// رندر بخش گزارش‌ها و خروجی PDF

function renderReport(monthKey) {
  const summary = Transactions.summaryForMonth(monthKey);

  document.getElementById('reportMonthTitle').textContent = `${t('reports.monthTitlePrefix')} ${monthKeyLabel(monthKey)}`;
  document.getElementById('reportSummary').innerHTML = `
    <span>${t('dashboard.statIncome')}: <b>${formatCurrency(summary.income)}</b></span>
    <span>${t('dashboard.statExpense')}: <b>${formatCurrency(summary.expense)}</b></span>
    <span>${t('dashboard.statBalance')}: <b>${formatCurrency(summary.balance)}</b></span>
  `;

  const tbody = document.getElementById('reportTbody');
  tbody.innerHTML = '';
  const items = summary.items.slice().sort((a, b) => a.date.localeCompare(b.date));

  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--text-muted); padding: 20px 0;">${t('transactions.empty')}</td></tr>`;
    return;
  }

  items.forEach((tx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(tx.title)}</td>
      <td>${escapeHtml(categoryLabel(tx.category))}</td>
      <td>${formatDateDisplay(tx.date)}</td>
      <td>${tx.type === 'income' ? t('common.income') : t('common.expense')}</td>
      <td class="amount-${tx.type}">${formatCurrency(tx.amount)}</td>
    `;
    tbody.appendChild(tr);
  });
}

async function downloadReportAsPdf(monthKey) {
  const reportPanel = document.getElementById('reportPanel');
  const btn = document.getElementById('downloadPdfBtn');
  const originalLabel = btn.textContent;
  btn.disabled = true;
  btn.textContent = t('reports.pdfBuilding');

  try {
    const canvas = await html2canvas(reportPanel, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
    });

    const imgData = canvas.toDataURL('image/png');
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth - 20;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 10;

    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
    heightLeft -= (pageHeight - 20);

    while (heightLeft > 0) {
      position = heightLeft - imgHeight + 10;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= (pageHeight - 20);
    }

    pdf.save(`report-${monthKey}.pdf`);
  } catch (err) {
    console.error(err);
    showToast(t('reports.pdfError'));
  } finally {
    btn.disabled = false;
    btn.textContent = originalLabel;
  }
}
