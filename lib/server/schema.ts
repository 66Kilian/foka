import 'server-only';
import { z } from 'zod';

const str = (max: number) => z.string().trim().max(max);
const money = z.number().int().min(0).max(1_000_000);
// Kép: csak saját képek (/images, /api/media) vagy a Vercel Blob tárhely
const url = z
  .string()
  .max(600)
  .refine((u) => /^\/(images|api\/media)\/[\w.\-/]+$/.test(u) || /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//.test(u), 'Ismeretlen képforrás');
const img = z.object({ src: url, thumb: url }).nullable();
const id = z.string().regex(/^[a-z0-9-]{1,48}$/);
const tag = z.enum(['popular', 'meat', 'salami', 'veg', 'spicy']);

export const ContentSchema = z.object({
  brand: z.object({ name: str(60), short: str(30), subtitle: str(60), tagline: str(200), mark: str(2) }),
  contact: z.object({
    phone: str(30), address: str(120), town: str(60), facebook: z.union([z.literal(''), z.string().url().max(300).startsWith('https://')]),
    lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180),
  }),
  seo: z.object({ title: str(90), description: str(300) }),
  texts: z.object({ closed: str(200), offersTitle: str(60), offersSub: str(120), footerNote: str(200), searchPlaceholder: str(60) }),
  hero: z.array(z.object({ id, itemId: id, kicker: str(60), title: str(60), text: str(240), image: img })).max(12),
  facts: z.array(z.object({ id, icon: z.enum(['bag', 'bike', 'bell', 'clock', 'pin', 'flame', 'leaf', 'pizza']), title: str(40), text: str(140) })).max(6),
  offers: z.array(z.object({
    id, title: str(80).min(1), text: str(300), price: money.min(1), oldPrice: money.nullable().optional(), image: img,
    days: z.array(z.number().int().min(0).max(6)).max(7), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(), active: z.boolean(),
  })).max(30),
  categories: z.array(z.object({ id, title: str(60).min(1) })).min(1).max(30),
  sections: z.array(z.object({
    id, title: str(60).min(1), sub: str(160),
    source: z.discriminatedUnion('type', [
      z.object({ type: z.literal('category'), category: id }),
      z.object({ type: z.literal('tag'), tag, category: id.optional() }),
    ]),
    feature: z.boolean().optional(), hidden: z.boolean().optional(),
  })).max(40),
  items: z.array(z.object({
    id, no: z.number().int().min(0).max(999).nullable().optional(), category: id,
    kind: z.enum(['pizza', 'dish', 'fried', 'side', 'drink', 'dessert']),
    name: str(80).min(1), desc: str(300), price: money.min(1), image: img, tags: z.array(tag).max(5),
    hidden: z.boolean().optional(), draft: z.boolean().optional(),
  })).max(400),
  options: z.object({
    toppings: z.array(str(40).min(1)).max(60), sauces: z.array(str(40).min(1)).max(30),
    freeSides: z.array(str(60).min(1)).max(20), freeSauces: z.array(str(60).min(1)).max(20),
    toppingPrice: money, saucePrice: money,
  }),
  pricing: z.object({ packagingFee: money, defaultPrepMinutes: z.number().int().min(5).max(180) }),
  delivery: z.object({
    maxKm: z.number().min(1).max(100), handoverMinutes: z.number().min(0).max(30), trafficFactor: z.number().min(1).max(3),
    roadFactor: z.number().min(1).max(3), fallbackKmh: z.number().min(10).max(120), unknownMinutes: z.number().int().min(5).max(120),
    towns: z.array(str(60).min(1)).max(80),
  }),
  sms: z.object({ mode: z.enum(['link', 'twilio', 'off']), ready: str(300), dispatch: str(300) }),
  rejectReasons: z.array(str(200).min(1)).min(1).max(10),
  updatedAt: z.number(),
}).superRefine((c, ctx) => {
  const dup = (arr: { id: string }[], what: string) => {
    const seen = new Set<string>();
    for (const x of arr) {
      if (seen.has(x.id)) ctx.addIssue({ code: 'custom', message: `Ismétlődő azonosító (${what}): ${x.id}` });
      seen.add(x.id);
    }
  };
  dup(c.items, 'termék'); dup(c.categories, 'kategória'); dup(c.sections, 'szekció'); dup(c.offers, 'ajánlat'); dup(c.hero, 'dia');
  const cats = new Set(c.categories.map((x) => x.id));
  for (const i of c.items) if (!cats.has(i.category)) ctx.addIssue({ code: 'custom', message: `„${i.name}” kategóriája nem létezik` });
});

export const StatusPatch = z.object({
  open: z.boolean().optional(),
  extraWait: z.number().int().min(0).max(180).optional(),
  soldOut: z.array(id).max(400).optional(),
});

const phone = z.string().regex(/^\+36\d{9}$/);
const choice = z.array(str(60)).max(30);

export const NewOrder = z.object({
  customerName: str(60).min(2),
  customerPhone: phone,
  orderType: z.enum(['pickup', 'delivery']),
  town: str(60),
  street: str(120),
  courierNote: str(120),
  items: z.array(z.object({
    ref: z.object({ type: z.enum(['item', 'offer']), id }),
    qty: z.number().int().min(1).max(50),
    extras: choice, sauces: choice, removed: choice,
    side: str(60).nullable(), freeSauce: str(60).nullable(),
    note: str(200),
  })).min(1).max(40),
  expectedTotal: z.number(),
});

export const OrderPatch = z.object({
  status: z.enum(['NEW', 'COOKING', 'READY', 'ON_THE_WAY', 'DONE', 'REJECTED']).optional(),
  prepMinutes: z.number().int().min(1).max(300).nullable().optional(),
  acceptedAt: z.number().nullable().optional(),
  readyAt: z.number().nullable().optional(),
  dispatchedAt: z.number().nullable().optional(),
  etaAt: z.number().nullable().optional(),
  completedAt: z.number().nullable().optional(),
  rejectReason: str(200).nullable().optional(),
  notified: z.object({ ready: z.number().optional(), dispatch: z.number().optional() }).optional(),
});

export function issues(e: z.ZodError) {
  return e.issues.slice(0, 5).map((i) => `${i.path.join('.') || '–'}: ${i.message}`).join('; ');
}
