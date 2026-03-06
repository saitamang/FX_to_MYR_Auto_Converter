// content.js
// Inserts a highlighted MYR badge next to matched currency values.
// Fix: wrap original price + badge in one [data-fx2myr] container so it won't be processed again.

let SETTINGS = null;
let RATES = {};
let observer = null;
let scheduled = false;

const FX_MARK_ATTR = "data-fx2myr"; // marker for processed DOM

function getHostname() {
  try { return location.hostname; } catch { return ""; }
}

function isEnabledForThisSite() {
  if (!SETTINGS) return false;
  if (!SETTINGS.enabledGlobal) return false;

  const host = getHostname();
  const overrides = SETTINGS.siteEnabled || {};

  // default enabled unless overridden
  if (host && host in overrides) return !!overrides[host];
  return true;
}

function parseNumber(numStr) {
  const cleaned = (numStr || "").replace(/,/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function formatMYR(value) {
  return value.toLocaleString("en-MY", { style: "currency", currency: "MYR" });
}

function nodeIsOurs(node) {
  if (!node) return false;
  const el = node.nodeType === 1 ? node : node.parentElement;
  return !!el && (el.hasAttribute?.(FX_MARK_ATTR) || el.closest?.(`[${FX_MARK_ATTR}]`));
}

function makeMyrBadge(myrNumber) {
  const badge = document.createElement("span");
  badge.className = "fx2myr-badge";
  badge.setAttribute(FX_MARK_ATTR, "1");

  const open = document.createElement("span");
  open.className = "fx2myr-muted";
  open.setAttribute(FX_MARK_ATTR, "1");
  open.textContent = "(≈";

  const hi = document.createElement("span");
  hi.className = "fx2myr-highlight";
  hi.setAttribute(FX_MARK_ATTR, "1");
  hi.textContent = formatMYR(myrNumber);

  const close = document.createElement("span");
  close.className = "fx2myr-muted";
  close.setAttribute(FX_MARK_ATTR, "1");
  close.textContent = ")";

  badge.appendChild(document.createTextNode(" "));
  badge.appendChild(open);
  badge.appendChild(document.createTextNode(" "));
  badge.appendChild(hi);
  badge.appendChild(document.createTextNode(" "));
  badge.appendChild(close);

  return badge;
}

// ✅ KEY FIX: wrap original price + badge together and mark wrapper as processed
function makeWrappedPrice(originalText, myrNumber) {
  const wrap = document.createElement("span");
  wrap.setAttribute(FX_MARK_ATTR, "1");
  wrap.appendChild(document.createTextNode(originalText));
  wrap.appendChild(makeMyrBadge(myrNumber));
  return wrap;
}

/**
 * Currency regexes:
 * Captures numeric amount as group (1) so we can compute MYR.
 */
const CURRENCY_DEFS = {
  USD: [{ regex: /(?:USD\s*)?\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/g }],
  EUR: [
    { regex: /(?:EUR\s*)?€\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/g },
    { regex: /EUR\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/g }
  ],
  GBP: [
    { regex: /(?:GBP\s*)?£\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/g },
    { regex: /GBP\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/g }
  ],
  JPY: [
    { regex: /(?:JPY\s*)?¥\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+)/g },
    { regex: /JPY\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+)/g }
  ],
  SGD: [
    { regex: /SGD\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/g },
    { regex: /S\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/g }
  ],
  AUD: [
    { regex: /AUD\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/g },
    { regex: /A\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/g }
  ],
  CNY: [
    { regex: /(?:CNY\s*)?(?:CN¥)\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/g },
    { regex: /CNY\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/g },
    { regex: /RMB\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/g }
  ],
  HKD: [
    { regex: /HKD\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/g },
    { regex: /HK\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/g }
  ],
  THB: [{ regex: /(?:THB\s*)?฿\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/g }],
  IDR: [{ regex: /(?:IDR\s*)?Rp\.?\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/g }],
  KRW: [{ regex: /(?:KRW\s*)?₩\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+)/g }],
  INR: [{ regex: /(?:INR\s*)?₹\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/g }],
  CAD: [{ regex: /CAD\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/g }],
  CHF: [{ regex: /CHF\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/g }]
};

function buildEnabledPatterns() {
  const enabled = SETTINGS?.enabledCurrencies || [];
  const patterns = [];

  for (const code of enabled) {
    const rate = RATES[code];
    if (!rate) continue;

    const defs = CURRENCY_DEFS[code] || [];
    for (const def of defs) patterns.push({ code, rate, regex: def.regex });
  }
  return patterns;
}

function convertTextNodeOnce(textNode, patterns) {
  const text = textNode.nodeValue;
  if (!text) return;

  if (nodeIsOurs(textNode)) return;

  for (const p of patterns) {
    p.regex.lastIndex = 0;
    if (!p.regex.exec(text)) continue;

    const parent = textNode.parentNode;
    if (!parent) return;

    const frag = document.createDocumentFragment();
    let lastIndex = 0;

    p.regex.lastIndex = 0;
    let match;
    while ((match = p.regex.exec(text)) !== null) {
      const full = match[0];
      const amountStr = match[1];

      const start = match.index;
      const end = start + full.length;

      if (start > lastIndex) frag.appendChild(document.createTextNode(text.slice(lastIndex, start)));

      const n = parseNumber(amountStr);
      if (n !== null) {
        const myr = n * p.rate;
        frag.appendChild(makeWrappedPrice(full, myr)); // ✅ no duplicates ever
      } else {
        frag.appendChild(document.createTextNode(full));
      }

      lastIndex = end;
    }

    if (lastIndex < text.length) frag.appendChild(document.createTextNode(text.slice(lastIndex)));

    parent.replaceChild(frag, textNode);
    break; // stability: one pattern per node
  }
}

function walkAndConvert(root = document.body) {
  if (!root || !isEnabledForThisSite()) return;

  const patterns = buildEnabledPatterns();
  if (!patterns.length) return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const p = node.parentElement;
      if (!p) return NodeFilter.FILTER_REJECT;

      const tag = (p.tagName || "").toLowerCase();
      if (["script", "style", "noscript"].includes(tag)) return NodeFilter.FILTER_REJECT;
      if (p.isContentEditable) return NodeFilter.FILTER_REJECT;

      if (nodeIsOurs(node)) return NodeFilter.FILTER_REJECT;

      const v = node.nodeValue || "";
      if (!/[€£¥₹₩฿$]|USD|EUR|GBP|JPY|SGD|AUD|CNY|HKD|THB|IDR|KRW|INR|CAD|CHF|RMB|Rp/.test(v)) {
        return NodeFilter.FILTER_SKIP;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);

  // Avoid self-trigger loops: disconnect observer during DOM edits, then reconnect
  const wasObserving = !!observer;
  if (wasObserving) observer.disconnect(); // disconnect is standard MutationObserver control [2](https://chromewebstore.google.com/detail/modresponse-mock-and-repl/bbjcdpjihbfmkgikdkplcalfebgcjjpm)

  for (const tn of nodes) convertTextNodeOnce(tn, patterns);

  if (wasObserving) observer.observe(document.documentElement, { childList: true, subtree: true });
}

function scheduleConvert() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    walkAndConvert(document.body);
  });
}

function startObserver() {
  if (observer) return;
  observer = new MutationObserver(() => scheduleConvert());
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

function stopObserver() {
  if (observer) observer.disconnect();
  observer = null;
}

async function loadSettingsAndRates() {
  const res = await chrome.runtime.sendMessage({ type: "GET_SETTINGS" });
  SETTINGS = res?.settings || null;

  const ratesRes = await chrome.runtime.sendMessage({ type: "GET_RATES" });
  RATES = ratesRes?.rates || {};

  if (isEnabledForThisSite()) {
    startObserver();
    scheduleConvert();
  } else {
    stopObserver();
  }
}

// React to settings changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.settings) {
    SETTINGS = changes.settings.newValue;
    RATES = SETTINGS?.rates ? SETTINGS.rates : RATES;

    if (isEnabledForThisSite()) {
      startObserver();
      scheduleConvert();
    } else {
      stopObserver();
    }
  }
});

loadSettingsAndRates();