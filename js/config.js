// ============================================================
//  ZOLGIZ ÉTELBÁR – BEÁLLÍTÁSOK
//  Minden, amit az étterem tulajdonosa módosíthat, itt van.
// ============================================================

export const CONFIG = {
  name: 'Zolgiz Ételbár',
  town: 'Nagycenk',
  address: '9485 Nagycenk, Soproni utca 1.',
  phone: '+36 99 359 902',
  phoneHref: '+3699359902',
  facebook: 'https://www.facebook.com/share/1ELrtrQwDe/?mibextid=wwXIfr',

  // Az étterem pontos helye (OpenStreetMap szerint: Soproni utca 1.)
  restaurant: { lat: 47.604695, lng: 16.697378 },

  // Árak
  packagingFee: 150,
  extraToppingPrice: 400,
  extraSaucePrice: 300,

  // Alap elkészítési idő, amit a vásárló lát, amíg a konyha vissza nem igazol (perc)
  defaultPrepMinutes: 25,

  // Kiszállítás
  delivery: {
    maxKm: 15,            // EGYEZTETENDŐ: meddig szállítotok ki (útvonal km)
    handoverMinutes: 3,   // parkolás + átadás a címen
    trafficFactor: 1.15,  // az útvonaltervező idejét ennyivel szorozzuk (falusi utak, megállás)
    roadFactor: 1.35,     // tartalék becslés: légvonal × ennyi = útvonal
    fallbackKmh: 45,      // tartalék becslés átlagsebessége
    unknownMinutes: 20,   // ha a címet egyáltalán nem találjuk
  },

  // Környékbeli települések a címmezőhöz (szabadon bővíthető)
  towns: ['Nagycenk', 'Fertőboz', 'Hidegség', 'Fertőhomok', 'Hegykő', 'Fertőszentmiklós', 'Kópháza',
    'Harka', 'Sopron', 'Pinnye', 'Nagylózs', 'Pereszteg', 'Sopronkövesd', 'Ebergőc', 'Csapod', 'Fertőszéplak'],

  // SMS mód a konyhán:
  //  'link'   – a gomb megnyitja a tablet/telefon SMS appját kitöltött üzenettel (mint az eredeti oldalon)
  //  'twilio' – teljesen automatikus küldés a netlify/functions/send-sms.mjs függvénnyel (README)
  //  'off'    – csak az oldalon belüli értesítés (a vásárló böngészőjében élőben megjelenik)
  smsMode: 'link',

  // FIREBASE – illeszd be ide a Firebase projekt beállításait (README).
  // Amíg null, az oldal DEMÓ módban fut: a rendelések csak ebben a böngészőben,
  // a vásárlói és a konyhai fül között utaznak (teszteléshez tökéletes).
  firebase: null,
  // firebase: {
  //   apiKey: '...',
  //   authDomain: '....firebaseapp.com',
  //   projectId: '...',
  //   appId: '...',
  // },

  // Csak DEMÓ módban: konyhai jelszó. Éles módban Firebase felhasználó (email + jelszó) kell.
  demoKitchenPassword: 'konyha',
};
