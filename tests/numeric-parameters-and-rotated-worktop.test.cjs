'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
const section=(a,b)=>{
  const i=html.indexOf(a),j=html.indexOf(b,i+a.length);
  assert.ok(i>=0&&j>i,'Nem található: '+a);
  return html.slice(i,j);
};
const custom=section('  function makeCustomPartDefinition(){','  function startSeriesEditor(');
const formulas=section('function calc(formula,vars){','  function getParts(){');
const partCode=section('  function getParts(){','  function intro(');
function furniture(id,value){
  return {id,name:'Szekrény '+id,qty:1,w:1000,ht:1500,d:600,t:18,s:0,
    customParameters:[{id:id+'-rule',name:'szokli',value:String(value),condition:'',parts:[]}],
    parts:[
      {id:id+'-front',name:'Szokli elöl',a:'W-2*T',b:'150',q:'1',
        ifCondition:'szokli=1 || [szokli]==3'},
      {id:id+'-side-one',name:'Szokli oldal 1',a:'D-2*T',b:'150',q:'1',
        ifCondition:'szokli>=2'},
      {id:id+'-side-two',name:'Szokli oldal 2',a:'D-2*T',b:'150',q:'1',
        ifCondition:'[szokli]==3'}
    ].map(p=>({...p,edge:'0-0',edgeThickness:2,mill:false}))
  };
}
function run(furnitures){
  let count=0;
  return vm.runInNewContext('(function(){'+custom+formulas+partCode+
    ';return {getParts,calcPartFormula,namedFurnitureParameter,evaluateFurnitureIf,customParameterStatus};})()',{
    state:{furnitures},uuid:()=>String(++count),h:x=>String(x??''),
    effectiveShelves:()=>0,effectiveDivider:()=>0,
    materialForPart:()=>({thickness:18,color:'Freya'}),
    sidesFromCode:()=>({x1:false,x2:false,y1:false,y2:false}),
    pnum:Number
  });
}
test('szokli=1: csak egy elülső alkatrész',()=>{
  const f=furniture('a',1),r=run([f]).getParts();
  assert.equal(r.total,1);
  assert.deepEqual(Array.from(r.rows.filter(x=>x.qty>0),x=>x.part.name),['Szokli elöl']);
});
test('szokli=2: csak egy oldalsó alkatrész',()=>{
  const f=furniture('a',2),r=run([f]).getParts();
  assert.equal(r.total,1);
  assert.deepEqual(Array.from(r.rows.filter(x=>x.qty>0),x=>x.part.name),['Szokli oldal 1']);
});
test('szokli=3: egy elülső és két oldalsó alkatrész',()=>{
  const f=furniture('a',3),r=run([f]).getParts();
  assert.equal(r.total,3);
  assert.deepEqual(Array.from(r.rows.filter(x=>x.qty>0),x=>x.part.name),
    ['Szokli elöl','Szokli oldal 1','Szokli oldal 2']);
});
test('a numerikus paraméter valódi értéke méret-, darabszám- és IF-képletben megmarad',()=>{
  const f=furniture('a',3),e=run([f]),v={W:1000,H:1500,D:600,T:18,S:0,O:0};
  assert.equal(e.namedFurnitureParameter('szokli',v,f),3);
  assert.equal(e.calcPartFormula('W-[szokli]*10',v,f,f.parts[0]),970);
  assert.equal(e.calcPartFormula('[szokli]-1',v,f,f.parts[0],'q'),2);
  assert.equal(e.evaluateFurnitureIf('szokli=2',v,f,f.parts[0]),false);
  assert.equal(e.evaluateFurnitureIf('szokli==3',v,f,f.parts[0]),true);
  assert.equal(e.evaluateFurnitureIf('[szokli]!=2',v,f,f.parts[0]),true);
});
test('azonos nevű paraméter két bútor között nem keveredhet át',()=>{
  const a=furniture('a',1),b=furniture('b',3),e=run([a,b]);
  assert.equal(e.getParts().total,4);
  b.customParameters[0].value='2';
  assert.equal(e.getParts().total,2);
  assert.equal(a.customParameters[0].value,'1');
});
test('hibás vagy üres számértékből nem lesz gépi alkatrész',()=>{
  for(const value of ['','1.5','-1','100','abc']){
    const f=furniture('a',value),r=run([f]).getParts();
    assert.equal(r.total,0,'hibás paraméter: '+value);
    assert.ok(r.errors.some(e=>/IF/.test(e)),'hibaüzenet: '+value);
  }
});
test('régi feltételes paraméter számérték nélkül megőrzi az igen/nem működést',()=>{
  const f=furniture('a',1);
  delete f.customParameters[0].value;
  f.customParameters[0].condition='W>=1100';
  const e=run([f]);
  assert.equal(e.getParts().total,0);
  f.w=1200;
  assert.equal(e.getParts().total,1);
});
test('a 38 mm munkalap minden vágásvonala vízszintes a 90°-os rajzon',()=>{
  const strip=section('  const STANDARD_BOARD=','  // Gyártási sorrend:');
  const draw=section('  function svgBoardSize(bin,compact=false){','  function trimmingSteps(');
  const solve=vm.runInNewContext('(function(){'+strip+';return makeStripPlan;})()',{
    state:{trim:10,kerf:5,boards:[]},remnantCatalog:[]
  });
  const row={furniture:{name:'Konyha',materialColor:'Fehér'},part:{id:'p',name:'Munkalap'},
    qty:4,a:800,b:600,originalA:800,originalB:600,thickness:38,materialColor:'Fehér',
    rot:false,edge:'0-0',edgeThickness:2,mill:false,millDepth:0};
  const bins=solve(0,{rows:[row]},'auto').bins;
  assert.equal(bins.length,1);
  const functions=vm.runInNewContext('(function(){'+draw+';return {svgBoard,svgBoardSize};})()',{
    state:{cutDirection:'auto'},result:null,colors:['#dcebdd'],h:x=>String(x),nfmt:x=>String(x)
  });
  const bin=bins[0],size=functions.svgBoardSize(bin);
  assert.equal(size.rotated,true);
  assert.equal(size.boardWidth,600);
  assert.equal(size.boardHeight,4100);
  const svg=functions.svgBoard(bin);
  assert.match(svg,/CSAK VÍZSZINTES VÁGÁS/);
  assert.doesNotMatch(svg,/KEZDŐVÁGÁS FELÜLRŐL/);
  // A két gépi menet most KÜLÖN rajzon van, így a munkalap
  // három méretre vágásához három vízszintes vágásvonal jelenik meg.
  const lines=[...svg.matchAll(/<path d="M([\d.]+) ([\d.]+)L([\d.]+) ([\d.]+)" stroke="#(?:c45b34|bd805b)" stroke-width="(?:8|4|3)"/g)];
  assert.ok(lines.length>=3,'a második menet vízszintes vágásai megjelennek');
  for(const cut of lines){
    assert.equal(Number(cut[2]),Number(cut[4]),'függőleges vágás jelenik meg');
    assert.notEqual(Number(cut[1]),Number(cut[3]),'nem valós vízszintes vágás');
  }
  assert.equal(bin.machine.feed,'x','az xPrg gépi parancssora változatlan');
  assert.ok(bin.cuts.every(c=>c.stage==='cross'),'nem keletkezhet hosszanti alábontás');
});
