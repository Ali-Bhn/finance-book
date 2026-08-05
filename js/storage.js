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
