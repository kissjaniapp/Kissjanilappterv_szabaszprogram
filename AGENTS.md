# Gatterka: kötelező fejlesztési szabályok

A fejlesztések megkezdése előtt olvasd el a gyökérben található `GATTERKA_FIX_FEJLESZTESI_SZABALYOK.txt` fájlt, és tartsd be minden pontját.

**Kiemelten védett:** a már rögzített gépi vágási sorrend és az xMix/xPrg export/Windows mentés. Kifejezett tulajdonosi utasítás nélkül egyiket sem szabad módosítani. A védelmet a `tests/locked-machine-invariants.test.cjs` teszt ellenőrzi; ezt nem szabad a védelem megkerülésére átírni.

## Jóváhagyott vágási logika (2026-11-03)

A tulajdonos kifejezetten jóváhagyta az új csíkozási/szabási szabályt. Az új szabályok a
`GATTERKA_FIX_FEJLESZTESI_SZABALYOK.txt` fájlban vannak, és mostantól FIXEK.
A csíkokat az első menet után 90°-kal el kell fordítani, a kisebb/maradék táblán
és a visszaforgatott csíkon az alkatrészeket felülre kell igazítani, az első
vágás az alsó alkatrész alatt történik; a teljes nagytábla régi számítása marad.

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
