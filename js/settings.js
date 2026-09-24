// تنظیمات کلی برنامه: زبان، واحد پول، نوع تقویم

const SETTINGS_KEY = 'finance_app_settings_v1';

const defaultSettings = () => ({
  language: 'en',   // 'fa' | 'en' | 'de'
  currency: 'IRT',  // 'IRT' | 'IRR' | 'USD' | 'EUR' | 'GBP'
  calendar: 'jalali', // 'jalali' | 'gregorian'
});

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings();
    return Object.assign(defaultSettings(), JSON.parse(raw));
  } catch (e) {
    console.error('خطا در بارگذاری تنظیمات', e);
    return defaultSettings();
  }
}

const Settings = {
  data: loadSettings(),
  // اگر قبلاً هیچ تنظیماتی ذخیره نشده، یعنی اولین بازدید کاربر از سایت است
  isFirstVisit: localStorage.getItem(SETTINGS_KEY) === null,
  get() {
    return this.data;
  },
  update(changes) {
    Object.assign(this.data, changes, { updatedAt: Date.now() });
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.data));
    if (typeof Sync !== 'undefined') Sync.onLocalChange();
  },
  // تنظیمات رسیده از همگام‌سازی (بدون تغییر زمان)
  replace(data) {
    this.data = Object.assign(defaultSettings(), data);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.data));
  },
};
