# Gatterka szabálytár

Ez a fejlesztések kötelező kiindulópontja. Célja, hogy egy hibajavítás közben ne változzon meg a tulajdonos által már elfogadott másik működés. A szabálytár hivatkozásokat és változtatási rendet tartalmaz; nem hoz létre a részletes szabályzatokkal párhuzamos, eltérő szabálymásolatot.

## Hol találhatók a szabályok?

| Téma | Elsődleges forrás |
| --- | --- |
| Fejlesztési kötelezettségek | [AGENTS.md](../../AGENTS.md) |
| Gépi vágási sorrend, xMix/xPrg, Windows mentés, archív visszaállítások | [Fix fejlesztési szabályok](../../GATTERKA_FIX_FEJLESZTESI_SZABALYOK.txt) |
| Bútortervező, hátfal, polcok, osztók, méretek, élzárás, reszelés, CNC, 3MF és kezelés | [Aktuális funkcionális szabályok](../../GATTERKA_AKTUALIS_SZABALYOK.txt) |
| Eredeti CNC komponensek, makróparaméterek és minták | [CNC makrómintatár](../cnc-makromintak/README.md) |
| Védett működés automatikus ellenőrzése | [Gépi invariánsok tesztje](../../tests/locked-machine-invariants.test.cjs) |
| Korábbi szabályzatok és állapotok | [Archívum](../archivum/) és a fix szabályzatban megnevezett Git-ágak |
| Új döntések, elvégzett és még hátralévő feladatok elkülönítése | [Döntésnapló](DONTESNAPLO.md) |

## Módosítás előtt

1. El kell olvasni ezt az útmutatót, az AGENTS.md-t és a két gyökérszintű szabályzatot. CNC esetén az érintett eredeti makrómintát is.
2. Pontosan meg kell határozni, mit kért a tulajdonos, és mely működés változására adott felhatalmazást. A kéréshez szükséges javítás elvégezhető; a kapcsolódó, de nem kért működés átformálása nem.
3. A szabályoknál a dátumot és a későbbi, kifejezett felülírást is ellenőrizni kell. Történeti bejegyzést nem szabad mai előírásként visszaállítani. Például a korábbi munkalapos kísérleteket a 2026-11-04-i „VÉGLEG CSAK BÚTORLAP-SZABÁS” döntés felülírta.
4. Ha a kérés egy meglévő szabályt egyértelműen módosít, ezt az új döntést és annak pontos hatókörét rögzíteni kell. Ha az ütközés feloldása nem egyértelmű, az érintett részt a tulajdonossal tisztázni kell a módosítása előtt. Már megadott felhatalmazást nem kell újra bekérni.
5. A vágási sorrend, xMix/xPrg és Windows mentés változtatásához külön, kifejezetten ezekre vonatkozó tulajdonosi utasítás és az előző állapot archiválása szükséges. CNC-fúrás javítása önmagában nem engedélyezi ezek módosítását. A védőtesztet nem szabad a védelem megkerülésére átírni.

## Módosítás átadásakor

- Az új vagy módosított funkcionális szabály az érintett változtatással együtt kerüljön az aktuális szabályzatba; a felülírt rész egyértelműen legyen megjelölve. A gépi szabályok változását a fix szabályzatban is vezetni kell.
- A döntésnaplóban külön szerepeljen az egyeztetett kérés, a megvalósítás és az ellenőrzés állapota. A szabály leírása vagy egy minta feltöltése még nem kész funkció.
- A tényleges változás maradjon a kért hatókörben. Az átadás nevezze meg a változást, az ellenőrzést és a hátralévő korlátokat. A gépi próba hiánya nem tüntethető el sikeres szoftverteszttel.
- A kötelező ellenőrzéseket el kell végezni. Dokumentációs változtatás nem indokolja az alkalmazás vagy a védőtesztek átírását.

A szabálytár és az AGENTS.md fejlesztési előírás; önmagában nem technikai írásvédelem. A meglévő védőteszt a rögzített gépi kódrészek eltérését ellenőrzi, a teljes kérési hatókört emberi áttekintéssel is ellenőrizni kell.
