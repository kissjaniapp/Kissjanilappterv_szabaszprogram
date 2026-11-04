'use strict';
// A 2026-11-03-án engedélyezett ÚJ gépi szabály rögzített ujjlenyomatai.
// Az EREDETI teszt és régi kód archiválva: docs/archivum/2026-11-03-regi-vagasi-logika/
// A korábbi négy ujjlenyomat közül a két engedélyezetten módosított blokk új értéket kapott.
// A 2026-11-03-i külön képi tisztítás is jóváhagyott:
// archivált előző rajzi kód: archive/before-board-map-cleanup-20261103
// Az új SVG/PNG ujjlenyomat a miniábrák nélküli FŐ szabásztérképet védi.
// Újabb, kifejezetten jóváhagyott módosítás 2026-11-03: a kevés alkatrészes
// NAGYTÁBLA is felülre igazodik, minden vágás sorszáma látható, a munkalap
// xPrg-fejléce a tényleges 600/900 mm keresztvágási hosszhoz igazodik.
// Visszaállítás: archive/before-full-sheet-top-align-and-cut-numbers-20261103
// A régi ujjelnyomatok az archivált szöveges tesztfájlban megmaradtak.
// 2026-11-03: a tulajdonos új utasítására a 38 mm-es munkalap XPRG parancsait
// a fő szabástérképen ténylegesen szereplő keresztvágásokhoz igazítottuk.
// A normál bútorlapok exportja, a fizikai geometria és a Windows mentés FIX.
// 2026-11-03: a tulajdonos a munkalap külön RY/Y szabályát visszavonta.
// A 38 mm munkalapra is a 18 mm bútorlap eredeti kétmenetes
// P → RY → Y → RX → X → F logikáját alkalmazzuk, külön ciklus nélkül.
// A munkalap a teljes 600/900 mm szélességét megőrzi, U nélkül.
// A bútorlapok és a Windows mentési rutin kódja változatlan.
// 2026-11-03: új engedély csak a munkalap XPRG-fejléc/P
// bútorlapos méretirányának visszaállítására: x feed -> 4100/600 vagy 4100/900.
// A finalize (1e0ac4b9), gyártási sorrend (afa801b9), SVG (86d21042)
// és Mentés másként (f49fe3b5) ujjlenyomata változatlanul FIX.
// Archívum: archive/locked-good-cut-order-before-worktop-xprg-header-20261103
// Visszaállítás: archive/before-unified-worktop-board-cutting-20261103
// 2026-11-03: a gépi XPRG-t a felhasználó tényleges 999×600 mm-es
// fájljával ellenőrizve, a korábbi 4100-as P/RX/X elforgatás tiltva.
// 38 mm munkalapnál a RY/Y a FŐ térkép eredeti vízszintes
// keresztvágásait adja, 600/900-as P-vel, gépi forgatás nélkül.
// A JÓVÁHAGYOTT fizikai finalize, gyártási sorrend, SVG térkép,
// bútorlap export és Windows Mentés másként szigorúan változatlan.
// Archívum: archive/before-worktop-horizontal-xprg-repair-20261103
// 2026-11-03: a tényleges WinCut Error[402] Larghezza errata
// miatt a 38 mm munkalaphoz 4100×600/900 fejléc és egyetlen
// X-sorozat szükséges, kezdeti P/Y vagy RX második menet nélkül.
// A bútorlapok teljes eredeti XPRG kódja és a fizikai vágás FIX.
// Visszaállítás: archive/before-worktop-x-only-error402-fix-20261103
// 2026-11-03 – TULAJDONOS ÁLTAL ENGEDÉLYEZETT MUNKALAP EXPORT:
// 2×964 mm darab, 4100×600×38 tábla, 12 mm szélezés:
// P=600, RY=2147.50, Y=964, F=0, Y=964, F=0.
// Fejléc Lunghezza=600, Larghezza=4100, Swap=1 (gépen nem hitelesített).
// Egyedi munkalap X/Y méret az anyagadatbázisból; csak a 38 mm-re.
// A vágási fizika/finalize, termelés, bútorlap XML, natív mentés, SVG FIX.
// Visszaállítás: archive/before-validated-p-ry-y-f-worktop-and-catalog-stock-20261103
// 2026-11-04: tulajdonosi engedéllyel a 38 mm munkalap fordított
// kétmenetes parancssora: P, RY, MINDEN Y, majd darabonként
// RX=0, X=teljes szélesség, U csak keskenyebb darabnál, F.
// A gépi P=Lunghezza=600/900/egyedi keresztvágási méret,
// Larghezza=tábla hossz, Swap=1 továbbra is KÍSÉRLETI.
// Az összes bútorlap XML, finalize, termelési sorrend, Windows
// mentés, SVG megjelenítés byte-ra változatlan.
// Archív: archive/before-worktop-reversed-two-pass-rx-x-20261104
// 2026-11-04: az xMix RigheMix sorrendje fix: minden bútorlap először,
// a 38 mm munkalapok az összes bútorlap után. Mindkét csoporton belül
// az eredeti táblasorrend változatlan. Az xPrg fájlok byte-ra változatlanok,
// ahogy a vágási geometria, a mentés és a munkalapos kétmenetes export.
// Archivált előző állapot: archive/before-xmix-worktops-last-20261104
// A teszt nem igazolja a gép tényleges végrehajtását; CNC éles használat előtt
// próbaszabás és az első vágás/távolságok gépi ellenőrzése kötelező.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8').replace(/\r\n/g,'\n');
function fingerprint(text){
 let hash=0x811c9dc5;
 for(let i=0;i<text.length;i++){
  hash^=text.charCodeAt(i);
  hash=Math.imul(hash,0x01000193);
 }
 return (hash>>>0).toString(16).padStart(8,'0');
}
const locked=[
 ['Fizikai csíkvágás (első vágás és 90° visszaadás)',
  '    function finalize(bin){','\n    const used=[...bins,...standardBins]','1e0ac4b9'],
 ['Kötelező kétmenetes gyártási sorrend',
  'function buildProductionSequence(bins){','\n  function computeNesting(){','afa801b9'],
 ['xMix/xPrg fájlformátum és parancssor',
  '  function buildOfflineXprgProject(','\n  // Az indító teljes Windows-útvonalat ad vissza.','a16c7e88'],
 ['Mentés másként – Windows helyi mentés',
  '  async function saveXprgToSelectedFolder(){','\n  function downloadCutList(','f49fe3b5'],
 ['Kötelező fő szabásztérkép: vízszintes munkalapvágás, első vágás, alapanyagméret',
  '  function svgBoardSize(bin,compact=false){','\n  function trimmingSteps(','86d21042']
];
for(const [name,begin,end,expected] of locked){
 test(name+' változatlan',()=>{
  const first=source.indexOf(begin);
  const last=source.indexOf(end,first);
  assert.ok(first>=0&&last>first,'Nem található a rögzített szakasz');
  assert.equal(fingerprint(source.slice(first,last)),expected,
    'A fix gyártási/mentési kód eltért a kipróbált verziótól!');
 });
}
