// popup.js (UPDATED)
const ALL = ["USD","EUR","GBP","JPY","SGD","AUD","CNY","HKD","THB","IDR","KRW","INR","CAD","CHF"];

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function hostFromUrl(url) {
  try { return new URL(url).hostname; } catch { return ""; }
}

function showStatus(text) {
  document.getElementById("status").textContent = text;
}

function fmtTime(ts) {
  if (!ts) return "Never";
  try { return new Date(ts).toLocaleString(); } catch { return String(ts); }
}

function renderRateInfo(rateUpdatedAt, rateSource) {
  const el = document.getElementById("rateInfo");
  el.textContent = `Last update: ${fmtTime(rateUpdatedAt)}${rateSource ? ` • source: ${rateSource}` : ""}`;
}

function renderCurrencies(selected) {
  const box = document.getElementById("currencies");
  box.innerHTML = "";

  for (const code of ALL) {
    const id = `cur-${code}`;
    const label = document.createElement("label");
    label.className = "row";
    label.innerHTML = `<input id="${id}" type="checkbox" /> <span>${code}</span>`;
    box.appendChild(label);

    const cb = label.querySelector("input");
    cb.checked = selected.includes(code);

    cb.addEventListener("change", async () => {
      const enabledCurrencies = ALL.filter(c => document.getElementById(`cur-${c}`).checked);
      const res = await chrome.runtime.sendMessage({ type: "SET_ENABLED_CURRENCIES", enabledCurrencies });
      showStatus(`Currencies saved (${res.settings.enabledCurrencies.length}).`);
      // update rate info (best-effort)
      const r = await chrome.runtime.sendMessage({ type: "GET_RATES", currencies: res.settings.enabledCurrencies });
      renderRateInfo(r.rateUpdatedAt, r.rateSource);
    });
  }
}

(async function init() {
  const tab = await getActiveTab();
  const host = hostFromUrl(tab?.url || "");
  document.getElementById("siteHost").textContent = host || "(unknown)";

  const res = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" });
  const settings = res.settings;

  // Global toggle
  const globalCb = document.getElementById("globalEnabled");
  globalCb.checked = !!settings.enabledGlobal;
  globalCb.addEventListener("change", async () => {
    const enabled = globalCb.checked;
    const saved = await chrome.runtime.sendMessage({ type: "SET_GLOBAL_ENABLED", enabled });
    showStatus(`Global: ${saved.settings.enabledGlobal ? "ON" : "OFF"} — refreshing...`);
    if (tab?.id) await chrome.tabs.reload(tab.id);
  });

  // Site toggle (default ON unless explicitly set)
  const siteCb = document.getElementById("siteEnabled");
  const siteMap = settings.siteEnabled || {};
  const currentSiteEnabled = (host && host in siteMap) ? !!siteMap[host] : true;
  siteCb.checked = currentSiteEnabled;
  siteCb.addEventListener("change", async () => {
    if (!host) return;
    const enabled = siteCb.checked;
    const saved = await chrome.runtime.sendMessage({ type: "SET_SITE_ENABLED", hostname: host, enabled });
    showStatus(`Site: ${host} = ${saved.settings.siteEnabled[host] ? "ON" : "OFF"} — refreshing...`);
    if (tab?.id) await chrome.tabs.reload(tab.id);
  });

  // Render currencies
  renderCurrencies(settings.enabledCurrencies || []);

  // Rate info + refresh button
  const r = await chrome.runtime.sendMessage({ type: "GET_RATES", currencies: settings.enabledCurrencies || [] });
  renderRateInfo(r.rateUpdatedAt, r.rateSource);

  document.getElementById("refreshRates").addEventListener("click", async () => {
    showStatus("Updating rates…");
    const rr = await chrome.runtime.sendMessage({ type: "REFRESH_RATES", currencies: settings.enabledCurrencies || [] });
    renderRateInfo(rr.rateUpdatedAt, rr.rateSource);
    showStatus("Rates updated. Refresh the page to apply if needed.");
  });

  showStatus(settings.enabledGlobal ? "Enabled (refresh to apply)" : "Disabled (turn on to start)");
})();