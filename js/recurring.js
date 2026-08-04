// منطق مربوط به هزینه‌های تکرارشونده‌ی ماهانه

const Recurring = {
  add({ title, amount, dayOfMonth, category }) {
    const item = {
      id: generateId(),
      title,
      amount: Number(amount),
      dayOfMonth: Math.min(28, Math.max(1, Number(dayOfMonth))),
      category: category || 'recurring',
      active: true,
      generatedMonthKeys: [],
    };
    store.data.recurring.push(item);
    store.persist();
    this.generateForCurrentMonth(item);
    return item;
  },

  update(id, changes) {
    const item = store.data.recurring.find((r) => r.id === id);
    if (!item) return null;
    Object.assign(item, changes);
    store.persist();
    return item;
  },

  remove(id) {
    store.data.recurring = store.data.recurring.filter((r) => r.id !== id);
    Transactions.removeByRef(id);
    store.persist();
  },

  toggleActive(id) {
    const item = store.data.recurring.find((r) => r.id === id);
    if (!item) return null;
    item.active = !item.active;
    store.persist();
    return item;
  },

  all() {
    return store.data.recurring.slice();
  },

  // اگر تاریخ امروز به روز مشخص‌شده رسیده و این ماه هنوز تراکنش تولید نشده، تراکنش را می‌سازد
  generateForCurrentMonth(item) {
    if (!item.active) return false;
    const monthKey = currentMonthKey();
    if (item.generatedMonthKeys.includes(monthKey)) return false;

    const today = new Date();
    const chargeDay = clampDayToMonth(item.dayOfMonth, monthKey);
    if (today.getDate() < chargeDay) return false;

    const date = `${monthKey}-${String(chargeDay).padStart(2, '0')}`;
    Transactions.add({
      type: 'expense',
      title: item.title,
      amount: item.amount,
      date,
      category: item.category,
      source: 'recurring',
      refId: item.id,
    });
    item.generatedMonthKeys.push(monthKey);
    store.persist();
    return true;
  },

  syncAllForCurrentMonth() {
    this.all().forEach((item) => this.generateForCurrentMonth(item));
  },
};
