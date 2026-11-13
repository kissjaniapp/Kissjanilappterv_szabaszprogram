# Gatterka: kötelező fejlesztési szabályok

CNC-fejlesztés előtt kötelező elolvasni a `docs/cnc-makromintak/README.md` fájlt és az érintett eredeti makrómintát. A tulajdonosi minták tartósan a `docs/cnc-makromintak/` mappában vannak; hiányzó mintaként nem szabad újra bekérni őket e mappa ellenőrzése nélkül.

A fejlesztések megkezdése előtt olvasd el a gyökérben található `GATTERKA_FIX_FEJLESZTESI_SZABALYOK.txt` fájlt, és tartsd be minden pontját.

Olvasd el a `GATTERKA_AKTUALIS_SZABALYOK.txt` fájlt is, és a megállapodott új vagy módosított funkcionális szabályokat az érintett változtatással együtt vezesd át rajta. Ha egy új kérés rögzített szabállyal ütközik, jelezd a tulajdonosnak és tisztázzátok az új szabályt vagy kivételt az ütköző rész megváltoztatása előtt.

**Kiemelten védett:** a már rögzített gépi vágási sorrend és az xMix/xPrg export/Windows mentés. Kifejezett tulajdonosi utasítás nélkül egyiket sem szabad módosítani. A védelmet a `tests/locked-machine-invariants.test.cjs` teszt ellenőrzi; ezt nem szabad a védelem megkerülésére átírni.

## Jóváhagyott vágási logika (2026-11-03)

A tulajdonos kifejezetten jóváhagyta az új csíkozási/szabási szabályt. Az új szabályok a
`GATTERKA_FIX_FEJLESZTESI_SZABALYOK.txt` fájlban vannak, és mostantól FIXEK.
A csíkokat az első menet után 90°-kal el kell fordítani, a kisebb/maradék táblán
és a visszaforgatott csíkon az alkatrészeket felülre kell igazítani, az első
vágás az alsó alkatrész alatt történik; a teljes nagytábla régi számítása csak akkor marad, ha a tábla
közel teljesen foglalt; kevés alkatrésznél a nagy tábla is
felülre igazítva, az alsó csík alatt kezdődik.

A korábbi teljes kód az `archive/legacy-cutting-logic-before-20261103` ágban,
az eredeti szabályfájl és ellenőrző teszt pedig a
`docs/archivum/2026-11-03-regi-vagasi-logika/` mappában található.

A `tests/locked-machine-invariants.test.cjs` a kifejezetten engedélyezett
módosítást követően már az ÚJ kód ujjlenyomatait védi; a régi ujjlenyomatok
az archív tesztben olvashatók. Ne változtasd meg egyik szabályt vagy ujjlenyomatot
sem újabb kifejezett jóváhagyás és előzetes verzióarchiválás nélkül.
A tényleges xPrg gépi próbavágás szükséges, tesztfuttatás önmagában nem elegendő.

## 2026-11-03 – a szabástérkép jóváhagyott tisztítása

A felhasználó csak a fő táblarajzot kéri: a második menet alsó
miniábrái és az alsó „Tábla anyaga” sor törölve. A 38 mm-es
munkalap fő rajzán kötelező a vízszintes „1. VÁGÁS” és a
kiinduló 4100 × 600/900 × 38 mm munkalapméret fejlécben.
Ez csak megjelenítés; minden gépi, kétmenetes végigvágási és
xMix/xPrg előállítási szabály FIX, továbbra is változatlan.
Az előző megjelenítés visszaállítható az
`archive/before-board-map-cleanup-20261103` GitHub-ágon.
A megjelenítés aktuális ujjlenyomata: `bffa3920`.

## 2026-11-03 – nagytábla, teljes vágásszámozás, munkalap xPrg

Új tulajdonosi utasítás: a nagytábla kevés alkatrész esetén is a felső
résztől indul, első vágás az alsó csík alatt. A FŐ szabásztérkép
MINDEN vágás sorszámát jelöli, a 90°-os csíkok második menetét
számozott jelvényként, függőleges gépi vonal nélkül.
A munkalap P és Lunghezza = 600/900 mm, Larghezza = 4100 mm
(az adott 38 mm munkalap tényleges keresztvágási szélessége),
a bútorlapok megszokott x/y fejléc-logikája változatlan.
Rögzített kód-ujjlenyomatok: finalize 4a440a8d,
termelési sorrend afa801b9, xPrg 2dd57d75,
Windows Mentés másként f49fe3b5, SVG 86d21042.
A teljes megelőző verzió visszaállítható innen:
`archive/before-full-sheet-top-align-and-cut-numbers-20261103`.
Az összes eredeti szabály és teszt külön txt archiválva:
`docs/archivum/2026-11-03-teljes-tabla-felso-igazitasa-elott/`.
Újabb gépi változtatás csak kifejezett engedéllyel és új archívummal.
Valódi CNC próbaszabás nélkül az új RY/RX/P értékek nem tekinthetők
fizikailag hitelesítettnek.
