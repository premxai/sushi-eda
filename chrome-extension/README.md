# Sushi EDA — Chrome Extension

Capture tables and CSV links from any web page and analyze them instantly with [Sushi EDA](https://sushi-eda.com).

## Features

- Detects HTML `<table>` elements on the current page — click **Analyze →** to send them to Sushi
- Detects links to CSV, TSV, Parquet, JSON, and Excel files — one click to download + analyze
- Right-click any data file link → **Analyze with Sushi EDA**
- Configurable API URL, API key, and org ID (via the ⚙ Settings panel)

## Development setup

1. Clone this repo and open `chrome://extensions` in Chrome
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** and select the `chrome-extension/` directory
4. Click the Sushi 🍣 icon in the toolbar to open the popup

> **Icons**: The `icons/` directory is referenced in `manifest.json`.
> Generate placeholder icons or copy your own PNGs named `icon16.png`, `icon32.png`, `icon48.png`, `icon128.png`.

## Configuration

Open the popup and click **⚙ Settings**:

| Field | Default | Description |
|---|---|---|
| API URL | `https://api.sushi-eda.com` | Sushi backend URL |
| API Key | *(empty)* | Your `sushi login` API key |
| Org ID | `default` | Your Clerk organisation ID |

Settings are stored in `chrome.storage.sync` (synced across devices when signed into Chrome).

## Publishing

1. Run `zip -r sushi-eda.zip chrome-extension/ -x "*.DS_Store"`
2. Upload to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
3. Fill in store listing details and submit for review
