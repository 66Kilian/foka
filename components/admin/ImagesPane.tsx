'use client';
// Képek: az oldal összes képe egy helyen. Egyenként cserélhető, vagy több fotó egyszerre,
// ilyenkor a fájlnév alapján (pl. „husimado.jpg”, „4.jpg”) magától a megfelelő ételhez kerül.
import { useMemo, useRef, useState } from 'react';
import { Icon } from '../Icon';
import { useAdmin } from './state';
import { fold, ft, slugify } from '@/lib/format';
import type { Content, Img } from '@/lib/types';

type Slot = {
  key: string;
  title: string;
  sub?: string;
  value: Img;
  /** ha nincs saját kép, ez látszik helyette (pl. slideshow → a termék képe) */
  fallback?: Img;
  fallbackNote?: string;
  set: (d: Content, v: Img) => Content;
  /** fájlnév-egyezéshez */
  names?: string[];
};
type Group = { id: string; title: string; desc?: string; slots: Slot[] };

const mapItem = (id: string) => (d: Content, v: Img): Content => ({ ...d, items: d.items.map((x) => (x.id === id ? { ...x, image: v } : x)) });

function buildGroups(d: Content): Group[] {
  const items = new Map(d.items.map((i) => [i.id, i]));
  const groups: Group[] = [
    {
      id: 'arculat', title: 'Arculat', slots: [
        { key: 'logo', title: 'Logó', sub: 'fejléc és lábléc', value: d.brand.logo ?? null, fallbackNote: `most a „${d.brand.mark}” betű látszik`,
          set: (c, v) => ({ ...c, brand: { ...c.brand, logo: v } }), names: ['logo'] },
        { key: 'share', title: 'Megosztási kép', sub: 'Facebook, Messenger', value: d.seo.image ?? null, fallback: d.hero[0] ? (d.hero[0].image ?? items.get(d.hero[0].itemId)?.image ?? null) : null,
          fallbackNote: 'most az első slideshow-kép', set: (c, v) => ({ ...c, seo: { ...c.seo, image: v } }), names: ['megosztas', 'share', 'og'] },
      ],
    },
    {
      id: 'hero', title: 'Slideshow', desc: 'Ha egy diának nincs saját képe, a hozzá tartozó étel képe látszik.',
      slots: d.hero.map((h, i) => {
        const it = items.get(h.itemId);
        return {
          key: `hero-${h.id}`, title: h.title || it?.name || `${i + 1}. dia`, sub: `${i + 1}. dia`, value: h.image, fallback: it?.image ?? null, fallbackNote: 'az étel képe látszik',
          set: (c: Content, v: Img) => ({ ...c, hero: c.hero.map((x) => (x.id === h.id ? { ...x, image: v } : x)) }),
        };
      }),
    },
    {
      id: 'offers', title: 'Napi ajánlatok',
      slots: d.offers.map((o) => ({
        key: `offer-${o.id}`, title: o.title, sub: ft(o.price), value: o.image, names: [o.title],
        set: (c: Content, v: Img) => ({ ...c, offers: c.offers.map((x) => (x.id === o.id ? { ...x, image: v } : x)) }),
      })),
    },
    ...d.categories.map((cat) => ({
      id: `cat-${cat.id}`, title: cat.title,
      slots: d.items.filter((i) => i.category === cat.id).map((i) => ({
        key: `item-${i.id}`, title: i.name, sub: `${i.no ? `${i.no}. · ` : ''}${ft(i.price)}`, value: i.image,
        names: [i.name, ...(i.no ? [String(i.no)] : [])], set: mapItem(i.id),
      })),
    })),
  ];
  return groups.filter((g) => g.slots.length);
}

/** „04-husimado.jpg” → a Húsimádó pizzához; „Hawaii.png” → Hawaii */
function matchFile(fileName: string, slots: Slot[]): Slot | null {
  const base = slugify(fileName.replace(/\.[a-z0-9]+$/i, ''));
  if (!base) return null;
  const num = base.match(/^0*(\d{1,3})(?:-|$)/)?.[1];
  const rest = base.replace(/^\d+-?/, '');
  for (const s of slots) if (s.names?.some((n) => slugify(n) === base || (rest && slugify(n) === rest))) return s;
  if (num && !rest) for (const s of slots) if (s.names?.includes(num)) return s;
  // részleges egyezés: a fájlnév tartalmazza az étel nevét (leghosszabb nyer)
  let best: Slot | null = null, len = 0;
  for (const s of slots) for (const n of s.names ?? []) {
    const k = slugify(n);
    if (k.length >= 4 && (rest || base).includes(k) && k.length > len) { best = s; len = k.length; }
  }
  return best;
}

export function ImagesPane() {
  const { draft, update, upload, library, toast } = useAdmin();
  const [missingOnly, setMissingOnly] = useState(false);
  const [q, setQ] = useState('');
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null);
  const [drag, setDrag] = useState(false);
  const many = useRef<HTMLInputElement>(null);

  const groups = useMemo(() => buildGroups(draft), [draft]);
  const all = groups.flatMap((g) => g.slots);
  const missing = all.filter((s) => !s.value && !s.fallback && s.key.startsWith('item-')).length;
  const f = fold(q.trim());

  async function bulkUpload(files: File[]) {
    const imgs = files.filter((x) => x.type.startsWith('image/'));
    if (!imgs.length) return;
    setBulk({ done: 0, total: imgs.length });
    let placed = 0, failed = 0;
    const loose: string[] = [];
    for (const file of imgs) {
      try {
        const im = await upload(file);
        const slot = matchFile(file.name, all);
        if (slot) { update((d) => slot.set(d, im)); placed++; } else loose.push(file.name);
      } catch { failed++; }
      setBulk((b) => (b ? { ...b, done: b.done + 1 } : b));
    }
    setBulk(null);
    const parts = [placed && `${placed} kép a helyére került`, loose.length && `${loose.length} a képtárba (fájlnév alapján nem találtuk a helyét)`, failed && `${failed} nem sikerült`].filter(Boolean);
    toast(`${parts.join(', ')}. Ne felejtsd el a Közzétételt.`, { ms: 9000 });
  }

  return (
    <div
      className={`pane ipane${drag ? ' is-drag' : ''}`}
      onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setDrag(true); } }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDrag(false); }}
      onDrop={(e) => { if ((e.target as HTMLElement).closest('.islot')) return; e.preventDefault(); setDrag(false); void bulkUpload([...e.dataTransfer.files]); }}
    >
      <header className="pane__head pane__head--row">
        <div>
          <h1>Képek</h1>
          <p>Az oldal minden képe egy helyen. Kattints egy képre a cseréhez, vagy húzd rá az új fotót.</p>
        </div>
        <button type="button" className="kbtn kbtn--go" disabled={!!bulk} onClick={() => many.current?.click()}>
          {bulk ? <><span className="kspin" />{bulk.done}/{bulk.total} feltöltve…</> : <><Icon name="upload" />Több kép egyszerre</>}
        </button>
        <input ref={many} type="file" accept="image/*" multiple hidden onChange={(e) => { void bulkUpload([...(e.target.files ?? [])]); e.target.value = ''; }} />
      </header>

      <p className="ipane__tip"><Icon name="image" />
        <span>Tipp: nevezd el a fotókat az étel nevéről (<b>husimado.jpg</b>, <b>hawaii.jpg</b>) vagy a pizza számáról (<b>4.jpg</b>), és tölts fel egyszerre többet: mindegyik magától a helyére kerül.</span>
      </p>

      <div className="arow ipane__bar">
        <label className="asearch"><Icon name="search" /><span className="sr">Keresés</span><input type="search" placeholder="Keresés…" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <div className="aseg aseg--sm" role="group" aria-label="Szűrés">
          <label><input type="radio" checked={!missingOnly} onChange={() => setMissingOnly(false)} /><span>Mind ({all.length})</span></label>
          <label><input type="radio" checked={missingOnly} onChange={() => setMissingOnly(true)} /><span>Kép nélkül ({missing})</span></label>
        </div>
      </div>

      {groups.map((g) => {
        const slots = g.slots.filter((s) => (!missingOnly || (!s.value && !s.fallback)) && (!f || fold(s.title).includes(f)));
        if (!slots.length) return null;
        return (
          <section key={g.id} className="igroup">
            <h2>{g.title}</h2>
            {g.desc && <p className="igroup__desc">{g.desc}</p>}
            <ul className="islots">
              {slots.map((s) => <SlotCard key={s.key} slot={s} upload={upload} library={library} onSet={(v) => update((d) => s.set(d, v))} />)}
            </ul>
          </section>
        );
      })}
      {missingOnly && missing === 0 && <p className="col__empty">Minden ételnek van képe.</p>}

      <section className="igroup">
        <h2>Képtár</h2>
        <p className="igroup__desc">Minden kép, ami az oldalon van, vagy amit most töltöttél fel. Innen bármelyik kép választható a „Meglévőből” gombbal.</p>
        <ul className="ilib">
          {library.map((im) => {
            const used = all.some((s) => s.value?.src === im.src);
            return (
              <li key={im.src} className={used ? '' : 'is-free'}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={im.thumb} alt="" loading="lazy" />
                {!used && <span>nincs használva</span>}
              </li>
            );
          })}
        </ul>
      </section>
      {drag && <div className="ipane__drop" aria-hidden="true"><Icon name="upload" />Engedd el – a fájlnév alapján a helyükre tesszük</div>}
    </div>
  );
}

function SlotCard({ slot, upload, library, onSet }: {
  slot: Slot; upload: (f: File) => Promise<NonNullable<Img>>; library: NonNullable<Img>[]; onSet: (v: Img) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [drag, setDrag] = useState(false);
  const [pick, setPick] = useState(false);
  const shown = slot.value ?? slot.fallback ?? null;

  async function take(f: File | undefined) {
    if (!f) return;
    setBusy(true); setErr('');
    try { onSet(await upload(f)); } catch (e) { setErr(e instanceof Error ? e.message : 'A feltöltés nem sikerült.'); } finally { setBusy(false); }
  }

  return (
    <li className={`islot${slot.value ? '' : slot.fallback ? ' is-fallback' : ' is-missing'}`}>
      <button
        type="button"
        className={`islot__img${drag ? ' is-drag' : ''}`}
        aria-label={`${slot.title}: ${shown ? 'kép cseréje' : 'kép feltöltése'}`}
        disabled={busy}
        onClick={() => input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setDrag(false); void take(e.dataTransfer.files[0]); }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {shown ? <img src={shown.thumb} alt="" loading="lazy" /> : <span className="islot__empty"><Icon name="image" />Nincs kép</span>}
        <span className="islot__hover"><Icon name="upload" />{shown ? 'Csere' : 'Feltöltés'}</span>
        {busy && <span className="aimg__busy"><span className="kspin" /></span>}
      </button>
      <div className="islot__txt">
        <b>{slot.title}</b>
        <small>{!slot.value && (slot.fallback || slot.fallbackNote) ? slot.fallbackNote : slot.sub}</small>
      </div>
      <div className="islot__acts">
        {library.length > 0 && <button type="button" className="kbtn kbtn--link kbtn--sm" aria-expanded={pick} onClick={() => setPick((p) => !p)}>Meglévőből</button>}
        {slot.value && <button type="button" className="kicon kicon--sm" aria-label={`${slot.title} képének törlése`} onClick={() => onSet(null)}><Icon name="trash" /></button>}
      </div>
      {err && <p className="af__err" role="alert">{err}</p>}
      {pick && (
        <div className="alib islot__lib" role="listbox" aria-label="Meglévő képek">
          {library.map((im) => (
            <button key={im.src} type="button" role="option" aria-selected={slot.value?.src === im.src} onClick={() => { onSet(im); setPick(false); }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={im.thumb} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { void take(e.target.files?.[0]); e.target.value = ''; }} />
    </li>
  );
}
