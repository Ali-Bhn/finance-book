// رندر صفحه‌ی خانه: مانده‌ی ماه، موارد ثابت ماهانه، آخرین تراکنش‌ها و نمودار

let categoryChartInstance = null;

const CHART_COLORS = [
  '#4f46e5', '#10b981', '#f43f5e', '#f59e0b', '#8b5cf6',
  '#06b6d4', '#ea580c', '#84cc16', '#ec4899', '#64748b',
];

function renderDashboard(monthKey) {
  const summary = Transactions.summaryForMonth(monthKey);

  document.getElementById('statIncome').textContent = formatCurrency(summary.income);
  document.getElementById('statExpense').textContent = formatCurrency(summary.expense);
  const balanceEl = document.getElementById('statBalance');
  balanceEl.textContent = formatCurrency(summary.balance);
  balanceEl.classList.toggle('negative', summary.balance < 0);

  const installmentsTotal = Installments.active().reduce((s, i) => s + i.monthlyAmount, 0);
  document.getElementById('statFixedIncome').textContent = formatCurrency(Recurring.monthlyTotal('income'));
  document.getElementById('statFixedExpense').textContent = formatCurrency(Recurring.monthlyTotal('expense'));
  document.getElementById('statInstallments').textContent = formatCurrency(installmentsTotal);

  renderCategoryChart(monthKey);
  renderTxList(document.getElementById('recentTransactionsList'), Transactions.forMonth(monthKey).slice(0, 6), false);
}

function renderCategoryChart(monthKey) {
  const breakdown = Transactions.categoryBreakdownForMonth(monthKey);
  const codes = Object.keys(breakdown).sort((a, b) => breakdown[b] - breakdown[a]);
  const labels = codes.map((c) => `${categoryIcon(c)} ${categoryLabel(c)}`);
  const values = codes.map((c) => breakdown[c]);
  const canvas = document.getElementById('categoryChart');
  const emptyHint = document.getElementById('chartEmptyHint');

  if (categoryChartInstance) {
    categoryChartInstance.destroy();
    categoryChartInstance = null;
  }

  if (labels.length === 0 || typeof Chart === 'undefined') {
    canvas.parentElement.hidden = true;
    emptyHint.hidden = false;
    return;
  }
  canvas.parentElement.hidden = false;
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
      maintainAspectRatio: false,
      cutout: '68%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { font: { family: 'Vazirmatn' }, padding: 12, usePointStyle: true, boxWidth: 8 },
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

// لیست تراکنش‌ها به شکل کارت؛ در صفحه‌ی تراکنش‌ها دکمه‌ی حذف هم دارد
function renderTxList(container, items, withDelete) {
  container.innerHTML = '';

  if (items.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-emoji">🗂️</div>
        <p>${t('dashboard.txEmpty')}</p>
      </div>`;
    return;
  }

  items.forEach((tx) => {
    const row = document.createElement('div');
    row.className = 'tx-row';
    let tag = '';
    if (tx.source === 'recurring') tag = `<span class="tag">${t('tag.monthly')}</span>`;
    if (tx.source === 'installment') tag = `<span class="tag">${t('tag.installment')}</span>`;
    row.innerHTML = `
      <span class="tx-icon ${tx.type}">${categoryIcon(tx.category)}</span>
      <div class="tx-info">
        <span class="tx-title">${escapeHtml(tx.title)} ${tag}</span>
        <span class="tx-meta">${escapeHtml(categoryLabel(tx.category))} · ${formatDateDisplay(tx.date)}</span>
      </div>
      <div class="tx-amount ${tx.type}">${tx.type === 'income' ? '+' : '−'} ${formatCurrency(tx.amount)}</div>
      ${withDelete ? `<button class="row-delete-btn" data-tx-id="${tx.id}" title="${t('common.delete')}">✕</button>` : ''}
    `;
    container.appendChild(row);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
