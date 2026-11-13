'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../Icon';
import { ToastProvider, useToast } from '../toast';
import { Hero } from './Hero';
import { Menu } from './Menu';
import { DishDialog, type DishTarget } from './DishDialog';
import { Drawer, NOTIFY, orderInfo, type CartLine, type View } from './Drawer';
import { EditCtx, Editable, type EditTarget } from './edit';
import { api, chime, ls } from '@/lib/client';
import { offerIsToday, unitPrice, type Selection } from '@/lib/menu';
import { ft, hhmm, telHref } from '@/lib/format';
import type { Content, PublicOrder, Status } from '@/lib/types';

type Props = {
  content: Content;
  status: Status;
  /** Admin előnézet: kattintásra szerkesztés, rendelés kikapcsolva */
  edit?: { open: (t: EditTarget) => void; active: EditTarget | null };
};

export function SiteView(props: Props) {
  const inner = <Shop {...props} />;
  return props.edit ? <EditCtx.Provider value={props.edit}><ToastProvider>{inner}</ToastProvider></EditCtx.Provider> : <ToastProvider>{inner}</ToastProvider>;
}

const lineKey = (ref: CartLine['ref'], s: Selection) =>
  JSON.stringify([ref.type, ref.id, [...s.extras].sort(), [...s.sauces].sort(), [...s.removed].sort(), s.side, s.freeSauce, s.note]);

function Shop({ content: c, status: initialStatus, edit }: Props) {
  const toast = useToast();
  const editing = !!edit;
  const [status, setStatus] = useState(initialStatus);
  const [rawCart, setRawCart] = useState<CartLine[]>([]);
  const [dish, setDish] = useState<DishTarget>(null);
  const [drawer, setDrawer] = useState(false);
  const [view, setView] = useState<View>('cart');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [bump, setBump] = useState(0);
  const loaded = useRef(false);

  useEffect(() => { if (editing) setStatus(initialStatus); }, [editing, initialStatus]);

  // Kosár és aktív rendelés visszatöltése
  useEffect(() => {
    if (editing) return;
    setRawCart(ls.get<CartLine[]>('zolgiz_cart', []));
    setOrderId(ls.get<string | null>('zolgiz_active_order', null));
    loaded.current = true;
  }, [editing]);
  useEffect(() => { if (loaded.current) ls.set('zolgiz_cart', rawCart); }, [rawCart]);

  // Az árakat mindig az aktuális étlapból számoljuk (ha közben változott valami)
  const soldOut = useMemo(() => new Set(status.soldOut), [status.soldOut]);
  const cart = useMemo(() => rawCart.flatMap((l): CartLine[] => {
    if (l.ref.type === 'offer') {
      const o = c.offers.find((x) => x.id === l.ref.id);
      return o && offerIsToday(o) ? [{ ...l, name: o.title, unitPrice: o.price }] : [];
    }
    const it = c.items.find((x) => x.id === l.ref.id);
    if (!it || it.hidden || soldOut.has(it.id)) return [];
    return [{ ...l, name: it.name, unitPrice: unitPrice(it.price, l, c) }];
  }), [rawCart, c, soldOut]);
  const count = cart.reduce((s, l) => s + l.qty, 0);
  const total = cart.length ? cart.reduce((s, l) => s + l.unitPrice * l.qty, 0) + c.pricing.packagingFee : 0;

  // Nyitva / elfogyott – fél percenként frissül
  useEffect(() => {
    if (editing) return;
    let alive = true;
    const pull = () => api<Status>('/api/status').then((s) => alive && setStatus(s)).catch(() => {});
    const t = setInterval(() => { if (!document.hidden) pull(); }, 30000);
    const onVis = () => { if (!document.hidden) pull(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { alive = false; clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, [editing]);

  // Élő rendeléskövetés (pár másodpercenként lekérdezi az állapotot)
  const notify = useCallback((o: PublicOrder) => {
    const n = NOTIFY[o.status]?.(o, c);
    if (!n) return;
    const loud = o.status === 'READY' || o.status === 'ON_THE_WAY';
    chime(loud ? [523.25, 659.25, 783.99] : [659.25, 880]);
    if (loud) navigator.vibrate?.([200, 100, 200]);
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      try { new Notification(n[0], { body: n[1], tag: `order-${o.code}` }); } catch { /* */ }
    }
    toast(`${n[0]} – ${n[1]}`, { action: 'Megnézem', onAction: () => { setView('track'); setDrawer(true); }, ms: 8000 });
  }, [c, toast]);

  useEffect(() => {
    if (!orderId || editing) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const pull = async () => {
      try {
        const o = await api<PublicOrder>(`/api/orders/${orderId}`);
        if (!alive) return;
        if (Date.now() - o.createdAt > 8 * 3600_000) { clear(); return; }
        setOrder(o);
        const seen = ls.get<string | null>('zolgiz_seen_status', null);
        if (seen !== o.status) { ls.set('zolgiz_seen_status', o.status); if (seen) notify(o); }
        if (o.status === 'DONE' || o.status === 'REJECTED') return; // vége, nem kérdezünk tovább
      } catch (e) {
        if ((e as { status?: number }).status === 404) { clear(); return; }
      }
      timer = setTimeout(pull, document.hidden ? 15000 : 5000);
    };
    const clear = () => { setOrderId(null); setOrder(null); ls.del('zolgiz_active_order'); ls.del('zolgiz_seen_status'); };
    pull();
    return () => { alive = false; clearTimeout(timer); };
  }, [orderId, editing, notify]);

  const openItem = (id: string) => {
    if (editing) return;
    if (soldOut.has(id)) { toast('Ez a termék most elfogyott.'); return; }
    setDish({ type: 'item', id });
  };

  const addLine = (ref: NonNullable<DishTarget>, name: string, sel: Selection, qty: number, unit: number) => {
    const key = lineKey(ref, sel);
    setRawCart((cart) => {
      const ex = cart.find((l) => l.key === key);
      return ex ? cart.map((l) => (l === ex ? { ...l, qty: Math.min(50, l.qty + qty) } : l)) : [...cart, { key, ref, name, qty, unitPrice: unit, ...sel }];
    });
    setBump((b) => b + 1);
    toast(`${name} a kosárban`, { action: 'Kosár', onAction: () => { setView('cart'); setDrawer(true); } });
  };

  const changeQty = (key: string, d: number) => {
    setRawCart((cart) => {
      const l = cart.find((x) => x.key === key);
      if (!l) return cart;
      if (l.qty + d <= 0) {
        toast(`${l.name} törölve`, { action: 'Visszavonás', onAction: () => setRawCart((c2) => [...c2, { ...l, qty: 1 }]) });
        return cart.filter((x) => x !== l);
      }
      return cart.map((x) => (x === l ? { ...x, qty: x.qty + d } : x));
    });
  };

  const openDrawer = (v?: View) => {
    if (editing) return;
    setView(v ?? (cart.length ? 'cart' : orderId ? 'track' : 'cart'));
    setDrawer(true);
  };

  const info = order ? orderInfo(order, c) : null;
  const phone = telHref(c.contact.phone);
  const year = new Date().getFullYear();

  return (
    <>
      <a className="skip" href="#etlap">Ugrás az étlapra</a>
      <header className="top">
        <div className="top__in">
          <Editable target={{ kind: 'brand' }} label="Név, logó">
            <a className="brand" href="#">
              {c.brand.logo
                // eslint-disable-next-line @next/next/no-img-element
                ? <img className="brand__logo" src={c.brand.logo.thumb} alt="" width={40} height={40} />
                : <span className="brand__mark" aria-hidden="true">{c.brand.mark}</span>}
              <span className="brand__txt"><b>{c.brand.short}</b><small>{c.brand.subtitle}</small></span>
            </a>
          </Editable>
          <nav className="top__nav" aria-label="Fő navigáció">
            <a href="#etlap">Étlap</a>
            <a href="#rolunk">Kiszállítás</a>
            <a href="#kapcsolat">Kapcsolat</a>
          </nav>
          <Editable target={{ kind: 'contact' }} label="Elérhetőség">
            <a className="top__phone" href={phone} aria-label={`Telefon: ${c.contact.phone}`}><Icon name="phone" /><span>{c.contact.phone}</span></a>
          </Editable>
          <button className={`cartbtn${bump ? ' is-bump' : ''}`} key={bump} type="button" onClick={() => openDrawer()}>
            <Icon name="bag" /><span className="cartbtn__label">Kosár</span><span className="cartbtn__count">{count}</span>
          </button>
        </div>
      </header>

      {!status.open && (
        <Editable target={{ kind: 'texts' }} label="Zárva szöveg">
          <div className="closed-banner">
            <Icon name="clock" />
            <span>{c.texts.closed} <a href={phone}>{c.contact.phone}</a></span>
          </div>
        </Editable>
      )}

      <main>
        <Hero c={c} soldOut={soldOut} onAdd={openItem} />
        <section className="facts" id="rolunk" aria-label="Rendelési információk">
          <div className="facts__in">
            {c.facts.map((f) => (
              <Editable key={f.id} target={{ kind: 'fact', id: f.id }} label="Infó">
                <div className="fact"><Icon name={f.icon} /><div><b>{f.title}</b><span>{f.text}</span></div></div>
              </Editable>
            ))}
          </div>
        </section>
        <Menu c={c} soldOut={soldOut} onItem={openItem} onOffer={(id) => !editing && setDish({ type: 'offer', id })} showAllOffers={editing} />
      </main>

      <Editable target={{ kind: 'contact' }} label="Elérhetőség, lábléc">
        <footer className="foot" id="kapcsolat">
          <div className="foot__in">
            <div className="foot__brand">
              {c.brand.logo
                // eslint-disable-next-line @next/next/no-img-element
                ? <img className="brand__logo brand__logo--lg" src={c.brand.logo.thumb} alt="" width={56} height={56} />
                : <span className="brand__mark brand__mark--lg" aria-hidden="true">{c.brand.mark}</span>}
              <p><b>{c.brand.name}</b><br />{c.brand.tagline}</p>
            </div>
            <div>
              <h2>Itt vagyunk</h2>
              <p><a href={`https://www.openstreetmap.org/?mlat=${c.contact.lat}&mlon=${c.contact.lng}#map=17/${c.contact.lat}/${c.contact.lng}`} target="_blank" rel="noopener noreferrer">{c.contact.address}</a></p>
              <p><a href={phone}>{c.contact.phone}</a></p>
            </div>
            {c.contact.facebook && (
              <div>
                <h2>Kövess minket</h2>
                <p><a href={c.contact.facebook} target="_blank" rel="noopener noreferrer">Facebook</a></p>
              </div>
            )}
          </div>
          <p className="foot__copy">© {year} {c.brand.name}. {c.texts.footerNote}</p>
        </footer>
      </Editable>

      {!editing && (
        <div className="floaters">
          {orderId && order && !drawer && info && (
            <button className={`tracker-pill tracker-pill--${info.tone}`} type="button" onClick={() => openDrawer('track')}>
              <span className="tracker-pill__dot" aria-hidden="true" />
              <span><b>#{order.code} · {info.short}</b>{info.eta ? <small>{info.etaLabel} {hhmm(info.eta)}</small> : null}</span>
            </button>
          )}
          {count > 0 && (
            <button className="cartbar" type="button" onClick={() => openDrawer()}>
              <span className="cartbar__n">{count}</span><span>Kosár megtekintése</span><b>{ft(total)}</b>
            </button>
          )}
        </div>
      )}

      {!editing && (
        <>
          <DishDialog c={c} target={dish} onClose={() => setDish(null)} onAdd={addLine} />
          <Drawer
            c={c}
            status={status}
            open={drawer}
            view={view}
            setView={setView}
            onClose={() => setDrawer(false)}
            cart={cart}
            changeQty={changeQty}
            clearCart={() => setRawCart([])}
            order={order}
            orderId={orderId}
            onOrdered={(o) => {
              setRawCart([]);
              ls.set('zolgiz_active_order', o.id);
              ls.set('zolgiz_seen_status', o.status);
              setOrder(o);
              setOrderId(o.id);
              setView('track');
            }}
            onNewOrder={() => {
              setOrderId(null); setOrder(null);
              ls.del('zolgiz_active_order'); ls.del('zolgiz_seen_status');
              setView('cart');
            }}
          />
        </>
      )}
    </>
  );
}
