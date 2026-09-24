// رابط کاربری حساب و همگام‌سازی (اختیاری)

const AccountUI = {
  pane: null, // صفحه‌ای که کاربر خودش باز کرده (خروج / حذف)؛ در غیر این صورت از وضعیت Sync تعیین می‌شود
  authMode: 'signin', // signin | signup

  init() {
    const btn = document.getElementById('syncBtn');
    const row = document.getElementById('settingsSyncRow');
    if (!Sync.available()) return;
    btn.classList.remove('hidden');
    row.classList.remove('hidden');
    btn.addEventListener('click', () => this.open());
    row.addEventListener('click', () => { closeModal('settingsModalOverlay'); this.open(); });

    Sync.on(() => this.render());
    this.bind();
    this.setAuthMode('signin');
    this.render();
  },

  open() {
    this.pane = null;
    this.clearMessages();
    openModal('accountModalOverlay');
    this.render();
    if (Sync.status === 'signed-out' || Sync.status === 'error') Sync.connect().catch(() => {});
  },

  currentPane() {
    if (this.pane) return this.pane;
    switch (Sync.status) {
      case 'signed-out': case 'unavailable': return 'signin';
      case 'loading': return 'loading';
      case 'needs-verify': return 'needs-verify';
      case 'foreign': return 'foreign';
      case 'error': return Sync.user ? 'account' : 'signin';
      default: return 'account';
    }
  },

  go(pane) {
    this.pane = pane;
    this.clearMessages();
    this.render();
  },

  setAuthMode(mode) {
    this.authMode = mode;
    const signup = mode === 'signup';
    document.querySelectorAll('.auth-tab').forEach((t) => {
      const active = t.dataset.authMode === mode;
      t.classList.toggle('active', active);
      t.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    const submit = document.getElementById('accSubmitBtn');
    submit.dataset.i18n = signup ? 'acc.signUp' : 'acc.signIn';
    submit.textContent = t(submit.dataset.i18n);
    document.getElementById('accPassword').autocomplete = signup ? 'new-password' : 'current-password';
    document.getElementById('accForgotRow').classList.toggle('hidden', signup);
    document.getElementById('accPwHint').classList.toggle('hidden', !signup);
    this.clearMessages();
  },

  providerLabel(user) {
    return user && user.provider === 'google.com' ? t('acc.viaGoogle') : t('acc.viaEmail');
  },

  statusText() {
    const s = Sync.status;
    if (s === 'syncing') return t('acc.stSyncing');
    if (s === 'ok') {
      const at = Sync.meta.lastSyncAt ? new Date(Sync.meta.lastSyncAt) : null;
      const time = at ? at.toLocaleTimeString(LOCALE_MAP[Settings.get().language] || 'en-US', { hour: '2-digit', minute: '2-digit' }) : '';
      return `✓ ${t('acc.stOk')}${time ? ` · ${time}` : ''}`;
    }
    if (s === 'error') return `⚠ ${this.errorText(Sync.error)}`;
    if (s === 'needs-verify' || s === 'foreign') return `⚠ ${t('acc.stAction')}`;
    if (s === 'loading') return t('acc.loading');
    return t('acc.stSignedOut');
  },

  render() {
    // نشانگر نوار بالا
    const dot = document.getElementById('syncDot');
    const s = Sync.status;
    let dotClass = '';
    if (s === 'ok') dotClass = 'ok';
    else if (s === 'syncing' || s === 'loading') dotClass = 'busy';
    else if (['needs-verify', 'foreign', 'error'].includes(s)) dotClass = 'warn';
    dot.className = `sync-dot ${dotClass}`;
    document.getElementById('settingsSyncStatus').textContent = this.statusText();

    const pane = this.currentPane();
    document.querySelectorAll('#accountModalOverlay .acc-pane').forEach((el) => {
      el.classList.toggle('hidden', el.dataset.pane !== pane);
    });

    const user = Sync.user;
    if (user) {
      document.getElementById('accUserEmail').textContent = user.email || '';
      document.getElementById('accAvatar').textContent = (user.email || '?').charAt(0).toUpperCase();
      document.getElementById('accProvider').textContent = this.providerLabel(user);
      document.getElementById('accVerifyText').textContent = t('acc.verifyText').replace('{email}', user.email || '');
      const isGoogle = user.provider === 'google.com';
      document.getElementById('accDeletePwField').classList.toggle('hidden', isGoogle);
      document.getElementById('accDeleteGoogleNote').classList.toggle('hidden', !isGoogle);
    }
    const state = document.getElementById('accSyncState');
    state.textContent = this.statusText();
    state.className = `sync-state ${s}`;
    const syncBtn = document.getElementById('accSyncNowBtn');
    syncBtn.disabled = s === 'syncing';
    syncBtn.classList.toggle('spinning', s === 'syncing');
  },

  clearMessages() {
    document.getElementById('accError').classList.add('hidden');
    document.getElementById('accInfo').classList.add('hidden');
  },
  showError(code) {
    const el = document.getElementById('accError');
    el.textContent = this.errorText(code);
    el.classList.remove('hidden');
    document.getElementById('accInfo').classList.add('hidden');
    document.querySelector('#accountModalOverlay .modal').scrollTop = 0;
  },
  showInfo(key) {
    const el = document.getElementById('accInfo');
    el.textContent = t(key);
    el.classList.remove('hidden');
    document.getElementById('accError').classList.add('hidden');
  },

  errorText(code) {
    const map = {
      'auth/invalid-credential': 'acc.err.credentials',
      'auth/wrong-password': 'acc.err.credentials',
      'auth/user-not-found': 'acc.err.credentials',
      'auth/invalid-email': 'acc.err.email',
      'auth/missing-email': 'acc.err.email',
      'auth/email-already-in-use': 'acc.err.emailInUse',
      'auth/weak-password': 'acc.err.weakLogin',
      'auth/missing-password': 'acc.err.weakLogin',
      'auth/too-many-requests': 'acc.err.tooMany',
      'auth/network-request-failed': 'acc.err.network',
      'auth/popup-closed-by-user': 'acc.err.popupClosed',
      'auth/cancelled-popup-request': 'acc.err.popupClosed',
      'auth/user-mismatch': 'acc.err.userMismatch',
      'auth/requires-recent-login': 'acc.err.recentLogin',
      unavailable: 'acc.err.network',
      'permission-denied': 'acc.err.permission',
      'not-verified': 'acc.err.notVerified',
      'too-large': 'acc.err.tooLarge',
    };
    return t(map[code] || 'acc.err.generic');
  },

  // اجرای یک عمل async با قفل دکمه‌ها و نمایش خطا
  async run(button, fn) {
    const modal = document.querySelector('#accountModalOverlay .modal');
    this.clearMessages();
    modal.classList.add('busy');
    if (button) button.disabled = true;
    try {
      await fn();
    } catch (e) {
      console.error(e);
      this.showError((e && e.code) || 'unknown');
    } finally {
      modal.classList.remove('busy');
      if (button) button.disabled = false;
    }
  },

  bind() {
    const $ = (id) => document.getElementById(id);
    const authError = (code) => { const e = new Error(code); e.code = code; return e; };

    $('accGoogleBtn').addEventListener('click', (e) => this.run(e.currentTarget, () => Sync.signInGoogle()));

    document.querySelectorAll('.auth-tab').forEach((tab) => {
      tab.addEventListener('click', () => this.setAuthMode(tab.dataset.authMode));
    });

    $('accPwToggle').addEventListener('click', () => {
      const input = $('accPassword');
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      $('accPwToggle').classList.toggle('on', show);
      $('accPwToggle').title = t(show ? 'acc.hidePassword' : 'acc.showPassword');
    });

    $('accEmailForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.run($('accSubmitBtn'), async () => {
        const email = $('accEmail').value.trim();
        const password = $('accPassword').value;
        if (!email) throw authError('auth/missing-email');
        if (this.authMode === 'signup') {
          if (password.length < 8) throw authError('auth/weak-password');
          await Sync.signUpEmail(email, password);
        } else {
          if (!password) throw authError('auth/missing-password');
          await Sync.signInEmail(email, password);
        }
        $('accPassword').value = '';
      });
    });
    $('accForgotBtn').addEventListener('click', (e) => this.run(e.currentTarget, async () => {
      const email = $('accEmail').value.trim();
      if (!email) throw authError('auth/missing-email');
      await Sync.resetPassword(email);
      this.showInfo('acc.resetSent');
    }));

    $('accVerifiedBtn').addEventListener('click', (e) => this.run(e.currentTarget, async () => {
      const ok = await Sync.checkVerified();
      if (!ok) throw authError('not-verified');
    }));
    $('accResendBtn').addEventListener('click', (e) => this.run(e.currentTarget, async () => {
      await Sync.resendVerification();
      this.showInfo('acc.verifySent');
    }));

    $('accForeignOkBtn').addEventListener('click', (e) => this.run(e.currentTarget, () => Sync.acceptForeign()));

    // همگام‌سازی دستی
    $('accSyncNowBtn').addEventListener('click', (e) => this.run(e.currentTarget, async () => {
      await Sync.syncNow();
      if (Sync.status === 'error') throw authError(Sync.error);
    }));

    $('accSignOutKeepBtn').addEventListener('click', (e) => this.run(e.currentTarget, async () => {
      await Sync.signOut(true);
      this.go(null);
    }));
    $('accSignOutWipeBtn').addEventListener('click', (e) => this.run(e.currentTarget, async () => {
      await Sync.signOut(false);
      this.go(null);
    }));
    document.querySelectorAll('[data-acc-signout-now]').forEach((b) => {
      b.addEventListener('click', (e) => this.run(e.currentTarget, async () => {
        await Sync.signOut(true);
        this.go(null);
      }));
    });

    $('accDeleteForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.run(e.submitter, async () => {
        const isGoogle = Sync.user && Sync.user.provider === 'google.com';
        const password = $('accDeletePw').value;
        if (!isGoogle && !password) throw authError('auth/missing-password');
        await Sync.deleteCloud(isGoogle ? null : password);
        $('accDeletePw').value = '';
        this.go(null);
        this.showInfo('acc.deleted');
      });
    });

    document.querySelectorAll('#accountModalOverlay [data-acc-go]').forEach((b) => {
      b.addEventListener('click', () => this.go(b.dataset.accGo));
    });
    document.querySelectorAll('#accountModalOverlay [data-acc-back]').forEach((b) => {
      b.addEventListener('click', () => this.go(null));
    });
  },
};
