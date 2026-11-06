'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
const begin=html.indexOf('  const STANDARD_BOARD=');
const end=html.indexOf('  // Gyártási sorrend:',begin);
assert.ok(begin>=0&&end>begin,'Kötelező gépi csíkozási számítás nem található');
function row(name,thickness,count){
  return {part:{id:name,name},furniture:{name:'3MF szekrény',materialColor:'Freya'},
    materialColor:'Freya',qty:count,a:1263,b:578.9,
    originalA:1263,originalB:578.9,thickness,rot:false,edge:'0-0',
    edgeThickness:2,mill:false};
}
function plan(rows,materialCatalog){
  const state={kerf:5,trim:12,boards:[]};
  const make=vm.runInNewContext('(function(){'+html.slice(begin,end)+
    ';return makeStripPlan;})()',{state,materialCatalog,Math,Number,Array});
  return make(0,{rows,total:rows.reduce((n,r)=>n+r.qty,0),errors:[]},'x');
}
test('36 mm-es 3MF alkatrészekhez katalógusbeli tábla automatikusan nyílik',()=>{
 const rows=[row('Szilárdtest27',36,8)];
 const result=plan(rows,[{id:'lap36',color:'Freya',thickness:36,boardA:2800,boardB:2070}]);
 assert.equal(result.failed.length,0);
 assert.equal(result.bins.reduce((sum,b)=>sum+b.placements.length,0),8);
 assert.ok(result.bins.every(b=>b.thickness===36&&b.automatic));
});
test('más vastagságot tilos 18 mm-es táblára elhelyezni vagy hamis mentést engedni',()=>{
 const result=plan([row('Szilárdtest27',36,2)],[]);
 assert.equal(result.failed.length,2);
 assert.equal(result.bins.length,0);
 assert.match(html,/A gépi mentés csak hiánytalan szabástervnél engedélyezett/);
 assert.match(html,/result\.failed\?\.length/);
});
test('18 mm-es táblák automatikus kiosztása marad',()=>{
 const result=plan([row('Polc',18,4)],[]);
 assert.equal(result.failed.length,0);
 assert.equal(result.bins.reduce((sum,b)=>sum+b.placements.length,0),4);
});
