'use strict';
// A 2026-11-03-án engedélyezett ÚJ gépi szabály rögzített ujjlenyomatai.
// Az EREDETI teszt és régi kód archiválva: docs/archivum/2026-11-03-regi-vagasi-logika/
// A korábbi négy ujjlenyomat közül a két engedélyezetten módosított blokk új értéket kapott.
// További módosítás csak tulajdonosi engedéllyel.
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
  '    function finalize(bin){','\n    const used=[...bins,...standardBins]','99575204'],
 ['Kötelező kétmenetes gyártási sorrend',
  'function buildProductionSequence(bins){','\n  function computeNesting(){','afa801b9'],
 ['xMix/xPrg fájlformátum és parancssor',
  '  function buildOfflineXprgProject(','\n  // Az indító teljes Windows-útvonalat ad vissza.','c393cfd9'],
 ['Mentés másként – Windows helyi mentés',
  '  async function saveXprgToSelectedFolder(){','\n  function downloadCutList(','f49fe3b5'],
 ['Kötelező kétmenetes vízszintes szabásrajz és 90°-os csíkforgatás',
  '  function svgBoardSize(bin,compact=false){','\n  function trimmingSteps(','368a35f0']
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
