import { CONFIG } from './config.js';
import {
  MENU, byId, SECTIONS, HERO_IDS, imgSmall, imgLarge, optionsFor, ingredients, unitPrice,
  EXTRA_TOPPINGS, EXTRA_SAUCES, FREE_SIDES, FREE_SAUCES,
} from './menu.js';
import * as store from './store.js';
import { estimateDelivery } from './eta.js';
import {
  $, $$, esc, ft, km, hhmm, icon, normalizePhone, debounce, safeLS, unlockAudio, chime, toast, injectIcons,
} from './util.js';

injectIcons();
$('#year').textContent = new Date().getFullYear();

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MIN = 60000;

const S = {
  settings: { open: true, soldOut: [], extraWait: 0 },
  cart: safeLS.get('zolgiz_cart', []),
  form: { mode: 'pickup', name: '', phone: '', town: CONFIG.town, street: '', courierNote: '', ...safeLS.get('zolgiz_form', {}) },
  view: 'cart',
  eta: { state: 'idle' },
  etaPromise: null,
  orderId: safeLS.get('zolgiz_active_order', null),
  order: null,
  submitting: false,
  submitError: '',
};

const prepMinutes = () => CONFIG.defaultPrepMinutes + (S.settings.extraWait || 0);
const isOut = (id) => S.settings.soldOut.includes(id);
const subtotal = () => S.cart.reduce((s, l) => s + l.unitPrice * l.qty, 0);
const total = () => (S.cart.length ? subtotal() + CONFIG.packagingFee : 0);
const count = () => S.cart.reduce((s, l) => s + l.qty, 0);

/* =========================================================
   HERO SLIDESHOW
   ========================================================= */
const heroItems = HERO_IDS.map((id) => byId.get(id));
const hero = $('#hero');
const stage = $('#hero-stage');
const rail = $('#hero-rail');
let heroIdx = 0;
let heroUserPaused = reduceMotion;

function renderHero() {
  const n = heroItems.length;
  stage.innerHTML = heroItems.map((it, i) => `
    <article class="slide${i === 0 ? ' is-active' : ''}" role="group" aria-roledescription="dia" aria-label="${i + 1} / ${n}: ${esc(it.name)}"${i ? ' aria-hidden="true" inert' : ''}>
      <img class="slide__img" src="${imgLarge(it.img)}" alt="" ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">
      <div class="slide__copy">
        <p class="slide__kicker">No. ${it.no} · Pizza · 32 cm</p>
        <h2 class="slide__name">${esc(it.name)}</h2>
        <p class="slide__desc">${esc(it.desc)}</p>
        <div class="slide__buy">
          <span class="slide__price">${ft(it.price)}</span>
          <button class="btn btn--primary btn--lg" type="button" data-add="${it.id}">${icon('plus')}<span>Kosárba</span></button>
        </div>
      </div>
    </article>`).join('');
  rail.innerHTML = heroItems.map((it, i) => `
    <li><button type="button" class="rail__item${i === 0 ? ' is-active' : ''}" data-go="${i}"${i === 0 ? ' aria-current="true"' : ''}>
      <img src="${imgSmall(it.img)}" alt="" loading="lazy" width="48" height="48">
      <span class="rail__txt"><b>${esc(it.name)}</b><span>${ft(it.price)}</span></span>
      <span class="rail__bar"><i></i></span>
    </button></li>`).join('');
  syncHeroPause();
}

function goHero(i) {
  const n = heroItems.length;
  heroIdx = (i + n) % n;
  $$('.slide', stage).forEach((el, k) => {
    const on = k === heroIdx;
    el.classList.toggle('is-active', on);
    el.toggleAttribute('inert', !on);
    on ? el.removeAttribute('aria-hidden') : el.setAttribute('aria-hidden', 'true');
  });
  $$('.rail__item', rail).forEach((el, k) => {
    el.classList.toggle('is-active', k === heroIdx);
    k === heroIdx ? el.setAttribute('aria-current', 'true') : el.removeAttribute('aria-current');
  });
}

function syncHeroPause() {
  hero.classList.toggle('is-paused', heroUserPaused);
  const b = $('[data-hero="pause"]');
  b.innerHTML = icon(heroUserPaused ? 'play' : 'pause');
  b.setAttribute('aria-label', heroUserPaused ? 'Automatikus lapozás indítása' : 'Automatikus lapozás megállítása');
}

// Az aktív sáv animációjának vége lapoz tovább → szünet = az animáció megáll
rail.addEventListener('animationend', (e) => { if (e.target.closest('.rail__item.is-active')) goHero(heroIdx + 1); });
rail.addEventListener('click', (e) => { const b = e.target.closest('[data-go]'); if (b) goHero(+b.dataset.go); });
hero.addEventListener('click', (e) => {
  const b = e.target.closest('[data-hero]');
  if (!b) return;
  if (b.dataset.hero === 'prev') goHero(heroIdx - 1);
  if (b.dataset.hero === 'next') goHero(heroIdx + 1);
  if (b.dataset.hero === 'pause') { heroUserPaused = !heroUserPaused; syncHeroPause(); }
});
hero.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') goHero(heroIdx - 1);
  if (e.key === 'ArrowRight') goHero(heroIdx + 1);
});
hero.addEventListener('focusin', () => hero.classList.add('is-hold'));
hero.addEventListener('focusout', (e) => { if (!hero.contains(e.relatedTarget)) hero.classList.remove('is-hold'); });

// Húzás (mobil)
let swipeX = null;
stage.addEventListener('pointerdown', (e) => { swipeX = e.clientX; });
stage.addEventListener('pointerup', (e) => {
  if (swipeX == null) return;
  const dx = e.clientX - swipeX;
  swipeX = null;
  if (Math.abs(dx) > 50) goHero(heroIdx + (dx < 0 ? 1 : -1));
});

/* =========================================================
   ÉTLAP + KATEGÓRIÁK + KERESÉS
   ========================================================= */
const sectionsEl = $('#menu-sections');
const catList = $('#cat-list');
const searchInput = $('#search');

function badges(it) {
  let s = '';
  if (it.tags.includes('spicy')) s += `<span class="badge badge--hot">${icon('flame')}Csípős</span>`;
  if (it.tags.includes('veg')) s += `<span class="badge badge--veg">${icon('leaf')}Húsmentes</span>`;
  if (isOut(it.id)) s += '<span class="badge badge--out">Elfogyott</span>';
  return s;
}

function dishCard(it) {
  const out = isOut(it.id);
  return `
  <article class="dish${out ? ' is-out' : ''}">
    <button class="dish__hit" type="button" data-add="${it.id}"${out ? ' disabled' : ''} aria-label="${esc(it.name)}, ${ft(it.price)}${out ? ', elfogyott' : ''}"></button>
    <div class="dish__body">
      <h3 class="dish__name">${it.no ? `<span class="dish__no">${it.no}</span>` : ''}${esc(it.name)}</h3>
      <p class="dish__desc">${esc(it.desc)}</p>
      <p class="dish__meta"><span class="dish__price">${ft(it.price)}</span>${badges(it)}</p>
    </div>
    <div class="dish__media">
      ${it.img ? `<img src="${imgSmall(it.img)}" alt="" loading="lazy" decoding="async" width="220" height="220">` : `<span class="dish__ph" aria-hidden="true">${esc(it.name[0])}</span>`}
      <span class="dish__plus" aria-hidden="true">${icon('plus')}</span>
    </div>
  </article>`;
}

function section(id, title, sub, items, extraCls = '') {
  return `
  <section class="msec ${extraCls}" id="s-${id}" aria-labelledby="h-${id}">
    <header class="msec__head"><h2 id="h-${id}">${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ''}</header>
    <div class="grid">${items.map(dishCard).join('')}</div>
  </section>`;
}

const sectionData = SECTIONS.map((s) => ({ ...s, items: MENU.filter(s.filter) })).filter((s) => s.items.length);

function renderCats() {
  catList.innerHTML = sectionData.map((s) => `<a href="#s-${s.id}" data-cat="${s.id}">${esc(s.title)}</a>`).join('');
}

const fold = (s) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

function renderMenu() {
  const q = fold(searchInput.value.trim());
  if (q) {
    const hits = MENU.filter((i) => fold(`${i.name} ${i.desc}`).includes(q));
    sectionsEl.innerHTML = hits.length ? section('talalatok', `Találatok: ${hits.length}`, '', hits) : '';
    $('#search-empty').hidden = !!hits.length;
    return;
  }
  $('#search-empty').hidden = true;
  sectionsEl.innerHTML = sectionData.map((s) => section(s.id, s.title, s.sub, s.items, s.id === 'nepszeru' ? 'msec--feature' : '')).join('');
  observeSections();
}

searchInput.addEventListener('input', debounce(() => {
  renderMenu();
  if (searchInput.value.trim()) $('#etlap').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
}, 180));

// Görgetés-figyelés: az aktív kategória kiemelése a sávban
let spy;
function observeSections() {
  spy?.disconnect();
  const visible = new Map();
  spy = new IntersectionObserver((entries) => {
    entries.forEach((e) => visible.set(e.target.id, e.isIntersecting));
    const first = sectionData.find((s) => visible.get(`s-${s.id}`));
    if (first) setActiveCat(first.id);
  }, { rootMargin: '-140px 0px -55% 0px' });
  $$('.msec', sectionsEl).forEach((el) => spy.observe(el));
}

function setActiveCat(id) {
  $$('a', catList).forEach((a) => {
    const on = a.dataset.cat === id;
    a.classList.toggle('is-active', on);
    if (on) {
      a.setAttribute('aria-current', 'true');
      const left = a.offsetLeft - catList.clientWidth / 2 + a.clientWidth / 2;
      catList.scrollTo({ left, behavior: reduceMotion ? 'auto' : 'smooth' });
    } else a.removeAttribute('aria-current');
  });
}

catList.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-cat]');
  if (!a) return;
  if (searchInput.value) { searchInput.value = ''; renderMenu(); }
});

/* =========================================================
   TERMÉK TESTRESZABÁS
   ========================================================= */
const dishDlg = $('#dish-dlg');
const dishForm = $('#dish-form');
let cur = null;

const fieldset = (title, hint, body) => `
  <fieldset class="opt">
    <legend><span>${esc(title)}</span>${hint ? `<small>${esc(hint)}</small>` : ''}</legend>
    <div class="opt__body">${body}</div>
  </fieldset>`;

const radios = (name, list) => list.map((v, i) => `
  <label class="choice"><input type="radio" name="${name}" value="${esc(v)}"${i === 0 ? ' checked' : ''}><span>${esc(v)}</span></label>`).join('');

const checks = (name, list, price) => list.map((v) => `
  <label class="chip"><input type="checkbox" name="${name}" value="${esc(v)}"><span>${esc(v)}${price ? ` <em>+${ft(price)}</em>` : ''}</span></label>`).join('');

function openDish(id) {
  const it = byId.get(id);
  if (!it) return;
  if (isOut(id)) { toast('Ez a termék most elfogyott.'); return; }
  const o = optionsFor(it);
  cur = { it, qty: 1 };
  const ing = o.removable ? ingredients(it) : [];
  dishForm.innerHTML = `
    <div class="dd__media">
      ${it.img ? `<img src="${imgLarge(it.img)}" alt="">` : ''}
      <button type="button" class="iconbtn dd__close" data-close aria-label="Bezárás">${icon('x')}</button>
    </div>
    <div class="dd__body">
      <h2 id="dd-title" class="dd__title">${it.no ? `<span class="dish__no">${it.no}</span>` : ''}${esc(it.name)}</h2>
      <p class="dd__desc">${esc(it.desc)}</p>
      <p class="dd__price">${ft(it.price)}</p>
      ${it.draft ? '<p class="dd__note">Az ár tájékoztató jellegű.</p>' : ''}
      ${o.freeChoice ? fieldset('Köret', 'benne van az árban', radios('side', FREE_SIDES)) + fieldset('Szósz', 'benne van az árban', radios('fsauce', FREE_SAUCES)) : ''}
      ${o.toppings ? fieldset('Extra feltét', `+${ft(CONFIG.extraToppingPrice)} / db`, `<div class="chips">${checks('extra', EXTRA_TOPPINGS)}</div>`) : ''}
      ${o.sauces ? fieldset('Extra szósz', `+${ft(CONFIG.extraSaucePrice)} / db`, `<div class="chips">${checks('sauce', EXTRA_SAUCES)}</div>`) : ''}
      ${ing.length ? fieldset('Kihagynál valamit?', 'koppints arra, ami ne kerüljön rá', `<div class="chips chips--remove">${checks('remove', ing)}</div>`) : ''}
      <label class="field">
        <span class="field__label">Megjegyzés a konyhának</span>
        <textarea name="note" rows="2" maxlength="200" placeholder="pl. jól átsütve, szósz külön tálkában"></textarea>
      </label>
    </div>
    <div class="dd__foot">
      <div class="stepper" role="group" aria-label="Mennyiség">
        <button type="button" data-q="-1" aria-label="Kevesebb">${icon('minus')}</button>
        <output data-qty aria-live="polite">1</output>
        <button type="button" data-q="1" aria-label="Több">${icon('plus')}</button>
      </div>
      <button class="btn btn--primary btn--block" type="submit">Kosárba · <span data-dd-total>${ft(it.price)}</span></button>
    </div>`;
  dishDlg.showModal();
  dishForm.querySelector('.dd__body').scrollTop = 0;
}

function readDish() {
  const fd = new FormData(dishForm);
  return {
    extras: fd.getAll('extra'),
    sauces: fd.getAll('sauce'),
    removed: fd.getAll('remove'),
    side: fd.get('side') || null,
    freeSauce: fd.get('fsauce') || null,
    note: String(fd.get('note') || '').trim(),
  };
}

function updateDishTotal() {
  if (!cur) return;
  const sel = readDish();
  $('[data-dd-total]', dishForm).textContent = ft(unitPrice(cur.it, sel) * cur.qty);
  $('[data-qty]', dishForm).textContent = cur.qty;
}

dishForm.addEventListener('change', updateDishTotal);
dishForm.addEventListener('click', (e) => {
  const q = e.target.closest('[data-q]');
  if (q) { cur.qty = Math.min(20, Math.max(1, cur.qty + +q.dataset.q)); updateDishTotal(); }
  if (e.target.closest('[data-close]')) dishDlg.close();
});
dishForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const sel = readDish();
  addToCart(cur.it, sel, cur.qty);
  dishDlg.close();
  toast(`${cur.it.name} a kosárban`, { action: 'Kosár', onAction: () => openDrawer('cart') });
});
dishDlg.addEventListener('click', (e) => { if (e.target === dishDlg) dishDlg.close(); });

/* =========================================================
   KOSÁR
   ========================================================= */
function lineKey(id, sel) {
  return JSON.stringify([id, [...sel.extras].sort(), [...sel.sauces].sort(), [...sel.removed].sort(), sel.side, sel.freeSauce, sel.note]);
}

function addToCart(it, sel, qty) {
  const key = lineKey(it.id, sel);
  const ex = S.cart.find((l) => l.key === key);
  if (ex) ex.qty = Math.min(50, ex.qty + qty);
  else S.cart.push({ key, id: it.id, name: it.name, qty, unitPrice: unitPrice(it, sel), ...sel });
  saveCart();
  const btn = $('.cartbtn');
  btn.classList.remove('is-bump');
  void btn.offsetWidth;
  btn.classList.add('is-bump');
}

function saveCart() {
  safeLS.set('zolgiz_cart', S.cart);
  renderCartChrome();
  if (drawer.open && (S.view === 'cart' || S.view === 'checkout')) renderDrawer();
}

function lineDetails(l) {
  const parts = [];
  if (l.side) parts.push(`<li>Köret: ${esc(l.side)}</li>`);
  if (l.freeSauce) parts.push(`<li>Szósz: ${esc(l.freeSauce)}</li>`);
  if (l.extras?.length) parts.push(`<li class="is-add">+ ${l.extras.map(esc).join(', ')}</li>`);
  if (l.sauces?.length) parts.push(`<li class="is-add">+ ${l.sauces.map(esc).join(', ')}</li>`);
  if (l.removed?.length) parts.push(`<li class="is-rm">nélkül: ${l.removed.map(esc).join(', ')}</li>`);
  if (l.note) parts.push(`<li class="is-note">„${esc(l.note)}”</li>`);
  return parts.length ? `<ul class="line__mods">${parts.join('')}</ul>` : '';
}

function renderCartChrome() {
  const c = count();
  $$('[data-cart-count]').forEach((el) => { el.textContent = c; });
  const bar = $('#cartbar');
  bar.hidden = !c;
  bar.innerHTML = `<span class="cartbar__n">${c}</span><span>Kosár megtekintése</span><b>${ft(total())}</b>`;
}

/* =========================================================
   FIÓK (kosár → adatok → követés)
   ========================================================= */
const drawer = $('#cart-dlg');
const drawerIn = $('#drawer');

function openDrawer(view) {
  S.view = view || (S.cart.length ? 'cart' : S.orderId ? 'track' : 'cart');
  renderDrawer();
  if (!drawer.open) drawer.showModal();
  renderFloaters();
}
drawer.addEventListener('close', renderFloaters);
drawer.addEventListener('click', (e) => { if (e.target === drawer) drawer.close(); });
document.addEventListener('click', (e) => {
  const add = e.target.closest('[data-add]');
  if (add && !add.disabled) openDish(+add.dataset.add);
  if (e.target.closest('[data-open-cart]')) openDrawer();
});

const head = (title, back) => `
  <header class="drawer__head">
    ${back ? `<button type="button" class="iconbtn" data-view="${back}" aria-label="Vissza">${icon('left')}</button>` : ''}
    <h2>${title}</h2>
    <button type="button" class="iconbtn" data-close-drawer aria-label="Bezárás">${icon('x')}</button>
  </header>`;

function renderDrawer() {
  if (S.view === 'track' && S.orderId) drawerIn.innerHTML = trackView();
  else if (S.view === 'checkout' && S.cart.length) drawerIn.innerHTML = checkoutView();
  else { S.view = 'cart'; drawerIn.innerHTML = cartView(); }
  drawer.setAttribute('aria-label', { cart: 'Kosár', checkout: 'Rendelés leadása', track: 'Rendelésed állapota' }[S.view]);
  if (S.view === 'checkout') bindCheckout();
}

function cartView() {
  if (!S.cart.length) {
    return `${head('Kosarad')}
      <div class="empty">
        ${icon('bag', 'empty__i')}
        <p><b>Még üres a kosarad.</b><br>Válassz valamit az étlapról – a pizzákat testre is szabhatod.</p>
        <button type="button" class="btn btn--ghost" data-close-drawer>Vissza az étlaphoz</button>
        ${S.orderId ? '<button type="button" class="btn btn--link" data-view="track">Folyamatban lévő rendelésed</button>' : ''}
      </div>`;
  }
  return `${head('Kosarad')}
    <ul class="lines">
      ${S.cart.map((l) => `
        <li class="line">
          <div class="line__main">
            <b class="line__name">${esc(l.name)}</b>
            ${lineDetails(l)}
          </div>
          <div class="line__side">
            <span class="line__price">${ft(l.unitPrice * l.qty)}</span>
            <div class="stepper stepper--sm" role="group" aria-label="${esc(l.name)} mennyisége">
              <button type="button" data-line="${esc(l.key)}" data-d="-1" aria-label="${l.qty === 1 ? 'Törlés' : 'Kevesebb'}">${icon(l.qty === 1 ? 'trash' : 'minus')}</button>
              <output>${l.qty}</output>
              <button type="button" data-line="${esc(l.key)}" data-d="1" aria-label="Több">${icon('plus')}</button>
            </div>
          </div>
        </li>`).join('')}
    </ul>
    <div class="drawer__foot">
      ${totals()}
      ${S.settings.open ? '' : '<p class="note note--warn">Most nem fogadunk online rendelést.</p>'}
      <button type="button" class="btn btn--primary btn--block btn--lg" data-view="checkout"${S.settings.open ? '' : ' disabled'}>Tovább a rendeléshez</button>
    </div>`;
}

const totals = () => `
  <dl class="totals">
    <div><dt>Részösszeg</dt><dd>${ft(subtotal())}</dd></div>
    <div><dt>Csomagolás</dt><dd>${ft(CONFIG.packagingFee)}</dd></div>
    <div class="totals__sum"><dt>Összesen</dt><dd>${ft(total())}</dd></div>
  </dl>`;

drawerIn.addEventListener('click', (e) => {
  if (e.target.closest('[data-close-drawer]')) { drawer.close(); return; }
  const v = e.target.closest('[data-view]');
  if (v) { S.view = v.dataset.view; renderDrawer(); drawerIn.scrollTop = 0; drawerIn.querySelector('h2')?.focus?.(); return; }
  const ln = e.target.closest('[data-line]');
  if (ln) {
    const l = S.cart.find((x) => x.key === ln.dataset.line);
    if (!l) return;
    l.qty += +ln.dataset.d;
    if (l.qty <= 0) {
      const removed = l;
      S.cart = S.cart.filter((x) => x !== l);
      toast(`${removed.name} törölve`, { action: 'Visszavonás', onAction: () => { removed.qty = 1; S.cart.push(removed); saveCart(); } });
    }
    saveCart();
    return;
  }
  if (e.target.closest('[data-new-order]')) { clearActiveOrder(); S.view = 'cart'; renderDrawer(); }
});

/* ---------------- Pénztár ---------------- */
function checkoutView() {
  const f = S.form;
  const deliv = f.mode === 'delivery';
  return `${head('Rendelés leadása', 'cart')}
  <form class="checkout" id="checkout" novalidate>
    <fieldset class="seg" aria-label="Átvétel módja">
      <label><input type="radio" name="mode" value="pickup"${deliv ? '' : ' checked'}><span>${icon('bag')}Elvitel</span></label>
      <label><input type="radio" name="mode" value="delivery"${deliv ? ' checked' : ''}><span>${icon('bike')}Házhozszállítás</span></label>
    </fieldset>

    <div class="field">
      <label class="field__label" for="f-name">Neved</label>
      <input id="f-name" name="name" autocomplete="name" required maxlength="60" value="${esc(f.name)}" aria-describedby="e-name">
      <p class="field__err" id="e-name"></p>
    </div>
    <div class="field">
      <label class="field__label" for="f-phone">Telefonszámod <small>ide küldjük az értesítést</small></label>
      <input id="f-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" required placeholder="06 30 123 4567" value="${esc(f.phone)}" aria-describedby="e-phone">
      <p class="field__err" id="e-phone"></p>
    </div>

    <div class="addr" data-addr${deliv ? '' : ' hidden'}>
      <div class="addr__row">
        <div class="field">
          <label class="field__label" for="f-town">Település</label>
          <input id="f-town" name="town" list="towns" autocomplete="address-level2" value="${esc(f.town)}" aria-describedby="e-town">
          <datalist id="towns">${CONFIG.towns.map((t) => `<option value="${esc(t)}">`).join('')}</datalist>
          <p class="field__err" id="e-town"></p>
        </div>
        <div class="field">
          <label class="field__label" for="f-street">Utca, házszám</label>
          <input id="f-street" name="street" autocomplete="address-line1" placeholder="Fő utca 12." value="${esc(f.street)}" aria-describedby="e-street">
          <p class="field__err" id="e-street"></p>
        </div>
      </div>
      <div class="field">
        <label class="field__label" for="f-cnote">Üzenet a futárnak <small>nem kötelező</small></label>
        <input id="f-cnote" name="courierNote" maxlength="120" placeholder="pl. kapucsengő nem működik, hívj" value="${esc(f.courierNote)}">
      </div>
    </div>

    <div class="eta" id="eta-box" aria-live="polite">${etaHTML()}</div>

    <div class="drawer__foot drawer__foot--form">
      ${totals()}
      <p class="note">Fizetés átvételkor.</p>
      <p class="form-err" id="submit-err" role="alert">${esc(S.submitError)}</p>
      <button type="submit" class="btn btn--primary btn--block btn--lg" id="submit-btn"${S.submitting ? ' disabled aria-busy="true"' : ''}>
        ${S.submitting ? 'Küldés…' : `Rendelés leadása · ${ft(total())}`}
      </button>
    </div>
  </form>`;
}

function etaHTML() {
  const prep = prepMinutes();
  if (S.form.mode === 'pickup') {
    return `${icon('clock')}<div><b>Elkészül kb. ${prep} perc alatt</b><span>Szólunk, amint indulhatsz érte: ${esc(CONFIG.address)}</span></div>`;
  }
  const e = S.eta;
  if (e.state === 'loading') return `<span class="spin" aria-hidden="true"></span><div><b>Útvonal számolása…</b><span>Megnézzük, milyen messze vagy tőlünk.</span></div>`;
  if (e.state === 'ok') {
    const arrive = Date.now() + (prep + e.data.minutes) * MIN;
    return `${icon('bike')}<div><b>${km(e.data.km)} · kb. ${e.data.minutes} perc út</b>
      <span>Várható érkezés: kb. ${prep + e.data.minutes} perc múlva (≈ ${hhmm(arrive)})${e.data.precise ? '' : ' – a házszámot nem találtuk pontosan, az utcával számoltunk'}</span></div>`;
  }
  if (e.state === 'far') return `${icon('alert')}<div class="is-bad"><b>Ide sajnos nem szállítunk (${km(e.data.km)})</b><span>A kiszállítási terület ${CONFIG.delivery.maxKm} km-ig tart. Válaszd az elvitelt, vagy hívj: ${esc(CONFIG.phone)}</span></div>`;
  if (e.state === 'notfound') return `${icon('alert')}<div><b>Ezt a címet nem találjuk a térképen</b><span>Ellenőrizd az utcanevet. A rendelés így is leadható, a futár idejét a konyha becsüli meg.</span></div>`;
  if (e.state === 'network') return `${icon('alert')}<div><b>Most nem tudtuk kiszámolni az útvonalat</b><span>A rendelés így is leadható.</span></div>`;
  return `${icon('pin')}<div><b>Add meg a címed</b><span>Kiszámoljuk, mennyi idő alatt ér oda hozzád a futár.</span></div>`;
}

const renderEta = () => { const b = $('#eta-box'); if (b) b.innerHTML = etaHTML(); };

let etaCtl = null;
function runEta() {
  const town = S.form.town.trim();
  const street = S.form.street.trim();
  etaCtl?.abort();
  if (S.form.mode !== 'delivery' || !town || !/\d/.test(street)) { S.eta = { state: 'idle' }; S.etaPromise = null; renderEta(); return; }
  etaCtl = new AbortController();
  const ctl = etaCtl;
  S.eta = { state: 'loading' };
  renderEta();
  S.etaPromise = estimateDelivery(town, street, ctl.signal).then((r) => {
    if (ctl.signal.aborted) return;
    if (!r.ok) S.eta = { state: r.reason };
    else if (r.km > CONFIG.delivery.maxKm) S.eta = { state: 'far', data: r };
    else S.eta = { state: 'ok', data: r };
    renderEta();
  }).catch(() => {});
  return S.etaPromise;
}
const runEtaDebounced = debounce(runEta, 750);

const VALIDATORS = {
  name: (v) => (v.trim().length < 2 ? 'Add meg a neved, hogy tudjuk, kié a rendelés.' : ''),
  phone: (v) => (!v.trim() ? 'Telefonszám nélkül nem tudunk szólni, ha kész.' : normalizePhone(v) ? '' : 'Magyar mobilszámot adj meg, pl. 06 30 123 4567.'),
  town: (v) => (S.form.mode === 'delivery' && !v.trim() ? 'Melyik településre vigyük?' : ''),
  street: (v) => (S.form.mode !== 'delivery' ? '' : !v.trim() ? 'Add meg az utcát és a házszámot.' : !/\d/.test(v) ? 'A házszámot is írd be.' : ''),
};
const touched = new Set();

function validateField(name, show) {
  const input = $(`#checkout [name="${name}"]`);
  if (!input || !VALIDATORS[name]) return true;
  const msg = VALIDATORS[name](input.value);
  if (show) {
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    $(`#e-${name}`).textContent = msg;
  }
  return !msg;
}

function bindCheckout() {
  const form = $('#checkout');
  form.addEventListener('input', (e) => {
    const { name, value } = e.target;
    if (name in S.form) { S.form[name] = value; safeLS.set('zolgiz_form', S.form); }
    if (touched.has(name)) validateField(name, true);
    if (name === 'town' || name === 'street') runEtaDebounced();
  });
  form.addEventListener('focusout', (e) => {
    const { name } = e.target;
    if (name && VALIDATORS[name] && e.target.value) { touched.add(name); validateField(name, true); }
  });
  form.addEventListener('change', (e) => {
    if (e.target.name !== 'mode') return;
    S.form.mode = e.target.value;
    safeLS.set('zolgiz_form', S.form);
    $('[data-addr]', form).hidden = S.form.mode !== 'delivery';
    runEta();
  });
  form.addEventListener('submit', submitOrder);
  if (S.form.mode === 'delivery' && S.eta.state === 'idle') runEta();
}

async function submitOrder(e) {
  e.preventDefault();
  if (S.submitting) return;
  const names = ['name', 'phone', 'town', 'street'];
  let firstBad = null;
  names.forEach((n) => { touched.add(n); if (!validateField(n, true) && !firstBad) firstBad = n; });
  if (firstBad) { $(`#checkout [name="${firstBad}"]`).focus(); return; }

  const deliv = S.form.mode === 'delivery';
  if (deliv && S.eta.state === 'loading') await S.etaPromise;
  if (deliv && S.eta.state === 'idle') await runEta();
  if (deliv && S.eta.state === 'far') { $('#eta-box').scrollIntoView({ block: 'center' }); return; }
  if (!S.settings.open) { S.submitError = 'Most nem fogadunk online rendelést.'; renderDrawer(); return; }

  unlockAudio();
  if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});

  const f = S.form;
  const order = {
    code: store.makeCode(),
    customerName: f.name.trim(),
    customerPhone: normalizePhone(f.phone),
    orderType: deliv ? 'delivery' : 'pickup',
    town: deliv ? f.town.trim() : '',
    street: deliv ? f.street.trim() : '',
    address: deliv ? `${f.town.trim()}, ${f.street.trim()}` : '',
    courierNote: deliv ? f.courierNote.trim() : '',
    items: S.cart.map(({ key, ...l }) => l),
    subtotal: subtotal(),
    packagingFee: CONFIG.packagingFee,
    total: total(),
    quotedPrepMinutes: prepMinutes(),
    delivery: deliv && S.eta.state === 'ok'
      ? { km: Math.round(S.eta.data.km * 10) / 10, minutes: S.eta.data.minutes, source: S.eta.data.source, lat: S.eta.data.lat, lng: S.eta.data.lng }
      : null,
  };

  S.submitting = true;
  S.submitError = '';
  renderDrawer();
  try {
    const id = await store.createOrder(order);
    S.cart = [];
    saveCart();
    S.submitting = false;
    setActiveOrder(id);
    S.view = 'track';
    renderDrawer();
  } catch (err) {
    console.error(err);
    S.submitting = false;
    S.submitError = 'Nem sikerült elküldeni a rendelést. Ellenőrizd az internetet és próbáld újra – a kosarad megmaradt. Ha nem megy, hívj: ' + CONFIG.phone;
    renderDrawer();
  }
}

/* =========================================================
   ÉLŐ RENDELÉSKÖVETÉS
   ========================================================= */
let unwatch = null;

function setActiveOrder(id) {
  S.orderId = id;
  safeLS.set('zolgiz_active_order', id);
  safeLS.set('zolgiz_seen_status', 'NEW');
  watchActive();
}

function clearActiveOrder() {
  unwatch?.();
  S.orderId = null;
  S.order = null;
  safeLS.del('zolgiz_active_order');
  safeLS.del('zolgiz_seen_status');
  renderFloaters();
}

function watchActive() {
  unwatch?.();
  if (!S.orderId) return;
  unwatch = store.watchOrder(S.orderId, (o, err) => {
    if (err) return; // átmeneti hiba – a Firestore újrapróbál
    if (!o || Date.now() - o.createdAt > 8 * 3600 * 1000) { clearActiveOrder(); if (S.view === 'track' && drawer.open) renderDrawer(); return; }
    S.order = o;
    const seen = safeLS.get('zolgiz_seen_status');
    if (seen !== o.status) { safeLS.set('zolgiz_seen_status', o.status); notifyCustomer(o); }
    if (drawer.open && S.view === 'track') renderDrawer();
    renderFloaters();
  });
}

function info(o) {
  const pickup = o.orderType === 'pickup';
  const now = Date.now();
  const prepEnd = o.acceptedAt ? o.acceptedAt + o.prepMinutes * MIN : o.createdAt + (o.quotedPrepMinutes || CONFIG.defaultPrepMinutes) * MIN;
  const travel = (o.delivery?.minutes ?? CONFIG.delivery.unknownMinutes) * MIN;
  switch (o.status) {
    case 'NEW':
      return { tone: 'wait', short: 'Visszaigazolásra vár', title: 'Megkaptuk a rendelésed', sub: 'A konyha mindjárt visszaigazolja és megadja a pontos időt.', eta: pickup ? prepEnd : prepEnd + travel, etaLabel: pickup ? 'becsült elkészülés' : 'becsült érkezés' };
    case 'COOKING':
      return { tone: 'cook', short: 'Készül', title: 'Készül a rendelésed', sub: pickup ? 'Szólunk, amint indulhatsz érte – addig ráérsz.' : 'Ha elkészül, a futár azonnal indul.', eta: pickup ? Math.max(prepEnd, now) : Math.max(prepEnd, now) + travel, etaLabel: pickup ? 'elkészül' : 'várható érkezés' };
    case 'READY':
      return pickup
        ? { tone: 'go', short: 'Elkészült – jöhetsz!', title: 'Elkészült! Indulhatsz érte', sub: CONFIG.address, eta: null }
        : { tone: 'cook', short: 'Elkészült, futárra vár', title: 'Elkészült, a futár hamarosan indul', sub: 'Becsomagoltuk, már csak a futár indulására vár.', eta: Math.max(now, o.readyAt || now) + travel, etaLabel: 'várható érkezés' };
    case 'ON_THE_WAY':
      return { tone: 'go', short: 'Futár úton', title: 'A futár úton van hozzád', sub: o.address, eta: o.etaAt, etaLabel: 'érkezik kb.' };
    case 'DONE':
      return { tone: 'done', short: pickup ? 'Átvéve' : 'Kiszállítva', title: pickup ? 'Átvéve – jó étvágyat!' : 'Kiszállítva – jó étvágyat!', sub: 'Köszönjük, hogy minket választottál.', eta: null };
    case 'REJECTED':
      return { tone: 'bad', short: 'Nem teljesíthető', title: 'Ezt a rendelést most nem tudjuk teljesíteni', sub: o.rejectReason || `Hívj minket a részletekért: ${CONFIG.phone}`, eta: null };
    default:
      return { tone: 'wait', short: '…', title: 'Rendelésed', sub: '', eta: null };
  }
}

function steps(o) {
  const pickup = o.orderType === 'pickup';
  const order = ['NEW', 'COOKING', pickup ? 'READY' : 'ON_THE_WAY', 'DONE'];
  let idx = order.indexOf(o.status);
  if (!pickup && o.status === 'READY') idx = 1; // kész, futárra vár → még a 2. lépésnél
  const list = [
    ['Beérkezett', o.createdAt],
    ['Készül', o.acceptedAt],
    [pickup ? 'Elkészült' : 'Futár úton', pickup ? o.readyAt : o.dispatchedAt],
    [pickup ? 'Átvéve' : 'Kiszállítva', o.completedAt],
  ];
  return `<ol class="steps">${list.map(([label, t], i) => `
    <li class="${i < idx ? 'is-done' : i === idx ? 'is-now' : ''}">
      <span class="steps__dot" aria-hidden="true"></span><span>${label}</span>${t && i <= idx ? `<time>${hhmm(t)}</time>` : ''}
    </li>`).join('')}</ol>`;
}

function etaBlock(i) {
  if (!i.eta) return '';
  const mins = Math.max(0, Math.round((i.eta - Date.now()) / MIN));
  return `<div class="ticket__eta"><span>${i.etaLabel}</span><b data-eta="${i.eta}">${hhmm(i.eta)}</b><small data-eta-rel="${i.eta}">${mins ? `kb. ${mins} perc múlva` : 'bármelyik percben'}</small></div>`;
}

function trackView() {
  const o = S.order;
  if (!o) return `${head('Rendelésed')}<div class="empty"><span class="spin" aria-hidden="true"></span><p>Rendelés betöltése…</p></div>`;
  const i = info(o);
  const final = o.status === 'DONE' || o.status === 'REJECTED';
  return `${head('Rendelésed')}
    <div class="ticket ticket--${i.tone}">
      <div class="ticket__top"><span>Blokk</span><b>#${esc(o.code)}</b><span>${hhmm(o.createdAt)}</span></div>
      <p class="ticket__title">${esc(i.title)}</p>
      <p class="ticket__sub">${esc(i.sub)}</p>
      ${etaBlock(i)}
      ${o.status === 'REJECTED' ? '' : steps(o)}
      <details class="ticket__items">
        <summary>${o.items.reduce((s, l) => s + l.qty, 0)} tétel · ${ft(o.total)} · ${o.orderType === 'pickup' ? 'elvitel' : 'házhozszállítás'}</summary>
        <ul>${o.items.map((l) => `<li><b>${l.qty}× ${esc(l.name)}</b>${lineDetails(l)}</li>`).join('')}</ul>
      </details>
    </div>
    <div class="drawer__foot">
      ${'Notification' in window && Notification.permission === 'default' && !final ? '<button type="button" class="btn btn--ghost btn--block" data-notif>Értesítés kérése, ha változik</button>' : ''}
      <a class="btn btn--ghost btn--block" href="tel:${CONFIG.phoneHref}">${icon('phone')}Kérdésed van? Hívj minket</a>
      ${final ? '<button type="button" class="btn btn--primary btn--block" data-new-order>Új rendelés</button>' : ''}
    </div>`;
}

drawerIn.addEventListener('click', (e) => {
  if (e.target.closest('[data-notif]')) {
    unlockAudio();
    Notification.requestPermission().finally(() => renderDrawer());
  }
});

const NOTIFY = {
  COOKING: (o) => ['Elfogadtuk a rendelésed', `Elkészül kb. ${hhmm(o.acceptedAt + o.prepMinutes * MIN)}-kor.`],
  READY: (o) => (o.orderType === 'pickup' ? ['Elkészült! Indulhatsz érte', CONFIG.address] : ['Elkészült a rendelésed', 'A futár hamarosan indul.']),
  ON_THE_WAY: (o) => ['A futár elindult!', `Várható érkezés: kb. ${hhmm(o.etaAt)}`],
  DONE: () => ['Jó étvágyat!', 'Köszönjük a rendelést.'],
  REJECTED: (o) => ['A rendelés nem teljesíthető', o.rejectReason || `Hívj minket: ${CONFIG.phone}`],
};

function notifyCustomer(o) {
  const n = NOTIFY[o.status]?.(o);
  if (!n) return;
  const loud = o.status === 'READY' || o.status === 'ON_THE_WAY';
  chime(loud ? [523.25, 659.25, 783.99] : [659.25, 880]);
  if (loud) navigator.vibrate?.([200, 100, 200]);
  if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
    try { new Notification(n[0], { body: n[1], tag: `order-${o.code}` }); } catch { /* */ }
  }
  if (!drawer.open) toast(`${n[0]} – ${n[1]}`, { action: 'Megnézem', onAction: () => openDrawer('track'), ms: 8000 });
}

function renderFloaters() {
  const pill = $('#tracker-pill');
  const show = S.orderId && S.order && !drawer.open;
  pill.hidden = !show;
  if (show) {
    const i = info(S.order);
    pill.className = `tracker-pill tracker-pill--${i.tone}`;
    pill.innerHTML = `<span class="tracker-pill__dot" aria-hidden="true"></span><span><b>#${esc(S.order.code)} · ${esc(i.short)}</b>${i.eta ? `<small>${i.etaLabel} ${hhmm(i.eta)}</small>` : ''}</span>`;
  }
  renderCartChrome();
}
$('#tracker-pill').addEventListener('click', () => openDrawer('track'));

// Percenként frissülő „kb. X perc múlva”
setInterval(() => {
  $$('[data-eta-rel]').forEach((el) => {
    const m = Math.max(0, Math.round((+el.dataset.etaRel - Date.now()) / MIN));
    el.textContent = m ? `kb. ${m} perc múlva` : 'bármelyik percben';
  });
}, 20000);

/* =========================================================
   INDÍTÁS
   ========================================================= */
renderHero();
renderCats();
renderMenu();
renderCartChrome();
if (S.orderId) watchActive();

store.watchSettings((s) => {
  const soldChanged = JSON.stringify(s.soldOut) !== JSON.stringify(S.settings.soldOut);
  S.settings = s;
  $('#closed-banner').hidden = s.open;
  if (soldChanged) renderMenu();
  if (drawer.open && S.view !== 'track') renderDrawer();
});
