// ادغام داده‌های دو دستگاه (محلی و ابری) — تابع خالص و بدون وابستگی، تا جداگانه قابل تست باشد.
// قاعده: برای هر رکورد، نسخه‌ی جدیدتر (updatedAt بزرگ‌تر) برنده است؛ فهرست ماه‌های پرداخت/ثبت‌شده
// اجتماع گرفته می‌شود تا هیچ ماهی دوباره شارژ نشود؛ رکوردی که بعد از آخرین تغییرش حذف شده، حذف می‌ماند.

const MERGE_COLLECTIONS = ['transactions', 'installments', 'recurring'];
const MERGE_UNION_KEYS = ['paidMonthKeys', 'skippedMonthKeys', 'generatedMonthKeys'];

function mergePayloads(a, b) {
  a = a || {};
  b = b || {};
  const deleted = Object.assign({}, a.deleted || {});
  Object.entries(b.deleted || {}).forEach(([id, ts]) => {
    deleted[id] = Math.max(deleted[id] || 0, ts);
  });

  const out = { deleted };
  MERGE_COLLECTIONS.forEach((coll) => {
    const byId = new Map();
    [...(a[coll] || []), ...(b[coll] || [])].forEach((rec) => {
      const prev = byId.get(rec.id);
      if (!prev) { byId.set(rec.id, rec); return; }
      const newer = (rec.updatedAt || 0) > (prev.updatedAt || 0) ? rec : prev;
      const merged = Object.assign({}, newer);
      MERGE_UNION_KEYS.forEach((k) => {
        if (Array.isArray(prev[k]) || Array.isArray(rec[k])) {
          merged[k] = Array.from(new Set([...(prev[k] || []), ...(rec[k] || [])])).sort();
        }
      });
      byId.set(rec.id, merged);
    });
    out[coll] = Array.from(byId.values())
      .filter((rec) => !(deleted[rec.id] && deleted[rec.id] >= (rec.updatedAt || 0)));
  });

  const sa = a.settings || null;
  const sb = b.settings || null;
  if (sa && sb) out.settings = (sb.updatedAt || 0) > (sa.updatedAt || 0) ? sb : sa;
  else out.settings = sa || sb;
  return out;
}

if (typeof module !== 'undefined') module.exports = { mergePayloads };
