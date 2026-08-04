# Finance Book — Personal Finance Manager

A single-page personal finance web app for tracking income, expenses, installments, and recurring monthly expenses. All data is stored only in your own browser (`localStorage`) — no server or backend required.

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
index.html          Main page skeleton and all modals/forms
css/style.css        Full stylesheet — responsive, RTL/LTR-aware
js/storage.js         localStorage persistence layer + Export/Import JSON
js/settings.js         User settings storage (language, currency, calendar type)
js/jalali.js            Gregorian <-> Jalali (Persian) calendar conversion
js/i18n.js               Translation dictionary (Persian/English/German) and translation helpers
js/utils.js            Date/currency/category helpers (settings-aware)
js/transactions.js     Transaction CRUD logic and monthly summary calculation
js/installments.js     Installment tracking logic (balance-based, not month-count-based)
js/recurring.js        Recurring expense logic and automatic monthly transaction generation
js/dashboard.js        Dashboard rendering and category breakdown chart (Chart.js)
js/reports.js          Monthly report rendering and PDF export
js/ui.js               Navigation, modals, forms, and list rendering
js/app.js              Main application bootstrap
```

## Features

- Record income/expense transactions with title, amount, date, and category
- Automatic monthly totals (income, expenses, balance) with the ability to switch between months
- **Installment tracking**: enter the total remaining amount, then choose either "I know the remaining months" or "I know the monthly amount" — whichever you don't know is calculated automatically, so the numbers can never be inconsistent. The remaining balance is decreased each month (the last payment is automatically shrunk to land exactly on zero), and installments are marked "paid off" once settled. Click any installment card to see a full detail view (total amount, remaining balance, amount paid, months paid, estimated months left, etc.).
- **Recurring expenses** (e.g. rent, subscriptions) that are automatically added as a transaction on the specified day of each month
- Dashboard with summary cards and a doughnut chart of expenses by category
- PDF export of any month's report
- Full backup/restore via JSON export/import
- **User settings** (⚙ icon in the top bar): language (Persian/English/German), currency (Toman, Rial, USD, EUR, GBP), and calendar system (Jalali or Gregorian) — every part of the app (text, amount formatting, dates, month names) updates accordingly
- Custom in-app confirmation modal for all delete actions (transactions, installments, recurring expenses) instead of the browser's native `confirm()` dialog — consistent styling and mobile-friendly
- Responsive layout: the top navigation collapses into a horizontally scrollable tab strip on narrow screens, and action button labels hide on small phones to save space

## Technical notes

- Libraries used (via CDN, no install needed): `Chart.js` for the chart, and `html2canvas` + `jsPDF` combined for PDF export.
- Why `html2canvas` + `jsPDF` instead of `jspdf-autotable`: jsPDF's default fonts don't support Persian/Arabic glyphs, and without embedding a custom font the text renders incorrectly. By screenshotting the HTML report table (which already renders Persian/RTL correctly) and placing that image into the PDF, the output is always accurate and readable regardless of language.
- All data is stored under the key `finance_app_data_v1` in the browser's `localStorage`; user settings are stored separately under `finance_app_settings_v1`. Clearing the browser's cache/site data will erase this data — use Export regularly to keep a backup.
- Transaction dates are always stored internally as Gregorian ISO dates. The calendar setting (Jalali/Gregorian) only affects display and where "month" boundaries fall for dashboards/reports and for auto-charging installments/recurring expenses. Switching the calendar setting mid-use may cause the current month's installment/recurring charge to be recalculated once more (or with a delay) — a minor, data-safe side effect.
