// منطق مربوط به موارد ماهانه‌ی ثابت: هم درآمد (مثل حقوق) و هم هزینه (مثل اجاره)

const Recurring = {
  add({ type = 'expense', title, amount, dayOfMonth, category }) {
    const item = {
      id: generateId(),
      type,
      title,
      amount: Number(amount),
      dayOfMonth: Math.min(31, Math.max(1, Number(dayOfMonth) || 1)),
      category: category || (type === 'income' ? 'salary' : 'recurring'),
      active: true,
      generatedMonthKeys: [],
    };
    store.data.recurring.push(item);
    store.persist();
    this.generateForCurrentMonth(item);
    return item;
  },

  remove(id) {
    store.data.recurring = store.data.recurring.filter((r) => r.id !== id);
    Transactions.removeByRef(id);
    store.persist();
  },

  toggleActive(id) {
    const item = this.byId(id);
    if (!item) return null;
    item.active = !item.active;
    store.persist();
    if (item.active) this.generateForCurrentMonth(item);
    return item;
  },

  // داده‌های نسخه‌ی قبلی فقط هزینه بودند و فیلد type نداشتند
  normalize(item) {
    if (!item.type) item.type = 'expense';
    if (!item.generatedMonthKeys) item.generatedMonthKeys = [];
    return item;
  },

  all() {
    return store.data.recurring.map((r) => this.normalize(r));
  },

  byId(id) {
    return this.all().find((r) => r.id === id) || null;
  },

  byType(type) {
    return this.all().filter((r) => r.type === type);
  },

  // مجموع مبلغ موارد فعال یک نوع (درآمد یا هزینه) در هر ماه
  monthlyTotal(type) {
    return this.byType(type).filter((r) => r.active).reduce((s, r) => s + r.amount, 0);
  },

  isGeneratedThisMonth(item) {
    return item.generatedMonthKeys.includes(currentMonthKey());
  },

  // اگر امروز به روز مشخص‌شده رسیده و این ماه هنوز تراکنش ساخته نشده، تراکنش را می‌سازد
  generateForCurrentMonth(item) {
    this.normalize(item);
    if (!item.active) return false;
    const monthKey = currentMonthKey();
    if (item.generatedMonthKeys.includes(monthKey)) return false;

    const chargeDay = clampDayToMonth(item.dayOfMonth, monthKey);
    if (todayDayOfMonth() < chargeDay) return false;

    Transactions.add({
      type: item.type,
      title: item.title,
      amount: item.amount,
      date: isoFromMonthKeyDay(monthKey, chargeDay),
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
