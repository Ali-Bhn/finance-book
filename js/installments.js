// منطق مربوط به مدیریت اقساط
// اصل طراحی: تنها یکی از «تعداد ماه» یا «مبلغ ماهانه» از کاربر گرفته می‌شود و دیگری محاسبه می‌شود،
// تا هرگز مقادیر ناسازگار (مثل ۸۰۰ باقی‌مانده، ۱۲ ماه، ۳۰ در ماه) ذخیره نشوند.
// منبع حقیقتِ پیشرفتِ قسط، «مبلغ باقی‌مانده» است؛ تعداد ماه‌های باقی‌مانده همیشه از روی آن تخمین زده می‌شود.

const Installments = {
  // dayOfMonth (اختیاری): روزی از ماه که قسط کم می‌شود؛ اگر خالی باشد، اولین باری که برنامه در آن ماه باز شود کم می‌شود.
  // paidThisMonth (اختیاری): اگر قسط این ماه قبلاً پرداخت شده، این ماه چیزی کم نمی‌شود و از ماه بعد شروع می‌شود.
  add({ title, totalAmount, mode, totalMonths, monthlyAmount, dayOfMonth = null, paidThisMonth = false }) {
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
      // اقساط جدید ماه‌هایی را که برنامه باز نشده جبران می‌کنند؛ اقساط قدیمی (بدون این فیلد) فقط ماه جاری را
      trackFrom: todayIso(),
      status: 'active',
      dayOfMonth: dayOfMonth ? Math.min(31, Math.max(1, Number(dayOfMonth))) : null,
      paidMonthKeys: [],
      skippedMonthKeys: paidThisMonth ? [currentMonthKey()] : [],
    };
    store.data.installments.push(installment);
    store.persist();
    this.syncOne(installment);
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
    if (inst.dayOfMonth === undefined) inst.dayOfMonth = null;
    if (!inst.skippedMonthKeys) inst.skippedMonthKeys = [];
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

  // برای یک ماه، اگر هنوز قسط آن ماه به‌عنوان تراکنش ثبت نشده، ثبتش می‌کند
  // و مبلغ آن را از باقی‌مانده کم می‌کند (آخرین قسط در صورت نیاز کوچک‌تر می‌شود تا دقیقاً صفر شود).
  chargeMonth(inst, monthKey) {
    this.normalize(inst);
    if (inst.status !== 'active') return false;
    if (inst.paidMonthKeys.includes(monthKey)) return false;
    if (inst.skippedMonthKeys.includes(monthKey)) return false;
    if (inst.remainingAmount <= 0) {
      inst.status = 'paid';
      store.persist();
      return false;
    }

    // اگر روز کسر مشخص شده، در ماه جاری تا رسیدن آن روز صبر می‌کنیم و تراکنش را با همان تاریخ ثبت می‌کنیم.
    // برای ماه‌های گذشته‌ای که برنامه باز نشده، بدون روز مشخص، هم‌روزِ تاریخ شروع استفاده می‌شود.
    const isCurrent = monthKey === currentMonthKey();
    let date = todayIso();
    if (inst.dayOfMonth) {
      const chargeDay = clampDayToMonth(inst.dayOfMonth, monthKey);
      if (isCurrent && todayDayOfMonth() < chargeDay) return false;
      date = isoFromMonthKeyDay(monthKey, chargeDay);
    } else if (!isCurrent) {
      date = isoFromMonthKeyDay(monthKey, clampDayToMonth(dayOfMonthOf(inst.startDate), monthKey));
    }

    const chargeAmount = Math.min(inst.monthlyAmount, inst.remainingAmount);
    Transactions.add({
      type: 'expense',
      title: `${t('category.installment')}: ${inst.title}`,
      amount: chargeAmount,
      date,
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

  // وضعیت این ماه برای نمایش: 'charged' | 'skipped' | 'upcoming' | 'none'
  monthStatus(inst) {
    const monthKey = currentMonthKey();
    if (inst.paidMonthKeys.includes(monthKey)) return 'charged';
    if (inst.skippedMonthKeys.includes(monthKey)) return 'skipped';
    if (inst.status === 'active' && inst.dayOfMonth) return 'upcoming';
    return 'none';
  },

  syncOne(inst) {
    const keys = inst.trackFrom ? monthKeysSince(inst.trackFrom) : [currentMonthKey()];
    keys.forEach((key) => this.chargeMonth(inst, key));
  },

  // در زمان بارگذاری برنامه، برای همه‌ی اقساط فعال بررسی می‌کند که ماه‌ها لحاظ شده باشند
  syncAllForCurrentMonth() {
    this.active().forEach((inst) => this.syncOne(inst));
  },
};
