// توابع کمکی عمومی: تاریخ، فرمت عدد، تولید شناسه — همگی به تنظیمات زبان/واحدپول/تقویم حساس هستند

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const LOCALE_MAP = { fa: 'fa-IR', en: 'en-US', de: 'de-DE' };

const CURRENCY_INFO = {
  IRT: { position: 'after', label: { fa: 'تومان', en: 'Toman', de: 'Toman' } },
  IRR: { position: 'after', label: { fa: 'ریال', en: 'Rial', de: 'Rial' } },
  USD: { position: 'before', symbol: '$' },
  EUR: { position: 'before', symbol: '€' },
  GBP: { position: 'before', symbol: '£' },
};

function formatCurrency(amount) {
  const n = Number(amount) || 0;
  const { language, currency } = Settings.get();
  const locale = LOCALE_MAP[language] || 'en-US';
  const formatted = n.toLocaleString(locale, { maximumFractionDigits: 2 });
  const info = CURRENCY_INFO[currency] || CURRENCY_INFO.IRT;
  if (info.position === 'before') return `${info.symbol}${formatted}`;
  const label = info.label[language] || info.label.en;
  return `${formatted} ${label}`;
}

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// کلید ماه، بسته به تقویم انتخاب‌شده در تنظیمات، به شکل شمسی یا میلادی تولید می‌شود
function monthKeyOf(dateIso) {
  const [gy, gm, gd] = dateIso.split('-').map(Number);
  if (Settings.get().calendar === 'jalali') {
    const j = toJalaali(gy, gm, gd);
    return `${j.jy}-${String(j.jm).padStart(2, '0')}`;
  }
  return `${gy}-${String(gm).padStart(2, '0')}`;
}

function currentMonthKey() {
  return monthKeyOf(todayIso());
}

function monthKeyLabel(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  const lang = Settings.get().language;
  const names = Settings.get().calendar === 'jalali' ? JALALI_MONTHS[lang] : GREGORIAN_MONTHS[lang];
  return `${names[month - 1]} ${year}`;
}

function shiftMonthKey(monthKey, delta) {
  const [year, month] = monthKey.split('-').map(Number);
  if (Settings.get().calendar === 'jalali') {
    let jy = year;
    let jm = month + delta;
    while (jm > 12) { jm -= 12; jy += 1; }
    while (jm < 1) { jm += 12; jy -= 1; }
    return `${jy}-${String(jm).padStart(2, '0')}`;
  }
  const d = new Date(year, month - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function daysInMonth(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  if (Settings.get().calendar === 'jalali') {
    return jalaaliMonthLength(year, month);
  }
  return new Date(year, month, 0).getDate();
}

function clampDayToMonth(day, monthKey) {
  return Math.min(day, daysInMonth(monthKey));
}

// روز امروز در تقویم انتخاب‌شده (شمسی یا میلادی)
function todayDayOfMonth() {
  const [gy, gm, gd] = todayIso().split('-').map(Number);
  if (Settings.get().calendar === 'jalali') return toJalaali(gy, gm, gd).jd;
  return gd;
}

// از «کلید ماه + روز» (در تقویم انتخاب‌شده) تاریخ میلادی ISO می‌سازد؛ تاریخ‌ها همیشه میلادی ذخیره می‌شوند
function isoFromMonthKeyDay(monthKey, day) {
  const [year, month] = monthKey.split('-').map(Number);
  let gy = year;
  let gm = month;
  let gd = day;
  if (Settings.get().calendar === 'jalali') {
    ({ gy, gm, gd } = toGregorian(year, month, day));
  }
  return `${gy}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}`;
}

// تاریخ یک تراکنش (که همیشه به‌صورت میلادی ذخیره می‌شود) را برای نمایش، مطابق تقویم انتخابی فرمت می‌کند
function formatDateDisplay(dateIso) {
  const [gy, gm, gd] = dateIso.split('-').map(Number);
  if (Settings.get().calendar === 'jalali') {
    const j = toJalaali(gy, gm, gd);
    return `${String(j.jd).padStart(2, '0')}/${String(j.jm).padStart(2, '0')}/${j.jy}`;
  }
  return `${String(gd).padStart(2, '0')}/${String(gm).padStart(2, '0')}/${gy}`;
}

const EXPENSE_CATEGORY_CODES = [
  'food', 'transport', 'housing', 'bills', 'health', 'clothing',
  'entertainment', 'education', 'installment', 'recurring', 'misc',
];

const INCOME_CATEGORY_CODES = [
  'salary', 'subsidy', 'rental', 'bonus', 'sale', 'investment', 'gift', 'misc',
];

const CATEGORY_ICONS = {
  food: '🍔', transport: '🚗', housing: '🏠', bills: '💡', health: '💊', clothing: '👕',
  entertainment: '🎬', education: '📚', installment: '🧾', recurring: '🔁', misc: '📦',
  salary: '💼', subsidy: '🏛️', rental: '🏘️', bonus: '⭐', sale: '🏷️', investment: '📈', gift: '🎁',
};

function categoryIcon(code) {
  return CATEGORY_ICONS[code] || '📦';
}
