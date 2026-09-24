// اتصال به Firebase (ورود + ذخیره‌ی سند رمزشده). فقط وقتی بارگذاری می‌شود که کاربر بخواهد وارد شود
// یا قبلاً وارد شده باشد؛ بدون ورود، برنامه هیچ ارتباطی با سرور ندارد.
// هر کاربر فقط به سند خودش (users/{uid}) دسترسی دارد (نگاه کنید به firestore.rules).

const SDK = 'https://www.gstatic.com/firebasejs/10.14.1';

export async function createFirebaseAdapter(config) {
  const [{ initializeApp }, authMod, fsMod] = await Promise.all([
    import(`${SDK}/firebase-app.js`),
    import(`${SDK}/firebase-auth.js`),
    import(`${SDK}/firebase-firestore.js`),
  ]);
  const {
    getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
    createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail,
    signOut, deleteUser, reload, reauthenticateWithPopup, reauthenticateWithCredential, EmailAuthProvider,
  } = authMod;
  const { getFirestore, doc, getDoc, runTransaction, deleteDoc, serverTimestamp } = fsMod;

  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);
  getRedirectResult(auth).catch(() => {});

  const toUser = (u) => (u ? {
    uid: u.uid,
    email: u.email,
    emailVerified: u.emailVerified,
    provider: (u.providerData[0] && u.providerData[0].providerId) || 'password',
  } : null);

  const userDoc = () => doc(db, 'users', auth.currentUser.uid);

  return {
    onAuth(cb) {
      return onAuthStateChanged(auth, (u) => cb(toUser(u)));
    },
    currentUser: () => toUser(auth.currentUser),
    setLanguage(lang) { auth.languageCode = lang; },

    async signInGoogle() {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      try {
        await signInWithPopup(auth, provider);
      } catch (e) {
        // اگر مرورگر پنجره‌ی بازشو را مسدود کرد (مثلاً در حالت نصب‌شده روی موبایل)، از روش هدایت استفاده می‌کنیم
        if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) {
          await signInWithRedirect(auth, provider);
          return;
        }
        throw e;
      }
    },
    signInEmail: (email, password) => signInWithEmailAndPassword(auth, email, password),
    async signUpEmail(email, password) {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(cred.user);
    },
    sendVerification: () => sendEmailVerification(auth.currentUser),
    async reloadUser() {
      await reload(auth.currentUser);
      // توکن را تازه می‌کنیم تا قوانین سرور وضعیت «ایمیل تأییدشده» را ببینند
      await auth.currentUser.getIdToken(true);
      return toUser(auth.currentUser);
    },
    resetPassword: (email) => sendPasswordResetEmail(auth, email),
    signOut: () => signOut(auth),
    // قبل از حذف حساب، هویت دوباره تأیید می‌شود (Firebase حذف را فقط بعد از ورود تازه اجازه می‌دهد)
    async reauthenticate(password) {
      const u = auth.currentUser;
      if (password) {
        await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, password));
      } else {
        await reauthenticateWithPopup(u, new GoogleAuthProvider());
      }
    },
    deleteAccount: () => deleteUser(auth.currentUser),

    async getDoc() {
      const snap = await getDoc(userDoc());
      return snap.exists() ? snap.data() : null;
    },
    // ذخیره با کنترل نسخه: اگر دستگاه دیگری در این فاصله چیزی نوشته باشد، خطای conflict می‌دهد
    async saveDoc(fields, expectedRev) {
      const ref = userDoc();
      return runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const currentRev = snap.exists() ? snap.data().rev : null;
        if (currentRev !== expectedRev) {
          const err = new Error('conflict');
          err.code = 'conflict';
          throw err;
        }
        const rev = (currentRev || 0) + 1;
        // همیشه کل داده نوشته می‌شود؛ فیلدهای قدیمی (مثلاً سند رمزشده‌ی نسخه‌ی قبل) جایگزین می‌شوند
        tx.set(ref, Object.assign({}, fields, { rev, updatedAt: serverTimestamp() }));
        return rev;
      });
    },
    deleteDoc: () => deleteDoc(userDoc()),
  };
}
