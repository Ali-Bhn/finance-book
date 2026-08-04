// منطق مربوط به مدیریت اقساط
// اصل طراحی: تنها یکی از «تعداد ماه» یا «مبلغ ماهانه» از کاربر گرفته می‌شود و دیگری محاسبه می‌شود،
// تا هرگز مقادیر ناسازگار (مثل ۸۰۰ باقی‌مانده، ۱۲ ماه، ۳۰ در ماه) ذخیره نشوند.
// منبع حقیقتِ پیشرفتِ قسط، «مبلغ باقی‌مانده» است؛ تعداد ماه‌های باقی‌مانده همیشه از روی آن تخمین زده می‌شود.

const Installments = {
  add({ title, totalAmount, mode, totalMonths, monthlyAmount }) {
    const total = Number(totalAmount);
    const monthly = mode === 'amount'
      ? Number(monthlyAmount)
      : Math.round((total / Math.max(1, Number(totalMonths))) * 100) / 100;

    const installment = {
      id: generateId(),
      title,
      totalAmount: total,
      remainingAmount: total,
      monthlyAmount: monthly,
      startDate: todayIso(),
      status: 'active',
      paidMonthKeys: [],
    };
    store.data.installments.push(installment);
    store.persist();
    this.chargeCurrentMonth(installment);
    return installment;
  },

  remove(id) {
    store.data.installments = store.data.installments.filter((i) => i.id !== id);
    Transactions.removeByRef(id);
    store.persist();
  },

  // داده‌های نسخه‌ی قبلی برنامه (که فقط remainingMonths داشتند) را به مدل جدید تبدیل می‌کند
  normalize(inst) {
    if (inst.remainingAmount === undefined) {
      if (typeof inst.remainingMonths === 'number' && inst.monthlyAmount) {
        inst.remainingAmount = Math.round(inst.remainingMonths * inst.monthlyAmount * 100) / 100;
      } else {
        inst.remainingAmount = inst.totalAmount || 0;
      }
    }
    if (inst.totalAmount === undefined) inst.totalAmount = inst.remainingAmount;
    return inst;
  },

  all() {
    return store.data.installments.map((i) => this.normalize(i));
  },

  active() {
    return this.all().filter((i) => i.status === 'active');
  },

  byId(id) {
    return this.all().find((i) => i.id === id) || null;
  },

  // تخمین تعداد ماه‌های باقی‌مانده، همیشه از روی مبلغ باقی‌مانده و قسط ماهانه محاسبه می‌شود
  estimatedRemainingMonths(inst) {
    if (inst.remainingAmount <= 0 || !inst.monthlyAmount) return 0;
    return Math.ceil(inst.remainingAmount / inst.monthlyAmount);
  },

  // برای ماه جاری، اگر هنوز قسط این ماه به‌عنوان تراکنش ثبت نشده، ثبتش می‌کند
  // و مبلغ آن را از باقی‌مانده کم می‌کند (آخرین قسط در صورت نیاز کوچک‌تر می‌شود تا دقیقاً صفر شود).
  chargeCurrentMonth(inst) {
    const monthKey = currentMonthKey();
    this.normalize(inst);
    if (inst.status !== 'active') return false;
    if (inst.paidMonthKeys.includes(monthKey)) return false;
    if (inst.remainingAmount <= 0) {
      inst.status = 'paid';
      store.persist();
      return false;
    }

    const chargeAmount = Math.min(inst.monthlyAmount, inst.remainingAmount);
    Transactions.add({
      type: 'expense',
      title: `${t('category.installment')}: ${inst.title}`,
      amount: chargeAmount,
      date: todayIso(),
      category: 'installment',
      source: 'installment',
      refId: inst.id,
    });

    inst.paidMonthKeys.push(monthKey);
    inst.remainingAmount = Math.round((inst.remainingAmount - chargeAmount) * 100) / 100;
    if (inst.remainingAmount <= 0) {
      inst.status = 'paid';
    }
    store.persist();
    return true;
  },

  // در زمان بارگذاری برنامه، برای همه‌ی اقساط فعال بررسی می‌کند که ماه جاری لحاظ شده باشد
  syncAllForCurrentMonth() {
    this.active().forEach((inst) => this.chargeCurrentMonth(inst));
  },
};
