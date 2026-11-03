# Zolgiz Ételbár – online rendelés + admin

Egyetlen Next.js alkalmazás (React frontend + TypeScript backend), Vercelen fut. Nincs külön szerver.

| Oldal | Kinek | Mit tud |
|---|---|---|
| `/` | vásárló | slideshow, **napi ajánlat**, kategóriák, keresés, testreszabás, kosár, elvitel / házhozszállítás a címhez kiszámolt idővel, élő rendeléskövetés |
| `/admin` | személyzet (jelszó) | **Pult** (rendelések: Új → Készül → Kész → Úton, SMS a vevőnek), **Oldal szerkesztő** (a saját oldal, bármire kattintva szerkeszthető), **Napi ajánlat**, **Étlap** (ár, kép, leírás, elfogyott), **Beállítások**, **Forgalom** |

A `/konyha` cím az `/admin`-ra visz.

## 1. Élesítés Vercelen (egyszer kell beállítani)

1. **Jelszó**: Vercel → a projekt → *Settings → Environment Variables* → `ADMIN_PASSWORD` = erős jelszó (ezzel lép be a konyha).
2. **Adatbázis** (rendelések, étlap): *Storage → Create → Upstash for Redis* (ingyenes csomag elég) → *Connect to project*. A szükséges változókat a Vercel magától beállítja.
3. **Képtárhely** (feltöltött fotók): *Storage → Create → Blob* → *Connect to project*.
4. *Deployments → Redeploy*.

Ha a 2. vagy 3. pont hiányzik, az oldal működik, de a módosítások és képek elveszhetnek. Ilyenkor az admin *Beállítások* fülén figyelmeztetés látszik.

> Ha a Vercel a megnyitáskor bejelentkezést kér: *Settings → Deployment Protection → Vercel Authentication → Disabled*, vagy használd a fő `….vercel.app` címet.

## 2. Helyi futtatás

```bash
npm install
npm run dev        # http://localhost:3000  és  http://localhost:3000/admin  (jelszó: konyha)
```

Helyben az adatok a `.data/` mappába kerülnek, semmit nem kell beállítani.

## 3. Hogyan használd az admint

- **Oldal szerkesztő**: balra a saját oldalad, ahogy a vevő látja. Kattints egy pizzára, a slideshow-ra, egy kategória címére, a napi ajánlatra vagy a láblécre, és jobbra megjelenik a szerkesztője (szöveg, ár, kép feltöltése). Gép/telefon nézet között válthatsz.
- A módosítások először csak nálad látszanak. Alul a **Közzététel** gomb teszi ki őket élesbe. Az **Elvetés** visszaállítja az utolsó közzétett állapotot.
- Ami azonnal él, közzététel nélkül: **Elfogyott** kapcsoló, **Nyitva/Zárva**, **Plusz várakozás**, rendelések kezelése.
- **Képek**: telefonról is feltölthetsz bármilyen fotót. A rendszer automatikusan kicsinyíti (nagy kép és kis négyzetes változat).
- **Napi ajánlat**: adott napra vagy hetente ismétlődve (pl. hétköznap). Csak azon a napon látszik, a magyar idő szerint.

## 4. Kiszállítási idő

A cím → koordináta (OpenStreetMap), majd autós útvonal (OSRM) az étterem helyétől. Útidő × forgalmi szorzó + átadás. Ha az útvonaltervező nem elérhető, légvonal × 1,35 / 45 km/h. A `maxKm`-nél messzebbre nem enged rendelni. A számítás a szerveren fut, az eredményt 2 hétig megjegyzi.

## 5. Értesítés a vevőnek

- A vevő oldalán mindig élőben frissül az állapot (csilingel, és rendszerértesítést is kap, ha engedélyezte).
- **SMS** (Beállítások → SMS mód):
  - *link* (alap, ingyenes): a „Kész” / „Átadva a futárnak” gomb a tableten megnyitja az SMS appot kitöltött üzenettel.
  - *Twilio*: teljesen automatikus. Kell hozzá `TWILIO_SID`, `TWILIO_TOKEN`, `TWILIO_FROM` környezeti változó.

## 6. Biztonság

- Az árakat a szerver számolja újra (a böngészőből jövő árnak nem hisz), elfogyott vagy lejárt ajánlatot nem enged megrendelni.
- Az admin csak jelszóval érhető el (HttpOnly süti, 30 nap). Hibás jelszóból 15 percenként legfeljebb 10 próbálkozás lehet.
- Rendelés leadása IP-címenként korlátozott. A vevő a rendelését csak a kitalálhatatlan azonosítóval látja, a telefonszámát nem kapja vissza.
- A feltöltött fájlt a szerver ellenőrzi, hogy valóban kép-e.

## Fájlok

```
app/page.tsx                  vásárlói oldal (szerveren renderelve – Google-barát)
app/admin/                    admin + belépés + szerkesztő előnézet
app/api/                      backend végpontok (rendelés, követés, ETA, admin)
components/site/              a vásárlói oldal React komponensei
components/admin/             admin komponensek (pult, szerkesztők, űrlapok)
lib/seed.ts                   kezdő étlap (első indításkor kerül az adatbázisba)
lib/types.ts                  adatmodell
lib/server/                   adatbázis, jelszó, árazás, útvonalszámítás
```
