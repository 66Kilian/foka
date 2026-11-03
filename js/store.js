// Adatréteg: Firebase Firestore (éles) vagy localStorage (DEMÓ, egy böngészőn belül).
// A vásárlói és a konyhai oldal ugyanazt az API-t használja.
import { CONFIG } from './config.js';

export const isDemo = !CONFIG.firebase;

const DEFAULT_SETTINGS = { open: true, soldOut: [], extraWait: 0 };
const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';

function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = res;
    s.onerror = () => rej(new Error(`Nem tölthető be: ${src}`));
    document.head.append(s);
  });
}

let fbReady = null;
let authReady = null;
function fb({ auth = false } = {}) {
  if (!fbReady) {
    fbReady = (async () => {
      await loadScript(SDK + 'firebase-app-compat.js');
      await loadScript(SDK + 'firebase-firestore-compat.js');
      const app = window.firebase.initializeApp(CONFIG.firebase);
      return { app, db: app.firestore() };
    })();
  }
  if (!auth) return fbReady;
  if (!authReady) {
    authReady = fbReady.then(async (base) => {
      await loadScript(SDK + 'firebase-auth-compat.js');
      return { ...base, auth: base.app.auth() };
    });
  }
  return authReady;
}

// ---------------- DEMÓ backend ----------------
const K_ORD = 'zolgiz_demo_orders';
const K_SET = 'zolgiz_demo_settings';
const subs = new Set();
const readJSON = (k, fb) => { try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch { return fb; } };
const demoOrders = () => readJSON(K_ORD, {});
const demoSettings = () => ({ ...DEFAULT_SETTINGS, ...readJSON(K_SET, {}) });
function demoWrite(k, v) { localStorage.setItem(k, JSON.stringify(v)); subs.forEach((f) => f()); }
if (isDemo) {
  window.addEventListener('storage', (e) => { if (e.key === K_ORD || e.key === K_SET) subs.forEach((f) => f()); });
}
function demoSub(fn) { subs.add(fn); fn(); return () => subs.delete(fn); }

// ---------------- Közös API ----------------
export const makeCode = () => String(Math.floor(100 + Math.random() * 900));

export async function createOrder(order) {
  const data = { ...order, status: 'NEW', createdAt: Date.now() };
  if (isDemo) {
    const id = 'demo-' + crypto.randomUUID().slice(0, 12);
    const all = demoOrders();
    all[id] = data;
    demoWrite(K_ORD, all);
    return id;
  }
  const { db } = await fb();
  const ref = await db.collection('orders').add({ ...data, serverTime: window.firebase.firestore.FieldValue.serverTimestamp() });
  return ref.id;
}

// Egy rendelés figyelése (vásárló). cb(order|null, error?)
export function watchOrder(id, cb) {
  if (isDemo) return demoSub(() => { const o = demoOrders()[id]; cb(o ? { id, ...o } : null); });
  let unsub = () => {};
  let stopped = false;
  fb().then(({ db }) => {
    if (stopped) return;
    unsub = db.collection('orders').doc(id).onSnapshot(
      (d) => cb(d.exists ? { id: d.id, ...d.data() } : null),
      (err) => cb(undefined, err),
    );
  }).catch((err) => cb(undefined, err));
  return () => { stopped = true; unsub(); };
}

// Az elmúlt 24 óra rendelései (konyha). cb(orders[], error?)
export function watchOrders(cb) {
  const since = Date.now() - 24 * 3600 * 1000;
  if (isDemo) {
    return demoSub(() => cb(Object.entries(demoOrders()).map(([id, o]) => ({ id, ...o })).filter((o) => o.createdAt >= since).sort((a, b) => a.createdAt - b.createdAt)));
  }
  let unsub = () => {};
  fb({ auth: true }).then(({ db }) => {
    unsub = db.collection('orders').where('createdAt', '>=', since).orderBy('createdAt', 'asc').onSnapshot(
      (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (err) => cb([], err),
    );
  }).catch((err) => cb([], err));
  return () => unsub();
}

export async function updateOrder(id, patch) {
  if (isDemo) {
    const all = demoOrders();
    if (!all[id]) return;
    all[id] = { ...all[id], ...patch };
    demoWrite(K_ORD, all);
    return;
  }
  const { db } = await fb({ auth: true });
  await db.collection('orders').doc(id).update(patch);
}

export function watchSettings(cb) {
  if (isDemo) return demoSub(() => cb(demoSettings()));
  let unsub = () => {};
  fb().then(({ db }) => {
    unsub = db.collection('settings').doc('store').onSnapshot(
      (d) => cb({ ...DEFAULT_SETTINGS, ...(d.exists ? d.data() : {}) }),
      () => cb({ ...DEFAULT_SETTINGS }),
    );
  }).catch(() => cb({ ...DEFAULT_SETTINGS }));
  return () => unsub();
}

export async function updateSettings(patch) {
  if (isDemo) return demoWrite(K_SET, { ...demoSettings(), ...patch });
  const { db } = await fb({ auth: true });
  await db.collection('settings').doc('store').set(patch, { merge: true });
}

// ---------------- Konyhai belépés ----------------
const K_AUTH = 'zolgiz_demo_kitchen';

export function onAuth(cb) {
  if (isDemo) { cb(sessionStorage.getItem(K_AUTH) === '1' ? { email: 'demo' } : null); return; }
  fb({ auth: true }).then(({ auth }) => auth.onAuthStateChanged((u) => cb(u)));
}

export async function signIn(email, password) {
  if (isDemo) {
    if (password !== CONFIG.demoKitchenPassword) throw new Error('Hibás jelszó.');
    sessionStorage.setItem(K_AUTH, '1');
    return { email: 'demo' };
  }
  const { auth } = await fb({ auth: true });
  try {
    const r = await auth.signInWithEmailAndPassword(email, password);
    return r.user;
  } catch (e) {
    if (e.code === 'auth/too-many-requests') throw new Error('Túl sok próbálkozás. Várj pár percet.');
    if (e.code === 'auth/network-request-failed') throw new Error('Nincs internetkapcsolat.');
    throw new Error('Hibás email vagy jelszó.');
  }
}

export async function signOut() {
  if (isDemo) { sessionStorage.removeItem(K_AUTH); return; }
  const { auth } = await fb({ auth: true });
  await auth.signOut();
}

export async function idToken() {
  if (isDemo) return null;
  const { auth } = await fb({ auth: true });
  return auth.currentUser ? auth.currentUser.getIdToken() : null;
}
