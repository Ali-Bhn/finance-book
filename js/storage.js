// لایه‌ی ذخیره‌سازی داده‌ها در localStorage
const STORAGE_KEY = 'finance_app_data_v1';
const COLLECTIONS = ['transactions', 'installments', 'recurring'];

const defaultData = () => ({
  transactions: [],   // { id, type: 'income'|'expense', title, amount, date: 'YYYY-MM-DD', category, source: 'manual'|'installment'|'recurring', refId, updatedAt }
  installments: [],   // { id, title, monthlyAmount, totalAmount, remainingAmount, startDate, status: 'active'|'paid', paidMonthKeys, skippedMonthKeys, updatedAt }
  recurring: [],      // { id, type, title, amount, dayOfMonth, category, active, generatedMonthKeys, updatedAt }
  deleted: {},        // { id: timestamp } — سوابق حذف، تا حذف در همگام‌سازی به دستگاه‌های دیگر هم برسد
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
      deleted: parsed.deleted || {},
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
  // امضای آخرین حالت ذخیره‌شده‌ی هر رکورد؛ برای تشخیص تغییر/حذف بدون نیاز به دست‌کاری همه‌ی توابع
  snapshot: null,

  persist() {
    this.stamp();
    saveData(this.data);
    if (typeof Sync !== 'undefined') Sync.onLocalChange();
  },

  signature(rec) {
    const { updatedAt, ...rest } = rec;
    return JSON.stringify(rest);
  },

  // رکوردهای جدید/تغییرکرده updatedAt می‌گیرند و رکوردهای حذف‌شده در deleted ثبت می‌شوند
  stamp() {
    const now = Date.now();
    const next = new Map();
    COLLECTIONS.forEach((coll) => {
      this.data[coll].forEach((rec) => {
        const key = `${coll}:${rec.id}`;
        const sig = this.signature(rec);
        // بدون مبنا (پیش از resetSnapshot) هیچ رکوردی را «تازه» فرض نمی‌کنیم
        if (this.snapshot && this.snapshot.get(key) !== sig) rec.updatedAt = now;
        next.set(key, sig);
      });
    });
    if (this.snapshot) {
      this.snapshot.forEach((_, key) => {
        if (!next.has(key)) this.data.deleted[key.slice(key.indexOf(':') + 1)] = now;
      });
    }
    this.snapshot = next;
  },

  // حالت فعلی را بدون زدن مهر زمان به‌عنوان مبنا ثبت می‌کند (بعد از بارگذاری یا ادغام)
  resetSnapshot() {
    this.snapshot = new Map();
    COLLECTIONS.forEach((coll) => {
      this.data[coll].forEach((rec) => this.snapshot.set(`${coll}:${rec.id}`, this.signature(rec)));
    });
  },

  // جایگزینی کامل داده‌ها (مثلاً بعد از ادغام با نسخه‌ی ابری)
  replace(data) {
    this.data = {
      transactions: data.transactions || [],
      installments: data.installments || [],
      recurring: data.recurring || [],
      deleted: data.deleted || {},
    };
    saveData(this.data);
  },
};
