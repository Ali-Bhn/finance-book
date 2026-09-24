// رمزنگاری سرتاسری با Web Crypto (بدون کتابخانه‌ی خارجی).
//
// طرح کلی:
// - برای هر حساب یک «کلید داده» تصادفی AES-256-GCM ساخته می‌شود؛ همه‌ی داده‌ها با همین کلید رمز می‌شوند.
// - کلید داده دو بار «قفل» (wrap) می‌شود: یک بار با کلیدی که از رمز همگام‌سازی ساخته می‌شود
//   (PBKDF2-SHA256، ۶۰۰٬۰۰۰ دور) و یک بار با کلیدی که از کلید بازیابی ساخته می‌شود (HKDF-SHA256).
// - روی سرور فقط کلیدهای قفل‌شده و داده‌ی رمزشده ذخیره می‌شود؛ رمز و کلید بازیابی هرگز از دستگاه خارج نمی‌شوند.
// - شناسه‌ی کاربر به‌عنوان داده‌ی احراز (AAD) در رمزنگاری وارد می‌شود، تا نتوان داده‌ی یک حساب را در حساب دیگری جا زد.
// - روی هر دستگاه، کلید داده به‌صورت «غیرقابل استخراج» در IndexedDB نگه داشته می‌شود.

const Vault = (() => {
  const subtle = globalThis.crypto.subtle;
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const PBKDF2_ITERATIONS = 600000;
  const MIN_PASSWORD_LENGTH = 8;
  // Crockford base32: بدون حروف گیج‌کننده (I, L, O, U)
  const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

  const rand = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));

  function b64(buf) {
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function unb64(str) {
    const s = atob(str);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i += 1) out[i] = s.charCodeAt(i);
    return out;
  }

  function encodeRecoveryKey(bytes) {
    let bits = 0;
    let value = 0;
    let out = '';
    bytes.forEach((byte) => {
      value = (value << 8) | byte;
      bits += 8;
      while (bits >= 5) {
        out += B32[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    });
    if (bits > 0) out += B32[(value << (5 - bits)) & 31];
    return out.match(/.{1,4}/g).join('-');
  }

  function decodeRecoveryKey(str) {
    const clean = String(str).toUpperCase().replace(/[\s-]/g, '')
      .replace(/O/g, '0').replace(/[IL]/g, '1');
    if (!/^[0-9A-HJKMNP-TV-Z]{32}$/.test(clean)) throw new VaultError('bad-recovery-key');
    let bits = 0;
    let value = 0;
    const out = [];
    for (const ch of clean) {
      value = (value << 5) | B32.indexOf(ch);
      bits += 5;
      if (bits >= 8) {
        out.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }
    return new Uint8Array(out.slice(0, 20));
  }

  class VaultError extends Error {
    constructor(code) { super(code); this.code = code; }
  }

  const keyAad = (uid) => enc.encode(`finance-book:key:${uid}`);
  const dataAad = (uid) => enc.encode(`finance-book:data:${uid}`);

  async function passwordKek(password, salt, iterations) {
    const base = await subtle.importKey('raw', enc.encode(String(password).normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
    return subtle.deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
      base, { name: 'AES-GCM', length: 256 }, false, ['wrapKey', 'unwrapKey'],
    );
  }

  async function recoveryKek(rkBytes, salt) {
    const base = await subtle.importKey('raw', rkBytes, 'HKDF', false, ['deriveKey']);
    return subtle.deriveKey(
      { name: 'HKDF', hash: 'SHA-256', salt, info: enc.encode('finance-book recovery v1') },
      base, { name: 'AES-GCM', length: 256 }, false, ['wrapKey', 'unwrapKey'],
    );
  }

  async function wrap(dek, kek, uid) {
    const iv = rand(12);
    const key = await subtle.wrapKey('raw', dek, kek, { name: 'AES-GCM', iv, additionalData: keyAad(uid) });
    return { iv: b64(iv), key: b64(key) };
  }

  async function unwrap(wrapped, kek, uid, extractable) {
    try {
      return await subtle.unwrapKey(
        'raw', unb64(wrapped.key), kek,
        { name: 'AES-GCM', iv: unb64(wrapped.iv), additionalData: keyAad(uid) },
        { name: 'AES-GCM' }, extractable, ['encrypt', 'decrypt'],
      );
    } catch (e) {
      return null;
    }
  }

  async function toDeviceKey(extractableDek) {
    const raw = await subtle.exportKey('raw', extractableDek);
    const key = await subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
    new Uint8Array(raw).fill(0);
    return key;
  }

  function checkPassword(password) {
    if (!password || String(password).length < MIN_PASSWORD_LENGTH) throw new VaultError('weak-password');
  }

  // ساخت گاوصندوق جدید: خروجی = سرآیند (برای سرور)، کلید دستگاه، و کلید بازیابی (فقط یک بار نمایش داده می‌شود)
  async function create(uid, password) {
    checkPassword(password);
    const dek = await subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    const salt = rand(16);
    const recSalt = rand(16);
    const rkBytes = rand(20);
    const header = {
      v: 1,
      kdf: { alg: 'PBKDF2-SHA256', iter: PBKDF2_ITERATIONS, salt: b64(salt) },
      pw: await wrap(dek, await passwordKek(password, salt, PBKDF2_ITERATIONS), uid),
      rec: Object.assign({ salt: b64(recSalt) }, await wrap(dek, await recoveryKek(rkBytes, recSalt), uid)),
    };
    const recoveryKey = encodeRecoveryKey(rkBytes);
    rkBytes.fill(0);
    return { header, deviceKey: await toDeviceKey(dek), recoveryKey };
  }

  async function unlockWithPassword(uid, header, password, extractable = false) {
    const kek = await passwordKek(password, unb64(header.kdf.salt), header.kdf.iter);
    const dek = await unwrap(header.pw, kek, uid, extractable);
    if (!dek) throw new VaultError('wrong-password');
    return dek;
  }

  async function unlockWithRecoveryKey(uid, header, recoveryKey, extractable = false) {
    const rkBytes = decodeRecoveryKey(recoveryKey);
    const kek = await recoveryKek(rkBytes, unb64(header.rec.salt));
    rkBytes.fill(0);
    const dek = await unwrap(header.rec, kek, uid, extractable);
    if (!dek) throw new VaultError('wrong-recovery-key');
    return dek;
  }

  // رمز جدید: کلید داده عوض نمی‌شود، فقط با رمز جدید دوباره قفل می‌شود (کلید بازیابی همچنان معتبر است)
  async function rewrapWithPassword(uid, extractableDek, newPassword) {
    checkPassword(newPassword);
    const salt = rand(16);
    return {
      kdf: { alg: 'PBKDF2-SHA256', iter: PBKDF2_ITERATIONS, salt: b64(salt) },
      pw: await wrap(extractableDek, await passwordKek(newPassword, salt, PBKDF2_ITERATIONS), uid),
    };
  }

  async function compress(bytes) {
    if (typeof CompressionStream === 'undefined') return { bytes, z: null };
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
    return { bytes: new Uint8Array(await new Response(stream).arrayBuffer()), z: 'gzip' };
  }
  async function decompress(bytes, z) {
    if (!z) return bytes;
    if (typeof DecompressionStream === 'undefined') throw new VaultError('unsupported-browser');
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(z));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function encrypt(uid, key, obj) {
    const { bytes, z } = await compress(enc.encode(JSON.stringify(obj)));
    const iv = rand(12);
    const ct = await subtle.encrypt({ name: 'AES-GCM', iv, additionalData: dataAad(uid) }, key, bytes);
    return { iv: b64(iv), ct: b64(ct), z };
  }

  async function decrypt(uid, key, box) {
    let plain;
    try {
      plain = await subtle.decrypt({ name: 'AES-GCM', iv: unb64(box.iv), additionalData: dataAad(uid) }, key, unb64(box.ct));
    } catch (e) {
      throw new VaultError('decrypt-failed');
    }
    return JSON.parse(dec.decode(await decompress(new Uint8Array(plain), box.z)));
  }

  // ---------- نگهداری کلید روی دستگاه (IndexedDB، غیرقابل استخراج) ----------
  const DB_NAME = 'finance-book-keys';
  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore('keys');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function kv(mode, fn) {
    const db = await openDb();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('keys', mode);
        const req = fn(tx.objectStore('keys'));
        tx.oncomplete = () => resolve(req && req.result);
        tx.onerror = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }
  const DeviceKeys = {
    get: (uid) => kv('readonly', (s) => s.get(uid)).catch(() => null),
    set: (uid, key) => kv('readwrite', (s) => s.put(key, uid)),
    remove: (uid) => kv('readwrite', (s) => s.delete(uid)).catch(() => null),
  };

  return {
    MIN_PASSWORD_LENGTH,
    VaultError,
    create,
    unlockWithPassword,
    unlockWithRecoveryKey,
    rewrapWithPassword,
    toDeviceKey,
    encrypt,
    decrypt,
    DeviceKeys,
    // فقط برای تست
    _encodeRecoveryKey: encodeRecoveryKey,
    _decodeRecoveryKey: decodeRecoveryKey,
  };
})();

if (typeof module !== 'undefined') module.exports = { Vault };
