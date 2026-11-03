// Közös étlap-logika – a böngésző és a szerver is ezt használja,
// így a vevő ugyanazt az árat látja, amit a szerver kiszámol.
import type { Content, Item, Offer, OrderLine, Section } from './types';

export function optionsFor(kind: Item['kind'] | 'offer') {
  return {
    toppings: kind === 'pizza',
    sauces: ['pizza', 'dish', 'fried', 'side'].includes(kind),
    freeChoice: kind === 'fried',
    removable: ['pizza', 'dish', 'fried'].includes(kind),
  };
}

export function ingredients(item: Pick<Item, 'desc'>) {
  return item.desc
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s && !/választható|körettel|külön/.test(s));
}

export type Selection = Pick<OrderLine, 'extras' | 'sauces' | 'removed' | 'side' | 'freeSauce' | 'note'>;

export function unitPrice(base: number, sel: Pick<Selection, 'extras' | 'sauces'>, c: Content) {
  return base + sel.extras.length * c.options.toppingPrice + sel.sauces.length * c.options.saucePrice;
}

export function sectionItems(s: Section, c: Content): Item[] {
  const visible = c.items.filter((i) => !i.hidden);
  if (s.source.type === 'category') {
    const cat = s.source.category;
    return visible.filter((i) => i.category === cat);
  }
  const { tag, category } = s.source;
  return visible.filter((i) => i.tags.includes(tag) && (!category || i.category === category));
}

/** Budapesti idő szerinti mai dátum (YYYY-MM-DD) és a hét napja (0 = vasárnap) */
export function budapestToday(now = Date.now()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Budapest', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' })
    .formatToParts(new Date(now));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  return { date: `${get('year')}-${get('month')}-${get('day')}`, weekday: wd };
}

export function offerIsToday(o: Offer, now = Date.now()) {
  if (!o.active) return false;
  const t = budapestToday(now);
  if (o.date) return o.date === t.date;
  return !o.days.length || o.days.includes(t.weekday);
}

export const WEEKDAYS = ['Vasárnap', 'Hétfő', 'Kedd', 'Szerda', 'Csütörtök', 'Péntek', 'Szombat'];
export const WEEKDAYS_SHORT = ['V', 'H', 'K', 'Sze', 'Cs', 'P', 'Szo'];

export function offerWhen(o: Offer) {
  if (o.date) return o.date.replace(/-/g, '. ') + '.';
  if (!o.days.length || o.days.length === 7) return 'Minden nap';
  const d = [...o.days].sort();
  if (d.join() === '1,2,3,4,5') return 'Hétköznap';
  if (d.join() === '0,6') return 'Hétvégén';
  return d.map((x) => WEEKDAYS_SHORT[x]).join(', ');
}

export function heroSlides(c: Content) {
  const byId = new Map(c.items.map((i) => [i.id, i]));
  return c.hero
    .map((h) => {
      const it = byId.get(h.itemId);
      if (!it || it.hidden) return null;
      return {
        slide: h,
        item: it,
        title: h.title || it.name,
        text: h.text || it.desc,
        image: h.image || it.image,
      };
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
}

export function fillTemplate(t: string, vars: Record<string, string>) {
  return t.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
}

export const TAG_LABEL: Record<string, string> = {
  popular: 'Népszerű',
  meat: 'Sok hús',
  salami: 'Szalámis',
  veg: 'Húsmentes',
  spicy: 'Csípős',
};

export const KIND_LABEL: Record<string, string> = {
  pizza: 'Pizza (feltét, szósz, kihagyás)',
  dish: 'Étel (szósz, kihagyás)',
  fried: 'Frissensült (köret + szósz választás)',
  side: 'Köret (szósz)',
  drink: 'Ital (nincs opció)',
  dessert: 'Desszert (nincs opció)',
};
