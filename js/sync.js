// موتور همگام‌سازی اختیاری.
// بدون ورود، هیچ کاری انجام نمی‌دهد و برنامه مثل قبل فقط روی همین دستگاه کار می‌کند.
// با ورود: داده‌ها روی دستگاه رمز می‌شوند (js/vault.js)، با نسخه‌ی ابری ادغام می‌شوند (js/merge.js)
// و نتیجه‌ی رمزشده ذخیره می‌شود (js/cloud.js).

const SYNC_META_KEY = 'finance_app_sync_v1';

const Sync = {
  status: 'unavailable', // unavailable | signed-out | loading | needs-verify | foreign | needs-setup | locked | syncing | ok | error
  error: null,
  user: null,
  key: null,
  adapter: null,
  listeners: [],
  applying: false,
  running: null,
  again: false,
  timer: null,
  meta: (() => {
    try { return JSON.parse(localStorage.getItem(SYNC_META_KEY)) || {}; } catch (e) { return {}; }
  })(),

  available() {
    return !!(window.__TEST_CLOUD_ADAPTER__ || window.FIREBASE_CONFIG);
  },

  saveMeta(changes) {
    Object.assign(this.meta, changes);
    localStorage.setItem(SYNC_META_KEY, JSON.stringify(this.meta));
  },

  on(cb) { this.listeners.push(cb); },
  setStatus(status, error = null) {
    this.status = status;
    this.error = error;
    this.listeners.forEach((cb) => cb(this));
  },
  fail(e) {
    console.error('sync', e);
    this.setStatus('error', (e && e.code) || 'unknown');
  },

  init() {
    if (!this.available()) { this.setStatus('unavailable'); return; }
    this.setStatus('signed-out');
    // اگر کاربر قبلاً وارد شده، اتصال را برقرار می‌کنیم تا نشست ذخیره‌شده بازیابی شود
    if (this.meta.signedIn) this.connect().catch(() => {});
    window.addEventListener('online', () => this.kick());
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.kick(); });
  },

  async connect() {
    if (this.adapter) return this.adapter;
    if (!this.connecting) {
      this.connecting = (async () => {
        this.setStatus('loading');
        const adapter = window.__TEST_CLOUD_ADAPTER__
          || await (await import('./cloud.js')).createFirebaseAdapter(window.FIREBASE_CONFIG);
        adapter.setLanguage(Settings.get().language);
        this.adapter = adapter;
        adapter.onAuth((u) => { this.handleUser(u).catch((e) => this.fail(e)); });
        return adapter;
      })();
    }
    try {
      return await this.connecting;
    } catch (e) {
      this.connecting = null;
      this.fail(e);
      throw e;
    }
  },

  localHasData() {
    return store.data.transactions.length + store.data.installments.length + store.data.recurring.length > 0;
  },

  async handleUser(user) {
    this.user = user;
    this.key = null;
    if (!user) {
      this.saveMeta({ signedIn: false });
      this.setStatus('signed-out');
      return;
    }
    this.saveMeta({ signedIn: true });
    if (user.provider === 'password' && !user.emailVerified) { this.setStatus('needs-verify'); return; }
    // داده‌های این دستگاه متعلق به حساب دیگری است؛ هرگز آن‌ها را وارد این حساب نمی‌کنیم
    if (this.meta.ownerUid && this.meta.ownerUid !== user.uid && this.localHasData()) {
      this.setStatus('foreign');
      return;
    }
    await this.continueSignedIn();
  },

  async continueSignedIn() {
    this.setStatus('loading');
    const remote = await this.adapter.getDoc();
    if (!remote) { this.setStatus('needs-setup'); return; }
    const key = await Vault.DeviceKeys.get(this.user.uid);
    if (!key) { this.setStatus('locked'); return; }
    this.key = key;
    this.saveMeta({ ownerUid: this.user.uid });
    await this.syncNow();
  },

  // ---------- ورود ----------
  async signInGoogle() { await (await this.connect()).signInGoogle(); },
  async signInEmail(email, password) { await (await this.connect()).signInEmail(email, password); },
  async signUpEmail(email, password) {
    const adapter = await this.connect();
    await adapter.signUpEmail(email, password);
    // onAuth ممکن است قبل از ارسال ایمیل اجرا شده باشد؛ وضعیت را دوباره تعیین می‌کنیم
    await this.handleUser(adapter.currentUser());
  },
  async resendVerification() { await this.adapter.sendVerification(); },
  async checkVerified() {
    const user = await this.adapter.reloadUser();
    await this.handleUser(user);
    return user.emailVerified;
  },
  async resetPassword(email) { await (await this.connect()).resetPassword(email); },

  async acceptForeign() {
    store.replace(defaultData());
    store.resetSnapshot();
    this.saveMeta({ ownerUid: null });
    this.notifyDataChanged();
    await this.continueSignedIn();
  },

  // ---------- گاوصندوق ----------
  async setup(password) {
    const uid = this.user.uid;
    const { header, deviceKey, recoveryKey } = await Vault.create(uid, password);
    const data = await Vault.encrypt(uid, deviceKey, this.currentPayload());
    await this.adapter.saveDoc(Object.assign({}, header, { data }), null);
    await Vault.DeviceKeys.set(uid, deviceKey);
    this.key = deviceKey;
    this.saveMeta({ ownerUid: uid, lastSyncAt: Date.now() });
    this.setStatus('ok');
    return recoveryKey;
  },

  async unlock(password) {
    const uid = this.user.uid;
    const remote = await this.adapter.getDoc();
    const key = await Vault.unlockWithPassword(uid, remote, password);
    await this.useKey(key);
  },

  async recover(recoveryKey, newPassword) {
    const uid = this.user.uid;
    const remote = await this.adapter.getDoc();
    const dek = await Vault.unlockWithRecoveryKey(uid, remote, recoveryKey, true);
    const fields = await Vault.rewrapWithPassword(uid, dek, newPassword);
    await this.adapter.saveDoc(fields, remote.rev);
    await this.useKey(await Vault.toDeviceKey(dek));
  },

  async changePassword(currentPassword, newPassword) {
    const uid = this.user.uid;
    const remote = await this.adapter.getDoc();
    const dek = await Vault.unlockWithPassword(uid, remote, currentPassword, true);
    const fields = await Vault.rewrapWithPassword(uid, dek, newPassword);
    await this.adapter.saveDoc(fields, remote.rev);
  },

  async useKey(key) {
    await Vault.DeviceKeys.set(this.user.uid, key);
    this.key = key;
    this.saveMeta({ ownerUid: this.user.uid });
    await this.syncNow();
  },

  async forgetKey() {
    if (this.user) await Vault.DeviceKeys.remove(this.user.uid);
    this.key = null;
  },

  // ---------- داده ----------
  currentPayload() {
    return JSON.parse(JSON.stringify(Object.assign({}, store.data, { settings: Settings.get() })));
  },

  applyPayload(payload) {
    this.applying = true;
    try {
      const languageBefore = Settings.get().language;
      store.replace(payload);
      if (payload.settings) Settings.replace(payload.settings);
      Installments.all();
      Recurring.all();
      store.resetSnapshot();
      // موارد ماهانه/قسط‌هایی که از دستگاه دیگر رسیده‌اند ممکن است این ماه ثبت‌نشده باشند
      Installments.syncAllForCurrentMonth();
      Recurring.syncAllForCurrentMonth();
      this.notifyDataChanged(languageBefore !== Settings.get().language);
    } finally {
      this.applying = false;
    }
  },

  notifyDataChanged(settingsChanged = true) {
    document.dispatchEvent(new CustomEvent('finance:data-changed', { detail: { settingsChanged } }));
  },

  onLocalChange() {
    if (this.applying || !this.key) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.syncNow(), 1500);
  },

  kick() {
    if (this.key && (this.status === 'ok' || this.status === 'error')) this.syncNow();
  },

  syncNow() {
    if (this.running) { this.again = true; return this.running; }
    this.running = (async () => {
      try {
        do {
          this.again = false;
          await this.syncOnce();
        } while (this.again);
      } catch (e) {
        this.fail(e);
      } finally {
        this.running = null;
      }
    })();
    return this.running;
  },

  async syncOnce() {
    if (!this.user || !this.key) return;
    const uid = this.user.uid;
    this.setStatus('syncing');
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const remote = await this.adapter.getDoc();
      if (!remote) {
        // داده‌های ابری از دستگاه دیگری حذف شده است
        await this.forgetKey();
        this.setStatus('needs-setup');
        return;
      }
      let remotePayload;
      try {
        remotePayload = await Vault.decrypt(uid, this.key, remote.data);
      } catch (e) {
        // کلید این دستگاه دیگر معتبر نیست؛ باید دوباره رمز وارد شود
        await this.forgetKey();
        this.setStatus('locked');
        return;
      }
      const local = this.currentPayload();
      const merged = mergePayloads(local, remotePayload);
      if (JSON.stringify(merged) !== JSON.stringify(local)) this.applyPayload(merged);
      const finalPayload = this.currentPayload();
      if (JSON.stringify(finalPayload) !== JSON.stringify(remotePayload)) {
        const data = await Vault.encrypt(uid, this.key, finalPayload);
        if (data.ct.length > 900000) { this.setStatus('error', 'too-large'); return; }
        try {
          await this.adapter.saveDoc({ data }, remote.rev);
        } catch (e) {
          // اگر دستگاه دیگری هم‌زمان نوشته باشد، قوانین سرور (rev باید دقیقاً یکی بیشتر باشد) نوشتن را رد می‌کنند
          // و Firebase آن را permission-denied/aborted گزارش می‌کند؛ دوباره می‌خوانیم، ادغام می‌کنیم و تکرار می‌کنیم.
          // اگر مشکل واقعاً دسترسی باشد، همه‌ی تلاش‌ها رد می‌شوند و خطا نمایش داده می‌شود.
          const retryable = e && ['conflict', 'permission-denied', 'aborted', 'failed-precondition'].includes(e.code);
          if (retryable && attempt < 3) {
            await new Promise((r) => setTimeout(r, 200 + Math.random() * 600));
            continue;
          }
          throw e;
        }
      }
      this.saveMeta({ lastSyncAt: Date.now() });
      this.setStatus('ok');
      return;
    }
    this.setStatus('error', 'conflict');
  },

  // ---------- خروج و حذف ----------
  async signOut(keepLocalData) {
    const uid = this.user && this.user.uid;
    clearTimeout(this.timer);
    if (this.running) await this.running;
    if (uid) await Vault.DeviceKeys.remove(uid);
    this.key = null;
    if (!keepLocalData) {
      store.replace(defaultData());
      store.resetSnapshot();
      this.saveMeta({ ownerUid: null });
      this.notifyDataChanged();
    }
    await this.adapter.signOut();
  },

  async deleteCloud() {
    const uid = this.user.uid;
    clearTimeout(this.timer);
    if (this.running) await this.running;
    await this.adapter.deleteDoc();
    await Vault.DeviceKeys.remove(uid);
    this.key = null;
    // داده‌های این دستگاه متعلق به خود کاربر است و می‌ماند
    this.saveMeta({ ownerUid: null });
    this.setStatus('needs-setup');
    await this.adapter.deleteAccount();
  },
};
