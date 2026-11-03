import { CONFIG } from './config.js';

// Képek: images/<id>-s.webp (kártya) és images/<id>-l.webp (nagy)
const IMG = {
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

export const imgSmall = (k) => (k ? `images/${IMG[k]}-s.webp` : '');
export const imgLarge = (k) => (k ? `images/${IMG[k]}-l.webp` : '');

// kind: pizza | dish | fried | side | drink | dessert
// tags: popular, meat, salami, veg, spicy
// draft: true → a termék/ár NEM az eredeti étlapról van, egyeztetni kell az étteremmel!
export const MENU = [
  // ---- Pizzák (32 cm)
  { id: 1, no: 1, cat: 'pizza', kind: 'pizza', name: 'Margherita', desc: 'paradicsomos alap, sajt, oregánó', price: 1650, img: 'margherita', tags: ['popular', 'veg'] },
  { id: 2, no: 2, cat: 'pizza', kind: 'pizza', name: 'Prosciutto', desc: 'paradicsomos alap, sonka, sajt', price: 1850, img: 'prosciutto', tags: [] },
  { id: 3, no: 3, cat: 'pizza', kind: 'pizza', name: 'Hawaii', desc: 'paradicsomos alap, sonka, ananász, kukorica, sajt', price: 2050, img: 'hawaii', tags: ['popular'] },
  { id: 4, no: 4, cat: 'pizza', kind: 'pizza', name: 'Húsimádó', desc: 'paradicsomos alap, bacon, füstölt tarja, szalámi, hagymás sajt', price: 2190, img: 'husimado', tags: ['popular', 'meat', 'salami'] },
  { id: 5, no: 5, cat: 'pizza', kind: 'pizza', name: 'Szalámis', desc: 'paradicsomos alap, szalámi, hagyma, sajt', price: 2050, img: 'szalamis', tags: ['popular', 'salami'] },
  { id: 6, no: 6, cat: 'pizza', kind: 'pizza', name: 'Piedone', desc: 'paradicsomos alap, bacon, bab, hagyma, sajt', price: 2050, img: 'piedone', tags: ['meat'] },
  { id: 7, no: 7, cat: 'pizza', kind: 'pizza', name: 'Magyaros', desc: 'paradicsomos alap, bacon, kolbász, hagyma, tv paprika, sajt', price: 2190, img: 'magyaros', tags: ['meat'] },
  { id: 8, no: 8, cat: 'pizza', kind: 'pizza', name: 'Tonhalas', desc: 'paradicsomos alap, tonhal, lilahagyma, sajt', price: 2190, img: 'tonhalas', tags: [] },
  { id: 9, no: 9, cat: 'pizza', kind: 'pizza', name: 'Calzone', desc: 'paradicsomos alap, szalámi, gomba, főtt tojás, sajt', price: 2050, img: 'calzone', tags: ['salami'] },
  { id: 10, no: 10, cat: 'pizza', kind: 'pizza', name: 'Vegetariana', desc: 'paradicsomos alap, kukorica, gomba, brokkoli, pfefferoni, sajt', price: 2090, img: 'vega', tags: ['veg'] },
  { id: 11, no: 11, cat: 'pizza', kind: 'pizza', name: 'Négysajtos', desc: 'paradicsomos alap, camembert, füstölt sajt, márványsajt, pannónia sajt', price: 2190, img: 'negysajtos', tags: ['popular', 'veg'] },
  { id: 12, no: 12, cat: 'pizza', kind: 'pizza', name: 'Massimo', desc: 'paradicsomos alap, sonka, tarja, bacon, kolbász, szalámi, hagyma, főtt tojás, sajt', price: 2190, img: 'massimo', tags: ['meat', 'salami'] },
  { id: 13, no: 13, cat: 'pizza', kind: 'pizza', name: 'Songoku', desc: 'paradicsomos alap, sonka, gomba, kukorica, sajt', price: 2050, img: 'prosciutto', tags: [] },
  { id: 14, no: 14, cat: 'pizza', kind: 'pizza', name: 'Bolognai', desc: 'paradicsomos alap, bolognai szósz, sajt', price: 2150, img: 'piedone', tags: ['meat'] },
  { id: 15, no: 15, cat: 'pizza', kind: 'pizza', name: 'Spenótos-fetás', desc: 'paradicsomos alap, spenót, feta sajt, sajt', price: 2150, img: 'spenotos', tags: ['veg'] },
  { id: 16, no: 16, cat: 'pizza', kind: 'pizza', name: 'Négy évszak', desc: 'paradicsomos alap, sonka, szalámi, gomba, tonhal, sajt', price: 2190, img: 'negyevszak', tags: ['salami'] },
  { id: 17, no: 17, cat: 'pizza', kind: 'pizza', name: 'Inferno', desc: 'paradicsomos alap, sonka, tabasco, sajt', price: 2050, img: 'inferno', tags: ['spicy'] },

  // ---- Hamburgerek
  { id: 18, cat: 'burger', kind: 'dish', name: 'Sima burger', desc: 'marhahúspogácsa, zöldségek, szósz', price: 1200, img: 'burger2', tags: [] },
  { id: 19, cat: 'burger', kind: 'dish', name: 'Sajtos burger', desc: 'marhahúspogácsa, sajt, zöldségek', price: 1400, img: 'burger2', tags: [] },
  { id: 20, cat: 'burger', kind: 'dish', name: 'Baconos burger', desc: 'marhahúspogácsa, bacon, sajt, zöldségek', price: 1500, img: 'burgers', tags: ['popular', 'meat'] },
  { id: 21, cat: 'burger', kind: 'dish', name: 'Dupla húsos burger', desc: '2× marhahúspogácsa, sajt, zöldségek', price: 1500, img: 'burger1', tags: ['meat'] },
  { id: 22, cat: 'burger', kind: 'dish', name: 'Hambi Box', desc: 'burger, hasábburgonya, üdítő', price: 2050, img: 'burgerbox', tags: [] },

  // ---- Gyros
  { id: 23, cat: 'gyros', kind: 'dish', name: 'Gyrostál', desc: 'gyroshús, fűszeres burgonya, saláta, öntet', price: 1890, img: 'gyrostal', tags: ['popular'] },
  { id: 24, cat: 'gyros', kind: 'dish', name: 'Dupla húsos gyrostál', desc: 'extra gyroshús, burgonya, saláta', price: 2290, img: 'gyrostal', tags: ['meat'] },
  { id: 25, cat: 'gyros', kind: 'dish', name: 'Gyros pita', desc: 'pitában gyroshús, zöldségek, öntet', price: 1790, img: 'pita', tags: [] },

  // ---- Melegszendvicsek
  { id: 26, cat: 'toast', kind: 'dish', name: 'Sonkás melegszendvics', desc: 'sonka, sajt, vaj', price: 1200, img: 'toast', tags: [] },
  { id: 27, cat: 'toast', kind: 'dish', name: 'Szalámis melegszendvics', desc: 'szalámi, sajt', price: 1200, img: 'toast', tags: [] },
  { id: 28, cat: 'toast', kind: 'dish', name: 'Gombás melegszendvics', desc: 'gomba, sajt', price: 1200, img: 'toast', tags: ['veg'] },
  { id: 29, cat: 'toast', kind: 'dish', name: 'Sonka-gomba melegszendvics', desc: 'sonka, gomba, sajt', price: 1400, img: 'toast', tags: [] },
  { id: 30, cat: 'toast', kind: 'dish', name: 'Magyaros melegszendvics', desc: 'kolbász, hagyma, sajt', price: 1400, img: 'toast', tags: [] },

  // ---- Frissensültek & köretek
  { id: 31, cat: 'fried', kind: 'fried', name: 'Rántott sajt / gomba / csirke / karaj', desc: 'választható körettel és szósszal', price: 1640, img: 'rantott', tags: ['popular'] },
  { id: 32, cat: 'fried', kind: 'fried', name: 'Kijevi csirke', desc: 'fűszeres vajjal töltve, körettel és szósszal', price: 1940, img: 'rantott', tags: [] },
  { id: 33, cat: 'fried', kind: 'fried', name: 'Gordon csirke / karaj', desc: 'sonkával és sajttal töltve, körettel és szósszal', price: 1940, img: 'steak', tags: [] },
  { id: 34, cat: 'fried', kind: 'fried', name: 'Csirkeszárny körettel', desc: 'fűszeres szárnyak, köret és szósz', price: 2590, img: 'rantott', tags: ['meat'] },
  { id: 35, cat: 'fried', kind: 'side', name: 'Hasábburgonya / rizs', desc: 'külön köret', price: 800, img: 'fries', tags: [] },

  // ---- Üdítők  (draft: az eredeti oldalon nem szerepeltek – termékek és árak egyeztetendők!)
  { id: 101, cat: 'drink', kind: 'drink', name: 'Coca-Cola 0,33 l', desc: 'dobozos', price: 590, img: 'cola', tags: [], draft: true },
  { id: 102, cat: 'drink', kind: 'drink', name: 'Coca-Cola Zero 0,33 l', desc: 'dobozos, cukormentes', price: 590, img: 'colazero', tags: [], draft: true },
  { id: 103, cat: 'drink', kind: 'drink', name: 'Házi limonádé 0,5 l', desc: 'citrom, menta', price: 790, img: 'limonade', tags: [], draft: true },
  { id: 104, cat: 'drink', kind: 'drink', name: 'Ásványvíz 0,5 l', desc: 'szénsavas vagy mentes', price: 390, img: null, tags: [], draft: true },

  // ---- Desszertek (draft)
  { id: 111, cat: 'dessert', kind: 'dessert', name: 'Csokis brownie', desc: 'étcsokoládés, szaftos', price: 890, img: 'brownie', tags: [], draft: true },
  { id: 112, cat: 'dessert', kind: 'dessert', name: 'Fagylaltkehely', desc: 'csokiöntettel, tejszínhabbal', price: 1190, img: 'kehely', tags: [], draft: true },
];

export const byId = new Map(MENU.map((i) => [i.id, i]));

export const EXTRA_TOPPINGS = ['Kéksajt', 'Füstölt sajt', 'Olíva', 'Kolbász', 'Tarja', 'Brokkoli', 'Erős paprika', 'Főtt tojás', 'Kukorica', 'Fokhagyma', 'Ananász', 'Bacon', 'Gomba', 'Sonka', 'Szalámi'];
export const EXTRA_SAUCES = ['Ketchup', 'Majonéz', 'Tartármártás', 'Fokhagymás öntet'];
export const FREE_SIDES = ['Hasábburgonya', 'Rizs', 'Vegyes köret (rizs + hasáb)'];
export const FREE_SAUCES = ['Ketchup', 'Majonéz', 'Tartármártás', 'Nem kérek szószt'];

// A vásárlói oldal szekciói (Wolt-szerű kategóriasáv)
export const SECTIONS = [
  { id: 'nepszeru', title: 'Népszerű', filter: (i) => i.tags.includes('popular') },
  { id: 'pizzak', title: 'Pizzák', sub: '32 cm, kemencés tészta, paradicsomos alap', filter: (i) => i.cat === 'pizza' },
  { id: 'husimado', title: 'Húsimádóknak', sub: 'Bacon, tarja, kolbász – sok hús', filter: (i) => i.cat === 'pizza' && i.tags.includes('meat') },
  { id: 'szalamis', title: 'Szalámis', filter: (i) => i.cat === 'pizza' && i.tags.includes('salami') },
  { id: 'husmentes', title: 'Húsmentes', sub: 'Vegetáriánus – tejterméket (sajtot) tartalmaznak', filter: (i) => i.tags.includes('veg') },
  { id: 'csipos', title: 'Csípős', filter: (i) => i.tags.includes('spicy') },
  { id: 'hamburgerek', title: 'Hamburgerek', filter: (i) => i.cat === 'burger' },
  { id: 'gyros', title: 'Gyros', filter: (i) => i.cat === 'gyros' },
  { id: 'melegszendvicsek', title: 'Melegszendvicsek', filter: (i) => i.cat === 'toast' },
  { id: 'frissensultek', title: 'Frissensültek', sub: 'A köret és a szósz az árban benne van', filter: (i) => i.cat === 'fried' },
  { id: 'uditok', title: 'Üdítők', filter: (i) => i.cat === 'drink' },
  { id: 'desszertek', title: 'Desszertek', filter: (i) => i.cat === 'dessert' },
];

export const HERO_IDS = [4, 1, 15, 5, 11, 17];

// Milyen opciók járnak egy termékhez
export function optionsFor(item) {
  return {
    toppings: item.kind === 'pizza',
    sauces: ['pizza', 'dish', 'fried', 'side'].includes(item.kind),
    freeChoice: item.kind === 'fried',
    removable: ['pizza', 'dish', 'fried'].includes(item.kind),
  };
}

export function ingredients(item) {
  return item.desc.split(',').map((s) => s.trim()).filter((s) => s && !/választható|körettel|külön/.test(s));
}

export function unitPrice(item, line) {
  return item.price + (line.extras?.length || 0) * CONFIG.extraToppingPrice + (line.sauces?.length || 0) * CONFIG.extraSaucePrice;
}

// Konyhai ellenőrzés: a beküldött végösszeg egyezik-e az étlap árával
export function expectedTotal(items) {
  let sum = 0;
  for (const line of items || []) {
    const item = byId.get(line.id);
    if (!item) return null;
    sum += unitPrice(item, line) * line.qty;
  }
  return sum + (items?.length ? CONFIG.packagingFee : 0);
}
