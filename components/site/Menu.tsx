'use client';
import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../Icon';
import { Editable, useEditing } from './edit';
import { offerIsToday, offerWhen, sectionItems } from '@/lib/menu';
import { fold, ft } from '@/lib/format';
import type { Content, Item, Offer } from '@/lib/types';

type Props = {
  c: Content;
  soldOut: Set<string>;
  onItem: (id: string) => void;
  onOffer: (id: string) => void;
  /** szerkesztőben a nem aktív ajánlatokat is mutatjuk */
  showAllOffers?: boolean;
};

const reduce = () => typeof window !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function Badges({ it, out }: { it: Item; out: boolean }) {
  return (
    <>
      {it.tags.includes('spicy') && <span className="badge badge--hot"><Icon name="flame" />Csípős</span>}
      {it.tags.includes('veg') && <span className="badge badge--veg"><Icon name="leaf" />Húsmentes</span>}
      {out && <span className="badge badge--out">Elfogyott</span>}
    </>
  );
}

function DishCard({ it, out, onItem }: { it: Item; out: boolean; onItem: (id: string) => void }) {
  const editing = useEditing();
  return (
    <Editable target={{ kind: 'item', id: it.id }} label="Termék">
      <article className={`dish${out ? ' is-out' : ''}`}>
        <button className="dish__hit" type="button" disabled={out && !editing} aria-label={`${it.name}, ${ft(it.price)}${out ? ', elfogyott' : ''}`} onClick={() => !editing && onItem(it.id)} tabIndex={editing ? -1 : undefined} />
        <div className="dish__body">
          <h3 className="dish__name">{it.no ? <span className="dish__no">{it.no}</span> : null}{it.name}</h3>
          <p className="dish__desc">{it.desc}</p>
          <p className="dish__meta"><span className="dish__price">{ft(it.price)}</span><Badges it={it} out={out} /></p>
        </div>
        <div className="dish__media">
          {it.image
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={it.image.thumb} alt="" loading="lazy" decoding="async" width={220} height={220} />
            : <span className="dish__ph" aria-hidden="true">{it.name[0]}</span>}
          <span className="dish__plus" aria-hidden="true"><Icon name="plus" /></span>
        </div>
      </article>
    </Editable>
  );
}

function OfferCard({ o, onOffer, inactive }: { o: Offer; onOffer: (id: string) => void; inactive: boolean }) {
  const editing = useEditing();
  const save = o.oldPrice && o.oldPrice > o.price ? o.oldPrice - o.price : 0;
  return (
    <Editable target={{ kind: 'offer', id: o.id }} label="Napi ajánlat">
      <article className={`offer${inactive ? ' is-inactive' : ''}`}>
        <button className="dish__hit" type="button" aria-label={`${o.title}, ${ft(o.price)}`} onClick={() => !editing && onOffer(o.id)} tabIndex={editing ? -1 : undefined} />
        <div className="offer__media">
          {o.image
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={o.image.src} alt="" loading="lazy" decoding="async" />
            : <span className="dish__ph" aria-hidden="true">{o.title[0]}</span>}
          {save > 0 && <span className="offer__save">−{ft(save)}</span>}
        </div>
        <div className="offer__body">
          <p className="offer__when">{!inactive ? offerWhen(o) : !o.active ? 'Kikapcsolva – a vevők nem látják' : `Ma nem látszik · ${offerWhen(o)}`}</p>
          <h3 className="offer__title">{o.title}</h3>
          {o.text && <p className="offer__text">{o.text}</p>}
          <p className="offer__buy">
            <span className="offer__price">{ft(o.price)}</span>
            {o.oldPrice ? <s className="offer__old">{ft(o.oldPrice)}</s> : null}
            <span className="offer__add" aria-hidden="true"><Icon name="plus" />Kosárba</span>
          </p>
        </div>
      </article>
    </Editable>
  );
}

export function Menu({ c, soldOut, onItem, onOffer, showAllOffers }: Props) {
  const editing = useEditing();
  const [q, setQ] = useState('');
  const dq = useDeferredValue(q);
  const [active, setActive] = useState<string | null>(null);
  const catRef = useRef<HTMLElement>(null);
  const sectionsRef = useRef<HTMLDivElement>(null);

  const offers = useMemo(
    () => c.offers.filter((o) => (showAllOffers ? true : offerIsToday(o))),
    [c.offers, showAllOffers],
  );
  const sections = useMemo(
    () => c.sections.filter((s) => !s.hidden).map((s) => ({ ...s, items: sectionItems(s, c) })).filter((s) => s.items.length),
    [c],
  );
  const hits = useMemo(() => {
    const f = fold(dq.trim());
    return f ? c.items.filter((i) => !i.hidden && fold(`${i.name} ${i.desc}`).includes(f)) : null;
  }, [dq, c.items]);

  const nav = [
    ...(offers.length ? [{ id: 'ajanlat', title: c.texts.offersTitle }] : []),
    ...sections.map((s) => ({ id: s.id, title: s.title })),
  ];

  // Görgetés-figyelés: az aktív kategória kiemelése a sávban
  useEffect(() => {
    if (hits || !sectionsRef.current) return;
    const visible = new Map<string, boolean>();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => visible.set(e.target.id.slice(2), e.isIntersecting));
      const first = nav.find((s) => visible.get(s.id));
      if (first) setActive(first.id);
    }, { rootMargin: '-140px 0px -55% 0px' });
    document.querySelectorAll('.msec[id^="s-"]').forEach((el) => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hits, nav.map((n) => n.id).join()]);

  useEffect(() => {
    const list = catRef.current;
    const a = list?.querySelector<HTMLAnchorElement>(`a[data-cat="${active}"]`);
    if (list && a) list.scrollTo({ left: a.offsetLeft - list.clientWidth / 2 + a.clientWidth / 2, behavior: reduce() ? 'auto' : 'smooth' });
  }, [active]);

  return (
    <>
      <div className="catbar">
        <div className="catbar__in">
          <nav className="catbar__list" aria-label="Kategóriák" ref={catRef}>
            {nav.map((s) => (
              <a key={s.id} href={`#s-${s.id}`} data-cat={s.id} className={active === s.id ? 'is-active' : undefined} aria-current={active === s.id ? 'true' : undefined}
                onClick={() => { if (q) setQ(''); }}>
                {s.title}
              </a>
            ))}
          </nav>
          <label className="search">
            <Icon name="search" />
            <span className="sr">Keresés az étlapon</span>
            <input type="search" placeholder={c.texts.searchPlaceholder} autoComplete="off" value={q}
              onChange={(e) => {
                setQ(e.target.value);
                if (e.target.value.trim()) document.getElementById('etlap')?.scrollIntoView({ behavior: reduce() ? 'auto' : 'smooth', block: 'start' });
              }} />
          </label>
        </div>
      </div>

      <section className="menu" id="etlap" aria-label="Étlap">
        <div ref={sectionsRef}>
          {hits ? (
            hits.length ? (
              <section className="msec">
                <header className="msec__head"><h2>Találatok: {hits.length}</h2></header>
                <div className="grid">{hits.map((it) => <DishCard key={it.id} it={it} out={soldOut.has(it.id)} onItem={onItem} />)}</div>
              </section>
            ) : <p className="menu__empty">Nincs találat. Próbáld másik összetevővel, pl. „sonka”.</p>
          ) : (
            <>
              {(offers.length > 0 || editing) && (
                <section className="msec msec--offers" id="s-ajanlat" aria-labelledby="h-ajanlat">
                  <Editable target={{ kind: 'offers' }} label="Napi ajánlatok">
                    <header className="msec__head">
                      <h2 id="h-ajanlat"><Icon name="star" className="msec__star" />{c.texts.offersTitle}</h2>
                      {c.texts.offersSub && <p>{c.texts.offersSub}</p>}
                    </header>
                  </Editable>
                  {offers.length
                    ? <div className="offers">{offers.map((o) => <OfferCard key={o.id} o={o} onOffer={onOffer} inactive={!offerIsToday(o)} />)}</div>
                    : <p className="menu__empty">Nincs napi ajánlat. Kattints a címre, és adj hozzá egyet.</p>}
                </section>
              )}
              {sections.map((s) => (
                <section key={s.id} className={`msec${s.feature ? ' msec--feature' : ''}`} id={`s-${s.id}`} aria-labelledby={`h-${s.id}`}>
                  <Editable target={{ kind: 'section', id: s.id }} label="Kategória">
                    <header className="msec__head"><h2 id={`h-${s.id}`}>{s.title}</h2>{s.sub && <p>{s.sub}</p>}</header>
                  </Editable>
                  <div className="grid">{s.items.map((it) => <DishCard key={it.id} it={it} out={soldOut.has(it.id)} onItem={onItem} />)}</div>
                </section>
              ))}
            </>
          )}
        </div>
      </section>
    </>
  );
}
