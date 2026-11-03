// Kezdő tartalom – az eredeti étlap. Az első indításkor ez kerül az adatbázisba,
// utána minden az admin felületen szerkeszthető.
import type { Content, Img, Item, Kind, Tag } from './types';

const IMG: Record<string, string> = {
  margherita: '1574071318508-1cdbab80d002',
  prosciutto: '1594007654729-407eedc4be65',
  hawaii: '1604382354936-07c5d9983bd3',
  husimado: '1565299624946-b28f40a0ae38',
  szalamis: '1628840042765-356cda07504e',
  piedone: '1513104890138-7c749659a591',
  magyaros: '1534308983496-4fabb1a015ee',
  tonhalas: '1588315029754-2dd089d39a1a',
  calzone: '1571407970349-bc81e7e96d47',
  vega: '1590947132387-155cc02f3212',
  negysajtos: '1541745537411-b8046dc6d66c',
  massimo: '1601924582970-9238bcb495d9',
  negyevszak: '1576458088443-04a19bb13da6',
  spenotos: '1593560708920-61dd98c46a4e',
  inferno: '1600028068383-ea11a7a101f3',
  burger1: '1568901346375-23c9450c58cd',
  burger2: '1571091718767-18b5b1457add',
  burgerbox: '1550547660-d9450f859349',
  burgers: '1609167830220-7164aa360951',
  gyrostal: '1529006557810-274b9b2fc783',
  pita: '1626700051175-6818013e1d4f',
  toast: '1528735602780-2552fd46c7af',
  rantott: '1562967914-608f82629710',
  steak: '1600891964092-4316c288032e',
  fries: '1573080496219-bb080dd4f877',
  cola: '1554866585-cd94860890b7',
  colazero: '1622483767028-3f66f32aef97',
  limonade: '1621263764928-df1444c5e859',
  brownie: '1606313564200-e75d5e30476c',
  kehely: '1563805042-7684c019e1cb',
};

const img = (k: string | null): Img => (k ? { src: `/images/${IMG[k]}-l.webp`, thumb: `/images/${IMG[k]}-s.webp` } : null);

type Row = [id: string, no: number | null, category: string, kind: Kind, name: string, desc: string, price: number, image: string | null, tags: Tag[], draft?: boolean];

const ROWS: Row[] = [
  ['margherita', 1, 'pizza', 'pizza', 'Margherita', 'paradicsomos alap, sajt, oregánó', 1650, 'margherita', ['popular', 'veg']],
  ['prosciutto', 2, 'pizza', 'pizza', 'Prosciutto', 'paradicsomos alap, sonka, sajt', 1850, 'prosciutto', []],
  ['hawaii', 3, 'pizza', 'pizza', 'Hawaii', 'paradicsomos alap, sonka, ananász, kukorica, sajt', 2050, 'hawaii', ['popular']],
  ['husimado', 4, 'pizza', 'pizza', 'Húsimádó', 'paradicsomos alap, bacon, füstölt tarja, szalámi, hagymás sajt', 2190, 'husimado', ['popular', 'meat', 'salami']],
  ['szalamis', 5, 'pizza', 'pizza', 'Szalámis', 'paradicsomos alap, szalámi, hagyma, sajt', 2050, 'szalamis', ['popular', 'salami']],
  ['piedone', 6, 'pizza', 'pizza', 'Piedone', 'paradicsomos alap, bacon, bab, hagyma, sajt', 2050, 'piedone', ['meat']],
  ['magyaros', 7, 'pizza', 'pizza', 'Magyaros', 'paradicsomos alap, bacon, kolbász, hagyma, tv paprika, sajt', 2190, 'magyaros', ['meat']],
  ['tonhalas', 8, 'pizza', 'pizza', 'Tonhalas', 'paradicsomos alap, tonhal, lilahagyma, sajt', 2190, 'tonhalas', []],
  ['calzone', 9, 'pizza', 'pizza', 'Calzone', 'paradicsomos alap, szalámi, gomba, főtt tojás, sajt', 2050, 'calzone', ['salami']],
  ['vegetariana', 10, 'pizza', 'pizza', 'Vegetariana', 'paradicsomos alap, kukorica, gomba, brokkoli, pfefferoni, sajt', 2090, 'vega', ['veg']],
  ['negysajtos', 11, 'pizza', 'pizza', 'Négysajtos', 'paradicsomos alap, camembert, füstölt sajt, márványsajt, pannónia sajt', 2190, 'negysajtos', ['popular', 'veg']],
  ['massimo', 12, 'pizza', 'pizza', 'Massimo', 'paradicsomos alap, sonka, tarja, bacon, kolbász, szalámi, hagyma, főtt tojás, sajt', 2190, 'massimo', ['meat', 'salami']],
  ['songoku', 13, 'pizza', 'pizza', 'Songoku', 'paradicsomos alap, sonka, gomba, kukorica, sajt', 2050, 'prosciutto', []],
  ['bolognai', 14, 'pizza', 'pizza', 'Bolognai', 'paradicsomos alap, bolognai szósz, sajt', 2150, 'piedone', ['meat']],
  ['spenotos-fetas', 15, 'pizza', 'pizza', 'Spenótos-fetás', 'paradicsomos alap, spenót, feta sajt, sajt', 2150, 'spenotos', ['veg']],
  ['negy-evszak', 16, 'pizza', 'pizza', 'Négy évszak', 'paradicsomos alap, sonka, szalámi, gomba, tonhal, sajt', 2190, 'negyevszak', ['salami']],
  ['inferno', 17, 'pizza', 'pizza', 'Inferno', 'paradicsomos alap, sonka, tabasco, sajt', 2050, 'inferno', ['spicy']],

  ['sima-burger', null, 'burger', 'dish', 'Sima burger', 'marhahúspogácsa, zöldségek, szósz', 1200, 'burger2', []],
  ['sajtos-burger', null, 'burger', 'dish', 'Sajtos burger', 'marhahúspogácsa, sajt, zöldségek', 1400, 'burger2', []],
  ['baconos-burger', null, 'burger', 'dish', 'Baconos burger', 'marhahúspogácsa, bacon, sajt, zöldségek', 1500, 'burgers', ['popular', 'meat']],
  ['dupla-burger', null, 'burger', 'dish', 'Dupla húsos burger', '2× marhahúspogácsa, sajt, zöldségek', 1500, 'burger1', ['meat']],
  ['hambi-box', null, 'burger', 'dish', 'Hambi Box', 'burger, hasábburgonya, üdítő', 2050, 'burgerbox', []],

  ['gyrostal', null, 'gyros', 'dish', 'Gyrostál', 'gyroshús, fűszeres burgonya, saláta, öntet', 1890, 'gyrostal', ['popular']],
  ['dupla-gyrostal', null, 'gyros', 'dish', 'Dupla húsos gyrostál', 'extra gyroshús, burgonya, saláta', 2290, 'gyrostal', ['meat']],
  ['gyros-pita', null, 'gyros', 'dish', 'Gyros pita', 'pitában gyroshús, zöldségek, öntet', 1790, 'pita', []],

  ['sonkas-meleg', null, 'toast', 'dish', 'Sonkás melegszendvics', 'sonka, sajt, vaj', 1200, 'toast', []],
  ['szalamis-meleg', null, 'toast', 'dish', 'Szalámis melegszendvics', 'szalámi, sajt', 1200, 'toast', []],
  ['gombas-meleg', null, 'toast', 'dish', 'Gombás melegszendvics', 'gomba, sajt', 1200, 'toast', ['veg']],
  ['sonka-gomba-meleg', null, 'toast', 'dish', 'Sonka-gomba melegszendvics', 'sonka, gomba, sajt', 1400, 'toast', []],
  ['magyaros-meleg', null, 'toast', 'dish', 'Magyaros melegszendvics', 'kolbász, hagyma, sajt', 1400, 'toast', []],

  ['rantott', null, 'fried', 'fried', 'Rántott sajt / gomba / csirke / karaj', 'választható körettel és szósszal', 1640, 'rantott', ['popular']],
  ['kijevi', null, 'fried', 'fried', 'Kijevi csirke', 'fűszeres vajjal töltve, körettel és szósszal', 1940, 'rantott', []],
  ['gordon', null, 'fried', 'fried', 'Gordon csirke / karaj', 'sonkával és sajttal töltve, körettel és szósszal', 1940, 'steak', []],
  ['csirkeszarny', null, 'fried', 'fried', 'Csirkeszárny körettel', 'fűszeres szárnyak, köret és szósz', 2590, 'rantott', ['meat']],
  ['koret', null, 'fried', 'side', 'Hasábburgonya / rizs', 'külön köret', 800, 'fries', []],

  ['cola', null, 'drink', 'drink', 'Coca-Cola 0,33 l', 'dobozos', 590, 'cola', [], true],
  ['cola-zero', null, 'drink', 'drink', 'Coca-Cola Zero 0,33 l', 'dobozos, cukormentes', 590, 'colazero', [], true],
  ['limonade', null, 'drink', 'drink', 'Házi limonádé 0,5 l', 'citrom, menta', 790, 'limonade', [], true],
  ['asvanyviz', null, 'drink', 'drink', 'Ásványvíz 0,5 l', 'szénsavas vagy mentes', 390, null, [], true],

  ['brownie', null, 'dessert', 'dessert', 'Csokis brownie', 'étcsokoládés, szaftos', 890, 'brownie', [], true],
  ['fagylaltkehely', null, 'dessert', 'dessert', 'Fagylaltkehely', 'csokiöntettel, tejszínhabbal', 1190, 'kehely', [], true],
];

const items: Item[] = ROWS.map(([id, no, category, kind, name, desc, price, image, tags, draft]) => ({
  id, no, category, kind, name, desc, price, image: img(image), tags, ...(draft ? { draft } : {}),
}));

const slide = (itemId: string, kicker: string) => ({ id: `h-${itemId}`, itemId, kicker, title: '', text: '', image: null });

export const SEED: Content = {
  brand: {
    name: 'Zolgiz Ételbár',
    short: 'Zolgiz',
    subtitle: 'Ételbár · Nagycenk',
    tagline: 'Pizza, burger, gyros, frissensültek – Nagycenk szívében.',
    mark: 'Z',
  },
  contact: {
    phone: '+36 99 359 902',
    address: '9485 Nagycenk, Soproni utca 1.',
    town: 'Nagycenk',
    facebook: 'https://www.facebook.com/share/1ELrtrQwDe/?mibextid=wwXIfr',
    lat: 47.604695,
    lng: 16.697378,
  },
  seo: {
    title: 'Zolgiz Ételbár – pizza, burger, gyros rendelés Nagycenken',
    description: 'Rendelj online a Zolgiz Ételbárból: 32 cm-es pizzák, hamburgerek, gyros, melegszendvicsek és frissensültek elvitelre vagy házhozszállítással Nagycenken és környékén. Élő rendeléskövetés.',
  },
  texts: {
    closed: 'Most nem fogadunk online rendelést. Telefonon érdeklődj:',
    offersTitle: 'Mai ajánlat',
    offersSub: 'Csak ma, amíg a készlet tart',
    footerNote: 'A képek illusztrációk.',
    searchPlaceholder: 'Keresés: pl. bacon, gomba…',
  },
  hero: [
    slide('husimado', 'No. 4 · Pizza · 32 cm'),
    slide('margherita', 'No. 1 · Pizza · 32 cm'),
    slide('spenotos-fetas', 'No. 15 · Pizza · 32 cm'),
    slide('szalamis', 'No. 5 · Pizza · 32 cm'),
    slide('negysajtos', 'No. 11 · Pizza · 32 cm'),
    slide('inferno', 'No. 17 · Pizza · 32 cm'),
  ],
  facts: [
    { id: 'f1', icon: 'bag', title: 'Elvitel', text: 'Szólunk, amint elkészült – csak akkor indulj.' },
    { id: 'f2', icon: 'bike', title: 'Házhozszállítás', text: 'A címed alapján kiszámoljuk, mikorra ér oda a futár.' },
    { id: 'f3', icon: 'bell', title: 'Élő követés', text: 'Látod, mikor készül, mikor indul a futár.' },
  ],
  offers: [
    {
      id: 'o-menu',
      title: 'Pizza + üdítő',
      text: 'Bármelyik 32 cm-es pizza és egy 0,33 l-es Coca-Cola. A pizzát a megjegyzésben írd meg.',
      price: 2390,
      oldPrice: 2780,
      image: img('husimado'),
      days: [1, 2, 3, 4, 5],
      date: null,
      active: false,
    },
  ],
  categories: [
    { id: 'pizza', title: 'Pizzák' },
    { id: 'burger', title: 'Hamburgerek' },
    { id: 'gyros', title: 'Gyros' },
    { id: 'toast', title: 'Melegszendvicsek' },
    { id: 'fried', title: 'Frissensültek & köretek' },
    { id: 'drink', title: 'Üdítők' },
    { id: 'dessert', title: 'Desszertek' },
  ],
  sections: [
    { id: 'nepszeru', title: 'Népszerű', sub: '', source: { type: 'tag', tag: 'popular' }, feature: true },
    { id: 'pizzak', title: 'Pizzák', sub: '32 cm, kemencés tészta, paradicsomos alap', source: { type: 'category', category: 'pizza' } },
    { id: 'husimado', title: 'Húsimádóknak', sub: 'Bacon, tarja, kolbász – sok hús', source: { type: 'tag', tag: 'meat', category: 'pizza' } },
    { id: 'szalamis', title: 'Szalámis', sub: '', source: { type: 'tag', tag: 'salami', category: 'pizza' } },
    { id: 'husmentes', title: 'Húsmentes', sub: 'Vegetáriánus – tejterméket (sajtot) tartalmaznak', source: { type: 'tag', tag: 'veg' } },
    { id: 'csipos', title: 'Csípős', sub: '', source: { type: 'tag', tag: 'spicy' } },
    { id: 'hamburgerek', title: 'Hamburgerek', sub: '', source: { type: 'category', category: 'burger' } },
    { id: 'gyros', title: 'Gyros', sub: '', source: { type: 'category', category: 'gyros' } },
    { id: 'melegszendvicsek', title: 'Melegszendvicsek', sub: '', source: { type: 'category', category: 'toast' } },
    { id: 'frissensultek', title: 'Frissensültek', sub: 'A köret és a szósz az árban benne van', source: { type: 'category', category: 'fried' } },
    { id: 'uditok', title: 'Üdítők', sub: '', source: { type: 'category', category: 'drink' } },
    { id: 'desszertek', title: 'Desszertek', sub: '', source: { type: 'category', category: 'dessert' } },
  ],
  items,
  options: {
    toppings: ['Kéksajt', 'Füstölt sajt', 'Olíva', 'Kolbász', 'Tarja', 'Brokkoli', 'Erős paprika', 'Főtt tojás', 'Kukorica', 'Fokhagyma', 'Ananász', 'Bacon', 'Gomba', 'Sonka', 'Szalámi'],
    sauces: ['Ketchup', 'Majonéz', 'Tartármártás', 'Fokhagymás öntet'],
    freeSides: ['Hasábburgonya', 'Rizs', 'Vegyes köret (rizs + hasáb)'],
    freeSauces: ['Ketchup', 'Majonéz', 'Tartármártás', 'Nem kérek szószt'],
    toppingPrice: 400,
    saucePrice: 300,
  },
  pricing: { packagingFee: 150, defaultPrepMinutes: 25 },
  delivery: {
    maxKm: 15,
    handoverMinutes: 3,
    trafficFactor: 1.15,
    roadFactor: 1.35,
    fallbackKmh: 45,
    unknownMinutes: 20,
    towns: ['Nagycenk', 'Fertőboz', 'Hidegség', 'Fertőhomok', 'Hegykő', 'Fertőszentmiklós', 'Kópháza', 'Harka', 'Sopron', 'Pinnye', 'Nagylózs', 'Pereszteg', 'Sopronkövesd', 'Ebergőc', 'Csapod', 'Fertőszéplak'],
  },
  sms: {
    mode: 'link',
    ready: 'Kedves {nev}! Elkészült a rendelésed (#{kod}). Várunk: {cim}',
    dispatch: 'Kedves {nev}! A futár elindult a rendeléseddel (#{kod}). Várható érkezés: kb. {erkezes}.',
  },
  rejectReasons: [
    'Sajnos elfogyott valamelyik alapanyag. Hívj minket, és megbeszéljük!',
    'Erre a címre sajnos nem tudunk kiszállítani.',
    'Ma már nem tudunk több rendelést vállalni. Köszönjük a megértést!',
  ],
  updatedAt: 0,
};
