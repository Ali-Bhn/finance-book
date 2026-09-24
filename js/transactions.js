// منطق مربوط به تراکنش‌های درآمد/هزینه

const Transactions = {
  add({ id = null, type, title, amount, date, category, source = 'manual', refId = null }) {
    const tx = {
      id: id || generateId(),
      type,
      title,
      amount: Number(amount),
      date,
      category: category || '',
      source,
      refId,
    };
    const existing = store.data.transactions.find((t) => t.id === tx.id);
    if (existing) return existing;
    store.data.transactions.push(tx);
    store.persist();
    return tx;
  },

  update(id, changes) {
    const tx = store.data.transactions.find((t) => t.id === id);
    if (!tx) return null;
    Object.assign(tx, changes);
    store.persist();
    return tx;
  },

  remove(id) {
    store.data.transactions = store.data.transactions.filter((t) => t.id !== id);
    store.persist();
  },

  removeByRef(refId) {
    store.data.transactions = store.data.transactions.filter((t) => t.refId !== refId);
    store.persist();
  },

  all() {
    return store.data.transactions.slice().sort((a, b) => b.date.localeCompare(a.date));
  },

  forMonth(monthKey) {
    return this.all().filter((t) => monthKeyOf(t.date) === monthKey);
  },

  availableMonthKeys() {
    const keys = new Set(store.data.transactions.map((t) => monthKeyOf(t.date)));
    keys.add(currentMonthKey());
    return Array.from(keys).sort().reverse();
  },

  summaryForMonth(monthKey) {
    const items = this.forMonth(monthKey);
    const income = items.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = items.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return { income, expense, balance: income - expense, items };
  },

  // نسخه‌های قبلی، تراکنش‌های تکرارشونده را در حالت تقویم شمسی با تاریخ شمسی (مثلاً 1403-07-05)
  // در فیلدی ذخیره می‌کردند که باید میلادی باشد. این تابع یک بار آن تاریخ‌ها را به میلادی تبدیل می‌کند.
  repairJalaliDates() {
    let changed = false;
    store.data.transactions.forEach((tx) => {
      const [y, m, d] = tx.date.split('-').map(Number);
      if (y < 1700) {
        const g = toGregorian(y, m, d);
        tx.date = `${g.gy}-${String(g.gm).padStart(2, '0')}-${String(g.gd).padStart(2, '0')}`;
        changed = true;
      }
    });
    if (changed) store.persist();
  },

  categoryBreakdownForMonth(monthKey) {
    const items = this.forMonth(monthKey).filter((t) => t.type === 'expense');
    const map = {};
    items.forEach((t) => {
      const cat = t.category || 'misc';
      map[cat] = (map[cat] || 0) + t.amount;
    });
    return map;
  },
};
