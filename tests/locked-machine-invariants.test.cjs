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
// Visszaállítás: archive/before-unified-worktop-board-cutting-20261103
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
  '  function buildOfflineXprgProject(','\n  // Az indító teljes Windows-útvonalat ad vissza.','4a04f390'],
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
