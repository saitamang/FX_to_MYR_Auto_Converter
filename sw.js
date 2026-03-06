// sw.js (UPDATED)
// - Fetches online FX rates (no API key) from Frankfurter
// - Stores rates as "foreign -> MYR" so content.js can do amount * rate
// - Caches rates with TTL, refreshes on demand
// Source: https://api.frankfurter.app/latest?base=MYR&symbols=USD,EUR,...  (Frankfurter API) [2](https://frankfurter.dev/)[3](https://openpublicapis.com/api/frankfurter)

const FRANKFURTER_LATEST = "https://api.frankfurter.app/latest";
const RATES_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

const DEFAULT_SETTINGS = {
  enabledGlobal: false,      // default OFF
  siteEnabled: {},           // per-host overrides
  enabledCurrencies: ["USD", "EUR", "GBP", "JPY", "SGD", "AUD", "CNY", "HKD"],
  rates: {},                 // { USD: 4.7, ... } foreign->MYR
  rateUpdatedAt: 0,          // epoch ms
  rateSource: "frankfurter"  // informational
};

async function getSettings() {
  const { settings } = await chrome.storage.local.get(["settings"]);
  if (!settings) return structuredClone(DEFAULT_SETTINGS);

  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    rates: { ...(DEFAULT_SETTINGS.rates), ...(settings.rates || {}) },
    siteEnabled: { ...(settings.siteEnabled || {}) }
  };
}

async function saveSettings(next) {
  await chrome.storage.local.set({ settings: next });
  return next;
}

async function patchSettings(patch) {
  const current = await getSettings();
  const next = { ...current, ...patch };

  if (patch.siteEnabled) next.siteEnabled = { ...current.siteEnabled, ...patch.siteEnabled };
  if (patch.rates) next.rates = { ...current.rates, ...patch.rates };

  if (typeof patch.enabledCurrencies !== "undefined") {
    next.enabledCurrencies = Array.isArray(patch.enabledCurrencies) ? patch.enabledCurrencies : [];
  }
  if (typeof patch.enabledGlobal !== "undefined") {
    next.enabledGlobal = !!patch.enabledGlobal;
  }
  return saveSettings(next);
}

/**
 * Fetch latest rates with base=MYR, then invert to store foreign->MYR.
 * Frankfurter returns: 1 MYR = X USD/EUR/... so foreign->MYR = 1 / X.
 */
async function fetchRatesForeignToMYR(codes) {
  const uniq = [...new Set(codes)].filter(Boolean).map(c => c.toUpperCase());
  const symbols = uniq.filter(c => c !== "MYR"); // MYR is trivial
  if (!symbols.length) return { rates: { MYR: 1 }, date: null };

  const url = `${FRANKFURTER_LATEST}?base=MYR&symbols=${encodeURIComponent(symbols.join(","))}`;
  const resp = await fetch(url, { method: "GET" });
  if (!resp.ok) throw new Error(`Rate fetch failed: HTTP ${resp.status}`);
  const data = await resp.json(); // { base:"MYR", date:"YYYY-MM-DD", rates:{USD:0.21,...} }

  const out = { MYR: 1 };
  for (const code of symbols) {
    const v = data?.rates?.[code];
    // v is 1 MYR -> code; we want 1 code -> MYR
    if (typeof v === "number" && v > 0) {
      out[code] = 1 / v;
    }
  }

  return { rates: out, date: data?.date || null };
}

/**
 * Ensure we have fresh rates for the requested currencies.
 * Refresh if forced, missing, or older than TTL.
 */
async function ensureFreshRates(wanted, force = false) {
  const settings = await getSettings();
  const now = Date.now();

  const currencies = (Array.isArray(wanted) && wanted.length)
    ? wanted
    : (settings.enabledCurrencies || []);

  const haveAll = currencies.every(c => typeof settings.rates?.[c] === "number" && settings.rates[c] > 0);

  const stale = !settings.rateUpdatedAt || (now - settings.rateUpdatedAt) > RATES_TTL_MS;

  if (!force && haveAll && !stale) {
    return settings; // good enough
  }

  // Try fetching online. If it fails, keep existing rates.
  try {
    const { rates, date } = await fetchRatesForeignToMYR(currencies);
    const mergedRates = { ...settings.rates, ...rates };

    const next = await patchSettings({
      rates: mergedRates,
      rateUpdatedAt: now,
      rateSource: `frankfurter${date ? `:${date}` : ""}`
    });

    return next;
  } catch (e) {
    // Keep old rates if any; just return current settings
    return settings;
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.local.get(["settings"]);
  if (!existing.settings) {
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
  }
  // Optional: attempt initial warm-up fetch (won't break if offline)
  await ensureFreshRates(DEFAULT_SETTINGS.enabledCurrencies, false);
});

// Message passing (popup/content -> SW)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (!msg?.type) return sendResponse({ error: "missing type" });

    if (msg.type === "GET_SETTINGS") {
      const settings = await getSettings();
      return sendResponse({ settings });
    }

    if (msg.type === "SET_GLOBAL_ENABLED") {
      const settings = await patchSettings({ enabledGlobal: !!msg.enabled });
      return sendResponse({ settings });
    }

    if (msg.type === "SET_SITE_ENABLED") {
      const host = msg.hostname;
      if (!host) return sendResponse({ error: "missing hostname" });
      const settings = await patchSettings({ siteEnabled: { [host]: !!msg.enabled } });
      return sendResponse({ settings });
    }

    if (msg.type === "SET_ENABLED_CURRENCIES") {
      const settings = await patchSettings({ enabledCurrencies: msg.enabledCurrencies || [] });
      // Optionally refresh after changing list (best-effort)
      await ensureFreshRates(settings.enabledCurrencies, false);
      return sendResponse({ settings });
    }

    // (Kept for manual overrides/testing)
    if (msg.type === "SET_RATE") {
      const code = (msg.code || "").toUpperCase();
      const rate = msg.rate;
      if (!code || typeof rate !== "number") return sendResponse({ error: "bad input" });
      const settings = await patchSettings({
        rates: { [code]: rate },
        rateUpdatedAt: Date.now(),
        rateSource: "manual"
      });
      return sendResponse({ settings });
    }

    // Fetch + return rates for given currencies (auto-refresh if stale)
    if (msg.type === "GET_RATES") {
      const settings = await ensureFreshRates(msg.currencies || null, false);
      const wanted = msg.currencies || settings.enabledCurrencies;
      const out = {};
      for (const c of wanted) out[c] = settings.rates?.[c];
      return sendResponse({ rates: out, rateUpdatedAt: settings.rateUpdatedAt, rateSource: settings.rateSource });
    }

    // Force refresh now (popup button)
    if (msg.type === "REFRESH_RATES") {
      const settings = await ensureFreshRates(msg.currencies || null, true);
      return sendResponse({
        rates: settings.rates,
        rateUpdatedAt: settings.rateUpdatedAt,
        rateSource: settings.rateSource
      });
    }

    return sendResponse({ error: "unknown type" });
  })();

  return true; // keep channel open for async response
});