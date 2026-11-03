'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
function section(a,b){
  const i=html.indexOf(a),j=html.indexOf(b,i+a.length);
  assert.ok(i>=0&&j>i,'Hiányzó programrész: '+a);
  return html.slice(i,j);
}
const packing=section('  const STANDARD_BOARD=','  // Gyártási sorrend:');
const drawing=section('  function svgBoardSize(bin,compact=false){','  function trimmingSteps(');
const solve=vm.runInNewContext('(function(){'+packing+';return makeStripPlan;})()',{
  state:{trim:10,kerf:5,boards:[],selectedRemnantIds:[]},remnantCatalog:[]
});
const pictures=vm.runInNewContext('(function(){'+drawing+
  ';return {svgBoard,svgBoardSize};})()',{
  state:{cutDirection:'auto'},result:null,colors:['#dcebdd'],
  h:s=>String(s),nfmt:n=>String(n)
});
const row=(a,b,thickness,qty,color)=>({
  part:{id:'p-'+a+'-'+b,name:'Munkalap / elem'},
  furniture:{name:'Konyha',materialColor:color},
  a,b,originalA:a,originalB:b,thickness,qty,materialColor:color,
  rot:false,edge:'0-0',edgeThickness:2,mill:false,millDepth:1
});
const lines=svg=>[...svg.matchAll(/<path d="M([-\d.]+) ([-\d.]+)L([-\d.]+) ([-\d.]+)" stroke="#(?:c45b34|bd805b)"/g)];
const near=(a,b)=>Math.abs(Number(a)-Number(b))<.001;
test('4100×600 munkalapból 1 alkatrész: kiinduló méret és az 1. vágás a fő rajzon',()=>{
  const out=solve(0,{rows:[row(999,600,38,1,'Freya')]},'auto');
  assert.equal(out.failed.length,0);
  const bin=out.bins[0],svg=pictures.svgBoard(bin);
  const size=pictures.svgBoardSize(bin);
  assert.equal(size.boardWidth,600);
  assert.equal(size.boardHeight,4100);
  assert.equal(size.passHeight,0);
  assert.match(svg,/Kiinduló munkalap: 4100 × 600 × 38 mm/);
  assert.match(svg,/>1[.] VÁGÁS<\/text>/);
  const cuts=lines(svg);
  assert.equal(cuts.length,2,'RY ráhagyásos vágás és Y készméretre vágás is látható');
  assert.ok(near(cuts[0][2],cuts[0][4]),'vízszintes első vágás');
  assert.ok(near(cuts[0][2],bin.cuts[0].x1+size.top),
    'a piros első vágás a valós fizikai koordinátán van');
  assert.equal(Math.abs(Number(cuts[0][1])-Number(cuts[0][3])),600);
  assert.ok(near(bin.cuts[0].x1-bin.cuts[1].x1,999+5),
    'az RX első vágás és X készméretes vágás között egy darab és egy fűrészrés van');
});
test('4100×900 munkalapból több alkatrész: 900 mm széles első vágás',()=>{
  const out=solve(0,{rows:[row(1000,900,38,3,'Márvány')]},'auto');
  assert.equal(out.failed.length,0);
  const bin=out.bins[0],svg=pictures.svgBoard(bin);
  assert.match(svg,/Kiinduló munkalap: 4100 × 900 × 38 mm/);
  assert.match(svg,/>1[.] VÁGÁS<\/text>/);
  const cuts=lines(svg);
  assert.equal(cuts.length,bin.cuts.length);
  assert.equal(cuts.length,4,'három munkalapdarab és az egyszeri RY szélezés');
  for(const c of cuts){
    assert.ok(near(c[2],c[4]),'tilos a függőleges vágásvonal');
    assert.equal(Math.abs(Number(c[1])-Number(c[3])),900);
  }
});
test('több munkalap esetén minden fő rajz saját kiinduló méretet mutat',()=>{
  const out=solve(0,{rows:[
    row(500,600,38,2,'Freya'),row(1000,900,38,2,'Márvány')
  ]},'auto');
  assert.equal(out.failed.length,0);
  assert.equal(out.bins.length,2);
  const sources=out.bins.map(b=>pictures.svgBoard(b));
  assert.ok(sources.some(svg=>svg.includes('4100 × 600 × 38 mm')));
  assert.ok(sources.some(svg=>svg.includes('4100 × 900 × 38 mm')));
  assert.ok(sources.every(svg=>svg.includes('1. VÁGÁS')));
});
test('teljes és maradéktábla: csak a fő szabásztérkép jelenik meg',()=>{
  const examples=[
    solve(0,{rows:[row(964,200,18,3,'Freya')]},'y').bins[0],
    {...solve(0,{rows:[row(1000,900,38,2,'Márvány')]},'auto').bins[0]}
  ];
  for(const bin of examples){
    const svg=pictures.svgBoard(bin),size=pictures.svgBoardSize(bin);
    assert.equal(size.passHeight,0);
    assert.doesNotMatch(svg,/2[.] menet · [0-9]+[.] csík · 90° forgatás/);
    assert.doesNotMatch(svg,/Tábla anyaga:/);
    assert.doesNotMatch(svg,/területi kihasználtság/);
    assert.equal(svg.match(/<svg /g).length,1);
  }
});
test('a kép nem módosítja a gépi parancsokat vagy a tábla adatait',()=>{
  const bin=solve(0,{rows:[row(900,600,38,3,'Freya')]},'auto').bins[0];
  const before=JSON.stringify(bin);
  pictures.svgBoard(bin);
  pictures.svgBoardSize(bin,true);
  assert.equal(JSON.stringify(bin),before);
});
