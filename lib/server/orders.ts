import 'server-only';
import { randomUUID, randomInt } from 'node:crypto';
import type { z } from 'zod';
import { db } from './db';
import { estimateDelivery } from './eta';
import type { NewOrder } from './schema';
import { ingredients, offerIsToday, optionsFor, unitPrice } from '../menu';
import type { Content, Order, OrderLine, PublicOrder, Status } from '../types';

export class OrderError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

const CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makeCode = () => Array.from({ length: 4 }, () => CODE_ABC[randomInt(CODE_ABC.length)]).join('');

/** A vevő csak a listából választhat – minden mást eldobunk */
const only = (list: string[], allowed: string[]) => [...new Set(list)].filter((x) => allowed.includes(x));

export async function createOrder(input: z.infer<typeof NewOrder>, c: Content, s: Status): Promise<Order> {
  if (!s.open) throw new OrderError('Most nem fogadunk online rendelést.', 409);
  const items = new Map(c.items.map((i) => [i.id, i]));
  const offers = new Map(c.offers.map((o) => [o.id, o]));
  const sold = new Set(s.soldOut);

  const lines: OrderLine[] = input.items.map((l) => {
    if (l.ref.type === 'offer') {
      const o = offers.get(l.ref.id);
      if (!o || !offerIsToday(o)) throw new OrderError('Az egyik napi ajánlat már nem érvényes. Frissítsd az oldalt.', 409);
      return { ref: l.ref, name: o.title, qty: l.qty, unitPrice: o.price, extras: [], sauces: [], removed: [], side: null, freeSauce: null, note: l.note };
    }
    const it = items.get(l.ref.id);
    if (!it || it.hidden) throw new OrderError('Az egyik termék már nincs az étlapon. Frissítsd az oldalt.', 409);
    if (sold.has(it.id)) throw new OrderError(`Elfogyott: ${it.name}. Vedd ki a kosárból.`, 409);
    const o = optionsFor(it.kind);
    const sel = {
      extras: o.toppings ? only(l.extras, c.options.toppings) : [],
      sauces: o.sauces ? only(l.sauces, c.options.sauces) : [],
      removed: o.removable ? only(l.removed, ingredients(it)) : [],
      side: o.freeChoice && l.side && c.options.freeSides.includes(l.side) ? l.side : o.freeChoice ? c.options.freeSides[0] ?? null : null,
      freeSauce: o.freeChoice && l.freeSauce && c.options.freeSauces.includes(l.freeSauce) ? l.freeSauce : o.freeChoice ? c.options.freeSauces[0] ?? null : null,
    };
    return { ref: l.ref, name: it.name, qty: l.qty, unitPrice: unitPrice(it.price, sel, c), ...sel, note: l.note };
  });

  const subtotal = lines.reduce((a, l) => a + l.unitPrice * l.qty, 0);
  const total = subtotal + c.pricing.packagingFee;
  if (total !== input.expectedTotal) throw new OrderError('Időközben változtak az árak. Nézd át a kosarad, és küldd újra.', 409);

  const deliv = input.orderType === 'delivery';
  let delivery: Order['delivery'] = null;
  if (deliv) {
    if (!input.town || !/\d/.test(input.street)) throw new OrderError('Add meg a települést, az utcát és a házszámot.');
    const eta = await estimateDelivery(input.town, input.street, c);
    if (eta.ok) {
      if (eta.km > c.delivery.maxKm) throw new OrderError(`Erre a címre sajnos nem szállítunk (${eta.km} km).`, 409);
      delivery = { km: eta.km, minutes: eta.minutes, source: eta.source, precise: eta.precise };
    }
  }

  const order: Order = {
    id: randomUUID(),
    code: makeCode(),
    customerName: input.customerName,
    customerPhone: input.customerPhone,
    orderType: input.orderType,
    town: deliv ? input.town : '',
    street: deliv ? input.street : '',
    address: deliv ? `${input.town}, ${input.street}` : '',
    courierNote: deliv ? input.courierNote : '',
    items: lines,
    subtotal,
    packagingFee: c.pricing.packagingFee,
    total,
    quotedPrepMinutes: c.pricing.defaultPrepMinutes + (s.extraWait || 0),
    delivery,
    status: 'NEW',
    createdAt: Date.now(),
  };
  await db.putOrder(order, true);
  return order;
}

export function toPublic(o: Order): PublicOrder {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { customerPhone, notified, ...rest } = o;
  return rest;
}
