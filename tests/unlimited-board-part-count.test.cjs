'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
function sourceBetween(a,b) {
 const from=html.indexOf(a),to=html.indexOf(b,from+a.length);
 assert.ok(from>=0&&to>from,'Hiányzó kódrész '+a);
 return html.slice(from,to);
}
test('101 vagy 225 előre megadott táblát is felvesz a készletből',()=>{
 const code=sourceBetween('  function prepareBins(){','  function bestPlacement(');
 const state={selectedRemnantIds:[],boards:[{id:'t1',qty:225,a:2800,b:2070,thickness:18}]};
 const run=vm.runInNewContext('(function(){'+code+';return prepareBins;})()',{
   state,remnantCatalog:[],Number,
   createBin:(board,index)=>({id:board.id,index})
 });
 const bins=Array.from(run());
 assert.equal(bins.length,225);
 assert.equal(bins[224].index,225);
});
test('a megadott alkatrész- és bútordarabszámot nem korlátozza 300',()=>{
 const parts=sourceBetween('  function getParts(){','  function intro(');
 assert.match(parts,/Number\.isSafeInteger\(qty\)&&qty>=0/);
 assert.doesNotMatch(parts,/qty<=300/);
 const selector=sourceBetween('  function choiceFields(','  function collectorFurniturePanel(');
 assert.doesNotMatch(selector,/entry\.qty>300|max="300"/);
});
test('tábla programját továbbra is a 99-es gépi parancshatár védi',()=>{
 assert.match(html,/const MAX_SAFE_XPRG_COMMANDS=99/);
 assert.match(html,/if\(cuts\.length>99\)/);
});
