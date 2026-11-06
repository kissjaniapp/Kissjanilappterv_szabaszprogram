'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const html=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
function section(from,to){
  const a=html.indexOf(from),b=html.indexOf(to,a+from.length);
  assert.ok(a>=0&&b>a,'A forrásrész létezik: '+from);
  return html.slice(a,b);
}
const helpers=section('  function sidesFromCode(','  let loaded=null;');
const draw=section('  function labelSvgContent(','  const labelPaper=');
const state={furnitures:[]};
const engine=vm.runInNewContext('(function(){'+helpers+draw+
  ';return {labelSvgContent,partEdgeLabel,cleanFilingForAbs};})()',{
  state,Number,Object,Array,Math,String,
  h:s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;'),
  nfmt:n=>String(Number(n)).replace('.',',')
});
function part(values={}){
  return {uid:'p1',name:'Fenék',source:'Konyha',destination:'Széria',materialColor:'Fehér tölgy',
    originalA:964,originalB:464,a:964,b:464,
    edge:'0-0',edgeThickness:2,filingSides:{x1:false,x2:false,y1:false,y2:false},
    mill:true,millDepth:1,...values};
}
function label(p){
  return engine.labelSvgContent({placement:{part:p}},0,0,48.5,25.4);
}
test('0-0 élzárás esetén nincs sem élzáróanyag, sem 2mm ABS jelzés a matricán',()=>{
  const svg=label(part());
  assert.doesNotMatch(svg,/2\s*mm\s*élzáró|[12]H|[12]R|0-0/);
  assert.match(svg,/Fehér tölgy/);
});
test('az anyagszín a matrica jobb felső sarkába kerül',()=>{
  const svg=label(part());
  assert.match(svg,/Fehér tölgy<\/text>/);
  assert.match(svg,/text-anchor="end">Fehér tölgy<\/text>/);
  assert.match(svg,/text-anchor="end">Fehér tölgy<\/text>/);
});
test('vegyes 1 hosszú 2mm + 2 rövid 0,4mm ABS esetén egyértelmű élcímke',()=>{
  const svg=label(part({edge:'1-2',
    edgeSides:{x1:true,x2:false,y1:true,y2:true},
    edgeThicknesses:{x1:2,x2:0,y1:.4,y2:.4}}));
  assert.match(svg,/1H 2mm 2R 0,4mm/);
  assert.doesNotMatch(svg,/resz/);
});
test('reszelés csak az érintett 2 mm-es élnél szerepel',()=>{
  const p=part({edge:'1-2',
    edgeSides:{x1:true,x2:false,y1:true,y2:true},
    edgeThicknesses:{x1:2,x2:0,y1:2,y2:2},
    filingSides:{x1:false,x2:false,y1:true,y2:true}});
  const svg=label(p);
  assert.match(svg,/1H 2mm 2Rresz 2mm/);
});
test('0,4mm-es élen eltávolítja a régi hibás reszelést',()=>{
  const p=part({edge:'1-2',
    edgeSides:{x1:true,x2:false,y1:true,y2:true},
    edgeThicknesses:{x1:2,x2:0,y1:.4,y2:.4},
    filingSides:{x1:false,x2:false,y1:true,y2:true}});
  assert.equal(engine.cleanFilingForAbs(p),true);
  assert.equal(p.filingSides.y1,false);
  assert.equal(p.filingSides.y2,false);
  assert.match(label(p),/2R 0,4mm/);
});
