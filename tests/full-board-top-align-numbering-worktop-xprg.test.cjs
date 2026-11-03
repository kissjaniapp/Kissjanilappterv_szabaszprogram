'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
function source(begin,end){
  const a=html.indexOf(begin),b=html.indexOf(end,a+begin.length);
  assert.ok(a>=0&&b>a,'Hiányzó kódrész: '+begin);
  return html.slice(a,b);
}
const packing=source('  const STANDARD_BOARD=','  // Gyártási sorrend:');
const drawing=source('  function svgBoardSize(bin,compact=false){','  function trimmingSteps(');
const producing=source('function buildProductionSequence(bins){','  function computeNesting(){');
const exporting=source('  function buildOfflineXprgProject(',
  '  // Az indító teljes Windows-útvonalat ad vissza.');
const draw=vm.runInNewContext('(function(){'+drawing+
  ';return {svgBoard,svgBoardSize};})()',{
    state:{cutDirection:'auto'},result:null,colors:['#e1f1e8'],
    h:t=>String(t??''),nfmt:n=>String(n)
  });
const schedule=vm.runInNewContext('(function(){'+producing+
  ';return buildProductionSequence;})()');
const exportXprg=vm.runInNewContext('(function(){'+exporting+
  ';return buildOfflineXprgProject;})()',{
    fileName:s=>String(s).replace(/[^A-Za-z0-9_-]+/g,'_')
  });
function part(a,b,qty=1,thickness=18,color='Fehér'){
  return {part:{id:'p'+a+'-'+b,name:'Alkatrész'},
    furniture:{name:'Bútor',materialColor:color},qty,a,b,
    originalA:a,originalB:b,thickness,materialColor:color,rot:false,
    edge:'0-0',edgeThickness:2,mill:false,millDepth:1};
}
function plan(rows,feed='y',trim=12,boards=[]){
  const fn=vm.runInNewContext('(function(){'+packing+
    ';return makeStripPlan;})()',{
      state:{trim,kerf:5,boards,selectedRemnantIds:[]},remnantCatalog:[]
    });
  const result=fn(0,{rows,errors:[],total:rows.reduce((sum,r)=>sum+r.qty,0)},feed);
  assert.equal(result.failed.length,0,'egy alkatrész sem maradhat ki');
  schedule(result.bins);
  return result;
}
function xml(bin){
  return exportXprg([bin],'Bútor','Fehér',5,'03/11/2026')
    .files.find(([name])=>name.endsWith('.xPrg'))[1];
}
function assertFullNumbering(bin){
  const svg=draw.svgBoard(bin);
  const labels=Array.from(svg.matchAll(/data-cut-order="([0-9]+)"/g),m=>Number(m[1]));
  const allOrders=[...new Set(bin.cuts.map(c=>c.boardOrder||c.globalOrder||c.order))].sort((a,b)=>a-b);
  const displayed=[...new Set(labels)].sort((a,b)=>a-b);
  assert.deepEqual(displayed,allOrders,'minden fizikai vágás sorszámát fel kell tüntetni');
  assert.equal(draw.svgBoardSize(bin).passHeight,0,'alsó miniábra nem jelenhet meg');
  assert.doesNotMatch(svg,/2[.] menet · [0-9]+[.] csík · 90° forgatás/);
  assert.doesNotMatch(svg,/Tábla anyaga:/);
  const lines=[...svg.matchAll(/<path d="M([-\d.]+) ([-\d.]+)L([-\d.]+) ([-\d.]+)" stroke="#(?:c45b34|bd805b)"/g)];
  assert.ok(lines.length>0);
  for(const m of lines)assert.equal(Number(m[2]),Number(m[4]),
    'függőleges gépi vágásvonal nem szerepelhet a fő rajzon');
  return svg;
}
test('kevés alkatrészes 2800×2070 nagytábla: felső igazítás és alsó kezdővágás',()=>{
  const bin=plan([part(964,200,3)],'y',12).bins[0];
  assert.equal(bin.automatic,true);
  assert.equal(bin.machine.topAligned,true);
  assert.equal(bin.machine.firstCutRule,'top-aligned-bottom');
  assert.ok(Math.abs(bin.machine.firstCutPosition-
    (bin.trim+bin.machine.feedUsed+2.5))<.001);
  assert.equal(bin.cuts[0].stage,'head-trim');
  assertFullNumbering(bin);
});
test('szinte tele lévő nagytáblán a régi kezdőszélezési hely marad',()=>{
  const bin=plan([part(2773.5,1800,1)],'y',12).bins[0];
  assert.equal(bin.machine.topAligned,false);
  assert.equal(bin.machine.firstCutPosition,2788);
  assert.equal(bin.machine.firstCutRule,undefined);
  assertFullNumbering(bin);
});
test('a normál táblák teljes kétmenetes 1..N vágássorrendje a fő rajzon látszik',()=>{
  const bin=plan([part(964,200,3)],'x',12).bins[0];
  const svg=assertFullNumbering(bin);
  assert.match(svg,/data-cut-pass="2"/);
  assert.match(svg,/90°-os visszaforgatás után/);
  assert.equal(svg.includes('stroke="#385e8d"'),false);
  const xprg=xml(bin);
  assert.match(xprg,/Lunghezza="2800[.]00" Larghezza="2070[.]00"/);
  assert.match(xprg,/<Cut T="P" Dim="2800[.]00"/);
});
test('1620×785 maradék táblán is minden sorszám megjelenik',()=>{
  const stock={id:'mar',name:'Maradék',a:1620,b:785,
    thickness:18,qty:1,materialColor:'Fehér'};
  const bin=plan([part(700,200,2),part(690,200,3)],'x',10,[stock]).bins[0];
  assert.equal(bin.machine.topAligned,true);
  assertFullNumbering(bin);
});
test('38 mm-es 4100×600 munkalap: Lunghezza és P 600, Larghezza 4100',()=>{
  const bin=plan([part(1000,600,3,38)],'auto',10).bins[0],xprg=xml(bin);
  assert.equal(bin.a,4100);assert.equal(bin.b,600);
  assert.match(xprg,/Lunghezza="600[.]00" Larghezza="4100[.]00"/);
  assert.match(xprg,/<Cut T="P" Dim="600[.]00"/);
  assertFullNumbering(bin);
});
test('38 mm-es 4100×900 munkalap: Lunghezza és P 900, Larghezza 4100',()=>{
  const bin=plan([part(1000,900,3,38)],'auto',10).bins[0],xprg=xml(bin);
  assert.equal(bin.a,4100);assert.equal(bin.b,900);
  assert.match(xprg,/Lunghezza="900[.]00" Larghezza="4100[.]00"/);
  assert.match(xprg,/<Cut T="P" Dim="900[.]00"/);
  assertFullNumbering(bin);
});
test('a fő SVG méretek, sorszámok rajzolása nem változtatja meg a gépi adatokat',()=>{
  const bin=plan([part(964,200,4)],'y',12).bins[0];
  const copy=JSON.stringify(bin);
  draw.svgBoard(bin);
  draw.svgBoard(bin,true);
  assert.equal(JSON.stringify(bin),copy);
});
