// منطق رابط کاربری: ناوبری، مودال‌ها، فرم افزودن، رندر لیست‌ها

let selectedMonthKey = currentMonthKey();
let activeView = 'dashboard';
let txFilter = 'all';

// صفحه‌هایی که به ماه انتخاب‌شده وابسته‌اند (در بقیه، انتخاب ماه پنهان می‌شود)
const MONTH_VIEWS = ['dashboard', 'transactions', 'reports'];

// ---------- Toast ----------
let toastTimer = null;
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

// ---------- Navigation ----------
function switchView(view) {
  activeView = view;
  document.querySelectorAll('.view').forEach((el) => el.classList.add('hidden'));
  document.getElementById(`view-${view}`).classList.remove('hidden');
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  document.getElementById('monthSwitcher').classList.toggle('hidden', !MONTH_VIEWS.includes(view));
  window.scrollTo(0, 0);
  renderActiveView();
}

function renderActiveView() {
  document.getElementById('currentMonthLabel').textContent = monthKeyLabel(selectedMonthKey);
  switch (activeView) {
    case 'dashboard': renderDashboard(selectedMonthKey); break;
    case 'transactions': renderTransactionsView(selectedMonthKey); break;
    case 'installments': renderInstallmentsView(); break;
    case 'recurring': renderRecurringView(); break;
    case 'reports': renderReport(selectedMonthKey); break;
  }
}

function initNav() {
  document.getElementById('mainNav').addEventListener('click', (e) => {
    const btn = e.target.closest('.nav-btn');
    if (!btn) return;
    switchView(btn.dataset.view);
  });

  document.querySelectorAll('[data-goto]').forEach((el) => {
    el.addEventListener('click', () => switchView(el.dataset.goto));
  });

  document.querySelectorAll('[data-quick]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const q = btn.dataset.quick;
      if (q === 'recurring') openAddModal({ type: 'income', kind: 'recurring' });
      else openAddModal({ type: q, kind: 'normal' });
    });
  });

  // در حالت راست‌به‌چپ، «ماه قبل» سمت راست است؛ ترتیب DOM همین را تضمین می‌کند
  document.getElementById('prevMonthBtn').addEventListener('click', () => {
    selectedMonthKey = shiftMonthKey(selectedMonthKey, -1);
    renderActiveView();
  });
  document.getElementById('nextMonthBtn').addEventListener('click', () => {
    selectedMonthKey = shiftMonthKey(selectedMonthKey, 1);
    renderActiveView();
  });

  document.getElementById('txFilter').addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    txFilter = chip.dataset.filter;
    document.querySelectorAll('#txFilter .chip').forEach((c) => c.classList.toggle('active', c === chip));
    renderActiveView();
  });
}

// ---------- Modals ----------
function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
  document.body.classList.add('modal-open');
}
function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
  if (!document.querySelector('.modal-overlay:not(.hidden)')) document.body.classList.remove('modal-open');
}

function initModalCloseHandlers() {
  document.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
  });
  // مودالی که data-locked دارد (مثل نمایش کلید بازیابی) با کلیک بیرون یا Esc بسته نمی‌شود
  document.querySelectorAll('.modal-overlay').forEach((overlay) => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay && !overlay.dataset.locked) closeModal(overlay.id);
    });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    document.querySelectorAll('.modal-overlay:not(.hidden)').forEach((o) => { if (!o.dataset.locked) closeModal(o.id); });
  });
}

// ---------- Confirm modal ----------
let confirmCallback = null;

function showConfirm(message, onConfirm) {
  document.getElementById('confirmMessage').textContent = message;
  confirmCallback = onConfirm;
  openModal('confirmModalOverlay');
}

function initConfirmModal() {
  document.getElementById('confirmOkBtn').addEventListener('click', () => {
    const cb = confirmCallback;
    confirmCallback = null;
    closeModal('confirmModalOverlay');
    if (cb) cb();
  });
  document.getElementById('confirmCancelBtn').addEventListener('click', () => {
    confirmCallback = null;
    closeModal('confirmModalOverlay');
  });
}

// ---------- Category chips ----------
function renderCategoryGrid(type, selected) {
  const grid = document.getElementById('categoryGrid');
  const input = document.getElementById('txCategory');
  const codes = (type === 'income' ? INCOME_CATEGORY_CODES : EXPENSE_CATEGORY_CODES)
    .filter((c) => c !== 'installment');
  const value = codes.includes(selected) ? selected : codes[0];
  input.value = value;
  grid.innerHTML = codes.map((c) => `
    <button type="button" class="cat-chip ${c === value ? 'active' : ''}" data-cat="${c}">
      <span class="cat-emoji">${categoryIcon(c)}</span><span class="cat-name">${escapeHtml(categoryLabel(c))}</span>
    </button>`).join('');
  grid.querySelectorAll('.cat-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      txFormState.categoryTouched = true;
      input.value = chip.dataset.cat;
      grid.querySelectorAll('.cat-chip').forEach((c) => c.classList.toggle('active', c === chip));
    });
  });
}

// ---------- Date field (calendar-aware: native input for Gregorian, selects for Jalali) ----------
function buildDateField(initialIso) {
  const container = document.getElementById('txDateFieldContainer');
  container.innerHTML = '';

  if (Settings.get().calendar === 'jalali') {
    const [gy, gm, gd] = initialIso.split('-').map(Number);
    const initialJ = toJalaali(gy, gm, gd);
    const todayJ = toJalaali(...todayIso().split('-').map(Number));

    container.classList.add('date-select-group');
    const yearSelect = document.createElement('select');
    const monthSelect = document.createElement('select');
    const daySelect = document.createElement('select');
    yearSelect.id = 'txDateYear';
    monthSelect.id = 'txDateMonth';
    daySelect.id = 'txDateDay';

    for (let y = todayJ.jy - 5; y <= todayJ.jy + 3; y += 1) {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y;
      if (y === initialJ.jy) opt.selected = true;
      yearSelect.appendChild(opt);
    }
    for (let m = 1; m <= 12; m += 1) {
      const opt = document.createElement('option');
      opt.value = m;
      opt.textContent = JALALI_MONTHS[Settings.get().language][m - 1];
      if (m === initialJ.jm) opt.selected = true;
      monthSelect.appendChild(opt);
    }

    function fillDays() {
      const jy = Number(yearSelect.value);
      const jm = Number(monthSelect.value);
      const len = jalaaliMonthLength(jy, jm);
      const prevSelected = Number(daySelect.value) || initialJ.jd;
      daySelect.innerHTML = '';
      for (let d = 1; d <= len; d += 1) {
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = d;
        if (d === Math.min(prevSelected, len)) opt.selected = true;
        daySelect.appendChild(opt);
      }
    }

    monthSelect.addEventListener('change', fillDays);
    yearSelect.addEventListener('change', fillDays);
    fillDays();
    daySelect.value = initialJ.jd;

    container.appendChild(daySelect);
    container.appendChild(monthSelect);
    container.appendChild(yearSelect);
  } else {
    container.classList.remove('date-select-group');
    const input = document.createElement('input');
    input.type = 'date';
    input.id = 'txDate';
    input.value = initialIso;
    container.appendChild(input);
  }
}

function getDateFieldValue() {
  if (Settings.get().calendar === 'jalali') {
    const jy = Number(document.getElementById('txDateYear').value);
    const jm = Number(document.getElementById('txDateMonth').value);
    const jd = Number(document.getElementById('txDateDay').value);
    const g = toGregorian(jy, jm, jd);
    return `${g.gy}-${String(g.gm).padStart(2, '0')}-${String(g.gd).padStart(2, '0')}`;
  }
  return document.getElementById('txDate').value || todayIso();
}

// ---------- Installment mode toggle ----------
// دقیقاً یکی از «تعداد ماه» یا «مبلغ ماهانه» از کاربر گرفته می‌شود؛ دیگری محاسبه می‌شود.
function setInstallmentMode(mode) {
  document.getElementById('txInstMode').value = mode;
  document.querySelectorAll('#txInstModeToggle .kind-toggle-btn')
    .forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
  document.getElementById('txInstMonthsField').classList.toggle('hidden', mode !== 'months');
  document.getElementById('txInstAmountField').classList.toggle('hidden', mode !== 'amount');
}

// ---------- Installment preview: به کاربر نشان می‌دهد دقیقاً چه چیزی و کِی کم می‌شود ----------
function updateInstallmentPreview() {
  const el = document.getElementById('txInstPreview');
  const total = Number(document.getElementById('txAmount').value);
  const mode = document.getElementById('txInstMode').value;
  const months = Number(document.getElementById('txInstTotalMonths').value);
  const monthlyInput = Number(document.getElementById('txInstMonthlyAmount').value);
  const day = Number(document.getElementById('txInstDay').value);
  const paid = document.getElementById('txInstPaidThisMonth').checked;

  const monthly = mode === 'amount' ? monthlyInput : (months >= 1 ? total / months : 0);
  if (!(total > 0) || !(monthly > 0)) { el.textContent = ''; return; }

  let first;
  if (paid) first = t('instPreview.nextMonth');
  else if (day >= 1 && day <= 31) {
    const chargeDay = clampDayToMonth(day, currentMonthKey());
    const today = todayDayOfMonth();
    if (today > chargeDay) first = t('instPreview.dayPassed').replace('{day}', day);
    else if (today === chargeDay) first = t('instPreview.today');
    else first = t('instPreview.thisMonthDay').replace('{day}', day);
  } else first = t('instPreview.today');

  const count = Math.ceil(total / monthly);
  el.textContent = t('instPreview.text')
    .replace('{amount}', formatCurrency(Math.round(monthly * 100) / 100))
    .replace('{count}', count.toLocaleString(LOCALE_MAP[Settings.get().language] || 'en-US'))
    .replace('{first}', first);
}

// ---------- Add form (یک فرم برای همه چیز: یک‌باره، ماهانه، قسطی) ----------
const txFormState = { type: 'expense', kind: 'normal', categoryTouched: false };

function applyTxFormState() {
  const { type, kind } = txFormState;
  document.getElementById('txType').value = type;
  document.getElementById('txKind').value = kind;

  document.querySelectorAll('.type-toggle-btn').forEach((b) => b.classList.toggle('active', b.dataset.type === type));
  document.querySelectorAll('#kindToggle .kind-toggle-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.kind === kind);
    // قسط فقط برای هزینه معنا دارد
    if (b.dataset.kind === 'installment') b.classList.toggle('hidden', type !== 'expense');
  });

  document.getElementById('normalFieldsGroup').classList.toggle('hidden', kind !== 'normal');
  document.getElementById('recurringFieldsGroup').classList.toggle('hidden', kind !== 'recurring');
  document.getElementById('installmentFieldsGroup').classList.toggle('hidden', kind !== 'installment');
  document.getElementById('categoryField').classList.toggle('hidden', kind === 'installment');

  const amountLabelKey = { normal: 'modal.fieldAmount', recurring: 'modal.fieldMonthlyAmountRec', installment: 'modal.fieldTotalAmount' }[kind];
  document.getElementById('txAmountLabel').textContent = t(amountLabelKey);

  const hintKey = {
    normal: type === 'income' ? 'hint.normalIncome' : 'hint.normalExpense',
    recurring: type === 'income' ? 'hint.recurringIncome' : 'hint.recurringExpense',
    installment: 'hint.installment',
  }[kind];
  document.getElementById('kindHint').textContent = t(hintKey);

  const placeholderKey = {
    normal: type === 'income' ? 'placeholder.incomeTitle' : 'placeholder.txTitle',
    recurring: type === 'income' ? 'placeholder.recIncomeTitle' : 'placeholder.recTitle',
    installment: 'placeholder.instTitle',
  }[kind];
  document.getElementById('txTitle').placeholder = t(placeholderKey);

  // تا وقتی کاربر خودش دسته‌ای انتخاب نکرده، دسته‌ی پیش‌فرض با نوع و تکرار عوض می‌شود
  const currentCat = txFormState.categoryTouched ? document.getElementById('txCategory').value : '';
  const defaultCat = type === 'income' ? 'salary' : (kind === 'recurring' ? 'housing' : 'food');
  renderCategoryGrid(type, currentCat || defaultCat);
  hideFormError();
}

function openAddModal({ type = 'expense', kind = 'normal' } = {}) {
  const form = document.getElementById('txForm');
  form.reset();
  document.getElementById('txCategory').value = '';
  buildDateField(todayIso());
  document.getElementById('txRecDay').value = todayDayOfMonth();
  setInstallmentMode('months');
  document.getElementById('txInstPreview').textContent = '';
  txFormState.type = kind === 'installment' ? 'expense' : type;
  txFormState.kind = kind;
  txFormState.categoryTouched = false;
  applyTxFormState();
  hideFormSuccess();
  openModal('txModalOverlay');
  setTimeout(() => document.getElementById('txAmount').focus(), 50);
}

// بعد از ذخیره: نوع، تکرار، دسته و تاریخ حفظ می‌شوند و فقط مبلغ و عنوان و فیلدهای قسط پاک می‌شوند
function prepareForNextEntry(message) {
  ['txAmount', 'txTitle', 'txInstTotalMonths', 'txInstMonthlyAmount', 'txInstDay'].forEach((id) => {
    document.getElementById(id).value = '';
  });
  document.getElementById('txInstPaidThisMonth').checked = false;
  document.getElementById('txInstPreview').textContent = '';
  hideFormError();
  const ok = document.getElementById('txFormSuccess');
  ok.textContent = `✓ ${message} — ${t('modal.nextEntryHint')}`;
  ok.classList.remove('hidden');
  document.querySelector('#txModalOverlay .modal').scrollTop = 0;
  document.getElementById('txAmount').focus({ preventScroll: true });
}

function hideFormSuccess() {
  document.getElementById('txFormSuccess').classList.add('hidden');
}

function showFormError(key) {
  hideFormSuccess();
  const el = document.getElementById('txFormError');
  el.textContent = t(key);
  el.classList.remove('hidden');
}
function hideFormError() {
  document.getElementById('txFormError').classList.add('hidden');
}

function initTxForm() {
  const form = document.getElementById('txForm');

  document.getElementById('fabAddTx').addEventListener('click', () => {
    if (activeView === 'recurring') openAddModal({ type: 'income', kind: 'recurring' });
    else if (activeView === 'installments') openAddModal({ type: 'expense', kind: 'installment' });
    else openAddModal({ type: 'expense', kind: 'normal' });
  });
  document.getElementById('addRecurringIncomeBtn').addEventListener('click', () => openAddModal({ type: 'income', kind: 'recurring' }));
  document.getElementById('addRecurringExpenseBtn').addEventListener('click', () => openAddModal({ type: 'expense', kind: 'recurring' }));
  document.getElementById('addInstallmentBtn').addEventListener('click', () => openAddModal({ type: 'expense', kind: 'installment' }));

  document.querySelectorAll('.type-toggle-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (txFormState.type === btn.dataset.type) return;
      txFormState.type = btn.dataset.type;
      if (txFormState.type === 'income' && txFormState.kind === 'installment') txFormState.kind = 'normal';
      txFormState.categoryTouched = false;
      applyTxFormState();
    });
  });
  document.querySelectorAll('#kindToggle .kind-toggle-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      txFormState.kind = btn.dataset.kind;
      applyTxFormState();
    });
  });
  document.querySelectorAll('#txInstModeToggle .kind-toggle-btn').forEach((btn) => {
    btn.addEventListener('click', () => { setInstallmentMode(btn.dataset.mode); updateInstallmentPreview(); });
  });
  ['txAmount', 'txInstTotalMonths', 'txInstMonthlyAmount', 'txInstDay', 'txInstPaidThisMonth'].forEach((id) => {
    const el = document.getElementById(id);
    el.addEventListener('input', updateInstallmentPreview);
    el.addEventListener('input', hideFormSuccess);
    el.addEventListener('change', updateInstallmentPreview);
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const { type, kind } = txFormState;
    let message = '';
    const amount = Number(document.getElementById('txAmount').value);
    const category = document.getElementById('txCategory').value;
    let title = document.getElementById('txTitle').value.trim();

    if (!(amount > 0)) {
      showFormError('error.amount');
      document.getElementById('txAmount').focus();
      return;
    }

    if (kind === 'installment') {
      const mode = document.getElementById('txInstMode').value;
      const months = Number(document.getElementById('txInstTotalMonths').value);
      const monthly = Number(document.getElementById('txInstMonthlyAmount').value);
      if (mode === 'months' && !(months >= 1)) { showFormError('error.months'); return; }
      if (mode === 'amount' && !(monthly > 0)) { showFormError('error.monthlyAmount'); return; }
      const dayRaw = document.getElementById('txInstDay').value.trim();
      const day = dayRaw === '' ? null : Number(dayRaw);
      if (day !== null && !(day >= 1 && day <= 31)) { showFormError('error.day'); return; }
      const paidThisMonth = document.getElementById('txInstPaidThisMonth').checked;
      const inst = Installments.add({
        title: title || t('installments.defaultTitle'),
        totalAmount: amount,
        mode,
        totalMonths: mode === 'months' ? months : null,
        monthlyAmount: mode === 'amount' ? monthly : null,
        dayOfMonth: day,
        paidThisMonth,
      });
      const st = Installments.monthStatus(inst);
      if (st === 'charged') message = t('installments.addedToast');
      else if (st === 'skipped') message = t('installments.addedToastNextMonth');
      else message = t('installments.addedToastLater').replace('{day}', inst.dayOfMonth);
      selectedMonthKey = currentMonthKey();
    } else if (kind === 'recurring') {
      const day = Number(document.getElementById('txRecDay').value);
      if (!(day >= 1 && day <= 31)) { showFormError('error.day'); return; }
      const item = Recurring.add({
        type,
        title: title || categoryLabel(category),
        amount,
        dayOfMonth: day,
        category,
      });
      message = (Recurring.isGeneratedThisMonth(item)
        ? t('recurring.addedToastNow')
        : t('recurring.addedToastLater').replace('{day}', item.dayOfMonth));
      selectedMonthKey = currentMonthKey();
    } else {
      const date = getDateFieldValue();
      Transactions.add({ type, title: title || categoryLabel(category), amount, date, category });
      message = t('toast.txAdded');
      selectedMonthKey = monthKeyOf(date);
    }

    // فرم باز می‌ماند تا کاربر بتواند مورد بعدی را وارد کند؛ بستن با دکمه‌ی جداگانه است
    renderActiveView();
    prepareForNextEntry(message);
  });
}

// ---------- Transactions ----------
function renderTransactionsView(monthKey) {
  const list = document.getElementById('transactionsList');
  let items = Transactions.forMonth(monthKey);
  if (txFilter !== 'all') items = items.filter((tx) => tx.type === txFilter);
  renderTxList(list, items, true);

  list.querySelectorAll('.row-delete-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      showConfirm(t('transactions.deleteConfirm'), () => {
        Transactions.remove(btn.dataset.txId);
        showToast(t('toast.txDeleted'));
        renderActiveView();
      });
    });
  });
}

// ---------- Installments ----------
function renderInstallmentsView() {
  const activeList = document.getElementById('activeInstallmentsList');
  const paidList = document.getElementById('paidInstallmentsList');
  const all = Installments.all();
  const active = all.filter((i) => i.status === 'active');
  const paid = all.filter((i) => i.status === 'paid');

  document.getElementById('activeInstallmentsEmptyHint').hidden = active.length > 0;
  document.getElementById('paidInstallmentsPanel').classList.toggle('hidden', paid.length === 0);

  activeList.innerHTML = active.map((i) => installmentCardHtml(i)).join('');
  paidList.innerHTML = paid.map((i) => installmentCardHtml(i)).join('');

  document.querySelectorAll('.installment-card').forEach((card) => {
    card.addEventListener('click', () => openInstallmentDetail(card.dataset.id));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openInstallmentDetail(card.dataset.id);
      }
    });
  });
}

function installmentCardHtml(inst) {
  const paidAmount = Math.max(0, inst.totalAmount - inst.remainingAmount);
  const progressPct = inst.totalAmount > 0 ? Math.round((paidAmount / inst.totalAmount) * 100) : 100;
  const remainingMonths = Installments.estimatedRemainingMonths(inst);
  let sub = t('badge.paid');
  if (inst.status === 'active') {
    const statusKey = {
      charged: 'installments.paidThisMonth',
      skipped: 'installments.startsNextMonth',
      upcoming: 'installments.dueOnDay',
      none: 'installments.notPaidThisMonth',
    }[Installments.monthStatus(inst)];
    sub = `${formatCurrency(inst.monthlyAmount)} ${t('installments.perMonth')} · ${remainingMonths} ${t('installments.monthsLeft')}`
      + `<br>${t(statusKey).replace('{day}', inst.dayOfMonth)}`;
  }
  return `
    <div class="item-card installment-card" data-id="${inst.id}" role="button" tabindex="0">
      <span class="tx-icon expense">🧾</span>
      <div class="item-info">
        <span class="item-title">${escapeHtml(inst.title)}</span>
        <span class="item-sub">${sub}</span>
        <div class="item-progress"><div class="item-progress-fill" style="width:${progressPct}%"></div></div>
      </div>
      <div class="item-side">
        <span class="item-amount">${formatCurrency(inst.remainingAmount)}</span>
        <span class="item-side-label">${t('installments.remainingLabel')}</span>
      </div>
    </div>
  `;
}

function openInstallmentDetail(id) {
  const inst = Installments.byId(id);
  if (!inst) return;

  const paidAmount = Math.max(0, inst.totalAmount - inst.remainingAmount);
  const progressPct = inst.totalAmount > 0 ? Math.round((paidAmount / inst.totalAmount) * 100) : 100;
  const remainingMonths = Installments.estimatedRemainingMonths(inst);

  document.getElementById('instDetailTitle').textContent = inst.title;
  document.getElementById('instDetailProgressFill').style.width = `${progressPct}%`;
  document.getElementById('instDetailProgressLabel').textContent = `${progressPct}%`;

  const rows = [
    [t('installments.totalAmountLabel'), formatCurrency(inst.totalAmount)],
    [t('installments.remainingLabel'), formatCurrency(inst.remainingAmount)],
    [t('installments.paidAmountLabel'), formatCurrency(paidAmount)],
    [t('installments.perMonth'), formatCurrency(inst.monthlyAmount)],
    [t('installments.paidMonthsCountLabel'), inst.paidMonthKeys.length],
    [t('installments.remainingMonthsLabel'), inst.status === 'active' ? remainingMonths : 0],
    [t('installments.startDateLabel'), formatDateDisplay(inst.startDate)],
    [t('installments.dueDayLabel'), inst.dayOfMonth || t('installments.dueDayNotSet')],
    [t('common.status'), inst.status === 'active' ? t('badge.active') : t('badge.paid')],
  ];

  document.getElementById('instDetailGrid').innerHTML = rows.map(([label, value]) => `
    <div class="detail-item">
      <div class="detail-label">${escapeHtml(label)}</div>
      <div class="detail-value">${escapeHtml(String(value))}</div>
    </div>
  `).join('');

  document.getElementById('instDetailDeleteBtn').onclick = () => {
    showConfirm(t('installments.deleteConfirm'), () => {
      Installments.remove(id);
      closeModal('installmentDetailModalOverlay');
      showToast(t('installments.deletedToast'));
      renderActiveView();
    });
  };

  openModal('installmentDetailModalOverlay');
}

// ---------- Monthly (recurring income & expense) ----------
function recurringCardHtml(r) {
  let status;
  if (!r.active) status = t('badge.inactive');
  else if (Recurring.isGeneratedThisMonth(r)) status = `✓ ${t('recurring.doneThisMonth')}`;
  else status = t('recurring.upcoming').replace('{day}', r.dayOfMonth);

  return `
    <div class="item-card ${r.active ? '' : 'inactive'}">
      <span class="tx-icon ${r.type}">${categoryIcon(r.category)}</span>
      <div class="item-info">
        <span class="item-title">${escapeHtml(r.title)}</span>
        <span class="item-sub">${t('recurring.everyMonthDay').replace('{day}', r.dayOfMonth)} · ${status}</span>
      </div>
      <div class="item-side">
        <span class="item-amount ${r.type}">${formatCurrency(r.amount)}</span>
        <div class="item-actions">
          <label class="switch" title="${r.active ? t('recurring.toggleDeactivate') : t('recurring.toggleActivate')}">
            <input type="checkbox" class="recurring-toggle" data-id="${r.id}" ${r.active ? 'checked' : ''}>
            <span class="switch-track"></span>
          </label>
          <button class="row-delete-btn recurring-delete-btn" data-id="${r.id}" title="${t('common.delete')}">✕</button>
        </div>
      </div>
    </div>
  `;
}

function renderRecurringView() {
  const income = Recurring.byType('income');
  const expense = Recurring.byType('expense');

  document.getElementById('recurringIncomeList').innerHTML = income.map(recurringCardHtml).join('');
  document.getElementById('recurringExpenseList').innerHTML = expense.map(recurringCardHtml).join('');
  document.getElementById('recurringIncomeEmptyHint').hidden = income.length > 0;
  document.getElementById('recurringExpenseEmptyHint').hidden = expense.length > 0;

  const incomeTotal = Recurring.monthlyTotal('income');
  const expenseTotal = Recurring.monthlyTotal('expense')
    + Installments.active().reduce((s, i) => s + i.monthlyAmount, 0);
  document.getElementById('recNetIncome').textContent = formatCurrency(incomeTotal);
  document.getElementById('recNetExpense').textContent = formatCurrency(expenseTotal);
  const leftEl = document.getElementById('recNetLeft');
  leftEl.textContent = formatCurrency(incomeTotal - expenseTotal);
  leftEl.className = incomeTotal - expenseTotal < 0 ? 'expense' : '';

  const view = document.getElementById('view-recurring');
  view.querySelectorAll('.recurring-toggle').forEach((input) => {
    input.addEventListener('change', () => {
      Recurring.toggleActive(input.dataset.id);
      renderActiveView();
    });
  });
  view.querySelectorAll('.recurring-delete-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      showConfirm(t('recurring.deleteConfirm'), () => {
        Recurring.remove(btn.dataset.id);
        showToast(t('recurring.deletedToast'));
        renderActiveView();
      });
    });
  });
}

// ---------- Settings ----------
function openSettingsModal() {
  const s = Settings.get();
  document.getElementById('settingsLanguage').value = s.language;
  document.getElementById('settingsCurrency').value = s.currency;
  document.getElementById('settingsCalendar').value = s.calendar;
  openModal('settingsModalOverlay');
}

function initSettingsForm() {
  document.getElementById('settingsBtn').addEventListener('click', openSettingsModal);

  document.getElementById('settingsForm').addEventListener('submit', (e) => {
    e.preventDefault();
    Settings.update({
      language: document.getElementById('settingsLanguage').value,
      currency: document.getElementById('settingsCurrency').value,
      calendar: document.getElementById('settingsCalendar').value,
    });
    closeModal('settingsModalOverlay');
    applyStaticTranslations();
    selectedMonthKey = currentMonthKey();
    renderActiveView();
    showToast(t('toast.settingsSaved'));
  });
}

// ---------- Reports ----------
function initReportHandlers() {
  document.getElementById('downloadPdfBtn').addEventListener('click', () => {
    downloadReportAsPdf(selectedMonthKey);
  });
}
