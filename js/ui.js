// منطق رابط کاربری: ناوبری، مودال‌ها، فرم‌ها، رندر لیست‌ها

let selectedMonthKey = currentMonthKey();
let activeView = 'dashboard';

// ---------- Toast ----------
let toastTimer = null;
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}

// ---------- Navigation ----------
function switchView(view) {
  activeView = view;
  document.querySelectorAll('.view').forEach((el) => el.classList.add('hidden'));
  document.getElementById(`view-${view}`).classList.remove('hidden');
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  renderActiveView();
}

function renderActiveView() {
  document.getElementById('currentMonthLabel').textContent = monthKeyLabel(selectedMonthKey);
  switch (activeView) {
    case 'dashboard': renderDashboard(selectedMonthKey); break;
    case 'transactions': renderTransactionsTable(selectedMonthKey); break;
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

  document.getElementById('prevMonthBtn').addEventListener('click', () => {
    selectedMonthKey = shiftMonthKey(selectedMonthKey, -1);
    renderActiveView();
  });
  document.getElementById('nextMonthBtn').addEventListener('click', () => {
    selectedMonthKey = shiftMonthKey(selectedMonthKey, 1);
    renderActiveView();
  });
}

// ---------- Modals ----------
function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
}
function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
}

function initModalCloseHandlers() {
  document.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
  });
  document.querySelectorAll('.modal-overlay').forEach((overlay) => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.classList.add('hidden');
    });
  });
}

// ---------- Confirm modal (جایگزین سفارشی و موبایل‌پسند برای confirm() مرورگر) ----------
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

// ---------- Category selects ----------
function fillCategorySelect(selectEl, categoryCodes) {
  selectEl.innerHTML = categoryCodes.map((c) => `<option value="${c}">${categoryLabel(c)}</option>`).join('');
}

function populateCategorySelects(type) {
  const txCategory = document.getElementById('txCategory');
  fillCategorySelect(txCategory, type === 'income' ? INCOME_CATEGORY_CODES : EXPENSE_CATEGORY_CODES);
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

    container.appendChild(yearSelect);
    container.appendChild(monthSelect);
    container.appendChild(daySelect);
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
  return document.getElementById('txDate').value;
}

// ---------- Installment mode toggle (shared between the tx-form and the dedicated installment modal) ----------
// دقیقاً یکی از «تعداد ماه» یا «مبلغ ماهانه» از کاربر گرفته می‌شود؛ دیگری همیشه محاسبه‌شده است
// تا هرگز مقادیر ناسازگار وارد نشوند.
function setupInstallmentModeToggle(prefix) {
  const toggle = document.getElementById(`${prefix}ModeToggle`);
  const modeInput = document.getElementById(`${prefix}Mode`);
  const monthsField = document.getElementById(`${prefix}MonthsField`);
  const amountField = document.getElementById(`${prefix}AmountField`);
  const monthsInput = document.getElementById(`${prefix}TotalMonths`);
  const amountInput = document.getElementById(`${prefix}MonthlyAmount`);

  function setMode(mode) {
    modeInput.value = mode;
    toggle.querySelectorAll('.kind-toggle-btn').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
    monthsField.classList.toggle('hidden', mode !== 'months');
    amountField.classList.toggle('hidden', mode !== 'amount');
    monthsInput.required = mode === 'months';
    amountInput.required = mode === 'amount';
  }

  toggle.querySelectorAll('.kind-toggle-btn').forEach((btn) => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
  });

  setMode('months');
  return { setMode };
}

// ---------- Transaction form ----------
function initTxForm() {
  const form = document.getElementById('txForm');
  const typeInput = document.getElementById('txType');
  const kindInput = document.getElementById('txKind');
  const typeToggleBtns = document.querySelectorAll('.type-toggle-btn');
  const kindToggle = document.getElementById('kindToggle');
  const kindToggleBtns = document.querySelectorAll('.kind-toggle-btn');

  const fieldGroups = {
    normal: document.getElementById('normalFieldsGroup'),
    installment: document.getElementById('installmentFieldsGroup'),
    recurring: document.getElementById('recurringFieldsGroup'),
  };
  const fieldsByKind = {
    normal: ['txAmount'],
    installment: ['txInstTotalAmount'],
    recurring: ['txRecAmount', 'txRecDay'],
  };
  const txInstModeCtl = setupInstallmentModeToggle('txInst');

  document.getElementById('fabAddTx').addEventListener('click', () => {
    form.reset();
    buildDateField(todayIso());
    setTxType('expense');
    setTxKind('normal');
    txInstModeCtl.setMode('months');
    openModal('txModalOverlay');
  });

  function setTxType(type) {
    typeInput.value = type;
    typeToggleBtns.forEach((b) => b.classList.toggle('active', b.dataset.type === type));
    kindToggle.classList.toggle('hidden', type !== 'expense');
    if (type !== 'expense') setTxKind('normal');
    populateCategorySelects(type);
  }

  function setTxKind(kind) {
    kindInput.value = kind;
    kindToggleBtns.forEach((b) => b.classList.toggle('active', b.dataset.kind === kind));
    Object.keys(fieldGroups).forEach((k) => fieldGroups[k].classList.toggle('hidden', k !== kind));
    Object.keys(fieldsByKind).forEach((k) => {
      fieldsByKind[k].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.required = k === kind;
      });
    });
    if (kind === 'installment') {
      txInstModeCtl.setMode(document.getElementById('txInstMode').value);
    } else {
      document.getElementById('txInstTotalMonths').required = false;
      document.getElementById('txInstMonthlyAmount').required = false;
    }
    if (kind === 'recurring') {
      fillCategorySelect(document.getElementById('txRecCategory'), EXPENSE_CATEGORY_CODES);
    }
  }

  typeToggleBtns.forEach((btn) => {
    btn.addEventListener('click', () => setTxType(btn.dataset.type));
  });
  kindToggleBtns.forEach((btn) => {
    btn.addEventListener('click', () => setTxKind(btn.dataset.kind));
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('txTitle').value.trim();
    const kind = kindInput.value;

    if (kind === 'installment') {
      const mode = document.getElementById('txInstMode').value;
      Installments.add({
        title,
        totalAmount: document.getElementById('txInstTotalAmount').value,
        mode,
        totalMonths: mode === 'months' ? document.getElementById('txInstTotalMonths').value : null,
        monthlyAmount: mode === 'amount' ? document.getElementById('txInstMonthlyAmount').value : null,
      });
      showToast(t('installments.addedToast'));
      selectedMonthKey = currentMonthKey();
    } else if (kind === 'recurring') {
      Recurring.add({
        title,
        amount: document.getElementById('txRecAmount').value,
        dayOfMonth: document.getElementById('txRecDay').value,
        category: document.getElementById('txRecCategory').value,
      });
      showToast(t('recurring.addedToast'));
      selectedMonthKey = currentMonthKey();
    } else {
      const date = getDateFieldValue();
      Transactions.add({
        type: typeInput.value,
        title,
        amount: document.getElementById('txAmount').value,
        date,
        category: document.getElementById('txCategory').value,
      });
      showToast(t('toast.txAdded'));
      const txMonth = monthKeyOf(date);
      if (txMonth !== selectedMonthKey) selectedMonthKey = txMonth;
    }

    closeModal('txModalOverlay');
    renderActiveView();
  });
}

// ---------- Transactions table ----------
function renderTransactionsTable(monthKey) {
  const tbody = document.getElementById('transactionsTbody');
  const emptyHint = document.getElementById('transactionsEmptyHint');
  const items = Transactions.forMonth(monthKey);
  tbody.innerHTML = '';

  if (items.length === 0) {
    document.getElementById('transactionsTable').hidden = true;
    emptyHint.hidden = false;
    return;
  }
  document.getElementById('transactionsTable').hidden = false;
  emptyHint.hidden = true;

  items.forEach((tx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(tx.title)}</td>
      <td>${escapeHtml(categoryLabel(tx.category))}</td>
      <td>${formatDateDisplay(tx.date)}</td>
      <td class="amount-${tx.type}">${formatCurrency(tx.amount)}</td>
      <td>${tx.type === 'income' ? t('common.income') : t('common.expense')}</td>
      <td><button class="row-delete-btn" data-tx-id="${tx.id}" title="${t('common.delete')}">✕</button></td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.row-delete-btn').forEach((btn) => {
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
function initInstallmentForm() {
  const instModeCtl = setupInstallmentModeToggle('inst');

  document.getElementById('addInstallmentBtn').addEventListener('click', () => {
    document.getElementById('installmentForm').reset();
    instModeCtl.setMode('months');
    openModal('installmentModalOverlay');
  });

  document.getElementById('installmentForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const mode = document.getElementById('instMode').value;
    Installments.add({
      title: document.getElementById('instTitle').value.trim(),
      totalAmount: document.getElementById('instTotalAmount').value,
      mode,
      totalMonths: mode === 'months' ? document.getElementById('instTotalMonths').value : null,
      monthlyAmount: mode === 'amount' ? document.getElementById('instMonthlyAmount').value : null,
    });
    closeModal('installmentModalOverlay');
    showToast(t('installments.addedToast'));
    renderActiveView();
  });
}

function renderInstallmentsView() {
  const activeList = document.getElementById('activeInstallmentsList');
  const paidList = document.getElementById('paidInstallmentsList');
  const all = Installments.all();
  const active = all.filter((i) => i.status === 'active');
  const paid = all.filter((i) => i.status === 'paid');

  document.getElementById('activeInstallmentsEmptyHint').hidden = active.length > 0;
  document.getElementById('paidInstallmentsEmptyHint').hidden = paid.length > 0;

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
  const chargedThisMonth = inst.paidMonthKeys.includes(currentMonthKey());
  const statusNote = inst.status === 'active'
    ? `· ${chargedThisMonth ? t('installments.paidThisMonth') : t('installments.notPaidThisMonth')}`
    : '';
  return `
    <div class="item-card installment-card" data-id="${inst.id}" role="button" tabindex="0">
      <div class="item-info">
        <span class="item-title">${escapeHtml(inst.title)}</span>
        <span class="item-sub">
          ${t('installments.remainingLabel')}: <b>${formatCurrency(inst.remainingAmount)}</b> ·
          ${formatCurrency(inst.monthlyAmount)} ${t('installments.perMonth')}
          ${inst.status === 'active' ? `· ~${remainingMonths} ${t('installments.months')}` : ''}
          ${statusNote}
        </span>
        <div class="item-progress"><div class="item-progress-fill" style="width:${progressPct}%"></div></div>
      </div>
      <div class="item-actions">
        <span class="badge ${inst.status}">${inst.status === 'active' ? t('badge.active') : t('badge.paid')}</span>
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

// ---------- Recurring ----------
function initRecurringForm() {
  document.getElementById('addRecurringBtn').addEventListener('click', () => {
    document.getElementById('recurringForm').reset();
    fillCategorySelect(document.getElementById('recCategory'), EXPENSE_CATEGORY_CODES);
    openModal('recurringModalOverlay');
  });

  document.getElementById('recurringForm').addEventListener('submit', (e) => {
    e.preventDefault();
    Recurring.add({
      title: document.getElementById('recTitle').value.trim(),
      amount: document.getElementById('recAmount').value,
      dayOfMonth: document.getElementById('recDay').value,
      category: document.getElementById('recCategory').value,
    });
    closeModal('recurringModalOverlay');
    showToast(t('recurring.addedToast'));
    renderActiveView();
  });
}

function renderRecurringView() {
  const list = document.getElementById('recurringList');
  const items = Recurring.all();
  document.getElementById('recurringEmptyHint').hidden = items.length > 0;

  list.innerHTML = items.map((r) => `
    <div class="item-card">
      <div class="item-info">
        <span class="item-title">${escapeHtml(r.title)}</span>
        <span class="item-sub">${formatCurrency(r.amount)} · ${t('recurring.dayLabel')} ${r.dayOfMonth} · ${escapeHtml(categoryLabel(r.category))}</span>
      </div>
      <div class="item-actions">
        <span class="badge ${r.active ? 'active' : 'inactive'}">${r.active ? t('badge.active') : t('badge.inactive')}</span>
        <button class="btn btn-secondary btn-small recurring-toggle-btn" data-id="${r.id}">${r.active ? t('recurring.toggleDeactivate') : t('recurring.toggleActivate')}</button>
        <button class="row-delete-btn recurring-delete-btn" data-id="${r.id}" title="${t('common.delete')}">✕</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('.recurring-toggle-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      Recurring.toggleActive(btn.dataset.id);
      renderActiveView();
    });
  });
  list.querySelectorAll('.recurring-delete-btn').forEach((btn) => {
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
function initSettingsForm() {
  document.getElementById('settingsBtn').addEventListener('click', () => {
    const s = Settings.get();
    document.getElementById('settingsLanguage').value = s.language;
    document.getElementById('settingsCurrency').value = s.currency;
    document.getElementById('settingsCalendar').value = s.calendar;
    openModal('settingsModalOverlay');
  });

  document.getElementById('settingsForm').addEventListener('submit', (e) => {
    e.preventDefault();
    Settings.update({
      language: document.getElementById('settingsLanguage').value,
      currency: document.getElementById('settingsCurrency').value,
      calendar: document.getElementById('settingsCalendar').value,
    });
    closeModal('settingsModalOverlay');
    applyStaticTranslations();
    populateCategorySelects(document.getElementById('txType').value);
    selectedMonthKey = currentMonthKey();
    renderActiveView();
    showToast(t('toast.settingsSaved'));
  });
}

// ---------- Export / Import ----------
function initBackupHandlers() {
  document.getElementById('exportBtn').addEventListener('click', () => {
    exportDataAsJson();
    showToast(t('toast.backupExported'));
  });

  document.getElementById('importInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    importDataFromJson(file, (ok, errorMsg) => {
      if (ok) {
        showToast(t('toast.backupImported'));
        renderActiveView();
      } else {
        showToast(`${t('toast.backupImportError')}: ${errorMsg}`);
      }
      e.target.value = '';
    });
  });
}

// ---------- Reports ----------
function initReportHandlers() {
  document.getElementById('downloadPdfBtn').addEventListener('click', () => {
    downloadReportAsPdf(selectedMonthKey);
  });
}
