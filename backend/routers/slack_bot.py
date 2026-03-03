"""
Slack bot integration for Sushi EDA.

Routes:
  POST /slack/events       — Slack Events API (url_verification + app_mention)
  POST /slack/commands     — Slack slash commands (/sushi)

Slash commands:
  /sushi help                  — show command list
  /sushi report <dataset_id>   — post analysis summary
  /sushi credits               — show AI credit usage for this org

Setup:
  1. Create a Slack app at api.slack.com
  2. Enable "Slash Commands": /sushi → https://your-api/slack/commands
  3. Enable "Event Subscriptions": Request URL → https://your-api/slack/events
       Subscribe to: app_mention
  4. Add OAuth scopes: commands, chat:write, app_mentions:read
  5. Set env vars:
       SLACK_SIGNING_SECRET  — from Basic Information → App Credentials
       SLACK_BOT_TOKEN       — Bot User OAuth Token (xoxb-...)
       SUSHI_API_URL         — internal URL of this backend
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import time
from typing import Any

import httpx
from fastapi import APIRouter, Form, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from loguru import logger

router = APIRouter(prefix="/slack", tags=["slack"])

_SIGNING_SECRET = os.getenv("SLACK_SIGNING_SECRET", "")
_BOT_TOKEN = os.getenv("SLACK_BOT_TOKEN", "")
_SUSHI_API_URL = os.getenv("SUSHI_API_URL", "http://localhost:8000")
_DATABASE_URL = os.getenv("DATABASE_URL", "")

_SLACK_API = "https://slack.com/api"
_TIMESTAMP_TOLERANCE_S = 300  # 5 minutes


# ── Signature verification ──────────────────────────────────────────────────


def _verify_slack_signature(body: bytes, timestamp: str, signature: str) -> bool:
    """Verify Slack's HMAC-SHA256 request signature."""
    if not _SIGNING_SECRET:
        logger.warning("SLACK_SIGNING_SECRET not set — skipping verification")
        return True

    try:
        ts = int(timestamp)
    except (ValueError, TypeError):
        return False

    if abs(time.time() - ts) > _TIMESTAMP_TOLERANCE_S:
        return False

    base = f"v0:{timestamp}:{body.decode('utf-8')}"
    expected = "v0=" + hmac.new(
        _SIGNING_SECRET.encode(),
        base.encode(),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature or "")


# ── Slack API helpers ───────────────────────────────────────────────────────


def _slack_post(method: str, payload: dict[str, Any]) -> dict[str, Any]:
    """POST to a Slack Web API method."""
    headers = {
        "Authorization": f"Bearer {_BOT_TOKEN}",
        "Content-Type": "application/json; charset=utf-8",
    }
    resp = httpx.post(f"{_SLACK_API}/{method}", json=payload, headers=headers, timeout=10)
    return resp.json()


def _reply(channel: str, text: str, blocks: list | None = None) -> None:
    """Post a message to a Slack channel."""
    payload: dict[str, Any] = {"channel": channel, "text": text}
    if blocks:
        payload["blocks"] = blocks
    result = _slack_post("chat.postMessage", payload)
    if not result.get("ok"):
        logger.warning(f"Slack postMessage failed: {result.get('error')}")


# ── Data helpers ────────────────────────────────────────────────────────────


def _get_latest_analysis(dataset_id: str, org_id: str = "default") -> dict | None:
    """Fetch the latest analysis from our own API."""
    try:
        resp = httpx.get(
            f"{_SUSHI_API_URL}/datasets/{dataset_id}/analysis",
            params={"org_id": org_id},
            timeout=10,
        )
        if resp.status_code == 200:
            return resp.json()
    except Exception as e:
        logger.warning(f"Failed to fetch analysis for {dataset_id}: {e}")
    return None


def _get_credit_status(org_id: str = "default") -> dict | None:
    """Fetch credit status from our own API."""
    try:
        resp = httpx.get(
            f"{_SUSHI_API_URL}/orgs/{org_id}/credits",
            timeout=10,
        )
        if resp.status_code == 200:
            return resp.json()
    except Exception as e:
        logger.warning(f"Failed to fetch credits: {e}")
    return None


# ── Report formatting ───────────────────────────────────────────────────────


def _format_report_blocks(dataset_id: str, data: dict) -> list[dict]:
    """Format an analysis result as Slack Block Kit blocks."""
    analysis = data.get("analysis", data)
    report = analysis.get("report", {})
    bi = report.get("basic_info", {})
    qs = report.get("quality_score", {})
    narrative = analysis.get("ai_narrative") or report.get("ai_narrative", "")

    rows = bi.get("rows", "?")
    cols = bi.get("columns", "?")
    score = qs.get("overall_score", "?")
    grade = qs.get("grade", "?")
    dups = bi.get("duplicate_rows", 0)

    # Color-coded quality emoji
    try:
        s = float(score)
        quality_emoji = "🟢" if s >= 80 else ("🟡" if s >= 60 else "🔴")
    except (ValueError, TypeError):
        quality_emoji = "⚪"

    blocks: list[dict] = [
        {
            "type": "header",
            "text": {"type": "plain_text", "text": f"📊 Dataset Report"},
        },
        {
            "type": "section",
            "fields": [
                {"type": "mrkdwn", "text": f"*Rows:*\n{rows:,}" if isinstance(rows, int) else f"*Rows:*\n{rows}"},
                {"type": "mrkdwn", "text": f"*Columns:*\n{cols}"},
                {"type": "mrkdwn", "text": f"*Quality:*\n{quality_emoji} {score}/100 ({grade})"},
                {"type": "mrkdwn", "text": f"*Duplicates:*\n{dups:,}" if isinstance(dups, int) else f"*Duplicates:*\n{dups}"},
            ],
        },
    ]

    if narrative:
        blocks.append({"type": "divider"})
        # Truncate long narratives for Slack (3000 char limit per block)
        snippet = narrative[:800] + ("…" if len(narrative) > 800 else "")
        blocks.append({
            "type": "section",
            "text": {"type": "mrkdwn", "text": f"*AI Summary*\n{snippet}"},
        })

    blocks.append({"type": "divider"})
    blocks.append({
        "type": "context",
        "elements": [
            {"type": "mrkdwn", "text": f"Dataset ID: `{dataset_id}`"},
        ],
    })
    return blocks


# ── Slash command handler ───────────────────────────────────────────────────


def _handle_command(text: str, channel_id: str, user_id: str, org_id: str) -> str:
    """
    Parse and dispatch a /sushi slash command.
    Returns an immediate response text (shown ephemerally).
    Longer responses are sent async via _reply().
    """
    parts = text.strip().split() if text.strip() else []
    sub = parts[0].lower() if parts else "help"

    if sub == "help" or sub == "":
        return (
            "*Sushi EDA — available commands:*\n"
            "• `/sushi help` — show this message\n"
            "• `/sushi report <dataset_id>` — post analysis summary\n"
            "• `/sushi credits` — show AI credit usage\n"
        )

    elif sub == "report":
        if len(parts) < 2:
            return "Usage: `/sushi report <dataset_id>`"

        dataset_id = parts[1]
        # Acknowledge immediately; fetch + reply async (within same request for simplicity)
        data = _get_latest_analysis(dataset_id, org_id)
        if data is None:
            return f"Could not fetch report for `{dataset_id}`. Check the dataset ID and try again."

        blocks = _format_report_blocks(dataset_id, data)
        _reply(channel_id, f"Dataset report for `{dataset_id}`", blocks=blocks)
        return ""  # Empty ephemeral reply — the channel post is the response

    elif sub == "credits":
        data = _get_credit_status(org_id)
        if data is None:
            return "Could not fetch credit status."

        used = data.get("ai_credits_used", 0)
        limit = data.get("ai_credits_limit", 0)
        plan = data.get("plan", "?")
        pct = data.get("percent_used", 0)

        if limit == -1:
            bar = "▓▓▓▓▓▓▓▓▓▓ unlimited"
        else:
            filled = int(pct / 10)
            bar = "▓" * filled + "░" * (10 - filled) + f" {pct:.0f}%"
            bar += f"  ({used:,}/{limit:,})"

        return f"*Sushi credits — {plan} plan*\n`{bar}`"

    else:
        return f"Unknown command `{sub}`. Type `/sushi help` for available commands."


# ── Routes ──────────────────────────────────────────────────────────────────


@router.post("/events")
async def slack_events(
    request: Request,
    x_slack_request_timestamp: str = Header(default=""),
    x_slack_signature: str = Header(default=""),
):
    """
    Slack Events API endpoint.
    Handles url_verification challenge and app_mention events.
    """
    body = await request.body()

    if not _verify_slack_signature(body, x_slack_request_timestamp, x_slack_signature):
        raise HTTPException(status_code=401, detail="Invalid Slack signature")

    payload = json.loads(body)

    # Respond to Slack's URL verification challenge
    if payload.get("type") == "url_verification":
        return {"challenge": payload["challenge"]}

    event = payload.get("event", {})
    event_type = event.get("type")

    if event_type == "app_mention":
        channel = event.get("channel", "")
        text: str = event.get("text", "")
        # Strip the bot mention (<@BOTID>) from the text
        mention_end = text.find(">")
        command_text = text[mention_end + 1:].strip() if mention_end >= 0 else text

        org_id = "default"
        response = _handle_command(command_text, channel, event.get("user", ""), org_id)
        if response:
            _reply(channel, response)

    return {"ok": True}


@router.post("/commands")
async def slack_commands(
    request: Request,
    x_slack_request_timestamp: str = Header(default=""),
    x_slack_signature: str = Header(default=""),
):
    """
    Slack slash command endpoint for /sushi.
    Returns an ephemeral immediate response; longer content is posted to the channel.
    """
    body = await request.body()

    if not _verify_slack_signature(body, x_slack_request_timestamp, x_slack_signature):
        raise HTTPException(status_code=401, detail="Invalid Slack signature")

    # Slack sends form-encoded data
    form = await request.form()
    text = str(form.get("text", ""))
    channel_id = str(form.get("channel_id", ""))
    user_id = str(form.get("user_id", ""))
    # Use team_domain as a rough org proxy until Clerk org-to-workspace mapping is set up
    org_id = str(form.get("team_id", "default"))

    response_text = _handle_command(text, channel_id, user_id, org_id)

    # Slack expects a 200 with response_type to ack slash commands
    if response_text:
        return JSONResponse({
            "response_type": "ephemeral",
            "text": response_text,
        })

    # If we already posted to channel (_reply), return empty 200
    return JSONResponse({"response_type": "ephemeral", "text": ""})
