'use strict';
const {test}=require('node:test'), assert=require('node:assert/strict'), vm=require('node:vm');
const {readFileSync}=require('node:fs'), path=require('node:path');
const main=readFileSync(path.join(__dirname,'..','app','index.htm'),'utf8');
const match=main.match(/const GATTERKA_CABINET_INLINE_HTML=("(?:\\.|[^"\\])*");/s);
assert.ok(match,'A beágyazott bútortervező nem található');
const html=JSON.parse(match[1]);
const script=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0]?.[1];
assert.ok(script,'Az élő bútortervező JavaScript része hiányzik');
const slice=(start,end)=>{
  const a=script.indexOf(start),b=script.indexOf(end,a);
  assert.ok(a>=0&&b>a,start+' hiányzik');return script.slice(a,b);
};
const readCode=slice('function read(){','\nfunction adjustFixed(');
const partsCode=slice('function getStructuredParts(p){','\nlet currentParts=[]');
const make=()=>{
  const state={w:1000,h:910,d:600,t:18,count:3,rabbetWidth:4,
    topHdfCut:'falc',bottomHdfCut:'falc',frontSetback:0,fullBackSetback:0,
    hasTop:true,hasBottom:true,falseBottom:false,
    top:'between',bottom:'between',backType:'rabbet',drilling:'fixed',distribution:'equal',
    raster:32,holes:3,supportInset:50};
  const ctx={
    state,
    $:key=>({value:state[key],checked:Boolean(state[key])}),
    safe:(key,lo,hi)=>Math.max(lo,Math.min(hi,Number(state[key]))),
    choice:key=>state[key],
    choiceHdfCut:key=>state[key]==='trim'?'trim':'falc',
    shelfAngleAt:()=>0,
    shelfBackAt:()=>4,
    shelfDepthAt:p=>p.d-p.front-(p.rabbet?p.rabbetWidth:p.fullBack?p.t+p.fullBackSetback:0),
    baseShelfBack:p=>p.rabbet?p.rabbetWidth:p.fullBack?p.t+p.fullBackSetback:0,
    // A HDF méretét izoláltan teszteljük; az F/V/osztó geometriát külön teszt fedi.
    fixedDividerPieces:()=>[],
    fmt:n=>String(n)
  };
  vm.runInNewContext(readCode+'\n'+partsCode+'\nthis.makeParts=()=>{const p=read();return {p,parts:getStructuredParts(p)};}',ctx);
  return {state,calculate:ctx.makeParts};
};
const hdf=parts=>parts.find(x=>x.key==='back-rabbet');

test('Falcos HDF mindkét oldalon 5,5 mm: W-11, H-11, vastagság 4',()=>{
  const {calculate}=make();
  const {p,parts}=calculate(),plate=hdf(parts);
  assert.equal(p.hdfW,989);assert.equal(p.hdfH,899);
  assert.equal(plate.a,989);assert.equal(plate.b,899);
  assert.equal(plate.thickness,4);assert.equal(plate.ready,true);
  assert.equal(parts.find(x=>x.key==='top').a,964);
});
test('Falcos és visszavágott vegyes: 5,5 + 2 mm magassági levonás',()=>{
  const {state,calculate}=make();
  state.topHdfCut='trim';
  assert.equal(hdf(calculate().parts).b,902.5);
  state.topHdfCut='falc';state.bottomHdfCut='trim';
  assert.equal(hdf(calculate().parts).b,902.5);
  state.topHdfCut='trim';
  assert.equal(hdf(calculate().parts).b,906);
});
test('Végigmenő tetőnél az oldallap magasságából számolja a HDF-et',()=>{
  const {state,calculate}=make();
  state.top='full';const {p,parts}=calculate();
  assert.equal(p.sideH,892);assert.equal(hdf(parts).a,989);assert.equal(hdf(parts).b,881);
});
test('Teli hátlap CNC X=alsó él, DX=magasság, DY=szélesség',()=>{
  const {state,calculate}=make();
  state.backType='full';const {p,parts}=calculate();
  assert.equal(p.innerW,964);assert.equal(p.innerH,874);
  assert.equal(parts.find(x=>x.key==='back-full').a,874);
  assert.equal(parts.find(x=>x.key==='back-full').b,964);
  assert.equal(hdf(parts),undefined);
});
test('4 mm-es bútorlap is választható; a HDF függetlenül 4 mm',()=>{
  const {state,calculate}=make();
  state.t=4;
  const {parts}=calculate();
  assert.equal(parts.find(x=>x.key==='top').thickness,4);
  assert.equal(hdf(parts).thickness,4);
  assert.match(main,/const materialThicknesses=\[4,12,15,18,36\]/);
  assert.match(main,/id:'hdf4',name:'HDF hátfal',thickness:4/);
  assert.match(html,/id="topHdfCut"/);
  assert.match(html,/id="bottomHdfCut"/);
  assert.match(html,/'topHdfCut','bottomHdfCut','hasBottom'/);
});


test('Pótfenék bekapcsolásakor a H teljes külméret nem nő: az oldallap T-vel rövidebb',()=>{
  const {state,calculate}=make();
  const old=calculate();
  assert.equal(old.p.sideH,910);
  assert.equal(old.p.hdfH,899);
  state.falseBottom=true;
  const {p,parts}=calculate();
  assert.equal(p.h,910,'A felhasználó H külmérete változatlan');
  assert.equal(p.bodyBottomOffset,18);
  assert.equal(p.bodyH,892);
  assert.equal(p.sideH,892,'Oldallap 910 - 18 = 892 mm');
  assert.equal(parts.find(x=>x.key==='side-left').a,892);
  assert.equal(parts.find(x=>x.key==='side-left').qty,2,'A két oldal azonos mérettel egy sorban van');
  assert.equal(parts.find(x=>x.key==='side-right'),undefined,'A jobb oldallap nem külön rekord');
  assert.equal(p.innerH,856);
  assert.equal(hdf(parts).a,989);
  assert.equal(hdf(parts).b,881);
  const falseBottom=parts.find(x=>x.key==='false-bottom');
  assert.equal(falseBottom.a,1001,'0,5–0,5 mm túlnyúlás megmarad');
  assert.equal(falseBottom.b,600);
  assert.equal(falseBottom.thickness,18);
  assert.equal(p.hdfBottomOffset,23.5,'18 mm pótfenék + 5,5 mm falc');
});

test('Végigmenő tető és fenék, pótfenék és teli hátfal esetén is H-t követ minden lap',()=>{
  const {state,calculate}=make();
  state.falseBottom=true;
  state.top='full';state.bottom='full';
  let {p,parts}=calculate();
  assert.equal(p.sideH,856,'910 - 18 pótfenék - 18 tető - 18 fenék');
  assert.equal(hdf(parts).b,845,'A falcos HDF a rövidebb oldallapból számolódik');
  state.backType='full';
  ({p,parts}=calculate());
  assert.equal(p.innerH,856);
  assert.equal(parts.find(x=>x.key==='back-full').a,856);
   assert.equal(parts.find(x=>x.key==='back-full').b,964);
  assert.equal(parts.find(x=>x.key==='side-left').a,856);
});

test('Falcos HDF csatlakozóválasztók kizárólag a Hátfal panelben találhatók',()=>{
  const panelStart=html.indexOf('<section class="panel"><div class="panel-head"><h2>▥');
  const panelEnd=html.indexOf('</section>',panelStart);
  assert.ok(panelStart>=0&&panelEnd>panelStart);
  const panel=html.slice(panelStart,panelEnd);
  assert.match(panel,/id="rabbetSettings"/);
  assert.match(panel,/id="topHdfJoin"/);
  assert.match(panel,/id="bottomHdfJoin"/);
  assert.ok(panel.indexOf('id="rabbetSettings"')<panel.indexOf('id="topHdfJoin"'));
  assert.ok(panel.indexOf('id="rabbetSettings"')<panel.indexOf('id="bottomHdfJoin"'));
  assert.doesNotMatch(html.slice(0,panelStart),/id="topHdfJoin"|id="bottomHdfJoin"/);
  assert.match(script,/\$\('rabbetSettings'\)\.classList\.toggle\('hidden',!p\.rabbet\)/);
  assert.match(script,/\$\('topHdfJoin'\)\.classList\.toggle\('hidden',!p\.hasTop\|\|!p\.rabbet\)/);
  assert.match(script,/\$\('bottomHdfJoin'\)\.classList\.toggle\('hidden',!p\.hasBottom\|\|!p\.rabbet\)/);
  const topStart=html.indexOf('<section class="panel"><div class="panel-head"><h2>▤');
  const topEnd=html.indexOf('</section>',topStart);
  const section=html.slice(topStart,topEnd);
  assert.equal((section.match(/<div(?:\s|>)/g)||[]).length,(section.match(/<\/div>/g)||[]).length);
});
