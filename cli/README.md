# sushi-cli

Command-line interface for the [Sushi EDA](https://sushi-eda.com) platform.

## Installation

```bash
pip install sushi-cli
```

## Quick start

```bash
# Authenticate
sushi login

# Upload and analyze a dataset (waits for completion)
sushi upload sales_data.csv

# List all datasets in your org
sushi datasets

# View the report for a dataset
sushi report <dataset_id>

# Check AI credit usage
sushi credits
```

## Commands

| Command | Description |
|---|---|
| `sushi login` | Store API credentials (saved to keychain) |
| `sushi logout` | Clear stored credentials |
| `sushi upload FILE` | Upload a dataset and start analysis |
| `sushi datasets` | List all datasets in the org |
| `sushi status ID` | Check analysis job status |
| `sushi report ID` | Print analysis report (use `--json` for raw JSON) |
| `sushi credits` | Show AI credit usage |
| `sushi connectors` | List saved data connectors |
| `sushi version` | Print CLI + API version |

## Configuration

Credentials are stored in `~/.sushi/config.json` and the system keychain.

Override via environment variables:

```bash
export SUSHI_API_URL=https://api.sushi-eda.com
export SUSHI_API_KEY=your_api_key
export SUSHI_ORG_ID=your_org_id
```

## Supported file formats

CSV, TSV, Excel (.xlsx/.xls), Parquet, JSON, SQLite
