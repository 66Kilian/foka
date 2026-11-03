# Zolgiz Ételbár – online rendelés + konyhai felület

Statikus weboldal (HTML/CSS/JS, nincs build), Netlify-ra tehető. Adatbázis: Firebase Firestore.

| Oldal | Kinek | Mit tud |
|---|---|---|
| `/` (index.html) | vásárló | kiemelt pizzák slideshow, kategóriasáv (Népszerű, Pizzák, Húsimádóknak, Szalámis, Húsmentes, Csípős, Hamburgerek, Gyros, Melegszendvicsek, Frissensültek, Üdítők, Desszertek), keresés, testreszabás, kosár, elvitel / házhozszállítás, **a címhez kiszámolt kiszállítási idő**, élő rendeléskövetés |
| `/konyha` (konyha.html) | csak a konyha | belépés, rendelés-tábla (Új → Készül → Kész → Úton), elkészítési idő egy koppintással, visszaszámláló, +5 perc, „Kész”, „Átadva a futárnak”, automatikus értesítés a vevőnek, elutasítás indokkal, visszavonás, étlap-elérhetőség (Elfogyott), nyitva/zárva, plusz várakozás, mai összesítő |

## 1. Kipróbálás most (DEMÓ mód)

Amíg a `js/config.js`-ben `firebase: null`, az oldal demó módban fut: a rendelések csak az adott böngészőben vannak.

```bash
cd "fofo etterme"
python3 -m http.server 8765
```

- Vásárlói oldal: http://localhost:8765/
- Konyha (másik fülön): http://localhost:8765/konyha.html (jelszó: `konyha`)

Adj le egy rendelést, és a konyhai fülön fogadd el. A vásárlói fül élőben frissül.

## 2. Élesítés Firebase-zel

1. https://console.firebase.google.com → **Új projekt** (ne a régi `zolgizetelbar01`-et használd, annak nyitott az adatbázisa).
2. **Firestore Database** → Create database (régió: `europe-central2`).
3. **Rules** fül → másold be a `firestore.rules` tartalmát → Publish.
4. **Authentication** → Sign-in method → **Email/Password** bekapcsolása.
   - Settings → User actions → **„Enable create (sign-up)” KIKAPCSOLÁSA** (így senki nem regisztrálhat magának fiókot).
   - Users → Add user: pl. `konyha@zolgiz.hu` + erős jelszó.
5. **Firestore** → Start collection: `staff` → Document ID = a felhasználó **UID**-ja (Authentication → Users listából) → mező: `name: "Konyha"`.
   Csak az léphet be a konyhába, akinek itt van dokumentuma.
6. Project settings → Your apps → Web app (`</>`) → a `firebaseConfig` objektumot másold a `js/config.js` → `firebase:` helyére.

## 3. Értesítések a vevőnek

- **Mindig megy (ingyen):** a vevő böngészőjében élőben változik a blokk, csilingel, és rendszer-értesítést kap, ha engedélyezte.
- **SMS** (`js/config.js` → `smsMode`):
  - `'link'` (alap): a „Kész” / „Átadva a futárnak” gomb a konyhai telefonon/tableten megnyitja az SMS appot kitöltött szöveggel, csak a Küldésre kell nyomni. Ugyanez volt a régi oldalon is.
  - `'twilio'`: **teljesen automatikus** SMS a `netlify/functions/send-sms.mjs`-sel. Kell hozzá Twilio fiók (SMS-enként kb. 30–40 Ft), és Netlifyn ezek a környezeti változók: `FIREBASE_API_KEY`, `STAFF_EMAILS`, `TWILIO_SID`, `TWILIO_TOKEN`, `TWILIO_FROM`.
  - `'off'`: nincs SMS.

## 4. Hogyan számolja a kiszállítási időt?

1. A vevő címét (település + utca, házszám) az OpenStreetMap (Nominatim) koordinátává alakítja.
2. Az OSRM útvonaltervező kiszámolja a valódi autós utat az étteremtől (Soproni u. 1.).
3. Útidő × 1,15 + 3 perc átadás (`config.js` → `delivery`).
4. Ha az útvonaltervező nem érhető el: légvonal × 1,35, 45 km/h átlaggal.
5. Ha a cím messzebb van, mint `maxKm` (most 15 km, **egyeztetendő**), nem engedi leadni.

A vevő a pénztárnál ezt látja: „4,1 km · kb. 12 perc út – várható érkezés kb. 37 perc múlva”.
Amikor a konyha megnyomja az „Átadva a futárnak” gombot, az érkezés = most + útidő. Ez megy ki az SMS-ben és a vevő oldalán is.

> Az OSM ingyenes szolgáltatásai kis forgalomra valók (pár rendelés/perc rendben van). Nagy forgalomnál érdemes saját kulcsos szolgáltatásra váltani.

## 5. Amit az étteremmel egyeztetni kell

- **Üdítők és desszertek**: a régi oldalon nem voltak. A `js/menu.js`-ben `draft: true` jelölésű tételek (Coca-Cola, limonádé, ásványvíz, brownie, fagylaltkehely) csak **minták**, a termékeket és az árakat cserélni kell.
- **Képek**: illusztrációk (Unsplash, szabadon használható). Ha van saját fotó, tedd az `images/` mappába, és írd át a `js/menu.js` tetején az `IMG` listát.
- **„Húsmentes” kategória**: vegetáriánus pizzák, sajtot tartalmaznak. Vegán étel nincs az étlapon, ezért nem írtuk ki, hogy „vegán”.
- Kiszállítási terület (`maxKm`), alap elkészítési idő (`defaultPrepMinutes`), települések listája.

## 6. Feltöltés Netlifyra

A teljes mappát húzd be a Netlify „Deploys” oldalára (drag & drop), vagy kösd GitHubhoz. A `netlify.toml` beállítja a biztonsági fejléceket, a konyhai oldal kitiltását a keresőkből, és az `/admin` → `/konyha` átirányítást.

## Fájlok

```
index.html, konyha.html     oldalak
css/site.css, kitchen.css   dizájn
js/config.js                ← BEÁLLÍTÁSOK (telefon, árak, Firebase, SMS mód)
js/menu.js                  ← ÉTLAP (termékek, árak, képek, kategóriák)
js/site.js                  vásárlói logika
js/kitchen.js               konyhai logika
js/store.js                 adatbázis (Firebase / demó)
js/eta.js                   kiszállítási idő számítás
firestore.rules             adatbázis-védelem
netlify/functions/send-sms.mjs   automatikus SMS (opcionális)
```
