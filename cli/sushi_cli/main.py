"""
sushi — CLI for the Sushi EDA platform.

Usage:
    sushi login             Store credentials
    sushi logout            Clear stored credentials
    sushi upload FILE       Upload a dataset and start analysis
    sushi datasets          List datasets in your org
    sushi status ID         Check analysis job status
    sushi report ID         Print analysis report
    sushi credits           Show AI credit usage
    sushi connectors        List saved data connectors
    sushi version           Print CLI version
"""
from __future__ import annotations

import sys
import time
from pathlib import Path

import click
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.table import Table
from rich import box

from sushi_cli import __version__
from sushi_cli import config as cfg

console = Console()
err_console = Console(stderr=True, style="bold red")


# ── CLI group ─────────────────────────────────────────────────────────────────

@click.group()
@click.version_option(__version__, prog_name="sushi")
def cli():
    """Sushi EDA — serve your raw data perfectly."""


# ── Auth ──────────────────────────────────────────────────────────────────────

@cli.command()
@click.option("--api-url", default=cfg.DEFAULT_API_URL, help="Sushi API base URL")
@click.option("--org-id", default="default", help="Clerk organisation ID")
def login(api_url: str, org_id: str):
    """Store your API credentials."""
    from sushi_cli import api

    api_key = click.prompt("API key", hide_input=True)
    # Validate the key by hitting /health
    try:
        cfg.save_config(api_url, org_id, api_key)
        health = api.health()
        console.print(f"[green]✓[/green] Connected to {api_url}  (status: {health.get('status', 'ok')})")
        console.print(f"[dim]Org: {org_id}[/dim]")
    except Exception as e:
        cfg.clear_config()
        err_console.print(f"Login failed: {e}")
        sys.exit(1)


@cli.command()
def logout():
    """Clear stored credentials."""
    cfg.clear_config()
    console.print("[green]✓[/green] Logged out.")


# ── Upload ────────────────────────────────────────────────────────────────────

@cli.command()
@click.argument("file", type=click.Path(exists=True, dir_okay=False, path_type=Path))
@click.option("--name", "-n", default=None, help="Display name for the dataset")
@click.option("--org-id", default=None, help="Organisation ID (overrides config)")
@click.option("--wait/--no-wait", default=True, help="Wait for analysis to complete")
def upload(file: Path, name: str | None, org_id: str | None, wait: bool):
    """Upload a dataset file and start EDA analysis."""
    from sushi_cli import api

    file_size_mb = file.stat().st_size / 1_048_576
    console.print(f"Uploading [bold]{file.name}[/bold] ({file_size_mb:.1f} MB)…")

    try:
        result = api.upload_dataset(file, name=name, org_id=org_id)
    except Exception as e:
        err_console.print(f"Upload failed: {e}")
        sys.exit(1)

    dataset_id = result["dataset_id"]
    console.print(f"[green]✓[/green] Queued  dataset_id=[bold]{dataset_id}[/bold]")

    if not wait:
        console.print(f"Run [bold]sushi status {dataset_id}[/bold] to check progress.")
        return

    # Poll for completion
    with Progress(SpinnerColumn(), TextColumn("[progress.description]{task.description}"), transient=True) as progress:
        task = progress.add_task("Analysing…", total=None)
        while True:
            time.sleep(3)
            try:
                status_data = api.get_job_status(dataset_id)
            except Exception:
                progress.update(task, description="Polling…")
                continue

            status = status_data.get("status", "unknown")
            stage  = status_data.get("stage", "")
            pct    = status_data.get("progress", "")

            label = f"{status}"
            if stage:
                label += f" · {stage}"
            if pct:
                label += f" ({pct}%)"
            progress.update(task, description=label)

            if status == "done":
                analysis_id = status_data.get("analysis_id", "")
                dur = status_data.get("duration_seconds", 0)
                console.print(
                    f"\n[green]✓[/green] Analysis complete in {dur:.1f}s  "
                    f"analysis_id=[bold]{analysis_id}[/bold]"
                )
                console.print(f"Run [bold]sushi report {dataset_id}[/bold] to view the report.")
                break
            elif status == "failed":
                err = status_data.get("error", "unknown error")
                err_console.print(f"\nAnalysis failed: {err}")
                sys.exit(1)


# ── Datasets ──────────────────────────────────────────────────────────────────

@cli.command()
@click.option("--org-id", default=None, help="Organisation ID")
def datasets(org_id: str | None):
    """List all datasets in your organisation."""
    from sushi_cli import api

    try:
        items = api.list_datasets(org_id=org_id)
    except Exception as e:
        err_console.print(str(e))
        sys.exit(1)

    if not items:
        console.print("[dim]No datasets found.[/dim]")
        return

    table = Table(box=box.SIMPLE_HEAD, show_header=True, header_style="bold")
    table.add_column("ID", style="dim", width=36)
    table.add_column("Name", min_width=20)
    table.add_column("Format", width=8)
    table.add_column("Rows", justify="right", width=8)
    table.add_column("Status", width=12)
    table.add_column("Created", width=20)

    STATUS_STYLE = {"ready": "green", "failed": "red", "pending": "yellow", "processing": "cyan"}

    for d in items:
        status = d.get("status", "?")
        style  = STATUS_STYLE.get(status, "")
        table.add_row(
            d.get("dataset_id", d.get("id", ""))[:36],
            d.get("name", "—"),
            d.get("file_format", "—"),
            str(d.get("row_count") or "—"),
            f"[{style}]{status}[/{style}]" if style else status,
            (d.get("created_at") or "")[:19],
        )

    console.print(table)


# ── Status ────────────────────────────────────────────────────────────────────

@cli.command()
@click.argument("dataset_id")
def status(dataset_id: str):
    """Check the analysis job status for a dataset."""
    from sushi_cli import api

    try:
        data = api.get_job_status(dataset_id)
    except Exception as e:
        err_console.print(str(e))
        sys.exit(1)

    status_val = data.get("status", "?")
    colors = {"done": "green", "failed": "red", "pending": "yellow", "processing": "cyan"}
    color  = colors.get(status_val, "white")
    console.print(f"Status:  [{color}]{status_val}[/{color}]")
    if data.get("stage"):
        console.print(f"Stage:   {data['stage']}")
    if data.get("progress"):
        console.print(f"Progress: {data['progress']}%")
    if data.get("analysis_id"):
        console.print(f"Analysis ID: [bold]{data['analysis_id']}[/bold]")
    if data.get("error"):
        console.print(f"[red]Error: {data['error']}[/red]")


# ── Report ────────────────────────────────────────────────────────────────────

@cli.command()
@click.argument("dataset_id")
@click.option("--org-id", default=None, help="Organisation ID")
@click.option("--json", "as_json", is_flag=True, help="Output raw JSON")
def report(dataset_id: str, org_id: str | None, as_json: bool):
    """Print the analysis report for a dataset."""
    from sushi_cli import api

    try:
        data = api.get_latest_analysis(dataset_id, org_id=org_id)
    except Exception as e:
        err_console.print(str(e))
        sys.exit(1)

    if as_json:
        import json
        console.print_json(json.dumps(data))
        return

    analysis = data.get("analysis", data)
    report_data = analysis.get("report", {})
    bi = report_data.get("basic_info", {})
    qs = report_data.get("quality_score", {})

    # Header
    console.rule(f"[bold]Dataset Report[/bold]")
    console.print(f"  Rows:     [bold]{bi.get('rows', '?'):,}[/bold]")
    console.print(f"  Columns:  [bold]{bi.get('columns', '?')}[/bold]")
    console.print(f"  Quality:  [bold]{qs.get('overall_score', '?')}[/bold] / 100  ({qs.get('grade', '?')})")
    console.print(f"  Duplicates: {bi.get('duplicate_rows', 0):,}")

    # AI Narrative
    narrative = analysis.get("ai_narrative") or report_data.get("ai_narrative")
    if narrative:
        console.rule("[dim]AI Narrative[/dim]")
        console.print(narrative)

    # Column summary table
    columns = report_data.get("column_analysis", [])
    if columns:
        console.rule("[dim]Columns[/dim]")
        tbl = Table(box=box.SIMPLE_HEAD, show_header=True, header_style="bold")
        tbl.add_column("Column", min_width=16)
        tbl.add_column("Type", width=10)
        tbl.add_column("Missing %", justify="right", width=10)
        tbl.add_column("Unique", justify="right", width=8)
        for c in columns[:20]:
            mp = c.get("missing_percent", 0)
            mp_style = "red" if mp > 30 else ("yellow" if mp > 5 else "")
            tbl.add_row(
                c["name"],
                c.get("dtype", "?"),
                f"[{mp_style}]{mp:.1f}%[/{mp_style}]" if mp_style else f"{mp:.1f}%",
                str(c.get("unique_count", "?")),
            )
        if len(columns) > 20:
            tbl.add_row(f"[dim]… {len(columns)-20} more columns[/dim]", "", "", "")
        console.print(tbl)


# ── Credits ───────────────────────────────────────────────────────────────────

@cli.command()
@click.option("--org-id", default=None, help="Organisation ID")
def credits(org_id: str | None):
    """Show AI credit usage for your organisation."""
    from sushi_cli import api

    try:
        data = api.get_credit_status(org_id=org_id)
    except Exception as e:
        err_console.print(str(e))
        sys.exit(1)

    used  = data.get("ai_credits_used", 0)
    limit = data.get("ai_credits_limit", 0)
    plan  = data.get("plan", "?")
    pct   = data.get("percent_used", 0)

    if limit == -1:
        bar = "[green]■■■■■■■■■■[/green] (unlimited)"
    else:
        filled = int(pct / 10)
        color  = "red" if pct > 90 else ("yellow" if pct > 60 else "green")
        bar = f"[{color}]{'■' * filled}[/{color}]{'□' * (10 - filled)} {pct:.0f}%"

    console.print(f"Plan:    [bold]{plan}[/bold]")
    console.print(f"Credits: {bar}")
    if limit != -1:
        console.print(f"         {used:,} / {limit:,} used")


# ── Connectors ────────────────────────────────────────────────────────────────

@cli.command()
@click.option("--org-id", default=None, help="Organisation ID")
def connectors(org_id: str | None):
    """List saved data connectors."""
    from sushi_cli import api

    try:
        items = api.list_connectors(org_id=org_id)
    except Exception as e:
        err_console.print(str(e))
        sys.exit(1)

    if not items:
        console.print("[dim]No connectors configured.[/dim]")
        return

    table = Table(box=box.SIMPLE_HEAD, show_header=True, header_style="bold")
    table.add_column("ID", style="dim", width=36)
    table.add_column("Name", min_width=16)
    table.add_column("Type", width=10)
    table.add_column("Last test", width=8)
    table.add_column("Tested at", width=20)

    for c in items:
        ok = c.get("last_test_ok")
        ok_label = "[green]✓ ok[/green]" if ok is True else ("[red]✗ fail[/red]" if ok is False else "[dim]—[/dim]")
        table.add_row(
            c.get("connector_id", "")[:36],
            c.get("name", "—"),
            c.get("connector_type", "—"),
            ok_label,
            (c.get("last_tested_at") or "—")[:19],
        )

    console.print(table)


# ── Version ───────────────────────────────────────────────────────────────────

@cli.command()
def version():
    """Print the CLI version."""
    from sushi_cli import api as _api
    console.print(f"sushi-cli [bold]{__version__}[/bold]")
    try:
        h = _api.health()
        console.print(f"API       [bold]{h.get('version', '?')}[/bold]  ({cfg.get_api_url()})")
    except Exception:
        console.print(f"API       [dim]unreachable[/dim]  ({cfg.get_api_url()})")
