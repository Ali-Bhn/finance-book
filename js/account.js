// رابط کاربری حساب و همگام‌سازی (اختیاری)

const AccountUI = {
  pane: null, // صفحه‌ای که کاربر خودش باز کرده (مثل تغییر رمز)؛ در غیر این صورت از وضعیت Sync تعیین می‌شود
  recoveryKey: null,

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
      case 'needs-setup': return 'needs-setup';
      case 'locked': return 'locked';
      case 'error': return Sync.user && Sync.key ? 'account' : (Sync.user ? 'loading' : 'signin');
      default: return 'account';
    }
  },

  go(pane) {
    this.pane = pane;
    this.clearMessages();
    this.render();
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
    if (['needs-verify', 'foreign', 'needs-setup', 'locked'].includes(s)) return `⚠ ${t('acc.stAction')}`;
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
    else if (['needs-verify', 'foreign', 'needs-setup', 'locked', 'error'].includes(s)) dotClass = 'warn';
    dot.className = `sync-dot ${dotClass}`;
    document.getElementById('settingsSyncStatus').textContent = this.statusText();

    const pane = this.currentPane();
    document.querySelectorAll('#accountModalOverlay .acc-pane').forEach((el) => {
      el.classList.toggle('hidden', el.dataset.pane !== pane);
    });

    if (Sync.user) {
      document.getElementById('accUserEmail').textContent = Sync.user.email || '';
      document.getElementById('accAvatar').textContent = (Sync.user.email || '?').charAt(0).toUpperCase();
      document.getElementById('accVerifyText').textContent = t('acc.verifyText').replace('{email}', Sync.user.email || '');
    }
    document.getElementById('accStatusLine').textContent = this.statusText();
    document.getElementById('accSyncNowBtn').disabled = s === 'syncing';
    if (pane === 'recovery-show') document.getElementById('accRecKey').textContent = this.recoveryKey || '';
    const overlay = document.getElementById('accountModalOverlay');
    if (pane === 'recovery-show') overlay.dataset.locked = '1';
    else delete overlay.dataset.locked;
    overlay.querySelector('.modal-close').classList.toggle('hidden', pane === 'recovery-show');
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
      'auth/requires-recent-login': 'acc.err.recentLogin',
      unavailable: 'acc.err.network',
      'permission-denied': 'acc.err.permission',
      'weak-password': 'acc.err.weakSync',
      'password-mismatch': 'acc.err.mismatch',
      'wrong-password': 'acc.err.wrongSync',
      'wrong-recovery-key': 'acc.err.wrongRecovery',
      'bad-recovery-key': 'acc.err.badRecovery',
      'not-verified': 'acc.err.notVerified',
      'too-large': 'acc.err.tooLarge',
      'unsupported-browser': 'acc.err.browser',
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

  checkNewPassword(pw, pw2) {
    if (!pw || pw.length < Vault.MIN_PASSWORD_LENGTH) throw new Vault.VaultError('weak-password');
    if (pw !== pw2) throw new Vault.VaultError('password-mismatch');
  },

  bind() {
    const $ = (id) => document.getElementById(id);
    const val = (id) => $(id).value;
    const clear = (...ids) => ids.forEach((id) => { $(id).value = ''; });

    $('accGoogleBtn').addEventListener('click', (e) => this.run(e.currentTarget, () => Sync.signInGoogle()));

    $('accEmailForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.run(e.submitter, async () => {
        await Sync.signInEmail(val('accEmail').trim(), val('accPassword'));
        clear('accPassword');
      });
    });
    $('accSignUpBtn').addEventListener('click', (e) => this.run(e.currentTarget, async () => {
      const pw = val('accPassword');
      if (pw.length < 8) { const err = new Error(); err.code = 'auth/weak-password'; throw err; }
      await Sync.signUpEmail(val('accEmail').trim(), pw);
      clear('accPassword');
    }));
    $('accForgotBtn').addEventListener('click', (e) => this.run(e.currentTarget, async () => {
      const email = val('accEmail').trim();
      if (!email) { const err = new Error(); err.code = 'auth/missing-email'; throw err; }
      await Sync.resetPassword(email);
      this.showInfo('acc.resetSent');
    }));

    $('accVerifiedBtn').addEventListener('click', (e) => this.run(e.currentTarget, async () => {
      const ok = await Sync.checkVerified();
      if (!ok) { const err = new Error(); err.code = 'not-verified'; throw err; }
    }));
    $('accResendBtn').addEventListener('click', (e) => this.run(e.currentTarget, async () => {
      await Sync.resendVerification();
      this.showInfo('acc.verifySent');
    }));

    $('accForeignOkBtn').addEventListener('click', (e) => this.run(e.currentTarget, () => Sync.acceptForeign()));

    $('accSetupForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.run(e.submitter, async () => {
        this.checkNewPassword(val('accSetupPw'), val('accSetupPw2'));
        this.recoveryKey = await Sync.setup(val('accSetupPw'));
        clear('accSetupPw', 'accSetupPw2');
        $('accRecSaved').checked = false;
        $('accRecDoneBtn').disabled = true;
        this.go('recovery-show');
      });
    });

    $('accRecCopyBtn').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(this.recoveryKey);
        this.showInfo('acc.copied');
      } catch (e) {
        this.showError('unknown');
      }
    });
    $('accRecDownloadBtn').addEventListener('click', () => {
      const text = `${t('brand.name')} — ${t('acc.recTitle')}\n\n${this.recoveryKey}\n\n${Sync.user ? Sync.user.email : ''}\n\n${t('acc.recFileNote')}\n`;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
      a.download = 'finance-book-recovery-key.txt';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    $('accRecSaved').addEventListener('change', () => { $('accRecDoneBtn').disabled = !$('accRecSaved').checked; });
    $('accRecDoneBtn').addEventListener('click', () => {
      // کلید بازیابی فقط همین یک بار نمایش داده می‌شود و در هیچ‌جا ذخیره نمی‌شود
      this.recoveryKey = null;
      $('accRecKey').textContent = '';
      this.go(null);
    });

    $('accUnlockForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.run(e.submitter, async () => {
        await Sync.unlock(val('accUnlockPw'));
        clear('accUnlockPw');
        this.go(null);
      });
    });

    $('accRecoverForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.run(e.submitter, async () => {
        this.checkNewPassword(val('accRecoverPw'), val('accRecoverPw2'));
        await Sync.recover(val('accRecoverKey'), val('accRecoverPw'));
        clear('accRecoverKey', 'accRecoverPw', 'accRecoverPw2');
        this.go(null);
        this.showInfo('acc.recovered');
      });
    });

    $('accSyncNowBtn').addEventListener('click', (e) => this.run(e.currentTarget, () => Sync.syncNow()));

    $('accChangePwForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.run(e.submitter, async () => {
        this.checkNewPassword(val('accNewPw'), val('accNewPw2'));
        await Sync.changePassword(val('accCurPw'), val('accNewPw'));
        clear('accCurPw', 'accNewPw', 'accNewPw2');
        this.go(null);
        this.showInfo('acc.pwChanged');
      });
    });

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

    $('accDeleteBtn').addEventListener('click', (e) => this.run(e.currentTarget, async () => {
      this.go(null);
      await Sync.deleteCloud();
      this.showInfo('acc.deleted');
    }));

    document.querySelectorAll('#accountModalOverlay [data-acc-go]').forEach((b) => {
      b.addEventListener('click', () => this.go(b.dataset.accGo));
    });
    document.querySelectorAll('#accountModalOverlay [data-acc-back]').forEach((b) => {
      b.addEventListener('click', () => this.go(null));
    });
  },
};
