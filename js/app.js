// نقطه‌ی شروع برنامه: اتصال ماژول‌ها به یکدیگر

document.addEventListener('DOMContentLoaded', () => {
  applyStaticTranslations();

  // در ابتدای هر بار باز شدن برنامه، اقساط و هزینه‌های تکرارشونده‌ی ماه جاری را همگام می‌کند
  Transactions.repairJalaliDates();
  Installments.syncAllForCurrentMonth();
  Recurring.syncAllForCurrentMonth();

  initNav();
  initModalCloseHandlers();
  initConfirmModal();
  initTxForm();
  initSettingsForm();
  initReportHandlers();

  switchView('dashboard');

  // بار اول که کاربر وارد سایت می‌شود، از او می‌خواهیم زبان/واحد پول/تقویم را انتخاب کند
  if (Settings.isFirstVisit) {
    openSettingsModal();
  }
});

// ثبت Service Worker برای کارکرد آفلاین (PWA)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.error('ثبت Service Worker ناموفق بود:', err);
    });
  });
}
