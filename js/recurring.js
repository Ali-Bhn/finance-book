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
      // موارد جدید ماه‌هایی را که برنامه باز نشده جبران می‌کنند
      trackFrom: todayIso(),
      generatedMonthKeys: [],
    };
    store.data.recurring.push(item);
    store.persist();
    this.syncOne(item);
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
    // بعد از فعال‌سازی دوباره فقط ماه جاری؛ ماه‌های غیرفعال نباید جبران شوند
    if (item.active) {
      item.trackFrom = todayIso();
      store.persist();
      this.generateForMonth(item, currentMonthKey());
    }
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

  // اگر روز مشخص‌شده‌ی آن ماه رسیده و هنوز تراکنش ساخته نشده، تراکنش را می‌سازد
  generateForMonth(item, monthKey) {
    this.normalize(item);
    if (!item.active) return false;
    if (item.generatedMonthKeys.includes(monthKey)) return false;

    const chargeDay = clampDayToMonth(item.dayOfMonth, monthKey);
    if (monthKey === currentMonthKey() && todayDayOfMonth() < chargeDay) return false;
    // در ماه شروع، روزهای قبل از تاریخ ثبت را ثبت نمی‌کنیم مگر اینکه همان ماه جاری باشد (رفتار قبلی)
    if (item.trackFrom && monthKey === monthKeyOf(item.trackFrom) && monthKey !== currentMonthKey()
      && chargeDay < dayOfMonthOf(item.trackFrom)) {
      item.generatedMonthKeys.push(monthKey);
      store.persist();
      return false;
    }

    Transactions.add({
      id: `rec-${item.id}-${monthKey}`,
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

  syncOne(item) {
    const keys = item.trackFrom ? monthKeysSince(item.trackFrom) : [currentMonthKey()];
    keys.forEach((key) => this.generateForMonth(item, key));
  },

  syncAllForCurrentMonth() {
    this.all().forEach((item) => this.syncOne(item));
  },
};
