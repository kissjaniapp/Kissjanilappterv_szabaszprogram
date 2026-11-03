'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
function sec(a,b){
  const i=html.indexOf(a),j=html.indexOf(b,i+a.length);
  assert.ok(i>=0&&j>i,'Hiányzó kódrész: '+a);
  return html.slice(i,j);
}
const nesting=sec('  const STANDARD_BOARD=','  // Gyártási sorrend:');
const exportCode=sec('  function buildOfflineXprgProject(',
  '  // Az indító teljes Windows-útvonalat ad vissza.');
const drawing=sec('  function svgBoardSize(bin,compact=false){',
  '  function trimmingSteps(');
function make(boards,rows,feed='x',trim=10){
 const pack=vm.runInNewContext('(function(){'+nesting+
   ';return makeStripPlan;})()',{
     state:{trim,kerf:5,boards,selectedRemnantIds:[]},remnantCatalog:[],
   });
 return pack(0,{rows,errors:[],total:rows.reduce((a,b)=>a+b.qty,0)},feed);
}
function part(a,b,qty=1,thickness=18,color='Fehér'){
 return {part:{id:'p'+a+b,name:'Elem'},furniture:{name:'Konyha',materialColor:color},
   qty,a,b,originalA:a,originalB:b,materialColor:color,thickness,
   rot:false,edge:'0-0',edgeThickness:2,mill:false,millDepth:1};
}
const exporter=vm.runInNewContext('(function(){'+exportCode+
   ';return buildOfflineXprgProject;})()',{
     fileName:s=>String(s).replace(/[^A-Za-z0-9_-]+/g,'_')
   });
const draw=vm.runInNewContext('(function(){'+drawing+
    ';return {svgBoard,svgBoardSize};})()',{
      state:{cutDirection:'auto'},result:null,
      colors:['#cde6d1'],h:x=>String(x),nfmt:x=>String(x)
    });
const near=(a,b)=>Math.abs(Number(a)-Number(b))<.01;
function exportXml(bins){
 return exporter(bins,'Konyha','Fehér',5,'03/11/2026')
   .files.filter(([name])=>name.endsWith('.xPrg')).map(([,xml])=>xml);
}
test('az előző elfogadott nagy alaptábla sorrendje és RY/RX marad',()=>{
 const out=make([], [part(964,200,3)], 'y',12);
 const bin=out.bins[0];
 assert.equal(bin.machine.topAligned,false);
 assert.equal(bin.a,2800);assert.equal(bin.b,2070);
 assert.equal(bin.machine.firstCutPosition,2798-10); // 2800 - 12 = 2788
});
test('1620×785 maradékon a legalsó csík alatt az első vágás, fent a darabok',()=>{
 const out=make([{id:'mar',name:'Maradék',a:1620,b:785,thickness:18,qty:1,materialColor:'Fehér'}],
   [part(700,200,2),part(690,200,3)]);
 assert.equal(out.failed.length,0);
 assert.equal(out.bins.length,1);
 const bin=out.bins[0],m=bin.machine;
 assert.equal(bin.automatic,false);
 assert.equal(m.topAligned,true);
 assert.equal(m.firstCutRule,'top-aligned-bottom');
 assert.ok(near(m.firstCutPosition,10+m.feedUsed+2.5));
 assert.equal(bin.cuts[0].stage,'head-trim');
 assert.ok(near(bin.cuts[0].y1,m.firstCutPosition));
 assert.equal(bin.placements.length,5);
 assert.ok(bin.placements.some(p=>near(p.y,10)),'legalább egy csík fent kezdődik');
 const xml=exportXml([bin])[0];
 assert.match(xml,/Cut T="RY" Dim="162[.]50"/);
 assert.ok(m.strips.some(strip=>strip.firstCutRule==='top-aligned-bottom'));
 for(const strip of m.strips){
   assert.ok(near(strip.firstCutPosition,strip.usedLength+bin.trim+2.5));
   const first=bin.cuts.find(c=>c.stripIndex===strip.index&&
     c.stage==='cross-head-trim');
   assert.ok(first,'van egy alsó kezdővágás a 90°-os csíkon');
   assert.ok(near(first.x1,strip.firstCutPosition));
 }
 assert.ok(xml.includes('<Cut T="RX" Dim="202.50"'));
 assert.ok((xml.match(/<Cut /g)||[]).length<=99);
});
test('38 mm munkalap: teljes szélesség, a 90° utáni darabok felül',()=>{
 const out=make([],[part(1000,600,3,38,'Fa')],'auto');
 assert.equal(out.failed.length,0);
 const bin=out.bins[0],strip=bin.machine.strips[0];
 assert.equal(bin.a,4100);assert.equal(bin.b,600);
 assert.equal(bin.machine.topAligned,true);
 assert.equal(bin.machine.feed,'x');
 assert.equal(strip.firstCutRule,'top-aligned-bottom');
 assert.ok(near(strip.firstCutPosition,3012.5));
 assert.ok(bin.placements.some(p=>near(p.x,0)),'darab a csík tetején');
 assert.ok(bin.cuts.every(c=>c.stage!=='rip'&&c.stage!=='strip'));
 const xml=exportXml([bin])[0];
 assert.match(xml,/Lunghezza="4100[.]00"/);
 assert.match(xml,/Larghezza="600[.]00"/);
 assert.match(xml,/Cut T="RY" Dim="0[.]00"/);
 assert.match(xml,/Cut T="RX" Dim="1087[.]50"/);
});
test('az első és a 90° utáni második menet vágásai a rajzon vízszintesek',()=>{
 const data=make([{id:'mar',name:'Maradék',a:1620,b:785,thickness:18,
   qty:1,materialColor:'Fehér'}],[part(700,200,2),part(690,200,3)]);
 const bin=data.bins[0],svg=draw.svgBoard(bin);
 assert.match(svg,/2[.] menet · 1[.] csík · 90° forgatás/);
 assert.ok(draw.svgBoardSize(bin).passHeight>0);
 const cuts=[...svg.matchAll(/<path d="M([-\d.]+) ([-\d.]+)L([-\d.]+) ([-\d.]+)" stroke="#(?:c45b34|bd805b)"/g)];
 assert.ok(cuts.length>=5,'az első és második menet vágásai megjelennek');
 for(const c of cuts)assert.ok(near(c[2],c[4]),'függőleges vágásvonal jelent meg');
 const worktop=make([],[part(1000,600,3,38,'Fa')],'auto').bins[0];
 const svg38=draw.svgBoard(worktop);
 const lines=[...svg38.matchAll(/<path d="M([-\d.]+) ([-\d.]+)L([-\d.]+) ([-\d.]+)" stroke="#(?:c45b34|bd805b)"/g)];
 assert.ok(lines.length>=3);
 for(const c of lines)assert.ok(near(c[2],c[4]));
});
test('az összesítőben az Élzárás és ABS vastagság külön oszlop',()=>{
 assert.match(html,/<th>Élzárás jelölése<\/th><th>ABS vastagság<\/th>/);
 assert.match(html,/<td class="abs-value">/);
 assert.match(html,/\.abs-value\{/);
});
test('a régi szabási verzió archiválva, és az új szabály rögzítve',()=>{
 assert.match(html,/const topAligned=isWorktop38/);
 assert.match(html,/m\.firstTrimDistance\?\?bin\.trim/);
 assert.match(html,/strip\.firstTrimDistance\?\?bin\.trim/);
});
