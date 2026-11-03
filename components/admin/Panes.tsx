'use client';
import { useMemo, useState } from 'react';
import { Icon } from '../Icon';
import { Group, Lines, Num, Select, Text } from './forms';
import { ItemEditor, OfferEditor, newItem, newOffer } from './editors';
import { uid, useAdmin } from './state';
import { offerIsToday, offerWhen } from '@/lib/menu';
import { fold, ft, hhmm, MIN, slugify } from '@/lib/format';
import type { Order } from '@/lib/types';

/* ---------------- Étlap ---------------- */
export function MenuPane() {
  const { draft, update, status, patchStatus } = useAdmin();
  const [sel, setSel] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const out = new Set(status.soldOut);
  const f = fold(q.trim());

  return (
    <div className="split">
      <div className="split__list">
        <header className="pane__head">
          <h1>Étlap</h1>
          <p>Kapcsolóval jelölheted, ha ma elfogyott (azonnal érvényes). Névre kattintva szerkesztheted az árat, a képet, a leírást.</p>
        </header>
        <div className="arow">
          <label className="asearch"><Icon name="search" /><span className="sr">Keresés</span><input type="search" placeholder="Keresés…" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        </div>
        <div className="mgrid mgrid--one">
          {draft.categories.map((cat) => {
            const items = draft.items.filter((i) => i.category === cat.id && (!f || fold(i.name).includes(f)));
            if (f && !items.length) return null;
            return (
              <section key={cat.id} className="mgroup">
                <div className="mgroup__head">
                  <h2>{cat.title}</h2>
                  <button type="button" className="kbtn kbtn--ghost kbtn--sm" onClick={() => { const n = newItem(cat.id); update((d) => ({ ...d, items: [...d.items, n] })); setSel(n.id); }}>
                    <Icon name="plus" />Új
                  </button>
                </div>
                <ul>
                  {items.map((i) => (
                    <li key={i.id} className={`mitem${out.has(i.id) ? ' is-out' : ''}${sel === i.id ? ' is-sel' : ''}${i.hidden ? ' is-hidden' : ''}`}>
                      <button type="button" className="mitem__open" onClick={() => setSel(i.id)} aria-current={sel === i.id || undefined}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {i.image ? <img src={i.image.thumb} alt="" width={40} height={40} loading="lazy" /> : <span className="mitem__ph">{i.name[0]}</span>}
                        <span>{i.no ? <small>{i.no}. </small> : null}{i.name}{i.hidden && <small> · rejtett</small>}</span>
                      </button>
                      <span className="mitem__price">{ft(i.price)}</span>
                      <button type="button" className="kswitch" role="switch" aria-checked={!out.has(i.id)} aria-label={`${i.name} elérhető`}
                        onClick={() => patchStatus({ soldOut: out.has(i.id) ? status.soldOut.filter((x) => x !== i.id) : [...status.soldOut, i.id] })}>
                        <span className="kswitch__track"><span className="kswitch__thumb" /></span><span className="kswitch__txt">{out.has(i.id) ? 'Elfogyott' : 'Van'}</span>
                      </button>
                    </li>
                  ))}
                  {!items.length && <li className="mitem mitem--empty">Még nincs termék.</li>}
                </ul>
              </section>
            );
          })}
        </div>
        <CategoriesEditor />
      </div>
      <aside className={`split__panel${sel ? ' is-open' : ''}`} aria-label="Termék szerkesztése">
        {sel ? (
          <>
            <header className="ved__head">
              <h2>{draft.items.find((i) => i.id === sel)?.name ?? 'Termék'}</h2>
              <button type="button" className="kicon" aria-label="Bezárás" onClick={() => setSel(null)}><Icon name="x" /></button>
            </header>
            <div className="ved__body" key={sel}><ItemEditor id={sel} onGone={() => setSel(null)} /></div>
          </>
        ) : <div className="ved__empty"><Icon name="pizza" className="ved__bigicon" /><p>Válassz egy terméket a listából.</p></div>}
      </aside>
    </div>
  );
}

function CategoriesEditor() {
  const { draft, update, toast } = useAdmin();
  const [name, setName] = useState('');
  return (
    <Group title="Kategóriák" desc="A termékek csoportjai. A vásárlói oldal sávját (Népszerű, Húsimádóknak…) az Oldal szerkesztőben a szekció címére kattintva állíthatod.">
      <ul className="alist alist--plain">
        {draft.categories.map((c, i) => {
          const used = draft.items.filter((x) => x.category === c.id).length;
          return (
            <li key={c.id} className="arow">
              <input className="ainput" aria-label="Kategória neve" value={c.title} onChange={(e) => update((d) => ({ ...d, categories: d.categories.map((x) => (x.id === c.id ? { ...x, title: e.target.value } : x)) }))} />
              <small>{used} termék</small>
              <button type="button" className="kicon" aria-label="Feljebb" disabled={i === 0} onClick={() => update((d) => { const a = [...d.categories]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; return { ...d, categories: a }; })}><Icon name="up" /></button>
              <button type="button" className="kicon" aria-label="Törlés" onClick={() => {
                if (used) { toast(`Előbb tedd át a ${used} terméket másik kategóriába.`); return; }
                update((d) => ({ ...d, categories: d.categories.filter((x) => x.id !== c.id), sections: d.sections.filter((s) => !(s.source.type === 'category' && s.source.category === c.id)) }));
              }}><Icon name="trash" /></button>
            </li>
          );
        })}
      </ul>
      <form className="arow" onSubmit={(e) => {
        e.preventDefault();
        const t = name.trim();
        if (!t) return;
        let id = slugify(t);
        if (draft.categories.some((c) => c.id === id)) id = uid(id.slice(0, 30));
        const sid = draft.sections.some((s) => s.id === id) ? uid(id.slice(0, 30)) : id;
        update((d) => ({ ...d, categories: [...d.categories, { id, title: t }], sections: [...d.sections, { id: sid, title: t, sub: '', source: { type: 'category', category: id } }] }));
        setName('');
        toast(`„${t}” kategória kész – a vásárlói oldalon is megjelenik, amint van benne termék.`);
      }}>
        <input className="ainput" placeholder="Új kategória, pl. Saláták" value={name} onChange={(e) => setName(e.target.value)} aria-label="Új kategória neve" />
        <button type="submit" className="kbtn kbtn--ghost"><Icon name="plus" />Hozzáadás</button>
      </form>
    </Group>
  );
}

/* ---------------- Napi ajánlatok ---------------- */
export function OffersPane() {
  const { draft, update } = useAdmin();
  const [sel, setSel] = useState<string | null>(null);
  return (
    <div className="split">
      <div className="split__list">
        <header className="pane__head">
          <h1>Napi ajánlatok</h1>
          <p>Az étlap tetején, külön sávban jelennek meg, csak azon a napon, amire beállítod. Adott napra vagy hetente ismétlődve.</p>
        </header>
        <button type="button" className="kbtn kbtn--go" onClick={() => { const o = newOffer(); update((d) => ({ ...d, offers: [o, ...d.offers] })); setSel(o.id); }}>
          <Icon name="plus" />Új napi ajánlat
        </button>
        <div className="ocards">
          {draft.offers.map((o) => {
            const on = offerIsToday(o);
            return (
              <button key={o.id} type="button" className={`ocard${sel === o.id ? ' is-sel' : ''}`} onClick={() => setSel(o.id)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {o.image ? <img src={o.image.thumb} alt="" /> : <span className="mitem__ph">{o.title[0]}</span>}
                <span className="ocard__txt">
                  <b>{o.title}</b>
                  <span>{ft(o.price)}{o.oldPrice ? <s> {ft(o.oldPrice)}</s> : null}</span>
                  <span className={`kpill ${on ? 'kpill--DONE' : ''}`}>{on ? 'Ma látszik' : o.active ? offerWhen(o) : 'Kikapcsolva'}</span>
                </span>
              </button>
            );
          })}
          {!draft.offers.length && <p className="col__empty">Még nincs napi ajánlat.</p>}
        </div>
      </div>
      <aside className={`split__panel${sel ? ' is-open' : ''}`} aria-label="Ajánlat szerkesztése">
        {sel ? (
          <>
            <header className="ved__head">
              <h2>Napi ajánlat</h2>
              <button type="button" className="kicon" aria-label="Bezárás" onClick={() => setSel(null)}><Icon name="x" /></button>
            </header>
            <div className="ved__body" key={sel}><OfferEditor id={sel} onGone={() => setSel(null)} /></div>
          </>
        ) : <div className="ved__empty"><Icon name="star" className="ved__bigicon" /><p>Válassz egy ajánlatot, vagy hozz létre újat.</p></div>}
      </aside>
    </div>
  );
}

/* ---------------- Beállítások ---------------- */
export function SettingsPane({ storage }: { storage: string }) {
  const { draft, update } = useAdmin();
  const set = <K extends keyof typeof draft>(k: K, p: Partial<(typeof draft)[K]>) => update((d) => ({ ...d, [k]: { ...(d[k] as object), ...p } }));
  return (
    <div className="pane pane--narrow">
      <header className="pane__head"><h1>Beállítások</h1><p>Minden módosítás a „Közzététel” gombbal lép életbe.</p></header>
      {storage !== 'redis' && (
        <p className="kt__warn"><Icon name="alert" />
          {storage === 'temp'
            ? 'Nincs adatbázis bekötve: Vercelen így a rendelések és a módosítások elveszhetnek! Vercel → Storage → Upstash for Redis → Connect (README).'
            : 'Helyi mód: az adatok a .data mappában vannak (csak ezen a gépen).'}
        </p>
      )}
      <Group title="Árak és idő">
        <div className="agrid3">
          <Num label="Csomagolási díj" value={draft.pricing.packagingFee} onChange={(v) => v != null && set('pricing', { packagingFee: v })} suffix="Ft" />
          <Num label="Alap elkészítési idő" hint="amit a vevő lát" value={draft.pricing.defaultPrepMinutes} onChange={(v) => v != null && set('pricing', { defaultPrepMinutes: v })} min={5} max={180} suffix="perc" />
        </div>
      </Group>
      <Group title="Feltétek és szószok">
        <div className="agrid2">
          <Num label="Extra feltét ára" value={draft.options.toppingPrice} onChange={(v) => v != null && set('options', { toppingPrice: v })} suffix="Ft / db" />
          <Num label="Extra szósz ára" value={draft.options.saucePrice} onChange={(v) => v != null && set('options', { saucePrice: v })} suffix="Ft / db" />
          <Lines label="Extra feltétek (pizzára)" value={draft.options.toppings} onChange={(v) => set('options', { toppings: v })} rows={8} />
          <Lines label="Extra szószok" value={draft.options.sauces} onChange={(v) => set('options', { sauces: v })} rows={8} />
          <Lines label="Köretek (frissensülthöz, ingyenes)" value={draft.options.freeSides} onChange={(v) => set('options', { freeSides: v })} />
          <Lines label="Szószok (frissensülthöz, ingyenes)" value={draft.options.freeSauces} onChange={(v) => set('options', { freeSauces: v })} />
        </div>
      </Group>
      <Group title="Kiszállítás" desc="Az útvonalat az OpenStreetMap számolja az étterem helyétől (Oldal szerkesztő → lábléc).">
        <div className="agrid3">
          <Num label="Max. távolság" value={draft.delivery.maxKm} onChange={(v) => v != null && set('delivery', { maxKm: v })} min={1} max={100} step={0.5} suffix="km" />
          <Num label="Átadás a címen" value={draft.delivery.handoverMinutes} onChange={(v) => v != null && set('delivery', { handoverMinutes: v })} max={30} suffix="perc" />
          <Num label="Forgalmi szorzó" hint="útidő × ennyi" value={draft.delivery.trafficFactor} onChange={(v) => v != null && set('delivery', { trafficFactor: v })} min={1} max={3} step={0.05} />
          <Num label="Ismeretlen címre" value={draft.delivery.unknownMinutes} onChange={(v) => v != null && set('delivery', { unknownMinutes: v })} min={5} max={120} suffix="perc" />
        </div>
        <Lines label="Települések a címmezőhöz" value={draft.delivery.towns} onChange={(v) => set('delivery', { towns: v })} rows={6} />
      </Group>
      <Group title="Értesítés a vevőnek" desc="A vevő oldalán mindig élőben frissül az állapot. Emellett SMS is mehet.">
        <Select label="SMS mód" value={draft.sms.mode} onChange={(v) => set('sms', { mode: v })} options={[
          { value: 'link', label: 'A tablet SMS appja nyílik meg kitöltve (ingyenes)' },
          { value: 'twilio', label: 'Teljesen automatikus (Twilio, fizetős – README)' },
          { value: 'off', label: 'Nincs SMS' },
        ]} />
        <Text label="„Kész” üzenet (elvitel)" hint="{nev} {kod} {cim}" value={draft.sms.ready} onChange={(v) => set('sms', { ready: v })} multiline maxLength={300} />
        <Text label="„Futár elindult” üzenet" hint="{nev} {kod} {erkezes}" value={draft.sms.dispatch} onChange={(v) => set('sms', { dispatch: v })} multiline maxLength={300} />
        <Lines label="Elutasítás indokai" hint="a konyha ezek közül választ" value={draft.rejectReasons} onChange={(v) => update((d) => ({ ...d, rejectReasons: v }))} rows={4} />
      </Group>
      <Group title="Google találat" desc="Ez látszik a Google-ben és megosztáskor.">
        <Text label="Oldal címe" value={draft.seo.title} onChange={(v) => set('seo', { title: v })} maxLength={90} />
        <Text label="Leírás" value={draft.seo.description} onChange={(v) => set('seo', { description: v })} multiline maxLength={300} />
      </Group>
    </div>
  );
}

/* ---------------- Statisztika ---------------- */
const ST: Record<string, string> = { NEW: 'Új', COOKING: 'Készül', READY: 'Kész', ON_THE_WAY: 'Úton', DONE: 'Lezárva', REJECTED: 'Elutasítva' };

export function DayPane({ orders, days, setDays }: { orders: Order[]; days: number; setDays: (d: number) => void }) {
  const start = useMemo(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (days - 1)); return +d;
  }, [days]);
  const list = orders.filter((o) => o.createdAt >= start);
  const done = list.filter((o) => o.status === 'DONE');
  const rejected = list.filter((o) => o.status === 'REJECTED');
  const revenue = done.reduce((s, o) => s + o.total, 0);
  const preps = done.filter((o) => o.acceptedAt && o.readyAt).map((o) => (o.readyAt! - o.acceptedAt!) / MIN);
  const avgPrep = preps.length ? Math.round(preps.reduce((a, b) => a + b, 0) / preps.length) : null;
  const top = useMemo(() => {
    const m = new Map<string, number>();
    done.forEach((o) => o.items.forEach((l) => m.set(l.name, (m.get(l.name) ?? 0) + l.qty)));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [done]);

  return (
    <div className="pane">
      <header className="pane__head pane__head--row">
        <div><h1>Forgalom</h1><p>{days === 1 ? 'Ma' : `Az utolsó ${days} nap`}</p></div>
        <div className="aseg aseg--sm" role="group" aria-label="Időszak">
          {[1, 7, 30].map((d) => <label key={d}><input type="radio" checked={days === d} onChange={() => setDays(d)} /><span>{d === 1 ? 'Ma' : `${d} nap`}</span></label>)}
        </div>
      </header>
      <dl className="stats">
        <div><dt>Lezárt rendelés</dt><dd>{done.length}</dd></div>
        <div><dt>Forgalom (lezárt)</dt><dd>{ft(revenue)}</dd></div>
        <div><dt>Átlagos kosár</dt><dd>{done.length ? ft(revenue / done.length) : '–'}</dd></div>
        <div><dt>Átlagos elkészítés</dt><dd>{avgPrep != null ? `${avgPrep} perc` : '–'}</dd></div>
        <div><dt>Elutasított</dt><dd>{rejected.length}</dd></div>
      </dl>
      {top.length > 0 && (
        <Group title="Legtöbbet rendelt">
          <ol className="atop">{top.map(([n, q]) => <li key={n}><span>{n}</span><b>{q} db</b></li>)}</ol>
        </Group>
      )}
      {list.length ? (
        <div className="tablewrap"><table className="ktable">
          <thead><tr><th>#</th><th>Idő</th><th>Vevő</th><th>Mód</th><th>Tételek</th><th className="num">Összeg</th><th>Állapot</th></tr></thead>
          <tbody>{[...list].reverse().map((o) => (
            <tr key={o.id}>
              <td><b>{o.code}</b></td>
              <td>{days > 1 && <small>{new Date(o.createdAt).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' })} </small>}{hhmm(o.createdAt)}</td>
              <td>{o.customerName}<br /><small>{o.customerPhone}</small></td>
              <td>{o.orderType === 'pickup' ? 'Elvitel' : <>Házhoz<br /><small>{o.address}</small></>}</td>
              <td>{o.items.map((l, i) => <div key={i}>{l.qty}× {l.name}</div>)}</td>
              <td className="num">{ft(o.total)}</td>
              <td><span className={`kpill kpill--${o.status}`}>{ST[o.status] ?? o.status}</span></td>
            </tr>
          ))}</tbody>
        </table></div>
      ) : <p className="col__empty">Ebben az időszakban még nem volt rendelés.</p>}
    </div>
  );
}
