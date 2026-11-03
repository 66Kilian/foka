import { CONFIG } from './config.js';
import { MENU, expectedTotal } from './menu.js';
import * as store from './store.js';
import { estimateDelivery } from './eta.js';
import { $, $$, esc, ft, km, hhmm, mmss, ago, icon, safeLS, unlockAudio, chime, toast, injectIcons } from './util.js';

injectIcons();
const MIN = 60000;
const ACTIVE = ['NEW', 'COOKING', 'READY', 'ON_THE_WAY'];
const PREP_CHOICES = [10, 15, 20, 25, 30, 40, 50, 60];
const REJECT_REASONS = [
  'Sajnos elfogyott valamelyik alapanyag. Hívj minket, és megbeszéljük!',
  'Erre a címre sajnos nem tudunk kiszállítani.',
  'Ma már nem tudunk több rendelést vállalni. Köszönjük a megértést!',
];

const K = {
  orders: [],
  settings: { open: true, soldOut: [], extraWait: 0 },
  sound: false,
  seen: null,          // a már látott rendelés-azonosítók
  rejecting: null,     // melyik blokknál van nyitva az elutasítás
  tab: 'board',
  unsubs: [],
};

/* =========================================================
   BELÉPÉS
   ========================================================= */
const loginEl = $('#login');
const appEl = $('#app');
const loginForm = $('#login-form');

if (store.isDemo) {
  $('#email-field').hidden = true;
  $('#login-demo').hidden = false;
  $('#login-demo').textContent = `DEMÓ mód (nincs Firebase beállítva) – jelszó: „${CONFIG.demoKitchenPassword}”`;
  $('#demo-order').hidden = false;
}


function showLogin() {
  stopApp();
  appEl.hidden = true;
  loginEl.hidden = false;
  loginForm.querySelector(store.isDemo ? '[name=password]' : '[name=email]').focus();
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  unlockAudio(); // a belépés kattintása engedélyezi a hangot
  K.sound = true;
  const fd = new FormData(loginForm);
  const btn = $('#login-btn');
  const err = $('#login-err');
  err.textContent = '';
  btn.disabled = true;
  btn.textContent = 'Belépés…';
  try {
    await store.signIn(String(fd.get('email') || '').trim(), String(fd.get('password') || ''));
    if (store.isDemo) startApp();
  } catch (ex) {
    err.textContent = ex.message;
    loginForm.password.select();
  } finally {
    btn.disabled = false;
    btn.textContent = 'Belépés';
  }
});

$('#logout').addEventListener('click', async () => {
  if (!confirm('Biztosan kilépsz? Amíg ki vagy lépve, nem látod az új rendeléseket.')) return;
  await store.signOut();
  if (store.isDemo) showLogin();
});

/* =========================================================
   ALKALMAZÁS
   ========================================================= */
let started = false;
function startApp() {
  if (started) return;
  started = true;
  loginEl.hidden = true;
  appEl.hidden = false;
  loginForm.reset();
  syncSound();
  keepAwake();
  K.unsubs.push(store.watchOrders((orders, err) => {
    const bar = $('#errbar');
    if (err) {
      bar.hidden = false;
      bar.textContent = err.code === 'permission-denied'
        ? 'Nincs jogosultság a rendelésekhez. Ellenőrizd a Firestore szabályokat és a felhasználót (README).'
        : 'Megszakadt a kapcsolat az adatbázissal – újrapróbálkozunk…';
      return;
    }
    bar.hidden = true;
    onOrders(orders);
  }));
  K.unsubs.push(store.watchSettings((s) => { K.settings = s; renderSettings(); if (K.tab === 'menu') renderMenuPane(); }));
}

function stopApp() {
  K.unsubs.forEach((u) => u?.());
  K.unsubs = [];
  started = false;
  K.seen = null;
}

/* ---------- Új rendelés riasztás ---------- */
// A vásárlótól jövő adatot sosem hisszük el: a számokat számmá kényszerítjük, mielőtt HTML-be kerülnek
const num = (v, fb = 0) => (Number.isFinite(+v) ? +v : fb);
function sanitize(o) {
  return {
    ...o,
    code: String(o.code ?? '').slice(0, 8),
    total: num(o.total),
    createdAt: num(o.createdAt, Date.now()),
    items: (Array.isArray(o.items) ? o.items : []).map((l) => ({
      ...l,
      id: num(l.id),
      qty: Math.max(1, Math.min(99, Math.round(num(l.qty, 1)))),
      extras: Array.isArray(l.extras) ? l.extras : [],
      sauces: Array.isArray(l.sauces) ? l.sauces : [],
      removed: Array.isArray(l.removed) ? l.removed : [],
    })),
    delivery: o.delivery ? { km: num(o.delivery.km), minutes: Math.round(num(o.delivery.minutes, CONFIG.delivery.unknownMinutes)), source: o.delivery.source === 'route' ? 'route' : 'estimate' } : null,
  };
}

function onOrders(orders) {
  orders = orders.map(sanitize);
  K.orders = orders;
  const fresh = [];
  if (K.seen) orders.forEach((o) => { if (!K.seen.has(o.id)) fresh.push(o); });
  K.seen = new Set(orders.map((o) => o.id));
  renderBoard(fresh.map((o) => o.id));
  if (K.tab === 'day') renderDay();
  if (fresh.some((o) => o.status === 'NEW')) {
    ring();
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      try { new Notification('Új rendelés!', { body: fresh.map((o) => `#${o.code} ${o.customerName}`).join(', ') }); } catch { /* */ }
    }
  }
}

function ring() { if (K.sound) chime([880, 1174.66, 880, 1174.66], 0.18); }

// Amíg van el nem fogadott rendelés, 15 mp-enként újra szól
setInterval(() => { if (K.orders.some((o) => o.status === 'NEW')) ring(); }, 15000);

function syncSound() {
  const b = $('#sound-btn');
  b.setAttribute('aria-pressed', String(K.sound));
  b.setAttribute('aria-label', K.sound ? 'Hang kikapcsolása' : 'Hang bekapcsolása');
  b.innerHTML = icon(K.sound ? 'volume' : 'mute');
  b.classList.toggle('is-on', K.sound);
  $('#soundwarn').hidden = K.sound;
}
function soundOn() {
  unlockAudio();
  K.sound = true;
  syncSound();
  chime([660, 880]);
  if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
}
$('#sound-btn').addEventListener('click', () => { if (K.sound) { K.sound = false; syncSound(); } else soundOn(); });
$('[data-sound-on]').addEventListener('click', soundOn);

let wakeLock = null;
async function keepAwake() {
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* nem támogatott */ }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && started && (!wakeLock || wakeLock.released)) keepAwake(); });

/* ---------- Fejléc beállítások ---------- */
function renderSettings() {
  const t = $('#open-toggle');
  t.setAttribute('aria-pressed', String(K.settings.open));
  t.classList.toggle('is-off', !K.settings.open);
  $('[data-open-label]').textContent = `Rendelésfogadás: ${K.settings.open ? 'NYITVA' : 'ZÁRVA'}`;
  $('#extra-wait').value = String(K.settings.extraWait || 0);
}
$('#open-toggle').addEventListener('click', () => {
  const open = !K.settings.open;
  if (!open && !confirm('Lezárod az online rendelést? A vásárlók nem tudnak rendelni, amíg újra ki nem nyitod.')) return;
  saveSettings({ open });
});
$('#extra-wait').addEventListener('change', (e) => saveSettings({ extraWait: +e.target.value }));
async function saveSettings(patch) {
  try { await store.updateSettings(patch); } catch { toast('Nem sikerült menteni. Ellenőrizd a netet.'); }
}

/* ---------- Fülek ---------- */
$('.tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tab]');
  if (!b) return;
  K.tab = b.dataset.tab;
  $$('[data-tab]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
  $('#panel-board').hidden = K.tab !== 'board';
  $('#panel-menu').hidden = K.tab !== 'menu';
  $('#panel-day').hidden = K.tab !== 'day';
  if (K.tab === 'menu') renderMenuPane();
  if (K.tab === 'day') renderDay();
});

/* =========================================================
   PULT (rendelés-tábla)
   ========================================================= */
const prepEnd = (o) => o.acceptedAt + o.prepMinutes * MIN;

function mods(l) {
  const r = [];
  if (l.side) r.push(`<li>Köret: <b>${esc(l.side)}</b></li>`);
  if (l.freeSauce) r.push(`<li>Szósz: <b>${esc(l.freeSauce)}</b></li>`);
  if (l.extras?.length) r.push(`<li class="is-add">+ ${l.extras.map(esc).join(', ')}</li>`);
  if (l.sauces?.length) r.push(`<li class="is-add">+ ${l.sauces.map(esc).join(', ')}</li>`);
  if (l.removed?.length) r.push(`<li class="is-rm">NÉLKÜL: ${l.removed.map(esc).join(', ')}</li>`);
  if (l.note) r.push(`<li class="is-note">„${esc(l.note)}”</li>`);
  return r.length ? `<ul class="kt__mods">${r.join('')}</ul>` : '';
}

function ticket(o, isFresh) {
  const pickup = o.orderType === 'pickup';
  const exp = expectedTotal(o.items);
  const priceWarn = exp !== null && exp !== o.total
    ? `<p class="kt__warn">${icon('alert')}Az összeg nem egyezik az étlappal (étlap szerint ${ft(exp)}). Ellenőrizd!</p>` : '';
  const d = o.delivery;
  return `
  <article class="kt kt--${o.status}${isFresh ? ' is-fresh' : ''}" data-id="${esc(o.id)}" aria-label="Rendelés #${esc(o.code)}">
    <header class="kt__head">
      <b class="kt__code">#${esc(o.code)}</b>
      <span class="kt__type kt__type--${pickup ? 'pickup' : 'delivery'}">${icon(pickup ? 'bag' : 'bike')}${pickup ? 'Elvitel' : 'Házhoz'}</span>
      <time class="kt__time">${hhmm(o.createdAt)} · <span data-ago="${o.createdAt}">${ago(o.createdAt)}</span></time>
    </header>
    <div class="kt__cust">
      <b>${esc(o.customerName)}</b>
      <a href="tel:${esc(o.customerPhone)}">${icon('phone')}${esc(o.customerPhone)}</a>
    </div>
    ${pickup ? '' : `
    <div class="kt__addr">
      ${icon('pin')}
      <div><b>${esc(o.address)}</b>
        <span>${d ? `${km(d.km)} · kb. ${d.minutes} perc út${d.source === 'estimate' ? ' (becslés)' : ''}` : 'Útvonal nem számolható – a futár becsül'}</span>
        ${o.courierNote ? `<span class="kt__cnote">Futárnak: „${esc(o.courierNote)}”</span>` : ''}
      </div>
    </div>`}
    <ul class="kt__items">${o.items.map((l) => `<li><span class="kt__qty">${l.qty}×</span><div><b>${esc(l.name)}</b>${mods(l)}</div></li>`).join('')}</ul>
    ${priceWarn}
    <p class="kt__total"><span>Fizetendő átvételkor</span><b>${ft(o.total)}</b></p>
    ${actions(o)}
  </article>`;
}

function actions(o) {
  const pickup = o.orderType === 'pickup';
  const sent = (k) => (o.notified?.[k] ? `<span class="kt__sent">${icon('msg')}Értesítve ${hhmm(o.notified[k])}</span>` : '');
  switch (o.status) {
    case 'NEW':
      if (K.rejecting === o.id) {
        return `<div class="kt__act kt__act--reject">
          <p class="kt__label">Miért utasítod el? A vásárló ezt látja:</p>
          ${REJECT_REASONS.map((r, i) => `<button type="button" class="kbtn kbtn--ghost kbtn--left" data-reject-reason="${i}">${esc(r)}</button>`).join('')}
          <button type="button" class="kbtn kbtn--link" data-reject-cancel>Mégse</button>
        </div>`;
      }
      return `<div class="kt__act">
        <p class="kt__label">Mennyi idő alatt lesz kész? <small>(egy koppintás = elfogadás)</small></p>
        <div class="kt__chips">${PREP_CHOICES.map((m) => `<button type="button" class="kchip" data-accept="${m}">${m}<small>p</small></button>`).join('')}</div>
        <button type="button" class="kbtn kbtn--link kbtn--danger" data-reject>Elutasítás</button>
      </div>`;
    case 'COOKING': {
      const end = prepEnd(o);
      return `<div class="kt__act">
        <div class="kt__timer">
          <div><span class="kt__label">Hátra</span><b data-cd="${end}">${mmss(end - Date.now())}</b></div>
          <span class="kt__goal">kész ${hhmm(end)}</span>
        </div>
        <div class="kt__prog"><i data-prog data-from="${o.acceptedAt}" data-to="${end}"></i></div>
        <div class="kt__row">
          <button type="button" class="kbtn kbtn--ghost" data-more="5">+5 perc</button>
          <button type="button" class="kbtn kbtn--go kbtn--grow" data-ready>${icon('check')}Kész</button>
        </div>
      </div>`;
    }
    case 'READY':
      if (pickup) {
        return `<div class="kt__act">
          <p class="kt__wait">Átvételre vár · <span data-ago="${o.readyAt}">${ago(o.readyAt)}</span></p>
          ${sent('ready')}
          <div class="kt__row">
            <button type="button" class="kbtn kbtn--ghost" data-sms="ready">${icon('msg')}SMS újra</button>
            <button type="button" class="kbtn kbtn--go kbtn--grow" data-done>${icon('check')}Átvette</button>
          </div>
        </div>`;
      }
      return `<div class="kt__act">
        <p class="kt__wait">Futárra vár · <span data-ago="${o.readyAt}">${ago(o.readyAt)}</span></p>
        <button type="button" class="kbtn kbtn--courier kbtn--block" data-dispatch>${icon('bike')}Átadva a futárnak</button>
        <p class="kt__hint">A vevő azonnal értesítést kap a várható érkezéssel${o.delivery ? ` (kb. ${hhmm(Date.now() + o.delivery.minutes * MIN)})` : ''}.</p>
      </div>`;
    case 'ON_THE_WAY':
      return `<div class="kt__act">
        <div class="kt__timer">
          <div><span class="kt__label">Érkezésig</span><b data-cd="${o.etaAt}">${mmss(o.etaAt - Date.now())}</b></div>
          <span class="kt__goal">érkezés ~${hhmm(o.etaAt)}</span>
        </div>
        <div class="kt__prog kt__prog--road"><i data-prog data-from="${o.dispatchedAt}" data-to="${o.etaAt}"></i></div>
        ${sent('dispatch')}
        <div class="kt__row">
          <button type="button" class="kbtn kbtn--ghost" data-sms="dispatch">${icon('msg')}SMS újra</button>
          <button type="button" class="kbtn kbtn--go kbtn--grow" data-done>${icon('check')}Kiszállítva</button>
        </div>
      </div>`;
    default:
      return '';
  }
}

function renderBoard(freshIds = []) {
  const active = K.orders.filter((o) => ACTIVE.includes(o.status));
  $('[data-count-active]').textContent = active.length;
  const newCount = active.filter((o) => o.status === 'NEW').length;
  document.title = newCount ? `(${newCount}) Új rendelés – Konyha` : 'Konyha – Zolgiz Ételbár';

  // ne rajzoljuk újra, amíg valaki gépel/kattint egy blokkon belül (fókusz megtartása)
  const focusId = document.activeElement?.closest?.('.kt')?.dataset.id;

  for (const col of $$('.col')) {
    const st = col.dataset.col;
    const list = active.filter((o) => o.status === st);
    // Készül oszlop: ami hamarabb kész, az van elöl
    if (st === 'COOKING') list.sort((a, b) => prepEnd(a) - prepEnd(b));
    $('[data-n]', col).textContent = list.length || '';
    $('.col__list', col).innerHTML = list.length
      ? list.map((o) => ticket(o, freshIds.includes(o.id))).join('')
      : `<p class="col__empty">${{ NEW: 'Nincs új rendelés.', COOKING: 'Semmi nem készül.', READY: 'Nincs kiadásra váró.', ON_THE_WAY: 'Nincs úton futár.' }[st]}</p>`;
  }
  if (focusId) $(`.kt[data-id="${CSS.escape(focusId)}"] button`)?.focus({ preventScroll: true });
  tick();
}

// Másodpercenként: visszaszámlálók, folyamatjelzők, „X perce”
function tick() {
  const now = Date.now();
  $('#clock').textContent = new Date(now).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  $$('[data-cd]').forEach((el) => {
    const left = +el.dataset.cd - now;
    el.textContent = left >= 0 ? mmss(left) : `+${mmss(left)}`;
    const card = el.closest('.kt');
    card.classList.toggle('is-soon', left >= 0 && left < 3 * MIN);
    card.classList.toggle('is-late', left < 0);
  });
  $$('[data-prog]').forEach((el) => {
    const from = +el.dataset.from;
    const to = +el.dataset.to;
    el.style.transform = `scaleX(${Math.min(1, Math.max(0, (now - from) / (to - from)))})`;
  });
  $$('[data-ago]').forEach((el) => { el.textContent = ago(+el.dataset.ago); });
}
setInterval(tick, 1000);

/* ---------- Műveletek ---------- */
const byId = (id) => K.orders.find((o) => o.id === id);

$('#panel-board').addEventListener('click', async (e) => {
  const card = e.target.closest('.kt');
  if (!card) return;
  const o = byId(card.dataset.id);
  if (!o) return;
  const t = e.target.closest('button');
  if (!t) return;
  const d = t.dataset;

  if ('accept' in d) return change(o, { status: 'COOKING', prepMinutes: +d.accept, acceptedAt: Date.now() }, `#${o.code} elfogadva – ${d.accept} perc`);
  if ('reject' in d) { K.rejecting = o.id; return renderBoard(); }
  if ('rejectCancel' in d) { K.rejecting = null; return renderBoard(); }
  if ('rejectReason' in d) {
    K.rejecting = null;
    return change(o, { status: 'REJECTED', rejectReason: REJECT_REASONS[+d.rejectReason], completedAt: Date.now() }, `#${o.code} elutasítva`);
  }
  if ('more' in d) return change(o, { prepMinutes: o.prepMinutes + +d.more }, `#${o.code} +${d.more} perc – a vevő látja az új időt`);
  if ('ready' in d) {
    const ok = await change(o, { status: 'READY', readyAt: Date.now() }, `#${o.code} kész`);
    if (ok && o.orderType === 'pickup') notify({ ...o, status: 'READY' }, 'ready');
    return;
  }
  if ('dispatch' in d) {
    t.disabled = true;
    t.innerHTML = '<span class="kspin"></span>Útvonal…';
    let minutes = o.delivery?.minutes;
    if (!minutes && o.town && o.street) {
      try {
        const r = await estimateDelivery(o.town, o.street);
        if (r.ok) minutes = r.minutes;
      } catch { /* */ }
    }
    minutes = minutes || CONFIG.delivery.unknownMinutes;
    const now = Date.now();
    const patch = { status: 'ON_THE_WAY', dispatchedAt: now, etaAt: now + minutes * MIN };
    const ok = await change(o, patch, `#${o.code} úton – érkezés ~${hhmm(patch.etaAt)}`);
    if (ok) notify({ ...o, ...patch }, 'dispatch');
    return;
  }
  if ('done' in d) return change(o, { status: 'DONE', completedAt: Date.now() }, `#${o.code} lezárva`);
  if ('sms' in d) return notify(o, d.sms, true);
});

async function change(o, patch, msg) {
  const prev = Object.fromEntries(Object.keys(patch).map((k) => [k, o[k] ?? null]));
  try {
    await store.updateOrder(o.id, patch);
  } catch (err) {
    console.error(err);
    toast('Nem sikerült menteni – ellenőrizd az internetet, és próbáld újra.');
    renderBoard();
    return false;
  }
  toast(msg, { action: 'Visszavonás', ms: 6000, onAction: () => store.updateOrder(o.id, prev).catch(() => toast('A visszavonás nem sikerült.')) });
  return true;
}

/* ---------- Értesítés (SMS) ---------- */
function smsText(o, kind) {
  if (kind === 'ready') return `Kedves ${o.customerName}! Elkészült a rendelésed (#${o.code}) a ${CONFIG.name}ban. Várunk: ${CONFIG.address}`;
  return `Kedves ${o.customerName}! A futár elindult a rendeléseddel (#${o.code}). Várható érkezés: kb. ${hhmm(o.etaAt)}. ${CONFIG.name}`;
}

async function notify(o, kind, manual = false) {
  // Az oldalon belüli értesítést a vevő böngészője magától megkapja (élő státusz).
  const mode = CONFIG.smsMode;
  const text = smsText(o, kind);
  const markDemoSafe = () => store.updateOrder(o.id, { notified: { ...(o.notified || {}), [kind]: Date.now() } }).catch(() => {});

  if (mode === 'off' && !manual) return;
  if (mode === 'twilio') {
    try {
      const token = await store.idToken();
      const r = await fetch('/.netlify/functions/send-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ to: o.customerPhone, text }),
      });
      if (!r.ok) throw new Error(await r.text());
      markDemoSafe();
      toast(`SMS elküldve: ${o.customerPhone}`);
    } catch (err) {
      console.error(err);
      toast('Az SMS nem ment ki. Hívd fel a vevőt!', { ms: 9000 });
    }
    return;
  }
  // 'link' mód: telefon/tablet SMS appja kitöltött üzenettel
  const href = `sms:${o.customerPhone}?&body=${encodeURIComponent(text)}`;
  const touch = matchMedia('(pointer: coarse)').matches;
  markDemoSafe();
  if (touch) location.href = href;
  else toast(`SMS szöveg kész ${o.customerPhone} számra`, { action: 'SMS megnyitása', ms: 9000, onAction: () => { location.href = href; } });
}

/* =========================================================
   ÉTLAP (elérhetőség)
   ========================================================= */
const CAT_TITLES = { pizza: 'Pizzák', burger: 'Hamburgerek', gyros: 'Gyros', toast: 'Melegszendvicsek', fried: 'Frissensültek & köretek', drink: 'Üdítők', dessert: 'Desszertek' };

function renderMenuPane() {
  const out = new Set(K.settings.soldOut || []);
  const groups = Object.entries(CAT_TITLES).map(([cat, title]) => {
    const items = MENU.filter((i) => i.cat === cat);
    return `<section class="mgroup"><h2>${title}</h2><ul>${items.map((i) => `
      <li class="mitem${out.has(i.id) ? ' is-out' : ''}">
        <span>${i.no ? `<small>${i.no}.</small> ` : ''}${esc(i.name)}</span>
        <span class="mitem__price">${ft(i.price)}</span>
        <button type="button" class="kswitch" role="switch" aria-checked="${!out.has(i.id)}" data-avail="${i.id}" aria-label="${esc(i.name)} elérhető">
          <span class="kswitch__track"><span class="kswitch__thumb"></span></span><span class="kswitch__txt">${out.has(i.id) ? 'Elfogyott' : 'Elérhető'}</span>
        </button>
      </li>`).join('')}</ul></section>`;
  }).join('');
  $('#panel-menu').innerHTML = `
    <header class="pane__head"><h1>Étlap – elérhetőség</h1><p>Ha valami elfogy, kapcsold ki: a vásárlói oldalon azonnal „Elfogyott” lesz, és nem rendelhető.</p></header>
    <div class="mgrid">${groups}</div>`;
}

$('#panel-menu').addEventListener('click', (e) => {
  const b = e.target.closest('[data-avail]');
  if (!b) return;
  const id = +b.dataset.avail;
  const set = new Set(K.settings.soldOut || []);
  set.has(id) ? set.delete(id) : set.add(id);
  K.settings = { ...K.settings, soldOut: [...set] };
  renderMenuPane();
  $(`[data-avail="${id}"]`)?.focus();
  saveSettings({ soldOut: [...set] });
});

/* =========================================================
   MAI NAP
   ========================================================= */
function renderDay() {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const today = K.orders.filter((o) => o.createdAt >= +start);
  const done = today.filter((o) => o.status === 'DONE');
  const rejected = today.filter((o) => o.status === 'REJECTED');
  const revenue = done.reduce((s, o) => s + o.total, 0);
  const preps = done.filter((o) => o.acceptedAt && o.readyAt).map((o) => (o.readyAt - o.acceptedAt) / MIN);
  const avgPrep = preps.length ? Math.round(preps.reduce((a, b) => a + b, 0) / preps.length) : null;
  const late = done.filter((o) => o.acceptedAt && o.readyAt && o.readyAt > prepEnd(o) + MIN).length;
  const statusTxt = { NEW: 'Új', COOKING: 'Készül', READY: 'Kész', ON_THE_WAY: 'Úton', DONE: 'Lezárva', REJECTED: 'Elutasítva' };
  $('#panel-day').innerHTML = `
    <header class="pane__head"><h1>Mai nap</h1><p>${start.toLocaleDateString('hu-HU', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</p></header>
    <dl class="stats">
      <div><dt>Lezárt rendelés</dt><dd>${done.length}</dd></div>
      <div><dt>Forgalom (lezárt)</dt><dd>${ft(revenue)}</dd></div>
      <div><dt>Átlagos elkészítés</dt><dd>${avgPrep != null ? `${avgPrep} perc` : '–'}</dd></div>
      <div><dt>Késve elkészült</dt><dd>${late}</dd></div>
      <div><dt>Elutasított</dt><dd>${rejected.length}</dd></div>
    </dl>
    ${today.length ? `
    <div class="tablewrap"><table class="ktable">
      <thead><tr><th>#</th><th>Idő</th><th>Vevő</th><th>Mód</th><th>Tételek</th><th class="num">Összeg</th><th>Állapot</th></tr></thead>
      <tbody>${[...today].reverse().map((o) => `
        <tr>
          <td><b>${esc(o.code)}</b></td>
          <td>${hhmm(o.createdAt)}</td>
          <td>${esc(o.customerName)}<br><small>${esc(o.customerPhone)}</small></td>
          <td>${o.orderType === 'pickup' ? 'Elvitel' : `Házhoz<br><small>${esc(o.address)}</small>`}</td>
          <td>${o.items.map((l) => `${l.qty}× ${esc(l.name)}`).join('<br>')}</td>
          <td class="num">${ft(o.total)}</td>
          <td><span class="kpill kpill--${o.status}">${statusTxt[o.status] || o.status}</span></td>
        </tr>`).join('')}
      </tbody>
    </table></div>` : '<p class="col__empty">Ma még nem volt rendelés.</p>'}`;
}

/* =========================================================
   DEMÓ: teszt rendelés
   ========================================================= */
$('#demo-order').addEventListener('click', async () => {
  const names = ['Kovács Anna', 'Nagy Péter', 'Tóth Gábor', 'Szabó Eszter', 'Horváth Bence'];
  const deliv = Math.random() > 0.5;
  const pick = MENU.filter((i) => i.cat === 'pizza')[Math.floor(Math.random() * 17)];
  const items = [{ id: pick.id, name: pick.name, qty: 1 + Math.floor(Math.random() * 2), unitPrice: pick.price + 400, extras: ['Bacon'], sauces: [], removed: [], side: null, freeSauce: null, note: '' }];
  const subtotal = items.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  await store.createOrder({
    code: store.makeCode(),
    customerName: names[Math.floor(Math.random() * names.length)],
    customerPhone: '+36301234567',
    orderType: deliv ? 'delivery' : 'pickup',
    town: deliv ? 'Fertőboz' : '', street: deliv ? 'Fő utca 10' : '', address: deliv ? 'Fertőboz, Fő utca 10' : '',
    courierNote: '', items, subtotal, packagingFee: CONFIG.packagingFee, total: subtotal + CONFIG.packagingFee,
    quotedPrepMinutes: CONFIG.defaultPrepMinutes,
    delivery: deliv ? { km: 5.7, minutes: 14, source: 'route' } : null,
  });
});

// Indítás: a végén, hogy minden változó létezzen
store.onAuth((user) => (user ? startApp() : showLogin()));
