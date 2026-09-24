# Finance Book — Personal Finance Manager

A single-page personal finance web app for tracking income, expenses, installments, and fixed monthly income/expenses (salary, rent, subscriptions…). All data is stored only in your own browser (`localStorage`) — no server or backend required.

## Running the project

Since the project is built with plain HTML/CSS/JS, there's nothing to install or build. Just open `index.html` in a browser.

The recommended approach (to avoid potential browser restrictions on `file://`) is to serve it with a simple static server:

```bash
# with Node.js
npx serve .

# or with Python
python -m http.server 8080
```

Then open the address printed in the terminal (e.g. `http://localhost:8080`) in your browser.

## Project structure

```
index.html          Main page skeleton, the single "Add" form, and other modals
css/style.css        Full stylesheet — responsive, RTL/LTR-aware
js/storage.js         localStorage persistence layer
js/settings.js         User settings storage (language, currency, calendar type)
js/jalali.js            Gregorian <-> Jalali (Persian) calendar conversion
js/i18n.js               Translation dictionary (Persian/English/German) and translation helpers
js/utils.js            Date/currency/category helpers (settings-aware)
js/transactions.js     Transaction CRUD logic and monthly summary calculation
js/installments.js     Installment tracking logic (balance-based, not month-count-based)
js/recurring.js        Monthly (recurring) income & expense logic and automatic monthly transaction generation
js/dashboard.js        Home screen rendering, transaction list rendering, and category chart (Chart.js)
js/reports.js          Monthly report rendering and PDF export
js/ui.js               Navigation, modals, the Add form, and per-view rendering
js/app.js              Main application bootstrap + service worker registration
manifest.json        PWA manifest (name, icons, theme colors, display mode)
sw.js                 Service worker — caches the app shell for offline use
icons/                 App icons (192x192, 512x512, 180x180 for iOS)
CNAME                 Custom subdomain for GitHub Pages (see "Deploying" below)
```

## Features

- **One simple "Add" form** for everything: pick Expense or Income, then how often — *Once*, *Every month*, or *Installment* (expense only). Amount comes first, the title is optional, and categories are tappable icon chips.
- **Monthly income and expenses**: add things like salary, subsidy/pension, rent received, rent paid, internet or subscriptions once, and they're recorded automatically on the chosen day of every month. The "Monthly" tab lists monthly income and monthly expenses separately, each with an on/off switch, and shows how much is left over each month after fixed expenses and installments.
- Home screen with this month's balance, income and expenses, quick-add buttons, fixed monthly totals, recent transactions, and a category chart
- Mobile-first layout: bottom tab bar and bottom-sheet forms on phones, top navigation on larger screens
- **Installment tracking**: enter the total remaining amount, then choose either "I know the remaining months" or "I know the monthly amount" — whichever you don't know is calculated automatically, so the numbers can never be inconsistent. The remaining balance is decreased each month (the last payment is automatically shrunk to land exactly on zero), and installments are marked "paid off" once settled. Click any installment card to see a full detail view (total amount, remaining balance, amount paid, months paid, estimated months left, etc.).
- PDF export of any month's report
- **User settings** (⚙ icon in the top bar): language (Persian/English/German), currency (Toman, Rial, USD, EUR, GBP), and calendar system (Jalali or Gregorian) — every part of the app (text, amount formatting, dates, month names) updates accordingly
- Custom in-app confirmation modal for all delete actions (transactions, installments, recurring expenses) instead of the browser's native `confirm()` dialog — consistent styling and mobile-friendly

## Technical notes

- Libraries used (via CDN, no install needed): `Chart.js` for the chart, and `html2canvas` + `jsPDF` combined for PDF export.
- Why `html2canvas` + `jsPDF` instead of `jspdf-autotable`: jsPDF's default fonts don't support Persian/Arabic glyphs, and without embedding a custom font the text renders incorrectly. By screenshotting the HTML report table (which already renders Persian/RTL correctly) and placing that image into the PDF, the output is always accurate and readable regardless of language.
- All data is stored under the key `finance_app_data_v1` in the browser's `localStorage`; user settings are stored separately under `finance_app_settings_v1`. Clearing the browser's cache/site data will erase this data.
- Transaction dates are always stored internally as Gregorian ISO dates. The calendar setting (Jalali/Gregorian) only affects display and where "month" boundaries fall for dashboards/reports and for auto-charging installments/recurring expenses. Switching the calendar setting mid-use may cause the current month's installment/recurring charge to be recalculated once more (or with a delay) — a minor, data-safe side effect.

## Installing as an app (PWA)

The app is a installable Progressive Web App: it ships a `manifest.json` and a service worker (`sw.js`) that caches the app shell (HTML/CSS/JS/icons) so it keeps working without an internet connection after the first visit. **This only works when served over HTTPS (or `localhost`)** — service workers refuse to register on a plain `http://` origin, so it won't activate if you just double-click `index.html` (`file://`), only once it's actually deployed (e.g. via GitHub Pages) or run through a local dev server on `localhost`.

**On Android (Chrome):** open the site, then either tap the "Install app" banner if it appears, or open the ⋮ menu → **Install app** / **Add to Home screen**.

**On iPhone/iPad (Safari):** open the site, tap the **Share** button, then **Add to Home Screen**. (iOS doesn't support install banners — this manual step is the only way, which is why the `apple-touch-icon` and `apple-mobile-web-app-*` meta tags are included.)

**On desktop (Chrome/Edge):** an install icon (⊕) appears in the address bar; click it, or use the browser menu → **Install Finance Book...**.

### Verifying the PWA with Lighthouse

1. Deploy the site (or serve it locally over `http://localhost:8080`, e.g. with `python -m http.server 8080`) and open it in Chrome.
2. Open Chrome DevTools (`F12`) → **Lighthouse** tab.
3. Check the **Progressive Web App** category (and optionally Performance/Accessibility), device = Mobile, then click **Analyze page load**.
4. Under DevTools → **Application** tab:
   - **Manifest**: confirm the manifest is detected with no errors, name/icons render correctly, and there's an "Installability" section with no blocking issues.
   - **Service Workers**: confirm `sw.js` shows status "activated and is running".
   - **Cache Storage**: confirm a `finance-book-v1` cache exists and contains the app-shell files.
5. To confirm offline support: in the **Network** tab, switch throttling to **Offline**, then reload the page — the app shell should still load (chart/PDF export need connectivity for their CDN scripts on first load, but once those scripts are cached by the browser they'll typically keep working too).
6. If you update any precached file later, bump `CACHE_NAME` in `sw.js` (e.g. `finance-book-v2`) so returning visitors get the new version instead of a stale cached copy.

## Deploying to a subdomain via GitHub Pages

This repo includes a `CNAME` file pre-filled with `finance.bahadoran.de` (edit that file if you want a different subdomain). To publish it without conflicting with a portfolio already living at the root of `bahadoran.de` via GitHub Pages:

1. **DNS**: in your domain's DNS settings, add a `CNAME` record for the subdomain (e.g. `hesab`) pointing to `<your-github-username>.github.io`. (A separate GitHub Pages site — typically its own repository — can serve the root `bahadoran.de` independently; this subdomain is a distinct Pages deployment and won't interfere with it.)
2. **GitHub**: push this repository to GitHub, then in the repo's **Settings → Pages**, set the source branch (e.g. `master`/`main`) and save. GitHub Pages will read the `CNAME` file automatically and configure the custom domain; check "Enforce HTTPS" once the certificate is issued (may take a few minutes).
3. Wait for DNS to propagate (can take anywhere from minutes to a few hours), then visit `https://finance.bahadoran.de` — it should serve this app with a valid HTTPS certificate, which is also required for the PWA/service worker to activate.
4. Every file reference in the project (CSS, JS, icons, manifest) uses **relative paths**, so it works the same whether it's served at a domain root, a subdomain root, or a GitHub Pages project subpath — no changes needed for this deployment.
