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
const draw=section('  function labelAxisDetails(','  const labelPaper=');
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
  assert.match(svg,/1H 2mm ABS/);
  assert.match(svg,/2R 0,4mm ABS/);
  assert.ok(svg.indexOf('1H 2mm ABS') < svg.indexOf('2R 0,4mm ABS'));
  assert.doesNotMatch(svg,/resz/);
});
test('reszelés csak az érintett 2 mm-es élnél szerepel',()=>{
  const p=part({edge:'1-2',
    edgeSides:{x1:true,x2:false,y1:true,y2:true},
    edgeThicknesses:{x1:2,x2:0,y1:2,y2:2},
    filingSides:{x1:false,x2:false,y1:true,y2:true}});
  const svg=label(p);
  assert.match(svg,/1H 2mm ABS/);
  assert.match(svg,/2R 2mm ABS/);
  assert.match(svg,/2Rresz/);
  assert.doesNotMatch(svg,/2Rresz 2mm/);
});
test('0,4mm-es élen eltávolítja a régi hibás reszelést',()=>{
  const p=part({edge:'1-2',
    edgeSides:{x1:true,x2:false,y1:true,y2:true},
    edgeThicknesses:{x1:2,x2:0,y1:.4,y2:.4},
    filingSides:{x1:false,x2:false,y1:true,y2:true}});
  assert.equal(engine.cleanFilingForAbs(p),true);
  assert.equal(p.filingSides.y1,false);
  assert.equal(p.filingSides.y2,false);
  const svg=label(p);
  assert.match(svg,/2R 0,4mm ABS/);
  assert.doesNotMatch(svg,/2Rresz/);
});

test('964 × 502, 1-2 élzárás: méretenkénti ABS, reszelés csak 502 alatt',()=>{
  const svg=label(part({originalB:502,b:502,edge:'1-2',
    edgeSides:{x1:true,x2:false,y1:true,y2:true},
    edgeThicknesses:{x1:2,x2:0,y1:2,y2:2},
    filingSides:{x1:false,x2:false,y1:true,y2:true}}));
  assert.match(svg,/>964<\/text>/);
  assert.match(svg,/>502<\/text>/);
  assert.match(svg,/1H 2mm ABS/);
  assert.match(svg,/2R 2mm ABS/);
  assert.match(svg,/2Rresz/);
  assert.doesNotMatch(svg,/1Hresz/);
});

test('hosszú alkatrésznév teljes egészében szerepel a lejjebb helyezett matricán',()=>{
  const name='Különösen hosszú konyhai felső szekrény oldallap';
  const svg=label(part({name}));
  assert.doesNotMatch(svg,/Különösen…|oldallap…/);
  assert.ok(svg.includes('Különösen hosszú konyhai'));
  assert.ok(svg.includes('szekrény oldallap'));
  assert.ok(svg.indexOf('Különösen')>svg.indexOf('1H 2mm ABS')||!svg.includes('1H 2mm ABS'));
});

test('matrica: nagyobb rés a méret aláhúzása és az ABS között, a név lent marad',()=>{
  const svg=label(part({name:'Oldal',originalB:502,b:502,edge:'1-2',
    edgeSides:{x1:true,x2:false,y1:true,y2:true},
    edgeThicknesses:{x1:2,x2:0,y1:.4,y2:.4},
    filingSides:{x1:false,x2:false,y1:true,y2:true}}));
  const abs=svg.match(/<text x="[^"]+" y="([^"]+)"[^>]*>2R 0,4mm ABS<\/text>/);
  const name=svg.match(/<text x="[^"]+" y="([^"]+)"[^>]*>Oldal<\/text>/);
  assert.ok(abs&&name,'ABS és alkatrésznév megjelenik');
  assert.ok(Number(abs[1])>=15,'ABS a méret alatt, megnövelt távolsággal');
  assert.ok(Number(name[1])>Number(abs[1])+4,'alkatrésznév továbbra is az alsó mezőben');
  assert.doesNotMatch(svg,/2Rresz/,'0,4 mm ABS-hez nincs reszelés');
});

test('négyjegyű méretek nem lógnak rá az × jelre vagy az 1-2 kódra',()=>{
  for(const [a,b] of [[1164,464],[754,964],[1164,1464],[12345,9876]]){
    const svg=label(part({originalA:a,originalB:b,edge:'1-2',
      edgeSides:{x1:true,x2:false,y1:true,y2:true},
      edgeThicknesses:{x1:2,x2:0,y1:.4,y2:.4}}));
    const elements=[...svg.matchAll(/<text x="([^"]+)" y="[^"]+" font-size="([^"]+)"[^>]*>([^<]+)<\/text>/g)]
      .map(m=>({x:Number(m[1]),size:Number(m[2]),value:m[3]}));
    const first=elements.find(t=>t.value===String(a));
    const second=elements.find(t=>t.value===String(b));
    const multiply=elements.find(t=>t.value==='×');
    const code=elements.find(t=>t.value==='1-2');
    assert.ok(first&&second&&multiply&&code,'összes méret és jel látható');
    // Konzervatív becslés félkövér Arial számszélességre.
    const half=t=>t.value.length*t.size*.31;
    assert.ok(first.x+half(first)+.6<multiply.x-half(multiply),
      'első méret és × között van hely: '+a);
    assert.ok(multiply.x+half(multiply)+.6<second.x-half(second),
      '× és második méret között van hely: '+b);
    assert.ok(second.x+half(second)+.6<code.x-code.value.length*code.size*.63,
      'második méret és élzáráskód között van hely: '+b);
  }
});

test('jobb alsó élenkénti maráslista: csak az élzárt H1/R1/R2 élek, 0,4 mindig nulla',()=>{
  const p=part({name:'Fenék',edge:'1-2',mill:true,millDepth:1,
    edgeSides:{x1:true,x2:false,y1:true,y2:true},
    edgeThicknesses:{x1:2,x2:0,y1:2,y2:.4},
    millDepthSides:{x1:1,x2:2,y1:1.5,y2:2}});
  const svg=label(p);
  assert.match(svg,/H1: 2mm ABS – 1mm marás/);
  assert.match(svg,/R1: 2mm ABS – 1,5mm marás/);
  assert.match(svg,/R2: 0,4mm ABS – nincs marás/);
  assert.doesNotMatch(svg,/H2: /);
  assert.match(svg,/>Fenék<\/text>/);
});
test('0-0 címkén nincs marási mező vagy lista',()=>{
  const svg=label(part({edge:'0-0',mill:true}));
  assert.doesNotMatch(svg,/H1:|H2:|R1:|R2:|nincs marás/);
});
test('az élenkénti marásból a szabási levonás is külön történik',()=>{
  const p=part({edge:'2-2',edgeSides:{x1:true,x2:true,y1:true,y2:true},
    edgeThicknesses:{x1:2,x2:2,y1:2,y2:.4},mill:true,millDepth:1,
    millDepthSides:{x1:1,x2:0,y1:1.5,y2:0}});
  const e=vm.runInNewContext('(function(){'+helpers+';return {partMillForSide};})()',{
    Number,Object,Array,Math,String
  });
  assert.equal(e.partMillForSide(p,'x1'),1);
  assert.equal(e.partMillForSide(p,'x2'),0);
  assert.equal(e.partMillForSide(p,'y1'),1.5);
  assert.equal(e.partMillForSide(p,'y2'),0);
  const t=e.partMillForSide;
  const thickness=p.edgeThicknesses;
  const net=side=>thickness[side]===2?2-t(p,side):thickness[side];
  assert.equal(net('x1')+net('x2'),3);
  assert.equal(net('y1')+net('y2'),.9);
});
