// رندر داشبورد: کارت‌های خلاصه، نمودار دسته‌بندی، آخرین تراکنش‌ها

let categoryChartInstance = null;

const CHART_COLORS = [
  '#2f6fed', '#1a9c6b', '#d9455f', '#b1740f', '#6c4fd1',
  '#0891b2', '#c2410c', '#65a30d', '#be185d', '#4338ca',
];

function renderDashboard(monthKey) {
  const summary = Transactions.summaryForMonth(monthKey);

  document.getElementById('statIncome').textContent = formatCurrency(summary.income);
  document.getElementById('statExpense').textContent = formatCurrency(summary.expense);
  document.getElementById('statBalance').textContent = formatCurrency(summary.balance);

  const activeInstallmentsTotal = Installments.active()
    .reduce((s, i) => s + i.monthlyAmount, 0);
  document.getElementById('statInstallments').textContent = formatCurrency(activeInstallmentsTotal);

  const recurringThisMonth = Transactions.forMonth(monthKey)
    .filter((t) => t.source === 'recurring')
    .reduce((s, t) => s + t.amount, 0);
  document.getElementById('statRecurring').textContent = formatCurrency(recurringThisMonth);

  renderCategoryChart(monthKey);
  renderRecentTransactions(monthKey);
}

function renderCategoryChart(monthKey) {
  const breakdown = Transactions.categoryBreakdownForMonth(monthKey);
  const codes = Object.keys(breakdown);
  const labels = codes.map(categoryLabel);
  const values = codes.map((c) => breakdown[c]);
  const canvas = document.getElementById('categoryChart');
  const emptyHint = document.getElementById('chartEmptyHint');

  if (categoryChartInstance) {
    categoryChartInstance.destroy();
    categoryChartInstance = null;
  }

  if (labels.length === 0) {
    canvas.hidden = true;
    emptyHint.hidden = false;
    return;
  }
  canvas.hidden = false;
  emptyHint.hidden = true;

  categoryChartInstance = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]),
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { family: 'Vazirmatn' }, padding: 14 },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.label}: ${formatCurrency(ctx.raw)}`,
          },
        },
      },
    },
  });
}

function renderRecentTransactions(monthKey) {
  const list = document.getElementById('recentTransactionsList');
  const items = Transactions.forMonth(monthKey).slice(0, 8);
  list.innerHTML = '';

  if (items.length === 0) {
    list.innerHTML = `<p class="empty-hint">${t('dashboard.txEmpty')}</p>`;
    return;
  }

  items.forEach((tx) => {
    const row = document.createElement('div');
    row.className = 'tx-row';
    row.innerHTML = `
      <div class="tx-info">
        <span class="tx-title">${escapeHtml(tx.title)}</span>
        <span class="tx-meta">${escapeHtml(categoryLabel(tx.category))} · ${formatDateDisplay(tx.date)}</span>
      </div>
      <div class="tx-amount ${tx.type}">${tx.type === 'income' ? '+' : '-'} ${formatCurrency(tx.amount)}</div>
    `;
    list.appendChild(row);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
