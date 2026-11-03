'use client';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../Icon';
import { api, ApiError, chime, ls, unlockAudio } from '@/lib/client';
import { ft, hhmm, km, MIN, normalizePhone, telHref } from '@/lib/format';
import type { Content, EtaResult, OrderLine, PublicOrder, Status } from '@/lib/types';
import type { Selection } from '@/lib/menu';

export type CartLine = Selection & { key: string; ref: OrderLine['ref']; name: string; qty: number; unitPrice: number };
export type View = 'cart' | 'checkout' | 'track';

type Form = { mode: 'pickup' | 'delivery'; name: string; phone: string; town: string; street: string; courierNote: string };
type Eta = { state: 'idle' | 'loading' | 'notfound' | 'network' } | { state: 'ok' | 'far'; data: Extract<EtaResult, { ok: true }> };

export function Mods({ l }: { l: Pick<OrderLine, 'side' | 'freeSauce' | 'extras' | 'sauces' | 'removed' | 'note'> }) {
  const parts: React.ReactNode[] = [];
  if (l.side) parts.push(<li key="s">Köret: {l.side}</li>);
  if (l.freeSauce) parts.push(<li key="f">Szósz: {l.freeSauce}</li>);
  if (l.extras.length) parts.push(<li key="e" className="is-add">+ {l.extras.join(', ')}</li>);
  if (l.sauces.length) parts.push(<li key="a" className="is-add">+ {l.sauces.join(', ')}</li>);
  if (l.removed.length) parts.push(<li key="r" className="is-rm">nélkül: {l.removed.join(', ')}</li>);
  if (l.note) parts.push(<li key="n" className="is-note">„{l.note}”</li>);
  return parts.length ? <ul className="line__mods">{parts}</ul> : null;
}

/* ---------------- Követés: állapot szövegek ---------------- */
export function orderInfo(o: PublicOrder, c: Content, now = Date.now()) {
  const pickup = o.orderType === 'pickup';
  const prepEnd = o.acceptedAt && o.prepMinutes ? o.acceptedAt + o.prepMinutes * MIN : o.createdAt + (o.quotedPrepMinutes || c.pricing.defaultPrepMinutes) * MIN;
  const travel = (o.delivery?.minutes ?? c.delivery.unknownMinutes) * MIN;
  type I = { tone: 'wait' | 'cook' | 'go' | 'done' | 'bad'; short: string; title: string; sub: string; eta: number | null; etaLabel?: string };
  const m: Record<string, () => I> = {
    NEW: () => ({ tone: 'wait', short: 'Visszaigazolásra vár', title: 'Megkaptuk a rendelésed', sub: 'A konyha mindjárt visszaigazolja és megadja a pontos időt.', eta: pickup ? prepEnd : prepEnd + travel, etaLabel: pickup ? 'becsült elkészülés' : 'becsült érkezés' }),
    COOKING: () => ({ tone: 'cook', short: 'Készül', title: 'Készül a rendelésed', sub: pickup ? 'Szólunk, amint indulhatsz érte – addig ráérsz.' : 'Ha elkészül, a futár azonnal indul.', eta: pickup ? Math.max(prepEnd, now) : Math.max(prepEnd, now) + travel, etaLabel: pickup ? 'elkészül' : 'várható érkezés' }),
    READY: () => (pickup
      ? { tone: 'go', short: 'Elkészült – jöhetsz!', title: 'Elkészült! Indulhatsz érte', sub: c.contact.address, eta: null }
      : { tone: 'cook', short: 'Elkészült, futárra vár', title: 'Elkészült, a futár hamarosan indul', sub: 'Becsomagoltuk, már csak a futár indulására vár.', eta: Math.max(now, o.readyAt || now) + travel, etaLabel: 'várható érkezés' }),
    ON_THE_WAY: () => ({ tone: 'go', short: 'Futár úton', title: 'A futár úton van hozzád', sub: o.address, eta: o.etaAt ?? null, etaLabel: 'érkezik kb.' }),
    DONE: () => ({ tone: 'done', short: pickup ? 'Átvéve' : 'Kiszállítva', title: pickup ? 'Átvéve – jó étvágyat!' : 'Kiszállítva – jó étvágyat!', sub: 'Köszönjük, hogy minket választottál.', eta: null }),
    REJECTED: () => ({ tone: 'bad', short: 'Nem teljesíthető', title: 'Ezt a rendelést most nem tudjuk teljesíteni', sub: o.rejectReason || `Hívj minket a részletekért: ${c.contact.phone}`, eta: null }),
  };
  return (m[o.status] ?? m.NEW)();
}

export const NOTIFY: Record<string, (o: PublicOrder, c: Content) => [string, string]> = {
  COOKING: (o) => ['Elfogadtuk a rendelésed', `Elkészül kb. ${hhmm((o.acceptedAt ?? Date.now()) + (o.prepMinutes ?? 0) * MIN)}-kor.`],
  READY: (o, c) => (o.orderType === 'pickup' ? ['Elkészült! Indulhatsz érte', c.contact.address] : ['Elkészült a rendelésed', 'A futár hamarosan indul.']),
  ON_THE_WAY: (o) => ['A futár elindult!', `Várható érkezés: kb. ${hhmm(o.etaAt ?? Date.now())}`],
  DONE: () => ['Jó étvágyat!', 'Köszönjük a rendelést.'],
  REJECTED: (o, c) => ['A rendelés nem teljesíthető', o.rejectReason || `Hívj minket: ${c.contact.phone}`],
};

function Steps({ o }: { o: PublicOrder }) {
  const pickup = o.orderType === 'pickup';
  const order = ['NEW', 'COOKING', pickup ? 'READY' : 'ON_THE_WAY', 'DONE'];
  let idx = order.indexOf(o.status);
  if (!pickup && o.status === 'READY') idx = 1;
  const list: [string, number | null | undefined][] = [
    ['Beérkezett', o.createdAt],
    ['Készül', o.acceptedAt],
    [pickup ? 'Elkészült' : 'Futár úton', pickup ? o.readyAt : o.dispatchedAt],
    [pickup ? 'Átvéve' : 'Kiszállítva', o.completedAt],
  ];
  return (
    <ol className="steps">
      {list.map(([label, t], i) => (
        <li key={label} className={i < idx ? 'is-done' : i === idx ? 'is-now' : ''}>
          <span className="steps__dot" aria-hidden="true" /><span>{label}</span>{t && i <= idx ? <time>{hhmm(t)}</time> : null}
        </li>
      ))}
    </ol>
  );
}

function useNow(ms: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

/* ---------------- A fiók ---------------- */
type Props = {
  c: Content;
  status: Status;
  open: boolean;
  view: View;
  setView: (v: View) => void;
  onClose: () => void;
  cart: CartLine[];
  changeQty: (key: string, d: number) => void;
  clearCart: () => void;
  order: PublicOrder | null;
  orderId: string | null;
  onOrdered: (o: PublicOrder) => void;
  onNewOrder: () => void;
};

export function Drawer(p: Props) {
  const { c, status, cart } = p;
  const ref = useRef<HTMLDialogElement>(null);
  const subtotal = cart.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const total = cart.length ? subtotal + c.pricing.packagingFee : 0;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (p.open && !d.open) d.showModal();
    if (!p.open && d.open) d.close();
  }, [p.open]);

  const view: View = p.view === 'track' && p.orderId ? 'track' : p.view === 'checkout' && cart.length ? 'checkout' : 'cart';
  const label = { cart: 'Kosár', checkout: 'Rendelés leadása', track: 'Rendelésed állapota' }[view];

  const head = (title: string, back?: View) => (
    <header className="drawer__head">
      {back && <button type="button" className="iconbtn" aria-label="Vissza" onClick={() => p.setView(back)}><Icon name="left" /></button>}
      <h2>{title}</h2>
      <button type="button" className="iconbtn" aria-label="Bezárás" onClick={() => ref.current?.close()}><Icon name="x" /></button>
    </header>
  );

  const totals = (
    <dl className="totals">
      <div><dt>Részösszeg</dt><dd>{ft(subtotal)}</dd></div>
      <div><dt>Csomagolás</dt><dd>{ft(c.pricing.packagingFee)}</dd></div>
      <div className="totals__sum"><dt>Összesen</dt><dd>{ft(total)}</dd></div>
    </dl>
  );

  return (
    <dialog ref={ref} className="drawer" aria-label={label} onClose={p.onClose} onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}>
      <div className="drawer__in">
        {view === 'cart' && (!cart.length ? (
          <>
            {head('Kosarad')}
            <div className="empty">
              <Icon name="bag" className="empty__i" />
              <p><b>Még üres a kosarad.</b><br />Válassz valamit az étlapról – a pizzákat testre is szabhatod.</p>
              <button type="button" className="btn btn--ghost" onClick={() => ref.current?.close()}>Vissza az étlaphoz</button>
              {p.orderId && <button type="button" className="btn btn--link" onClick={() => p.setView('track')}>Folyamatban lévő rendelésed</button>}
            </div>
          </>
        ) : (
          <>
            {head('Kosarad')}
            <ul className="lines">
              {cart.map((l) => (
                <li key={l.key} className="line">
                  <div className="line__main"><b className="line__name">{l.name}</b><Mods l={l} /></div>
                  <div className="line__side">
                    <span className="line__price">{ft(l.unitPrice * l.qty)}</span>
                    <div className="stepper stepper--sm" role="group" aria-label={`${l.name} mennyisége`}>
                      <button type="button" aria-label={l.qty === 1 ? 'Törlés' : 'Kevesebb'} onClick={() => p.changeQty(l.key, -1)}><Icon name={l.qty === 1 ? 'trash' : 'minus'} /></button>
                      <output>{l.qty}</output>
                      <button type="button" aria-label="Több" onClick={() => p.changeQty(l.key, 1)}><Icon name="plus" /></button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="drawer__foot">
              {totals}
              {!status.open && <p className="note note--warn">Most nem fogadunk online rendelést.</p>}
              <button type="button" className="btn btn--primary btn--block btn--lg" disabled={!status.open} onClick={() => p.setView('checkout')}>Tovább a rendeléshez</button>
            </div>
          </>
        ))}
        {view === 'checkout' && (
          <>
            {head('Rendelés leadása', 'cart')}
            <Checkout c={c} status={status} cart={cart} total={total} totals={totals} onOrdered={p.onOrdered} />
          </>
        )}
        {view === 'track' && (
          <>
            {head('Rendelésed')}
            <Track c={c} order={p.order} onNewOrder={p.onNewOrder} />
          </>
        )}
      </div>
    </dialog>
  );
}

/* ---------------- Pénztár ---------------- */
const FORM0: Form = { mode: 'pickup', name: '', phone: '', town: '', street: '', courierNote: '' };

function Checkout({ c, status, cart, total, totals, onOrdered }: { c: Content; status: Status; cart: CartLine[]; total: number; totals: React.ReactNode; onOrdered: (o: PublicOrder) => void }) {
  const [f, setF] = useState<Form>(() => ({ ...FORM0, town: c.contact.town, ...ls.get<Partial<Form>>('zolgiz_form', {}) }));
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [eta, setEta] = useState<Eta>({ state: 'idle' });
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');
  const etaReq = useRef<{ ctl: AbortController; p: Promise<Eta> } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const deliv = f.mode === 'delivery';
  const prep = c.pricing.defaultPrepMinutes + (status.extraWait || 0);

  useEffect(() => { ls.set('zolgiz_form', f); }, [f]);

  const validators: Record<string, (v: string) => string> = {
    name: (v) => (v.trim().length < 2 ? 'Add meg a neved, hogy tudjuk, kié a rendelés.' : ''),
    phone: (v) => (!v.trim() ? 'Telefonszám nélkül nem tudunk szólni, ha kész.' : normalizePhone(v) ? '' : 'Magyar mobilszámot adj meg, pl. 06 30 123 4567.'),
    town: (v) => (deliv && !v.trim() ? 'Melyik településre vigyük?' : ''),
    street: (v) => (!deliv ? '' : !v.trim() ? 'Add meg az utcát és a házszámot.' : !/\d/.test(v) ? 'A házszámot is írd be.' : ''),
  };
  const errOf = (k: keyof Form) => (touched.has(k) ? validators[k]?.(f[k]) ?? '' : '');

  function runEta(town = f.town.trim(), street = f.street.trim(), mode = f.mode): Promise<Eta> {
    etaReq.current?.ctl.abort();
    if (mode !== 'delivery' || !town || !/\d/.test(street)) { const e: Eta = { state: 'idle' }; setEta(e); etaReq.current = null; return Promise.resolve(e); }
    const ctl = new AbortController();
    setEta({ state: 'loading' });
    const p = fetch('/api/eta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ town, street }), signal: ctl.signal })
      .then((r) => r.json() as Promise<EtaResult & { far?: boolean }>)
      .then((r): Eta => (!r.ok ? { state: r.reason } : r.far ? { state: 'far', data: r } : { state: 'ok', data: r }))
      .catch((): Eta => ({ state: ctl.signal.aborted ? 'loading' : 'network' }))
      .then((e) => { if (!ctl.signal.aborted) setEta(e); return e; });
    etaReq.current = { ctl, p };
    return p;
  }

  // cím változás → kis késleltetéssel újraszámol
  useEffect(() => {
    if (!deliv) { runEta(); return; }
    const t = setTimeout(() => runEta(), 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.town, f.street, f.mode]);

  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const blur = (k: keyof Form) => () => { if (f[k]) setTouched((t) => new Set(t).add(k)); };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    const keys: (keyof Form)[] = ['name', 'phone', 'town', 'street'];
    setTouched(new Set(keys));
    const bad = keys.find((k) => validators[k](f[k]));
    if (bad) { formRef.current?.querySelector<HTMLInputElement>(`[name="${bad}"]`)?.focus(); return; }

    let e2 = eta;
    if (deliv && (eta.state === 'loading' || eta.state === 'idle')) e2 = await (etaReq.current?.p ?? runEta());
    if (deliv && e2.state === 'far') { document.getElementById('eta-box')?.scrollIntoView({ block: 'center' }); return; }

    unlockAudio();
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});

    setSubmitting(true);
    setErr('');
    try {
      const o = await api<PublicOrder>('/api/orders', {
        method: 'POST',
        json: {
          customerName: f.name.trim(),
          customerPhone: normalizePhone(f.phone),
          orderType: f.mode,
          town: deliv ? f.town.trim() : '',
          street: deliv ? f.street.trim() : '',
          courierNote: deliv ? f.courierNote.trim() : '',
          items: cart.map((l) => ({ ref: l.ref, qty: l.qty, extras: l.extras, sauces: l.sauces, removed: l.removed, side: l.side, freeSauce: l.freeSauce, note: l.note })),
          expectedTotal: total,
        },
      });
      onOrdered(o);
    } catch (ex) {
      const msg = ex instanceof ApiError && ex.status && ex.status < 500 ? ex.message : 'Nem sikerült elküldeni a rendelést. Ellenőrizd az internetet és próbáld újra – a kosarad megmaradt.';
      setErr(`${msg} Ha nem megy, hívj: ${c.contact.phone}`);
    } finally {
      setSubmitting(false);
    }
  }

  const etaBox = () => {
    if (!deliv) return <><Icon name="clock" /><div><b>Elkészül kb. {prep} perc alatt</b><span>Szólunk, amint indulhatsz érte: {c.contact.address}</span></div></>;
    switch (eta.state) {
      case 'loading': return <><span className="spin" aria-hidden="true" /><div><b>Útvonal számolása…</b><span>Megnézzük, milyen messze vagy tőlünk.</span></div></>;
      case 'ok': {
        const arrive = Date.now() + (prep + eta.data.minutes) * MIN;
        return <><Icon name="bike" /><div><b>{km(eta.data.km)} · kb. {eta.data.minutes} perc út</b><span>Várható érkezés: kb. {prep + eta.data.minutes} perc múlva (≈ {hhmm(arrive)}){eta.data.precise ? '' : ' – a házszámot nem találtuk pontosan, az utcával számoltunk'}</span></div></>;
      }
      case 'far': return <><Icon name="alert" /><div className="is-bad"><b>Ide sajnos nem szállítunk ({km(eta.data.km)})</b><span>A kiszállítási terület {c.delivery.maxKm} km-ig tart. Válaszd az elvitelt, vagy hívj: {c.contact.phone}</span></div></>;
      case 'notfound': return <><Icon name="alert" /><div><b>Ezt a címet nem találjuk a térképen</b><span>Ellenőrizd az utcanevet. A rendelés így is leadható, a futár idejét a konyha becsüli meg.</span></div></>;
      case 'network': return <><Icon name="alert" /><div><b>Most nem tudtuk kiszámolni az útvonalat</b><span>A rendelés így is leadható.</span></div></>;
      default: return <><Icon name="pin" /><div><b>Add meg a címed</b><span>Kiszámoljuk, mennyi idő alatt ér oda hozzád a futár.</span></div></>;
    }
  };

  const input = (k: keyof Form, label: React.ReactNode, props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <div className="field">
      <label className="field__label" htmlFor={`f-${k}`}>{label}</label>
      <input id={`f-${k}`} name={k} value={f[k]} onChange={set(k)} onBlur={blur(k)} aria-invalid={touched.has(k) ? !!errOf(k) : undefined} aria-describedby={`e-${k}`} {...props} />
      <p className="field__err" id={`e-${k}`}>{errOf(k)}</p>
    </div>
  );

  return (
    <form className="checkout" ref={formRef} noValidate onSubmit={submit}>
      <fieldset className="seg" aria-label="Átvétel módja">
        <label><input type="radio" name="mode" value="pickup" checked={!deliv} onChange={() => setF((x) => ({ ...x, mode: 'pickup' }))} /><span><Icon name="bag" />Elvitel</span></label>
        <label><input type="radio" name="mode" value="delivery" checked={deliv} onChange={() => setF((x) => ({ ...x, mode: 'delivery' }))} /><span><Icon name="bike" />Házhozszállítás</span></label>
      </fieldset>
      {input('name', 'Neved', { autoComplete: 'name', required: true, maxLength: 60 })}
      {input('phone', <>Telefonszámod <small>ide küldjük az értesítést</small></>, { type: 'tel', inputMode: 'tel', autoComplete: 'tel', required: true, placeholder: '06 30 123 4567' })}
      {deliv && (
        <div className="addr">
          <div className="addr__row">
            {input('town', 'Település', { list: 'towns', autoComplete: 'address-level2' })}
            {input('street', 'Utca, házszám', { autoComplete: 'address-line1', placeholder: 'Fő utca 12.' })}
          </div>
          <datalist id="towns">{c.delivery.towns.map((t) => <option key={t} value={t} />)}</datalist>
          <div className="field">
            <label className="field__label" htmlFor="f-cnote">Üzenet a futárnak <small>nem kötelező</small></label>
            <input id="f-cnote" maxLength={120} placeholder="pl. kapucsengő nem működik, hívj" value={f.courierNote} onChange={set('courierNote')} />
          </div>
        </div>
      )}
      <div className="eta" id="eta-box" aria-live="polite">{etaBox()}</div>
      <div className="drawer__foot drawer__foot--form">
        {totals}
        <p className="note">Fizetés átvételkor.</p>
        <p className="form-err" role="alert">{err}</p>
        <button type="submit" className="btn btn--primary btn--block btn--lg" disabled={submitting || !status.open} aria-busy={submitting || undefined}>
          {submitting ? 'Küldés…' : `Rendelés leadása · ${ft(total)}`}
        </button>
      </div>
    </form>
  );
}

/* ---------------- Követés ---------------- */
function Track({ c, order: o, onNewOrder }: { c: Content; order: PublicOrder | null; onNewOrder: () => void }) {
  const now = useNow(20000);
  const [, force] = useState(0);
  if (!o) return <div className="empty"><span className="spin" aria-hidden="true" /><p>Rendelés betöltése…</p></div>;
  const i = orderInfo(o, c, now);
  const final = o.status === 'DONE' || o.status === 'REJECTED';
  const mins = i.eta ? Math.max(0, Math.round((i.eta - now) / MIN)) : 0;
  const canNotify = typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default' && !final;
  return (
    <>
      <div className={`ticket ticket--${i.tone}`}>
        <div className="ticket__top"><span>Blokk</span><b>#{o.code}</b><span>{hhmm(o.createdAt)}</span></div>
        <p className="ticket__title">{i.title}</p>
        <p className="ticket__sub">{i.sub}</p>
        {i.eta && (
          <div className="ticket__eta"><span>{i.etaLabel}</span><b>{hhmm(i.eta)}</b><small>{mins ? `kb. ${mins} perc múlva` : 'bármelyik percben'}</small></div>
        )}
        {o.status !== 'REJECTED' && <Steps o={o} />}
        <details className="ticket__items">
          <summary>{o.items.reduce((s, l) => s + l.qty, 0)} tétel · {ft(o.total)} · {o.orderType === 'pickup' ? 'elvitel' : 'házhozszállítás'}</summary>
          <ul>{o.items.map((l, k) => <li key={k}><b>{l.qty}× {l.name}</b><Mods l={l} /></li>)}</ul>
        </details>
      </div>
      <div className="drawer__foot">
        {canNotify && (
          <button type="button" className="btn btn--ghost btn--block" onClick={() => { unlockAudio(); chime(); Notification.requestPermission().finally(() => force((n) => n + 1)); }}>
            Értesítés kérése, ha változik
          </button>
        )}
        <a className="btn btn--ghost btn--block" href={telHref(c.contact.phone)}><Icon name="phone" />Kérdésed van? Hívj minket</a>
        {final && <button type="button" className="btn btn--primary btn--block" onClick={onNewOrder}>Új rendelés</button>}
      </div>
    </>
  );
}
