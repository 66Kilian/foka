'use client';
// Egy-egy elem szerkesztője. Ugyanezeket használja az „Oldal szerkesztő” oldalsávja és az Étlap / Ajánlatok fül.
import { Icon } from '../Icon';
import { Days, Group, ImageField, Num, Select, Text, Toggle } from './forms';
import { uid, useAdmin } from './state';
import type { EditTarget } from '../site/edit';
import { KIND_LABEL, TAG_LABEL, budapestToday, offerIsToday, offerWhen, sectionItems } from '@/lib/menu';
import { ft } from '@/lib/format';
import type { Content, Fact, HeroSlide, Item, Offer, Section, Tag } from '@/lib/types';

const move = <T,>(arr: T[], i: number, d: number) => {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const a = [...arr];
  [a[i], a[j]] = [a[j], a[i]];
  return a;
};

function OrderButtons({ onUp, onDown, onDelete, deleteLabel }: { onUp?: () => void; onDown?: () => void; onDelete?: () => void; deleteLabel?: string }) {
  return (
    <div className="arow">
      {onUp && <button type="button" className="kbtn kbtn--ghost" onClick={onUp}><Icon name="up" />Előrébb</button>}
      {onDown && <button type="button" className="kbtn kbtn--ghost" onClick={onDown}><Icon name="down" />Hátrébb</button>}
      {onDelete && <button type="button" className="kbtn kbtn--link kbtn--danger aright" onClick={onDelete}><Icon name="trash" />{deleteLabel ?? 'Törlés'}</button>}
    </div>
  );
}

/* ---------------- Termék ---------------- */
export function newItem(category: string): Item {
  return { id: uid('t'), category, kind: category === 'pizza' ? 'pizza' : category === 'drink' ? 'drink' : category === 'dessert' ? 'dessert' : 'dish', name: 'Új termék', desc: '', price: 1000, image: null, tags: [], no: null };
}

export function ItemEditor({ id, onGone }: { id: string; onGone?: () => void }) {
  const { draft, update, upload, library, status, patchStatus, toast } = useAdmin();
  const it = draft.items.find((i) => i.id === id);
  if (!it) return <p className="aempty">Ez a termék már nincs az étlapon.</p>;
  const set = (p: Partial<Item>) => update((d) => ({ ...d, items: d.items.map((x) => (x.id === id ? { ...x, ...p } : x)) }));
  const out = status.soldOut.includes(id);
  const inHero = draft.hero.some((h) => h.itemId === id);
  const toggleTag = (t: Tag) => set({ tags: it.tags.includes(t) ? it.tags.filter((x) => x !== t) : [...it.tags, t] });

  const remove = () => {
    const snapshot = draft;
    update((d) => ({ ...d, items: d.items.filter((x) => x.id !== id), hero: d.hero.filter((h) => h.itemId !== id) }));
    onGone?.();
    toast(`„${it.name}” törölve (közzétételig visszavonható)`, { action: 'Visszavonás', onAction: () => update(() => snapshot), ms: 8000 });
  };
  const duplicate = () => {
    const copy = { ...it, id: uid('t'), name: `${it.name} (másolat)` };
    update((d) => { const i = d.items.findIndex((x) => x.id === id); const items = [...d.items]; items.splice(i + 1, 0, copy); return { ...d, items }; });
    toast('Másolat elkészült az eredeti alatt.');
  };

  return (
    <div className="aform">
      <div className="aswitches">
        <Toggle label="Ma elfogyott" hint="azonnal érvényes, nem kell közzétenni" checked={out}
          onChange={(v) => patchStatus({ soldOut: v ? [...status.soldOut, id] : status.soldOut.filter((x) => x !== id) })} />
        <Toggle label="Elrejtés az étlapról" hint="megmarad, csak nem látszik" checked={!!it.hidden} onChange={(v) => set({ hidden: v })} />
        <Toggle label="Kiemelés a slideshow-ban" checked={inHero}
          onChange={(v) => update((d) => ({ ...d, hero: v ? [...d.hero, { id: uid('h'), itemId: id, kicker: '', title: '', text: '', image: null }] : d.hero.filter((h) => h.itemId !== id) }))} />
      </div>
      <Text label="Név" value={it.name} onChange={(v) => set({ name: v })} maxLength={80} error={it.name.trim() ? '' : 'Adj nevet a terméknek'} />
      <Text label="Leírás" hint="vesszővel elválasztva – ezekből választhat a vevő, mit hagyjon le" value={it.desc} onChange={(v) => set({ desc: v })} multiline maxLength={300} />
      <div className="agrid2">
        <Num label="Ár" value={it.price} onChange={(v) => v != null && set({ price: v })} min={1} suffix="Ft" />
        <Num label="Sorszám" hint="pizzáknál" value={it.no ?? null} onChange={(v) => set({ no: v })} allowEmpty max={999} />
      </div>
      <ImageField label="Kép" value={it.image} onChange={(v) => set({ image: v })} upload={upload} library={library} />
      <div className="agrid2">
        <Select label="Kategória" value={it.category} onChange={(v) => set({ category: v })} options={draft.categories.map((c) => ({ value: c.id, label: c.title }))} />
        <Select label="Milyen opciók járnak hozzá?" value={it.kind} onChange={(v) => set({ kind: v })} options={Object.entries(KIND_LABEL).map(([value, label]) => ({ value: value as Item['kind'], label }))} />
      </div>
      <fieldset className="af">
        <legend className="af__label">Címkék <small>ezek alapján kerül a Népszerű, Húsmentes stb. szekciókba</small></legend>
        <div className="atags">
          {(Object.keys(TAG_LABEL) as Tag[]).map((t) => (
            <label key={t}><input type="checkbox" checked={it.tags.includes(t)} onChange={() => toggleTag(t)} /><span>{TAG_LABEL[t]}</span></label>
          ))}
        </div>
      </fieldset>
      <Toggle label="Tájékoztató ár" hint="„Az ár tájékoztató jellegű” felirat a terméknél" checked={!!it.draft} onChange={(v) => set({ draft: v })} />
      <div className="arow">
        <button type="button" className="kbtn kbtn--ghost" onClick={duplicate}><Icon name="copy" />Másolat</button>
        <button type="button" className="kbtn kbtn--link kbtn--danger aright" onClick={remove}><Icon name="trash" />Termék törlése</button>
      </div>
    </div>
  );
}

/* ---------------- Napi ajánlat ---------------- */
export function newOffer(): Offer {
  return { id: uid('o'), title: 'Mai ajánlat', text: '', price: 1990, oldPrice: null, image: null, days: [], date: budapestToday().date, active: true };
}

export function OfferEditor({ id, onGone }: { id: string; onGone?: () => void }) {
  const { draft, update, upload, library, toast } = useAdmin();
  const o = draft.offers.find((x) => x.id === id);
  if (!o) return <p className="aempty">Ez az ajánlat már nincs meg.</p>;
  const set = (p: Partial<Offer>) => update((d) => ({ ...d, offers: d.offers.map((x) => (x.id === id ? { ...x, ...p } : x)) }));
  const idx = draft.offers.findIndex((x) => x.id === id);
  const today = budapestToday().date;
  const visible = offerIsToday(o);
  return (
    <div className="aform">
      <p className={`astate ${visible ? 'is-on' : ''}`}>{visible ? 'Ma látszik a vásárlói oldalon' : !o.active ? 'Kikapcsolva – nem látszik' : `Ma nem látszik (${offerWhen(o)})`}</p>
      <Toggle label="Bekapcsolva" checked={o.active} onChange={(v) => set({ active: v })} />
      <Text label="Cím" value={o.title} onChange={(v) => set({ title: v })} maxLength={80} error={o.title.trim() ? '' : 'Adj címet'} />
      <Text label="Leírás" value={o.text} onChange={(v) => set({ text: v })} multiline maxLength={300} />
      <div className="agrid2">
        <Num label="Ár" value={o.price} onChange={(v) => v != null && set({ price: v })} min={1} suffix="Ft" />
        <Num label="Eredeti ár" hint="áthúzva látszik" value={o.oldPrice ?? null} onChange={(v) => set({ oldPrice: v })} allowEmpty suffix="Ft" />
      </div>
      <ImageField label="Kép" value={o.image} onChange={(v) => set({ image: v })} upload={upload} library={library} />
      <fieldset className="af">
        <legend className="af__label">Mikor érvényes?</legend>
        <div className="aseg">
          <label><input type="radio" checked={!!o.date} onChange={() => set({ date: today })} /><span>Egy adott napon</span></label>
          <label><input type="radio" checked={!o.date} onChange={() => set({ date: null })} /><span>Hetente ismétlődik</span></label>
        </div>
      </fieldset>
      {o.date
        ? <Text label="Dátum" type="date" value={o.date} onChange={(v) => set({ date: v || today })} />
        : <Days value={o.days} onChange={(v) => set({ days: v })} />}
      <OrderButtons
        onUp={idx > 0 ? () => update((d) => ({ ...d, offers: move(d.offers, idx, -1) })) : undefined}
        onDown={idx < draft.offers.length - 1 ? () => update((d) => ({ ...d, offers: move(d.offers, idx, 1) })) : undefined}
        onDelete={() => {
          const snap = draft;
          update((d) => ({ ...d, offers: d.offers.filter((x) => x.id !== id) }));
          onGone?.();
          toast('Ajánlat törölve', { action: 'Visszavonás', onAction: () => update(() => snap) });
        }}
      />
    </div>
  );
}

export function OffersHeaderEditor({ onOpen }: { onOpen: (t: EditTarget) => void }) {
  const { draft, update } = useAdmin();
  const setT = (p: Partial<Content['texts']>) => update((d) => ({ ...d, texts: { ...d.texts, ...p } }));
  return (
    <div className="aform">
      <Text label="Szekció címe" value={draft.texts.offersTitle} onChange={(v) => setT({ offersTitle: v })} maxLength={60} />
      <Text label="Alcím" value={draft.texts.offersSub} onChange={(v) => setT({ offersSub: v })} maxLength={120} />
      <Group title="Ajánlatok">
        <ul className="alist">
          {draft.offers.map((o) => (
            <li key={o.id}><button type="button" onClick={() => onOpen({ kind: 'offer', id: o.id })}>
              <b>{o.title}</b><span>{ft(o.price)} · {offerIsToday(o) ? 'ma látszik' : o.active ? offerWhen(o) : 'kikapcsolva'}</span><Icon name="right" />
            </button></li>
          ))}
        </ul>
        <button type="button" className="kbtn kbtn--go" onClick={() => { const o = newOffer(); update((d) => ({ ...d, offers: [o, ...d.offers] })); onOpen({ kind: 'offer', id: o.id }); }}>
          <Icon name="plus" />Új napi ajánlat
        </button>
      </Group>
    </div>
  );
}

/* ---------------- Szekció (kategória a vásárlói oldalon) ---------------- */
export function SectionEditor({ id, onOpen, onGone }: { id: string; onOpen: (t: EditTarget) => void; onGone?: () => void }) {
  const { draft, update, toast } = useAdmin();
  const s = draft.sections.find((x) => x.id === id);
  if (!s) return <p className="aempty">Ez a szekció már nincs meg.</p>;
  const set = (p: Partial<Section>) => update((d) => ({ ...d, sections: d.sections.map((x) => (x.id === id ? { ...x, ...p } : x)) }));
  const idx = draft.sections.findIndex((x) => x.id === id);
  const items = sectionItems(s, draft);
  const srcVal = s.source.type === 'category' ? `c:${s.source.category}` : `t:${s.source.tag}:${s.source.category ?? ''}`;
  const srcOptions = [
    ...draft.categories.map((c) => ({ value: `c:${c.id}`, label: `Kategória: ${c.title}` })),
    ...(Object.keys(TAG_LABEL) as Tag[]).flatMap((t) => [
      { value: `t:${t}:`, label: `Címke: ${TAG_LABEL[t]} (minden termék)` },
      ...draft.categories.filter((c) => c.id === 'pizza').map((c) => ({ value: `t:${t}:${c.id}`, label: `Címke: ${TAG_LABEL[t]} – csak ${c.title.toLowerCase()}` })),
    ]),
  ];
  const cat = s.source.type === 'category' ? s.source.category : null;

  return (
    <div className="aform">
      <Text label="Cím" value={s.title} onChange={(v) => set({ title: v })} maxLength={60} />
      <Text label="Alcím" value={s.sub} onChange={(v) => set({ sub: v })} maxLength={160} />
      <Select label="Mi kerüljön ide?" value={srcVal} options={srcOptions}
        onChange={(v) => {
          const [k, a, b] = v.split(':');
          set({ source: k === 'c' ? { type: 'category', category: a } : { type: 'tag', tag: a as Tag, ...(b ? { category: b } : {}) } });
        }} />
      <div className="aswitches">
        <Toggle label="Nagy kártyák, vízszintes sáv" checked={!!s.feature} onChange={(v) => set({ feature: v })} />
        <Toggle label="Elrejtés" checked={!!s.hidden} onChange={(v) => set({ hidden: v })} />
      </div>
      <Group title={`Termékek itt (${items.length})`} desc={s.source.type === 'tag' ? 'A címke alapján kerülnek ide – a terméknél állítható.' : undefined}>
        <ul className="alist">
          {items.map((it) => (
            <li key={it.id}><button type="button" onClick={() => onOpen({ kind: 'item', id: it.id })}><b>{it.name}</b><span>{ft(it.price)}</span><Icon name="right" /></button></li>
          ))}
        </ul>
        {cat && (
          <button type="button" className="kbtn kbtn--go" onClick={() => { const n = newItem(cat); update((d) => ({ ...d, items: [...d.items, n] })); onOpen({ kind: 'item', id: n.id }); }}>
            <Icon name="plus" />Új termék ide
          </button>
        )}
      </Group>
      <OrderButtons
        onUp={idx > 0 ? () => update((d) => ({ ...d, sections: move(d.sections, idx, -1) })) : undefined}
        onDown={idx < draft.sections.length - 1 ? () => update((d) => ({ ...d, sections: move(d.sections, idx, 1) })) : undefined}
        onDelete={() => {
          const snap = draft;
          update((d) => ({ ...d, sections: d.sections.filter((x) => x.id !== id) }));
          onGone?.();
          toast('Szekció törölve (a termékek megmaradtak)', { action: 'Visszavonás', onAction: () => update(() => snap) });
        }}
        deleteLabel="Szekció törlése"
      />
    </div>
  );
}

/* ---------------- Slideshow dia ---------------- */
export function HeroEditor({ id, onOpen, onGone }: { id: string; onOpen: (t: EditTarget) => void; onGone?: () => void }) {
  const { draft, update, upload, library } = useAdmin();
  const h = draft.hero.find((x) => x.id === id);
  if (!h) return <p className="aempty">Ez a dia már nincs meg.</p>;
  const it = draft.items.find((x) => x.id === h.itemId);
  const set = (p: Partial<HeroSlide>) => update((d) => ({ ...d, hero: d.hero.map((x) => (x.id === id ? { ...x, ...p } : x)) }));
  const idx = draft.hero.findIndex((x) => x.id === id);
  return (
    <div className="aform">
      <p className="astate">{idx + 1}. dia a {draft.hero.length}-ből</p>
      <Select label="Melyik termék?" hint="ár és „Kosárba” gomb innen jön" value={h.itemId} onChange={(v) => set({ itemId: v })}
        options={draft.items.map((i) => ({ value: i.id, label: `${i.name} – ${ft(i.price)}` }))} />
      <Text label="Felső kis felirat" value={h.kicker} onChange={(v) => set({ kicker: v })} placeholder="pl. No. 4 · Pizza · 32 cm" maxLength={60} />
      <Text label="Nagy cím" hint="üresen a termék neve" value={h.title} onChange={(v) => set({ title: v })} placeholder={it?.name} maxLength={60} />
      <Text label="Szöveg" hint="üresen a termék leírása" value={h.text} onChange={(v) => set({ text: v })} placeholder={it?.desc} multiline maxLength={240} />
      <ImageField label="Háttérkép" value={h.image} fallback={it?.image} onChange={(v) => set({ image: v })} upload={upload} library={library} />
      {it && <button type="button" className="kbtn kbtn--ghost" onClick={() => onOpen({ kind: 'item', id: it.id })}><Icon name="edit" />A termék szerkesztése (ár, név)</button>}
      <OrderButtons
        onUp={idx > 0 ? () => update((d) => ({ ...d, hero: move(d.hero, idx, -1) })) : undefined}
        onDown={idx < draft.hero.length - 1 ? () => update((d) => ({ ...d, hero: move(d.hero, idx, 1) })) : undefined}
        onDelete={draft.hero.length > 1 ? () => { update((d) => ({ ...d, hero: d.hero.filter((x) => x.id !== id) })); onGone?.(); } : undefined}
        deleteLabel="Dia törlése"
      />
      <button type="button" className="kbtn kbtn--go" onClick={() => {
        const n: HeroSlide = { id: uid('h'), itemId: draft.items[0].id, kicker: '', title: '', text: '', image: null };
        update((d) => { const hero = [...d.hero]; hero.splice(idx + 1, 0, n); return { ...d, hero }; });
        onOpen({ kind: 'hero', id: n.id });
      }}><Icon name="plus" />Új dia ez után</button>
    </div>
  );
}

/* ---------------- Kisebb szövegek ---------------- */
const ICONS: { value: Fact['icon']; label: string }[] = [
  { value: 'bag', label: 'Táska' }, { value: 'bike', label: 'Futár' }, { value: 'bell', label: 'Csengő' }, { value: 'clock', label: 'Óra' },
  { value: 'pin', label: 'Helyjelölő' }, { value: 'flame', label: 'Láng' }, { value: 'leaf', label: 'Levél' }, { value: 'pizza', label: 'Pizza' },
];

export function FactEditor({ id }: { id: string }) {
  const { draft, update } = useAdmin();
  const f = draft.facts.find((x) => x.id === id);
  if (!f) return null;
  const set = (p: Partial<Fact>) => update((d) => ({ ...d, facts: d.facts.map((x) => (x.id === id ? { ...x, ...p } : x)) }));
  return (
    <div className="aform">
      <Select label="Ikon" value={f.icon} onChange={(v) => set({ icon: v })} options={ICONS} />
      <Text label="Cím" value={f.title} onChange={(v) => set({ title: v })} maxLength={40} />
      <Text label="Szöveg" value={f.text} onChange={(v) => set({ text: v })} multiline maxLength={140} />
    </div>
  );
}

export function BrandEditor() {
  const { draft, update } = useAdmin();
  const { upload, library } = useAdmin();
  const set = (p: Partial<Content['brand']>) => update((d) => ({ ...d, brand: { ...d.brand, ...p } }));
  const b = draft.brand;
  return (
    <div className="aform">
      <ImageField label="Logó" hint="ha nincs, a lenti betű látszik" value={b.logo ?? null} onChange={(v) => set({ logo: v })} upload={upload} library={library} />
      <Text label="Étterem teljes neve" value={b.name} onChange={(v) => set({ name: v })} maxLength={60} />
      <div className="agrid2">
        <Text label="Rövid név (fejléc)" value={b.short} onChange={(v) => set({ short: v })} maxLength={30} />
        <Text label="Logó betű (ha nincs kép)" value={b.mark} onChange={(v) => set({ mark: v.slice(0, 2) })} maxLength={2} />
      </div>
      <Text label="Alcím a név alatt" value={b.subtitle} onChange={(v) => set({ subtitle: v })} maxLength={60} />
      <Text label="Szlogen (lábléc)" value={b.tagline} onChange={(v) => set({ tagline: v })} multiline maxLength={200} />
    </div>
  );
}

export function ContactEditor() {
  const { draft, update } = useAdmin();
  const set = (p: Partial<Content['contact']>) => update((d) => ({ ...d, contact: { ...d.contact, ...p } }));
  const c = draft.contact;
  return (
    <div className="aform">
      <Text label="Telefonszám" value={c.phone} onChange={(v) => set({ phone: v })} type="tel" maxLength={30} />
      <Text label="Cím" value={c.address} onChange={(v) => set({ address: v })} maxLength={120} />
      <Text label="Település" hint="ez az alapértelmezett a kiszállítási címnél" value={c.town} onChange={(v) => set({ town: v })} maxLength={60} />
      <Text label="Facebook oldal" hint="üresen nem látszik" value={c.facebook} onChange={(v) => set({ facebook: v.trim() })} type="url" maxLength={300}
        error={c.facebook && !c.facebook.startsWith('https://') ? 'https://-sel kezdődő link kell' : ''} />
      <Group title="Az étterem helye a térképen" desc="Ebből számoljuk a kiszállítási távolságot. Google Térképen jobb klikk a helyre → az első sor a két szám.">
        <div className="agrid2">
          <Num label="Szélesség (lat)" value={c.lat} onChange={(v) => v != null && set({ lat: v })} min={-90} max={90} step={0.000001} />
          <Num label="Hosszúság (lng)" value={c.lng} onChange={(v) => v != null && set({ lng: v })} min={-180} max={180} step={0.000001} />
        </div>
      </Group>
      <Text label="Lábléc kis szöveg" value={draft.texts.footerNote} onChange={(v) => update((d) => ({ ...d, texts: { ...d.texts, footerNote: v } }))} maxLength={200} />
    </div>
  );
}

export function TextsEditor() {
  const { draft, update } = useAdmin();
  const set = (p: Partial<Content['texts']>) => update((d) => ({ ...d, texts: { ...d.texts, ...p } }));
  return (
    <div className="aform">
      <Text label="Zárva felirat" hint="utána a telefonszám jön" value={draft.texts.closed} onChange={(v) => set({ closed: v })} multiline maxLength={200} />
      <Text label="Keresőmező szövege" value={draft.texts.searchPlaceholder} onChange={(v) => set({ searchPlaceholder: v })} maxLength={60} />
    </div>
  );
}

/* ---------------- Melyik szerkesztő kell? ---------------- */
export const targetTitle = (t: EditTarget, d: Content) => {
  switch (t.kind) {
    case 'brand': return 'Név és logó';
    case 'contact': return 'Elérhetőség';
    case 'texts': return 'Feliratok';
    case 'hero': return 'Slideshow dia';
    case 'fact': return 'Infó doboz';
    case 'offers': return 'Napi ajánlatok';
    case 'offer': return d.offers.find((o) => o.id === t.id)?.title || 'Napi ajánlat';
    case 'section': return `Szekció: ${d.sections.find((s) => s.id === t.id)?.title ?? ''}`;
    case 'item': return d.items.find((i) => i.id === t.id)?.name || 'Termék';
  }
};

export function TargetEditor({ target, onOpen, onClose }: { target: EditTarget; onOpen: (t: EditTarget) => void; onClose: () => void }) {
  switch (target.kind) {
    case 'brand': return <BrandEditor />;
    case 'contact': return <ContactEditor />;
    case 'texts': return <TextsEditor />;
    case 'hero': return <HeroEditor id={target.id} onOpen={onOpen} onGone={onClose} />;
    case 'fact': return <FactEditor id={target.id} />;
    case 'offers': return <OffersHeaderEditor onOpen={onOpen} />;
    case 'offer': return <OfferEditor id={target.id} onGone={onClose} />;
    case 'section': return <SectionEditor id={target.id} onOpen={onOpen} onGone={onClose} />;
    case 'item': return <ItemEditor id={target.id} onGone={onClose} />;
  }
}
