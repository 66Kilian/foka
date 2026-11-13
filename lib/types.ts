// ============================================================
//  Adatmodell – ezt szerkeszti az admin felület.
// ============================================================

export type Img = { src: string; thumb: string } | null;

/** Milyen opciók járnak a termékhez (feltét, szósz, köret) */
export type Kind = 'pizza' | 'dish' | 'fried' | 'side' | 'drink' | 'dessert';
export type Tag = 'popular' | 'meat' | 'salami' | 'veg' | 'spicy';

export type Category = { id: string; title: string };

export type Item = {
  id: string;
  no?: number | null;
  category: string;
  kind: Kind;
  name: string;
  desc: string;
  price: number;
  image: Img;
  tags: Tag[];
  hidden?: boolean;
  draft?: boolean;
};

/** Az étlap egy szekciója: egy kategória, vagy egy címke szerinti válogatás */
export type Section = {
  id: string;
  title: string;
  sub: string;
  source: { type: 'category'; category: string } | { type: 'tag'; tag: Tag; category?: string };
  feature?: boolean;
  hidden?: boolean;
};

export type HeroSlide = {
  id: string;
  itemId: string;
  kicker: string;
  title: string; // üres = termék neve
  text: string; // üres = termék leírása
  image: Img; // null = termék képe
};

/** Napi ajánlat. days: 0=vasárnap … 6=szombat; üres = minden nap. date: csak azon a napon. */
export type Offer = {
  id: string;
  title: string;
  text: string;
  price: number;
  oldPrice?: number | null;
  image: Img;
  days: number[];
  date?: string | null;
  active: boolean;
};

export type Fact = { id: string; icon: 'bag' | 'bike' | 'bell' | 'clock' | 'pin' | 'flame' | 'leaf' | 'pizza'; title: string; text: string };

export type Content = {
  brand: { name: string; short: string; subtitle: string; tagline: string; mark: string; /** ha van, a betű helyett ez látszik */ logo?: Img };
  contact: { phone: string; address: string; town: string; facebook: string; lat: number; lng: number };
  seo: { title: string; description: string; /** Facebook / Messenger megosztáskor látszó kép */ image?: Img };
  texts: { closed: string; offersTitle: string; offersSub: string; footerNote: string; searchPlaceholder: string };
  hero: HeroSlide[];
  facts: Fact[];
  offers: Offer[];
  categories: Category[];
  sections: Section[];
  items: Item[];
  options: {
    toppings: string[];
    sauces: string[];
    freeSides: string[];
    freeSauces: string[];
    toppingPrice: number;
    saucePrice: number;
  };
  pricing: { packagingFee: number; defaultPrepMinutes: number };
  delivery: {
    maxKm: number;
    handoverMinutes: number;
    trafficFactor: number;
    roadFactor: number;
    fallbackKmh: number;
    unknownMinutes: number;
    towns: string[];
  };
  sms: { mode: 'link' | 'twilio' | 'off'; ready: string; dispatch: string };
  rejectReasons: string[];
  updatedAt: number;
};

/** Napközbeni állapot – azonnal érvényes, nem kell közzétenni */
export type Status = { open: boolean; extraWait: number; soldOut: string[] };

export type OrderStatus = 'NEW' | 'COOKING' | 'READY' | 'ON_THE_WAY' | 'DONE' | 'REJECTED';

export type OrderLine = {
  ref: { type: 'item' | 'offer'; id: string };
  name: string;
  qty: number;
  unitPrice: number;
  extras: string[];
  sauces: string[];
  removed: string[];
  side: string | null;
  freeSauce: string | null;
  note: string;
};

export type Delivery = { km: number; minutes: number; source: 'route' | 'estimate'; precise: boolean } | null;

export type Order = {
  id: string;
  code: string;
  customerName: string;
  customerPhone: string;
  orderType: 'pickup' | 'delivery';
  town: string;
  street: string;
  address: string;
  courierNote: string;
  items: OrderLine[];
  subtotal: number;
  packagingFee: number;
  total: number;
  quotedPrepMinutes: number;
  delivery: Delivery;
  status: OrderStatus;
  createdAt: number;
  acceptedAt?: number | null;
  prepMinutes?: number | null;
  readyAt?: number | null;
  dispatchedAt?: number | null;
  etaAt?: number | null;
  completedAt?: number | null;
  rejectReason?: string | null;
  notified?: { ready?: number; dispatch?: number };
};

/** A vevőnek visszaadott (szűkített) rendelés */
export type PublicOrder = Omit<Order, 'customerPhone' | 'notified'>;

export type EtaResult =
  | { ok: true; km: number; minutes: number; source: 'route' | 'estimate'; precise: boolean }
  | { ok: false; reason: 'notfound' | 'network' };
