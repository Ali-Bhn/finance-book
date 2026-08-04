// لایه‌ی ذخیره‌سازی داده‌ها در localStorage
const STORAGE_KEY = 'finance_app_data_v1';

const defaultData = () => ({
  transactions: [],   // { id, type: 'income'|'expense', title, amount, date: 'YYYY-MM-DD', category, source: 'manual'|'installment'|'recurring', refId }
  installments: [],   // { id, title, monthlyAmount, remainingMonths, totalMonths, totalAmount, startDate, status: 'active'|'paid', paidMonthKeys: ['YYYY-MM'] }
  recurring: [],      // { id, title, amount, dayOfMonth, category, active: true, generatedMonthKeys: ['YYYY-MM'] }
});

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData();
    const parsed = JSON.parse(raw);
    return {
      transactions: parsed.transactions || [],
      installments: parsed.installments || [],
      recurring: parsed.recurring || [],
    };
  } catch (e) {
    console.error('خطا در بارگذاری داده‌ها', e);
    return defaultData();
  }
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// وضعیت سراسری برنامه در حافظه، هماهنگ با localStorage
const store = {
  data: loadData(),
  persist() {
    saveData(this.data);
  },
};

function exportDataAsJson() {
  const blob = new Blob([JSON.stringify(store.data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const today = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `finance-backup-${today}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function importDataFromJson(file, onDone) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (!parsed || typeof parsed !== 'object') throw new Error('فرمت فایل نامعتبر است');
      store.data = {
        transactions: Array.isArray(parsed.transactions) ? parsed.transactions : [],
        installments: Array.isArray(parsed.installments) ? parsed.installments : [],
        recurring: Array.isArray(parsed.recurring) ? parsed.recurring : [],
      };
      store.persist();
      onDone(true);
    } catch (err) {
      console.error(err);
      onDone(false, err.message);
    }
  };
  reader.readAsText(file);
}
