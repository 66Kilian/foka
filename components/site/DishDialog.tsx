'use client';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '../Icon';
import { ingredients, optionsFor, unitPrice, type Selection } from '@/lib/menu';
import { ft } from '@/lib/format';
import type { Content, Img } from '@/lib/types';

export type DishTarget = { type: 'item' | 'offer'; id: string } | null;

type Resolved = { name: string; desc: string; price: number; image: Img; no?: number | null; kind: ReturnType<typeof kindOf>; draft?: boolean };
const kindOf = (k: string) => k as Parameters<typeof optionsFor>[0];

export function resolveTarget(c: Content, t: NonNullable<DishTarget>): Resolved | null {
  if (t.type === 'offer') {
    const o = c.offers.find((x) => x.id === t.id);
    return o ? { name: o.title, desc: o.text, price: o.price, image: o.image, kind: 'offer' } : null;
  }
  const it = c.items.find((x) => x.id === t.id);
  return it ? { name: it.name, desc: it.desc, price: it.price, image: it.image, no: it.no, kind: kindOf(it.kind), draft: it.draft } : null;
}

const empty = (c: Content, kind: Resolved['kind']): Selection => {
  const o = optionsFor(kind);
  return {
    extras: [], sauces: [], removed: [], note: '',
    side: o.freeChoice ? c.options.freeSides[0] ?? null : null,
    freeSauce: o.freeChoice ? c.options.freeSauces[0] ?? null : null,
  };
};

export function DishDialog({ c, target, onClose, onAdd }: {
  c: Content;
  target: DishTarget;
  onClose: () => void;
  onAdd: (t: NonNullable<DishTarget>, name: string, sel: Selection, qty: number, unit: number) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const r = target ? resolveTarget(c, target) : null;
  const [sel, setSel] = useState<Selection>(() => empty(c, 'pizza'));
  const [qty, setQty] = useState(1);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (r && target) {
      setSel(empty(c, r.kind));
      setQty(1);
      if (!d.open) d.showModal();
      bodyRef.current?.scrollTo(0, 0);
    } else if (d.open) d.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.type, target?.id]);

  const o = r ? optionsFor(r.kind) : null;
  const ing = r && o?.removable ? ingredients({ desc: r.desc }) : [];
  const unit = r ? unitPrice(r.price, sel, c) : 0;
  const toggle = (k: 'extras' | 'sauces' | 'removed', v: string) =>
    setSel((s) => ({ ...s, [k]: s[k].includes(v) ? s[k].filter((x) => x !== v) : [...s[k], v] }));

  // sima függvények (nem komponensek), hogy a fókusz ne vesszen el újrarajzoláskor
  const checks = (k: 'extras' | 'sauces' | 'removed', list: string[], price?: number, cls = '') => (
    <div className={`chips ${cls}`}>
      {list.map((v) => (
        <label key={v} className="chip">
          <input type="checkbox" checked={sel[k].includes(v)} onChange={() => toggle(k, v)} />
          <span>{v}{price ? <em> +{ft(price)}</em> : null}</span>
        </label>
      ))}
    </div>
  );
  const radios = (k: 'side' | 'freeSauce', list: string[]) => (
    <>
      {list.map((v) => (
        <label key={v} className="choice">
          <input type="radio" name={k} checked={sel[k] === v} onChange={() => setSel((s) => ({ ...s, [k]: v }))} />
          <span>{v}</span>
        </label>
      ))}
    </>
  );
  const field = (title: string, hint: string, children: React.ReactNode) => (
    <fieldset className="opt">
      <legend><span>{title}</span><small>{hint}</small></legend>
      <div className="opt__body">{children}</div>
    </fieldset>
  );

  return (
    <dialog ref={ref} className="sheet dish-dlg" aria-labelledby="dd-title" onClose={onClose} onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}>
      {r && target && o && (
        <form className="dish-dlg__form" method="dialog" onSubmit={(e) => { e.preventDefault(); onAdd(target, r.name, sel, qty, unit); ref.current?.close(); }}>
          <div className="dd__media">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {r.image && <img src={r.image.src} alt="" />}
            <button type="button" className="iconbtn dd__close" aria-label="Bezárás" onClick={() => ref.current?.close()}><Icon name="x" /></button>
          </div>
          <div className="dd__body" ref={bodyRef}>
            <h2 id="dd-title" className="dd__title">{r.no ? <span className="dish__no">{r.no}</span> : null}{r.name}</h2>
            {r.desc && <p className="dd__desc">{r.desc}</p>}
            <p className="dd__price">{ft(r.price)}</p>
            {r.draft && <p className="dd__note">Az ár tájékoztató jellegű.</p>}
            {o.freeChoice && (
              <>
                {field('Köret', 'benne van az árban', radios('side', c.options.freeSides))}
                {field('Szósz', 'benne van az árban', radios('freeSauce', c.options.freeSauces))}
              </>
            )}
            {o.toppings && field('Extra feltét', `+${ft(c.options.toppingPrice)} / db`, checks('extras', c.options.toppings))}
            {o.sauces && field('Extra szósz', `+${ft(c.options.saucePrice)} / db`, checks('sauces', c.options.sauces))}
            {ing.length > 0 && field('Kihagynál valamit?', 'koppints arra, ami ne kerüljön rá', checks('removed', ing, undefined, 'chips--remove'))}
            <label className="field">
              <span className="field__label">Megjegyzés a konyhának</span>
              <textarea rows={2} maxLength={200} value={sel.note} onChange={(e) => setSel((s) => ({ ...s, note: e.target.value }))}
                placeholder={target.type === 'offer' ? 'pl. melyik pizzát kéred' : 'pl. jól átsütve, szósz külön tálkában'} />
            </label>
          </div>
          <div className="dd__foot">
            <div className="stepper" role="group" aria-label="Mennyiség">
              <button type="button" aria-label="Kevesebb" onClick={() => setQty((q) => Math.max(1, q - 1))}><Icon name="minus" /></button>
              <output aria-live="polite">{qty}</output>
              <button type="button" aria-label="Több" onClick={() => setQty((q) => Math.min(20, q + 1))}><Icon name="plus" /></button>
            </div>
            <button className="btn btn--primary btn--block" type="submit">Kosárba · <span>{ft(unit * qty)}</span></button>
          </div>
        </form>
      )}
    </dialog>
  );
}
