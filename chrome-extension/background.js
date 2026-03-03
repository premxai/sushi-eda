/**
 * Sushi EDA — service worker (background script).
 *
 * Handles:
 *  - Extension install: open onboarding page
 *  - Context menu: "Analyze with Sushi" on links to data files
 */

const DATA_EXTENSIONS = /\.(csv|tsv|parquet|json|jsonl|xlsx?|xls)(\?.*)?$/i;
const DEFAULT_API_URL = "https://api.sushi-eda.com";
const APP_URL = "https://app.sushi-eda.com";

// ── Install hook ───────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") {
    chrome.tabs.create({ url: `${APP_URL}?source=chrome_extension` });
  }

  // Register context menu for data file links
  chrome.contextMenus.create({
    id: "sushi-analyze-link",
    title: "Analyze with Sushi EDA",
    contexts: ["link"],
  });
});

// ── Context menu click ─────────────────────────────────────────────────────────

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "sushi-analyze-link") return;

  const linkUrl = info.linkUrl;
  if (!linkUrl || !DATA_EXTENSIONS.test(new URL(linkUrl).pathname)) {
    // Not a data file link — just open the dashboard
    chrome.tabs.create({ url: APP_URL });
    return;
  }

  const settings = await chrome.storage.sync.get(["apiUrl", "apiKey", "orgId"]);
  const apiUrl = settings.apiUrl || DEFAULT_API_URL;
  const apiKey = settings.apiKey || "";
  const orgId = settings.orgId || "default";

  try {
    // Fetch the file content
    const fileResp = await fetch(linkUrl);
    if (!fileResp.ok) throw new Error(`Fetch failed: ${fileResp.status}`);
    const blob = await fileResp.blob();

    const parts = new URL(linkUrl).pathname.split("/");
    const filename = parts[parts.length - 1] || "data.csv";

    const fd = new FormData();
    fd.append("file", blob, filename);

    const uploadResp = await fetch(`${apiUrl}/datasets/upload?org_id=${orgId}`, {
      method: "POST",
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      body: fd,
    });

    if (!uploadResp.ok) throw new Error(`Upload failed: ${uploadResp.status}`);
    const result = await uploadResp.json();

    // Navigate to the dataset in the dashboard
    const dashUrl = `${APP_URL.replace("api.", "")}/dashboard?dataset_id=${result.dataset_id}`;
    chrome.tabs.create({ url: dashUrl });
  } catch (e) {
    console.error("[Sushi EDA]", e.message);
    // Fall back to opening dashboard
    chrome.tabs.create({ url: APP_URL });
  }
});

// ── Message handler (from popup / content scripts) ─────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "PING") {
    sendResponse({ ok: true });
  }
  return true;
});
