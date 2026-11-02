'use strict';
// Az elfogadott gépi és mentési kódrészletekhez NE nyúlj!
// Ha később célzottan, felhasználói kérésre mégis módosítani kellene,
// előbb új gépi próba és jóváhagyás szükséges. Ez a teszt nem helyettesíti
// a gépi biztonsági ellenőrzést, de védi a megőrzött megvalósítást.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
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
  '    function finalize(bin){','\n    const used=[...bins,...standardBins]','dbb716b6'],
 ['Kötelező kétmenetes gyártási sorrend',
  'function buildProductionSequence(bins){','\n  function computeNesting(){','afa801b9'],
 ['xMix/xPrg fájlformátum és parancssor',
  '  function buildOfflineXprgProject(','\n  // Az indító teljes Windows-útvonalat ad vissza.','73d8a27d'],
 ['Mentés másként – Windows helyi mentés',
  '  async function saveXprgToSelectedFolder(){','\n  function downloadCutList(','f49fe3b5']
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
