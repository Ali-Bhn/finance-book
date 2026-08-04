// نقطه‌ی شروع برنامه: اتصال ماژول‌ها به یکدیگر

document.addEventListener('DOMContentLoaded', () => {
  applyStaticTranslations();

  // در ابتدای هر بار باز شدن برنامه، اقساط و هزینه‌های تکرارشونده‌ی ماه جاری را همگام می‌کند
  Installments.syncAllForCurrentMonth();
  Recurring.syncAllForCurrentMonth();

  initNav();
  initModalCloseHandlers();
  initConfirmModal();
  initTxForm();
  initInstallmentForm();
  initRecurringForm();
  initSettingsForm();
  initBackupHandlers();
  initReportHandlers();

  populateCategorySelects('expense');
  switchView('dashboard');
});
