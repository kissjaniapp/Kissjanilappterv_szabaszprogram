'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
function between(a,b){
 const start=html.indexOf(a),end=html.indexOf(b,start+a.length);
 assert.ok(start!==-1&&end>start,'Megvan a kód: '+a);
 return html.slice(start,end);
}
test('minden kért bútor darabonként külön egyedi másolat, qty=1',()=>{
 const src=between('  function startSelectedFurnitureCut(){','  function collectorFurniturePanel(){');
 assert.match(src,/for\(let i=0;i<entry\.qty;i\+\+\)/);
 assert.match(src,/const copy=copyFurniture\(template\)/);
 assert.match(src,/copy\.qty=1/);
 assert.match(src,/state\.furnitures=chosen/);
});
test('a gyűjtő megnyitás/mentés/összesítés gombjai működő eseményekre mutatnak',()=>{
 const src=between('  function collectorFurniturePanel(){','  function isCombinedSelectionWorkspace(');
 assert.match(src,/data-action="collector-open-furniture"/);
 assert.match(src,/data-action="collector-save"/);
 assert.match(src,/data-action="collector-summary"/);
 for(const action of ['collector-open-furniture','collector-save','collector-summary']){
  assert.ok(html.includes("action==='"+action+"'"),'Hiányzó gombkezelő '+action);
 }
});
test('egyedi példányok ugyanabban a munkaprojektben maradnak',()=>{
 const src=between('  function startSelectedFurnitureCut(){','  function collectorFurniturePanel(){');
 assert.match(src,/job\.selectionWorkspace=true/);
 assert.match(src,/save\(\);render\(\)/);
});
test('a Még nincs mappában rész megszűnt, mentett bútorok továbbra is elérhetőek',()=>{
 const src=between('  function folderLibraryView(){','  function seriesLibraryPanel(){');
 assert.doesNotMatch(src,/Még nincs mappában/);
 assert.match(src,/Mentett bútorok/);
 assert.match(src,/Kijelölt bútorok gyűjtője/);
});
test('szabászati xMix és xPrg megvalósításhoz a gyűjtő nem nyúl',()=>{
 const src=between('  function collectorFurniturePanel(){','  function isCombinedSelectionWorkspace(');
 assert.doesNotMatch(src,/xMix|xPrg|cuttingGroup|makeStripPlan/);
});
