
# FX → MYR Auto Converter (Browser Extension)

Automatically converts foreign currency amounts (USD, EUR, GBP, JPY, etc.) on web pages into **MYR (Malaysian Ringgit)** and displays the converted value inline.

✅ Uses **live exchange rates (online)**  
✅ No API key required  
✅ Works on **Chrome & Edge (Manifest V3)**  
✅ Lightweight, client-side only  

---

## ✨ Features

- 🔁 **Live FX rates** (fetched online, cached locally)
- 💱 Converts multiple currencies → **MYR**
- 🌐 Works on **any website**
- 🎯 Per‑site enable / disable
- ✅ Select which currencies to convert
- 🟨 MYR value highlighted inline (non-intrusive)
- 🔄 No duplicate conversions (DOM-safe)

---

## 🌍 Supported Currencies

- USD, EUR, GBP, JPY  
- SGD, AUD, CNY, HKD  
- THB, IDR, KRW, INR  
- CAD, CHF  

(More can be added easily.)

---

## 📸 How It Looks

Example on a webpage:

$199  (≈ MYR 935.30)

MYR value is highlighted for quick scanning.

---

## 🔧 How It Works (High Level)

1. **Content Script**
   - Scans visible text for currency patterns
   - Inserts MYR conversion inline
   - Uses MutationObserver to handle dynamic pages

2. **Service Worker**
   - Fetches latest FX rates online
   - Converts rates to `foreign → MYR`
   - Caches results (12‑hour TTL)
   - Stores settings in `chrome.storage`

3. **Popup UI**
   - Enable/disable globally or per‑site
   - Select currencies
   - Manually refresh FX rates

---

## 📦 Installation (Developer Mode)

### Chrome / Edge

1. Clone this repository:
   ```bash
   git clone https://github.com/yourname/fx-myr-auto-converter.git
   ```

2. Open extensions page:

Chrome: chrome://extensions
Edge: edge://extensions


3. Enable Developer mode


4. Click Load unpacked


5. Select the project folder

✅ Extension is now active.

## ⚙️ Usage

Click the FX → MYR extension icon
Enable the converter
Select currencies you want
Refresh the page
MYR values appear automatically

You can also:

Disable conversion on specific sites
Force refresh exchange rates anytime


## 🌐 Exchange Rate Source
Rates are fetched from Frankfurter API:

Free
No API key
CORS‑enabled
Updated daily
Based on institutional reference rates


Rates are cached locally and refreshed automatically.


## 🔒 Privacy & Security

✅ No tracking
✅ No analytics
✅ No data sent to third parties (except FX rates)
✅ Runs entirely in your browser


## 🛠️ Tech Stack

JavaScript (ES2022)
Chrome Extension Manifest V3
Service Worker background
MutationObserver (DOM‑safe)
chrome.storage.local


## 🚧 Limitations

FX rates are reference rates, not for trading
Conversion happens on visible text only
Pages rendered as images (e.g. PDFs) are not supported


## 📄 License
MIT License
Feel free to fork, modify, and share.

## 🤝 Contributing
PRs welcome for:

More currencies
UI improvements
Performance optimizations
Regex edge cases


## ⭐️ Star the Repo
If you find this useful, please ⭐️ the repo to help others find it!
