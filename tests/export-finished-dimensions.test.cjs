'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const html=readFileSync(path.join(__dirname,'../app/index.htm'),'utf8').replace(/\r\n/g,'\n');
function section(start,end){
 const i=html.indexOf(start),j=html.indexOf(end,i+start.length);
 assert.ok(i>=0&&j>i,'Nem található: '+start);
 return html.slice(i,j);
}
test('az xMix/xPrg export minden három elfogadott gépi módot engedélyez',()=>{
 const src=section('function machineExportBundle(options={}){','\n  async function downloadXprgProject()');
 const exportIt=vm.runInNewContext('(function(){return '+src.trim()+';})()',{
 });
 for(const layoutMode of ['auto','mosaic','economy']){
  const env={state:{layoutMode,kerf:5,projectName:'Teszt'},
    result:{machineReady:true,bins:[{a:2800,b:2070}],failed:[]},
    getFurniture:()=>({name:'Szekrény',materialColor:'Freya',destination:'Műhely'}),
    buildOfflineXprgProject:(bins,project,color)=>({bins,project,color,mixName:'Szekreny_1_tablas.xMix',files:[]}),
    Date,Number,String,Error
  };
  const f=vm.runInNewContext('('+src.trim()+')',env);
  const out=f({relative:true});
  assert.equal(out.project,'Szekrény');
  assert.equal(out.color,'Freya');
  env.result.machineReady=false;
  assert.throws(()=>f({relative:true}),/gépi csíkos szabástervet/);
 }
 assert.doesNotMatch(src,/!\\['machine','economy'\\]\.includes\(state\.layoutMode\)/);
});
test('az alkatrész neve szövegben és önmagában is tartalmazhat biztonságos képletet',()=>{
 const code=section('function calc(formula,vars){','\n  function getParts(){');
 const helper=vm.runInNewContext('(function(){'+code+';return {calc,resolvedPartName};})()');
 const vars={W:1000,H:900,D:600,T:18,S:3,O:1};
 assert.equal(helper.resolvedPartName('Oldal',vars),'Oldal');
 assert.equal(helper.resolvedPartName('Polc {W-2*T} mm',vars),'Polc 964 mm');
 assert.equal(helper.resolvedPartName('=D-2*T',vars),'564');
 assert.equal(helper.resolvedPartName('Szokli {D-2*T} mm',vars),'Szokli 564 mm');
 assert.throws(()=>helper.resolvedPartName('Polc {unknown}',vars),/képlet|Hibás/i);
});
test('a kész méret az alkatrészlistában, a levont szabásméret csak a gépi szabáshoz',()=>{
 const nameAndCalc=section('function calc(formula,vars){','\n  function getParts(){');
 const partsCode=section('function getParts(){','\n  function ');
 const runner=vm.runInNewContext('(function(){'+nameAndCalc+';'+partsCode+';return getParts;})()',{
  state:{furnitures:[{name:'Szekrény',w:1000,ht:900,d:600,t:18,s:2,qty:1,parts:[
    {id:'p1',name:'Polc {W-2*T}',a:'W',b:'D',q:'1',edge:'2-0',edgeThickness:2,mill:true,millDepth:1,grainRequired:true}
  ]}]},
  materialForPart:()=>({thickness:18,color:'Freya'}),
  effectiveShelves:()=>2,effectiveDivider:()=>0,pnum:Number,Math,Number,String
 });
 const res=runner(),r=res.rows[0];
 assert.equal(res.errors.length,0);
 assert.equal(r.resolvedName,'Polc 964');
 assert.equal(r.originalA,1000);
 assert.equal(r.originalB,600);
 assert.equal(r.a,1000);
 assert.equal(r.b,598);
 assert.equal(r.qty,1);
 assert.match(html,/nfmt\(r\.originalA\).*?nfmt\(r\.originalB\)/s);
 assert.match(html,/Kiszámolt készméret/);
 assert.match(html,/Kiszámolt készméret · ABS és marás levonása nélkül/);
});
test('a széria-szerkesztő az Anyagkészlet, Matrica és Mentés oldalakra is továbblép',()=>{
 const render=section('function render(){','\n  function download(');
 assert.match(render,/state\.active==='stock'\?stockPage\(\)/);
 assert.match(render,/state\.active==='save'\?savePage\(\)/);
 const events=section("document.addEventListener('click',e=>{","document.addEventListener('input',e=>{");
 assert.doesNotMatch(events,/projectScreen==='series-edit'&&!/);
});
test('az elrendezés és az ütköztetés változásakor automatikus frissítés van, kézi gomb nélkül',()=>{
 assert.doesNotMatch(html,/data-action="refresh-nesting"/);
 assert.match(html,/\['cutDirection','layoutMode'\]\.includes\(key\)/);
 assert.match(html,/result=hadNesting\|\|state\.active==='nesting'\?computeNesting\(\):null/);
 assert.match(html,/result=computeNesting\(\);state\.selectedBoard=0/);
});
test('a teljes tábla összesítő egyetlen PNG és nincs többé SVG felirat',()=>{
 const code=section('function downloadOverview(){','\n  // HTML5 húzd és ejtsd');
 assert.match(code,/downloadBlob\(blob,'gatterka_osszes_tabla\.png'\)/);
 assert.match(code,/canvas\.toBlob/);
 assert.match(code,/image\/png/);
 assert.doesNotMatch(code,/gatterka_osszes_tabla\.svg/);
 assert.match(html,/Összes tábla egyben \(PNG\)/);
});
test('a megismételt tájékoztató eltűnt a mentés aljáról',()=>{
 const src=section('function savePage(){','\n  function materialsPage()');
 assert.doesNotMatch(src,/A mentési mappa kiválasztása ugyanazzal/);
 assert.match(src,/savedMachinePanel/);
});
