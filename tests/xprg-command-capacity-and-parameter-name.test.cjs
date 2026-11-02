'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
function block(a,b){
  const first=html.indexOf(a),last=html.indexOf(b,first+a.length);
  assert.ok(first>=0&&last>first,'Hiányzó kódrész: '+a);
  return html.slice(first,last);
}
const stripCode=block('  const STANDARD_BOARD=','  // Gyártási sorrend:');
const exportCode=block('  function buildOfflineXprgProject(','  // Az indító teljes Windows-útvonalat ad vissza.');
const runStrip=state=>vm.runInNewContext('(function(){'+stripCode+';return makeStripPlan;})()',{
  state,Math,Number,Array
});
const save=vm.runInNewContext('(function(){'+exportCode+';return buildOfflineXprgProject;})()',{
  fileName:s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^A-Za-z0-9_-]+/g,'_').slice(0,70)
});
function row(name,a,b,qty){
  return {part:{id:name,name},furniture:{name:'Konyha',materialColor:'Freya'},
    materialColor:'Freya',qty,a,b,originalA:a,originalB:b,
    thickness:18,rot:false,edge:'0-0',edgeThickness:2,mill:false};
}
function planAndExport(rows,feed='x',mode=0){
  const parts={rows,total:rows.reduce((n,r)=>n+r.qty,0),errors:[]};
  const result=runStrip({kerf:5,trim:12,boards:[]})(mode,parts,feed);
  assert.equal(result.failed.length,0,'nem maradhat ki alkatrész');
  const total=result.bins.reduce((n,b)=>n+b.placements.length,0);
  assert.equal(total,parts.total,'minden alkatrész táblára kerül');
  const bundle=save(result.bins,'Szekrény','Freya',5,'02/11/2026');
  const xml=bundle.files.filter(([name])=>name.endsWith('.xPrg')).map(([,content])=>content);
  assert.equal(xml.length,result.bins.length);
  assert.equal((bundle.files[0][1].match(/<RigaMix /g)||[]).length,result.bins.length);
  for(const [i,program] of xml.entries()){
    const cuts=[...program.matchAll(/<Cut T="([^"]+)" Dim="([^"]+)" Rip="1" ID="(\d+)" \/>/g)];
    assert.ok(cuts.length<=99,'A '+(i+1)+'. tábla túllépi a 99 gépi parancsot');
    assert.equal(cuts.length,result.bins[i].machine.commandCount);
    assert.deepEqual(Array.from(cuts,cut=>Number(cut[3])),
      Array.from({length:cuts.length},(_,n)=>n),'Folytonos gépi parancsazonosítók');
    assert.equal(cuts[0][1],'P');
    assert.equal(cuts[1][1],'RY');
  }
  return {result,bundle,xml};
}
test('60 kis alkatrész két xPrg táblára kerül a 99-es korlát mellett',()=>{
  const {result}=planAndExport([row('Oldal',20,200,60)]);
  assert.ok(result.bins.length>=2,'a korábbi mentési hiba nem fordulhat elő');
});
test('200 alkatrész egy xMix-be kerül több táblán; egyik xPrg sem több 99 parancsnál',()=>{
  const {result}=planAndExport([row('Oldal',20,200,200)]);
  assert.ok(result.bins.length>=4);
});
test('U alábontás esetén is pontos a parancsok számlálása',()=>{
  const {xml}=planAndExport([row('Széles',70,200,120),row('Keskeny',70,180,160)],'x',42);
  assert.ok(xml.some(x=>x.includes('T="U"')),'az U parancsokat is számolni kell');
});
test('hosszú / rövid él és automatikus gépállás is a védett parancskorlát alatt marad',()=>{
  for(const [feed,mode] of [['auto',15],['long',12],['short',10]])
    planAndExport([row('Oldal',60,175,140)],feed,mode);
});
test('400 alkatrészes munka is egy xMix több tábla xPrg programjával készül',()=>{
  const {result}=planAndExport([row('A',25,195,200),row('B',25,195,200)],'auto',15);
  assert.ok(result.bins.length>3);
});

const paramCode=block('  function makeCustomPartDefinition(){','  function startSeriesEditor(');
const calcCode=block('function calc(formula,vars){','  // Névképlet:');
let next=0;
const params=vm.runInNewContext('(function(){'+calcCode+paramCode+
  ';return {syncCustomParameterParts,customPartName};})()',{
    uuid:()=>String(++next),h:x=>String(x??''),effectiveShelves:()=>0,
    effectiveDivider:()=>0,sidesFromCode:()=>({x1:false,x2:false,y1:false,y2:false})
  });
function furniture(name){
  return {name:'Bútor',w:1000,ht:1400,d:500,t:18,s:0,parts:[],
    customParameters:[{id:name+'rule',name,enabled:true,
      parts:[{id:name+'part',name:'',a:'W-2*T',b:'100',q:'1'}]}]};
}
test('az első alkatrész neve automatikusan a paraméter neve lehet',()=>{
  const f=furniture('Merevítő');
  params.syncCustomParameterParts(f);
  assert.equal(f.parts[0].name,'Merevítő');
  assert.equal(f.customParameters[0].parts[0].name,'','az öröklés nem változtathatja meg a definíciót');
  f.customParameters[0].name='Polctartó';
  params.syncCustomParameterParts(f);
  assert.equal(f.parts[0].name,'Polctartó');
  f.customParameters[0].enabled=false;
  params.syncCustomParameterParts(f);
  assert.equal(f.parts.length,0);
  assert.equal(f.customParameters[0].parts[0].name,'');
  f.customParameters[0].enabled=true;
  params.syncCustomParameterParts(f);
  assert.equal(f.parts[0].name,'Polctartó');
});
test('másik bútor paraméter- és alkatrészneve nem keveredhet át',()=>{
  const a=furniture('Pánt'),b=furniture('Merevítő');
  params.syncCustomParameterParts(a);params.syncCustomParameterParts(b);
  assert.equal(a.parts[0].name,'Pánt');
  assert.equal(b.parts[0].name,'Merevítő');
  a.customParameters[0].name='Zsanér';
  params.syncCustomParameterParts(a);
  assert.equal(a.parts[0].name,'Zsanér');
  assert.equal(b.parts[0].name,'Merevítő');
});
test('a felülírt alkatrésznév maradjon kézi név',()=>{
  const f=furniture('Első');
  f.customParameters[0].parts[0].name='Második';
  params.syncCustomParameterParts(f);
  assert.equal(f.parts[0].name,'Második');
  f.customParameters[0].name='Harmadik';
  params.syncCustomParameterParts(f);
  assert.equal(f.parts[0].name,'Második');
});
