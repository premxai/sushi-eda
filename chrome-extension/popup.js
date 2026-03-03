/**
 * Sushi EDA — Chrome extension popup script.
 *
 * Communicates with the content script to enumerate tables and CSV links
 * on the current page, then uploads selected data to the Sushi API.
 */

const DEFAULT_API_URL = "https://api.sushi-eda.com";

// ── DOM refs ──────────────────────────────────────────────────────────────────

const mainPanel = document.getElementById("main-panel");
const settingsPanel = document.getElementById("settings-panel");
const toggleSettings = document.getElementById("toggle-settings");
const tableList = document.getElementById("table-list");
const csvList = document.getElementById("csv-list");
const statusBar = document.getElementById("status-bar");
const apiUrlInput = document.getElementById("api-url-input");
const apiKeyInput = document.getElementById("api-key-input");
const orgIdInput = document.getElementById("org-id-input");
const saveSettingsBtn = document.getElementById("save-settings");
const settingsStatus = document.getElementById("settings-status");

// ── Settings ──────────────────────────────────────────────────────────────────

async function loadSettings() {
  const s = await chrome.storage.sync.get(["apiUrl", "apiKey", "orgId"]);
  apiUrlInput.value = s.apiUrl || DEFAULT_API_URL;
  apiKeyInput.value = s.apiKey || "";
  orgIdInput.value = s.orgId || "default";
  return s;
}

saveSettingsBtn.addEventListener("click", async () => {
  const apiUrl = apiUrlInput.value.trim() || DEFAULT_API_URL;
  const apiKey = apiKeyInput.value.trim();
  const orgId = orgIdInput.value.trim() || "default";
  await chrome.storage.sync.set({ apiUrl, apiKey, orgId });
  settingsStatus.textContent = "✓ Saved";
  settingsStatus.className = "status success";
  setTimeout(() => { settingsStatus.textContent = ""; }, 2000);
});

toggleSettings.addEventListener("click", () => {
  const isSettings = !settingsPanel.classList.contains("hidden");
  settingsPanel.classList.toggle("hidden", isSettings);
  mainPanel.classList.toggle("hidden", !isSettings);
  toggleSettings.textContent = isSettings ? "⚙ Settings" : "← Back";
});

// ── API upload ────────────────────────────────────────────────────────────────

function setStatus(msg, type = "") {
  statusBar.textContent = msg;
  statusBar.className = `status ${type}`;
}

async function uploadCsv(csvContent, filename, settings) {
  const { apiUrl = DEFAULT_API_URL, apiKey = "", orgId = "default" } = settings;
  const blob = new Blob([csvContent], { type: "text/csv" });
  const fd = new FormData();
  fd.append("file", blob, filename);

  const resp = await fetch(`${apiUrl}/datasets/upload?org_id=${orgId}`, {
    method: "POST",
    headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    body: fd,
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Upload failed (${resp.status}): ${err}`);
  }
  return resp.json();
}

async function fetchAndUpload(url, filename, settings) {
  setStatus("Downloading…", "loading");
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Could not fetch ${url} (${resp.status})`);
  const text = await resp.text();
  setStatus("Uploading to Sushi…", "loading");
  return uploadCsv(text, filename, settings);
}

function openDashboard(result, apiUrl) {
  const base = apiUrl.replace(/\/api$/, "").replace("api.", "") || "https://app.sushi-eda.com";
  const url = `${base}/dashboard?dataset_id=${result.dataset_id}`;
  chrome.tabs.create({ url });
}

// ── Table → CSV conversion ────────────────────────────────────────────────────

function tableToRows(htmlTable) {
  const rows = [];
  for (const tr of htmlTable.querySelectorAll("tr")) {
    const cells = [];
    for (const cell of tr.querySelectorAll("th, td")) {
      // Escape quotes and wrap in quotes if needed
      const text = cell.innerText.replace(/"/g, '""');
      cells.push(text.includes(",") || text.includes("\n") ? `"${text}"` : text);
    }
    if (cells.length) rows.push(cells.join(","));
  }
  return rows.join("\n");
}

// ── Render helpers ────────────────────────────────────────────────────────────

function renderTableItem(info, index, settings) {
  const item = document.createElement("div");
  item.className = "table-item";
  item.innerHTML = `
    <span class="table-item-icon">📋</span>
    <div class="table-item-info">
      <div class="table-item-name">Table ${index + 1}</div>
      <div class="table-item-meta">${info.rows} rows × ${info.cols} cols${info.caption ? " — " + info.caption : ""}</div>
    </div>
    <button class="table-item-btn">Analyze →</button>
  `;
  item.querySelector("button").addEventListener("click", async () => {
    try {
      setStatus("Extracting table…", "loading");
      // Ask content script for the actual CSV of this table
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const [{ result: csv }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (idx) => {
          const tables = document.querySelectorAll("table");
          if (!tables[idx]) return null;
          const rows = [];
          for (const tr of tables[idx].querySelectorAll("tr")) {
            const cells = [];
            for (const cell of tr.querySelectorAll("th, td")) {
              const text = cell.innerText.replace(/"/g, '""');
              cells.push(text.includes(",") || text.includes("\n") ? `"${text}"` : text);
            }
            if (cells.length) rows.push(cells.join(","));
          }
          return rows.join("\n");
        },
        args: [index],
      });

      if (!csv) { setStatus("Could not extract table.", "error"); return; }

      const result = await uploadCsv(csv, `table_${index + 1}.csv`, settings);
      setStatus(`✓ Queued! dataset_id: ${result.dataset_id}`, "success");
      setTimeout(() => openDashboard(result, settings.apiUrl || DEFAULT_API_URL), 1000);
    } catch (e) {
      setStatus(`Error: ${e.message}`, "error");
    }
  });
  return item;
}

function renderCsvLink(link, settings) {
  const item = document.createElement("div");
  item.className = "csv-link";
  item.innerHTML = `
    <span class="csv-link-icon">📄</span>
    <span class="csv-link-name" title="${link.href}">${link.text || link.filename}</span>
    <button class="csv-link-btn">Analyze →</button>
  `;
  item.querySelector("button").addEventListener("click", async () => {
    try {
      const result = await fetchAndUpload(link.href, link.filename, settings);
      setStatus(`✓ Queued! dataset_id: ${result.dataset_id}`, "success");
      setTimeout(() => openDashboard(result, settings.apiUrl || DEFAULT_API_URL), 1000);
    } catch (e) {
      setStatus(`Error: ${e.message}`, "error");
    }
  });
  return item;
}

// ── Init ──────────────────────────────────────────────────────────────────────

(async function init() {
  const settings = await loadSettings();

  // Ask the content script what's on the page
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  let pageData;
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.__sushiPageData__ || null,
    });
    pageData = result;
  } catch {
    tableList.innerHTML = '<div class="empty">Cannot access this page.</div>';
    csvList.innerHTML = "";
    return;
  }

  // If content script hasn't run yet, inject it
  if (!pageData) {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content.js"],
    });
    // Give it a moment to scan
    await new Promise((r) => setTimeout(r, 300));
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.__sushiPageData__ || null,
    });
    pageData = result;
  }

  // ── Tables ──
  tableList.innerHTML = "";
  if (pageData?.tables?.length) {
    for (let i = 0; i < pageData.tables.length; i++) {
      tableList.appendChild(renderTableItem(pageData.tables[i], i, settings));
    }
  } else {
    tableList.innerHTML = '<div class="empty">No tables found on this page.</div>';
  }

  // ── CSV links ──
  csvList.innerHTML = "";
  if (pageData?.csvLinks?.length) {
    for (const link of pageData.csvLinks) {
      csvList.appendChild(renderCsvLink(link, settings));
    }
  } else {
    csvList.innerHTML = '<div class="empty">No data file links found.</div>';
  }
})();
