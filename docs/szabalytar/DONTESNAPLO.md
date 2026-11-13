# Gatterka döntésnapló

## 2026-11-13 – Sarkokra illeszkedő lapvég, látható pontok nélkül

A tulajdonos pontosította: a lapvég húzáskor a másik lap közeli vagy túlsó
sarkára illeszkedjen; a narancssárga pontok ne jelenjenek meg. A kijelölt
lap hossza és végeinek túlnyúlása számmal szerkeszthető. A megvalósítás
közeli csatlakozó lapélekhez illeszt, a végén átlátszó húzófelületet használ.
Az első véget a pontos hossz megadása megtartja. F/V geometriai teszt készült.

## 2026-11-13 – Lapvégek szabad hosszabbítása

A tulajdonos kéri, hogy a narancssárga fogantyú az eredeti belméreten túl,
akár a másik lap túlsó éléig is húzható legyen. Az előjeles végpontérték
a rajz, méretszámítás és mentés része; csak a nem pozitív hossz tiltott.
Ez a végpontkorlátot módosítja, nem az egész lap mozgatásának határait.

## 2026-11-13 – F/V betűre kattintás utáni szakaszállapot

A tulajdonos két képernyőképen jelezte: a kapcsolási irány váltása más
rekeszre helyezi a kivett szakaszt. A virtuális és fizikai szakaszok eltérő
számozását váltáskor össze kell rendelni; a kivétel és eltolás helye maradjon.
A javítás az F/V betű kattintáskezelőjét és a hozzá tartozó állapotát érinti.
A gépi szabáskód változatlan. Kétirányú állapotmegőrzési regressziós teszt készült.

A 2026-11-13. előtti részletes döntések a [fix](../../GATTERKA_FIX_FEJLESZTESI_SZABALYOK.txt) és az [aktuális](../../GATTERKA_AKTUALIS_SZABALYOK.txt) szabályzat dátumozott részeiben maradnak. Ez a napló nem helyettesíti őket.

## 2026-11-13 – Makróminták tartós megőrzése

- Kérés: a tulajdonos átadott KOMPONENSEK.zip állományát a GitHub-projekt őrizze meg a későbbi CNC-fejlesztésekhez.
- Megvalósítás: eredeti ZIP és PGM fájlok, kereshető kivonatok, ellenőrzőösszegek és kötelező AGENTS.md-hivatkozás elkészült a `docs/cnc-makromintak/` mappában.
- GitHub commit: `9fc67df38520cd3c75638eca6ac914e251c21c70`.
- Ellenőrzés: az öt meglévő gépi védőteszt sikeres. Ez a commit nem módosítja a CNC-generálás működését.

## 2026-11-13 – Szabálytár és a kérés hatókörének védelme

- Kérés: a korábbi szabályok legyenek könnyen visszakereshetők; ne történjen nem kért működésváltoztatás.
- Megvalósítás: központi szabálytár, forrásjegyzék, kötelező változtatási rend és döntésnapló. Az AGENTS.md és az aktuális funkcionális szabályzat erre hivatkozik.
- Hatókör: kizárólag dokumentáció; meglévő működési szabályt és alkalmazáskódot nem változtat meg.

## Korábban kért CNC-javítások – még hátralévő megvalósítás

Az alábbi tulajdonosi kérések rögzítése nem jelenti a javítások elkészültét:

- Fenék: felső lap felől kezdés az F-osztók lapfurataival; összehúzós kötésnél utána fordítás és élfuratok. Csavaros vagy csak tiplis kötésnél a felső lap felől történhet minden.
- Tető: mindig az alsó lappal kezdődik a megmunkálás. A már helyesen számított F-osztó-pozíciókat meg kell őrizni.
- Fenék: az F-osztó lapfuratainak X-koordinátája DX-ből visszaszámítva, tükrözve készül.
- A beállított falc makrója a fenék és a tető programjából sem maradhat ki. Az eredeti FALC.pgm mintában a pontos makrónév XFALC.
- Ki kell javítani a többi alkatrész indokolatlan kimaradását a bútortervező CNC-exportjából.

Ezek a kérések a CNC-export javítására adnak felhatalmazást; a védett szabászgépi vágási sorrend, xMix/xPrg és Windows mentés módosítására nem.

## Új bejegyzés kötelező adatai

Dátum; a tulajdonos kérése és forrása (csevegés vagy hivatkozás); pontos hatókör; az érintett szabályzat és esetleges felülírt rendelkezés; megvalósítás állapota; commit/PR; ellenőrzés és még szükséges gépi próba. Új döntést csak tényleges tulajdonosi kérés alapján szabad bejegyezni.
