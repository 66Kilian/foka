'use client';
// A pult: Új → Készül → Kész → Úton. Egy koppintás = egy lépés, minden visszavonható.
import { useEffect, useState } from 'react';
import { Icon } from '../Icon';
import { useAdmin } from './state';
import { api } from '@/lib/client';
import { fillTemplate, unitPrice } from '@/lib/menu';
import { ago, ft, hhmm, km, MIN, mmss } from '@/lib/format';
import type { Content, EtaResult, Order, OrderLine, OrderStatus } from '@/lib/types';

export const ACTIVE: OrderStatus[] = ['NEW', 'COOKING', 'READY', 'ON_THE_WAY'];
const PREP_CHOICES = [10, 15, 20, 25, 30, 40, 50, 60];
const COLS: { st: OrderStatus; title: string; empty: string }[] = [
  { st: 'NEW', title: 'Új', empty: 'Nincs új rendelés.' },
  { st: 'COOKING', title: 'Készül', empty: 'Semmi nem készül.' },
  { st: 'READY', title: 'Kész', empty: 'Nincs kiadásra váró.' },
  { st: 'ON_THE_WAY', title: 'Úton', empty: 'Nincs úton futár.' },
];

export type Patch = Partial<Pick<Order, 'status' | 'prepMinutes' | 'acceptedAt' | 'readyAt' | 'dispatchedAt' | 'etaAt' | 'completedAt' | 'rejectReason' | 'notified'>>;

const prepEnd = (o: Order) => (o.acceptedAt ?? o.createdAt) + (o.prepMinutes ?? 0) * MIN;

function useTick() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  return now;
}

/** Ellenőrzés: az étlap mai árai szerint ennyi lenne (ha közben árat módosítottak, eltérhet) */
function expected(lines: OrderLine[], c: Content) {
  let sum = 0;
  for (const l of lines) {
    if (l.ref.type === 'offer') { const o = c.offers.find((x) => x.id === l.ref.id); if (!o) return null; sum += o.price * l.qty; continue; }
    const it = c.items.find((x) => x.id === l.ref.id);
    if (!it) return null;
    sum += unitPrice(it.price, l, c) * l.qty;
  }
  return sum + c.pricing.packagingFee;
}

function KMods({ l }: { l: OrderLine }) {
  const r: React.ReactNode[] = [];
  if (l.side) r.push(<li key="s">Köret: <b>{l.side}</b></li>);
  if (l.freeSauce) r.push(<li key="f">Szósz: <b>{l.freeSauce}</b></li>);
  if (l.extras.length) r.push(<li key="e" className="is-add">+ {l.extras.join(', ')}</li>);
  if (l.sauces.length) r.push(<li key="a" className="is-add">+ {l.sauces.join(', ')}</li>);
  if (l.removed.length) r.push(<li key="r" className="is-rm">NÉLKÜL: {l.removed.join(', ')}</li>);
  if (l.note) r.push(<li key="n" className="is-note">„{l.note}”</li>);
  return r.length ? <ul className="kt__mods">{r}</ul> : null;
}

export function Board({ orders, fresh, change }: { orders: Order[]; fresh: Set<string>; change: (o: Order, p: Patch, msg: string) => Promise<boolean> }) {
  const { published: c, toast } = useAdmin();
  const now = useTick();
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const active = orders.filter((o) => ACTIVE.includes(o.status));

  async function notify(o: Order, kind: 'ready' | 'dispatch', manual = false) {
    const text = fillTemplate(kind === 'ready' ? c.sms.ready : c.sms.dispatch, {
      nev: o.customerName, kod: o.code, cim: c.contact.address, erkezes: o.etaAt ? hhmm(o.etaAt) : '', etterem: c.brand.name,
    });
    const mark = () => api(`/api/admin/orders/${o.id}`, { method: 'PATCH', json: { notified: { [kind]: Date.now() } } }).catch(() => {});
    if (c.sms.mode === 'off' && !manual) return;
    if (c.sms.mode === 'twilio') {
      try {
        await api('/api/admin/sms', { method: 'POST', json: { to: o.customerPhone, text } });
        void mark();
        toast(`SMS elküldve: ${o.customerPhone}`);
      } catch (e) {
        toast(`Az SMS nem ment ki (${e instanceof Error ? e.message : 'hiba'}). Hívd fel a vevőt!`, { ms: 9000 });
      }
      return;
    }
    // 'link': a tablet/telefon SMS appja nyílik meg kitöltve
    const href = `sms:${o.customerPhone}?&body=${encodeURIComponent(text)}`;
    void mark();
    if (matchMedia('(pointer: coarse)').matches) location.href = href;
    else toast(`SMS szöveg kész: ${o.customerPhone}`, { action: 'SMS megnyitása', ms: 9000, onAction: () => { location.href = href; } });
  }

  async function dispatch(o: Order) {
    setBusy(o.id);
    let minutes = o.delivery?.minutes;
    if (!minutes && o.town && o.street) {
      try {
        const r = await api<EtaResult>('/api/admin/eta', { method: 'POST', json: { town: o.town, street: o.street } });
        if (r.ok) minutes = r.minutes;
      } catch { /* */ }
    }
    minutes = minutes || c.delivery.unknownMinutes;
    const t = Date.now();
    const patch: Patch = { status: 'ON_THE_WAY', dispatchedAt: t, etaAt: t + minutes * MIN };
    const ok = await change(o, patch, `#${o.code} úton – érkezés ~${hhmm(patch.etaAt!)}`);
    setBusy(null);
    if (ok) void notify({ ...o, ...patch }, 'dispatch');
  }

  const sent = (o: Order, k: 'ready' | 'dispatch') => (o.notified?.[k] ? <span className="kt__sent"><Icon name="msg" />Értesítve {hhmm(o.notified[k]!)}</span> : null);

  function actions(o: Order) {
    const pickup = o.orderType === 'pickup';
    switch (o.status) {
      case 'NEW':
        if (rejecting === o.id) {
          return (
            <div className="kt__act kt__act--reject">
              <p className="kt__label">Miért utasítod el? A vásárló ezt látja:</p>
              {c.rejectReasons.map((r) => (
                <button key={r} type="button" className="kbtn kbtn--ghost kbtn--left" onClick={() => { setRejecting(null); void change(o, { status: 'REJECTED', rejectReason: r, completedAt: Date.now() }, `#${o.code} elutasítva`); }}>{r}</button>
              ))}
              <button type="button" className="kbtn kbtn--link" onClick={() => setRejecting(null)}>Mégse</button>
            </div>
          );
        }
        return (
          <div className="kt__act">
            <p className="kt__label">Mennyi idő alatt lesz kész? <small>(egy koppintás = elfogadás)</small></p>
            <div className="kt__chips">
              {PREP_CHOICES.map((m) => (
                <button key={m} type="button" className="kchip" onClick={() => change(o, { status: 'COOKING', prepMinutes: m, acceptedAt: Date.now() }, `#${o.code} elfogadva – ${m} perc`)}>{m}<small>p</small></button>
              ))}
            </div>
            <button type="button" className="kbtn kbtn--link kbtn--danger" onClick={() => setRejecting(o.id)}>Elutasítás</button>
          </div>
        );
      case 'COOKING': {
        const end = prepEnd(o);
        const left = end - now;
        const from = o.acceptedAt ?? o.createdAt;
        return (
          <div className="kt__act">
            <div className="kt__timer">
              <div><span className="kt__label">Hátra</span><b>{left >= 0 ? mmss(left) : `+${mmss(left)}`}</b></div>
              <span className="kt__goal">kész {hhmm(end)}</span>
            </div>
            <div className="kt__prog"><i style={{ transform: `scaleX(${Math.min(1, Math.max(0, (now - from) / (end - from)))})` }} /></div>
            <div className="kt__row">
              <button type="button" className="kbtn kbtn--ghost" onClick={() => change(o, { prepMinutes: (o.prepMinutes ?? 0) + 5 }, `#${o.code} +5 perc – a vevő látja az új időt`)}>+5 perc</button>
              <button type="button" className="kbtn kbtn--go kbtn--grow" onClick={async () => {
                const ok = await change(o, { status: 'READY', readyAt: Date.now() }, `#${o.code} kész`);
                if (ok && pickup) void notify({ ...o, status: 'READY' }, 'ready');
              }}><Icon name="check" />Kész</button>
            </div>
          </div>
        );
      }
      case 'READY':
        if (pickup) {
          return (
            <div className="kt__act">
              <p className="kt__wait">Átvételre vár · {ago(o.readyAt ?? now, now)}</p>
              {sent(o, 'ready')}
              <div className="kt__row">
                <button type="button" className="kbtn kbtn--ghost" onClick={() => notify(o, 'ready', true)}><Icon name="msg" />SMS újra</button>
                <button type="button" className="kbtn kbtn--go kbtn--grow" onClick={() => change(o, { status: 'DONE', completedAt: Date.now() }, `#${o.code} lezárva`)}><Icon name="check" />Átvette</button>
              </div>
            </div>
          );
        }
        return (
          <div className="kt__act">
            <p className="kt__wait">Futárra vár · {ago(o.readyAt ?? now, now)}</p>
            <button type="button" className="kbtn kbtn--courier kbtn--block" disabled={busy === o.id} onClick={() => dispatch(o)}>
              {busy === o.id ? <><span className="kspin" />Útvonal…</> : <><Icon name="bike" />Átadva a futárnak</>}
            </button>
            <p className="kt__hint">A vevő azonnal értesítést kap a várható érkezéssel{o.delivery ? ` (kb. ${hhmm(now + o.delivery.minutes * MIN)})` : ''}.</p>
          </div>
        );
      case 'ON_THE_WAY': {
        const eta = o.etaAt ?? now;
        const left = eta - now;
        const from = o.dispatchedAt ?? now;
        return (
          <div className="kt__act">
            <div className="kt__timer">
              <div><span className="kt__label">Érkezésig</span><b>{left >= 0 ? mmss(left) : `+${mmss(left)}`}</b></div>
              <span className="kt__goal">érkezés ~{hhmm(eta)}</span>
            </div>
            <div className="kt__prog kt__prog--road"><i style={{ transform: `scaleX(${Math.min(1, Math.max(0, (now - from) / (eta - from || 1)))})` }} /></div>
            {sent(o, 'dispatch')}
            <div className="kt__row">
              <button type="button" className="kbtn kbtn--ghost" onClick={() => notify(o, 'dispatch', true)}><Icon name="msg" />SMS újra</button>
              <button type="button" className="kbtn kbtn--go kbtn--grow" onClick={() => change(o, { status: 'DONE', completedAt: Date.now() }, `#${o.code} lezárva`)}><Icon name="check" />Kiszállítva</button>
            </div>
          </div>
        );
      }
      default:
        return null;
    }
  }

  return (
    <section className="board" aria-label="Rendelések">
      {COLS.map(({ st, title, empty }) => {
        const list = active.filter((o) => o.status === st);
        if (st === 'COOKING') list.sort((a, b) => prepEnd(a) - prepEnd(b));
        return (
          <div key={st} className="col" data-col={st}>
            <h2>{title} <span>{list.length || ''}</span></h2>
            <div className="col__list" aria-live={st === 'NEW' ? 'polite' : undefined}>
              {list.length ? list.map((o) => {
                const pickup = o.orderType === 'pickup';
                const exp = expected(o.items, c);
                const d = o.delivery;
                const timerEnd = o.status === 'COOKING' ? prepEnd(o) : o.status === 'ON_THE_WAY' ? o.etaAt ?? null : null;
                const left = timerEnd != null ? timerEnd - now : null;
                return (
                  <article key={o.id} className={`kt kt--${o.status}${fresh.has(o.id) ? ' is-fresh' : ''}${left != null && left < 0 ? ' is-late' : left != null && left < 3 * MIN ? ' is-soon' : ''}`} aria-label={`Rendelés #${o.code}`}>
                    <header className="kt__head">
                      <b className="kt__code">#{o.code}</b>
                      <span className={`kt__type kt__type--${pickup ? 'pickup' : 'delivery'}`}><Icon name={pickup ? 'bag' : 'bike'} />{pickup ? 'Elvitel' : 'Házhoz'}</span>
                      <time className="kt__time">{hhmm(o.createdAt)} · {ago(o.createdAt, now)}</time>
                    </header>
                    <div className="kt__cust">
                      <b>{o.customerName}</b>
                      <a href={`tel:${o.customerPhone}`}><Icon name="phone" />{o.customerPhone}</a>
                    </div>
                    {!pickup && (
                      <div className="kt__addr">
                        <Icon name="pin" />
                        <div>
                          <b>{o.address}</b>
                          <span>{d ? `${km(d.km)} · kb. ${d.minutes} perc út${d.source === 'estimate' ? ' (becslés)' : ''}` : 'Útvonal nem számolható – a futár becsül'}</span>
                          {o.courierNote && <span className="kt__cnote">Futárnak: „{o.courierNote}”</span>}
                        </div>
                      </div>
                    )}
                    <ul className="kt__items">
                      {o.items.map((l, i) => <li key={i}><span className="kt__qty">{l.qty}×</span><div><b>{l.name}</b><KMods l={l} /></div></li>)}
                    </ul>
                    {exp !== null && exp !== o.total && (
                      <p className="kt__warn"><Icon name="alert" />Az étlap mai árai szerint {ft(exp)} lenne (közben árat módosítottatok?). A rendeléskor érvényes ár: {ft(o.total)}.</p>
                    )}
                    <p className="kt__total"><span>Fizetendő átvételkor</span><b>{ft(o.total)}</b></p>
                    {actions(o)}
                  </article>
                );
              }) : <p className="col__empty">{empty}</p>}
            </div>
          </div>
        );
      })}
    </section>
  );
}
