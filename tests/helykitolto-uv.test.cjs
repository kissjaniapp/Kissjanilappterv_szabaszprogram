'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const hash=value=>require('node:crypto').createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
const block=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)+a.length));
const code=block('  const STANDARD_BOARD=','  // Gyártási sorrend:');
const productionCode=block('  function buildProductionSequence(bins){','  function computeNesting(){');
const exportCode=block('  function buildOfflineXprgProject(','  // Az indító teljes Windows-útvonalat ad vissza.');
const save=vm.runInNewContext('(function(){'+exportCode+';return buildOfflineXprgProject;})()',{
 fileName:s=>String(s).replace(/[^A-Za-z0-9_-]/g,'_')});
const production=vm.runInNewContext('(function(){'+productionCode+';return buildProductionSequence;})()');
function row(name,a,b,qty=1,rot=false,color='Freya',thickness=18){return {
 part:{id:name,name},furniture:{name:'Minta',materialColor:color},materialColor:color,
 qty,a,b,originalA:a,originalB:b,thickness,rot,edge:'0-0'};}
function plan(rows,feed='x',layoutMode='fill',mode=0,kerf=5){
 const pack=vm.runInNewContext('(function(){'+code+';return makeStripPlan;})()',{
  state:{kerf,trim:15,boards:[],layoutMode}});
 return pack(mode,{rows,total:rows.reduce((n,r)=>n+r.qty,0),errors:[]},feed);
}
function check(result,rows,kerf=5){
 assert.equal(result.failed.length,0);
 const parts=result.bins.flatMap(b=>b.placements);
 assert.equal(parts.length,rows.reduce((n,r)=>n+r.qty,0));
 for(const row of rows)assert.equal(parts.filter(p=>p.part.name===row.part.name).length,row.qty);
 for(const bin of result.bins){
  const events=production([bin]);
  assert.ok(bin.cuts.every(c=>Number.isInteger(c.boardOrder)&&c.boardOrder>0));
  assert.equal(new Set(bin.cuts.map(c=>c.boardOrder)).size,events.totalCuts);
  for(const p of bin.placements){
   assert.ok(p.x>=0&&p.y>=0&&p.x+p.realW<=bin.a+.001&&p.y+p.realH<=bin.b+.001);
   if(!p.part.rot)assert.equal(p.turned,false);
  }
  for(let i=0;i<bin.placements.length;i++)for(let j=i+1;j<bin.placements.length;j++){
   const p=bin.placements[i],q=bin.placements[j];
   assert.ok(p.x+p.realW+kerf<=q.x+.001||q.x+q.realW+kerf<=p.x+.001||
    p.y+p.realH+kerf<=q.y+.001||q.y+q.realH+kerf<=p.y+.001,'kerf / átfedés');
  }
 }
 const bundle=save(result.bins,'Minta','Freya',kerf,'16/11/2026');
 const programs=bundle.files.filter(([name])=>name.endsWith('.xPrg')).map(([,text])=>text);
 programs.forEach((xml,i)=>{
  const cuts=[...xml.matchAll(/<Cut T="([^"]+)" Dim="([^"]+)" Rip="1" ID="(\d+)"/g)];
  assert.equal(cuts.length,result.bins[i].machine.commandCount);
  assert.ok(cuts.length<=99);
  // Független parancsdekóder: az X/U/V-ből visszakapott kész darabok
  // méretei és száma egyezzenek a geometriai tervvel.
  let width=0,length=0,lane=null,hasV=false;const decoded=[];
  for(const cut of cuts){
   const type=cut[1],dim=+cut[2];
   if(type==='Y')width=dim;
   if(type==='X'){length=dim;lane=null;hasV=false;}
   if(type==='U'){lane=dim;hasV=false;}
   if(type==='V'){decoded.push([dim,lane]);hasV=true;}
   if(type==='F'){
    if(!hasV)decoded.push([length,lane??width]);
    lane=null;hasV=false;
   }
  }
  const actual=result.bins[i].placements.map(p=>result.bins[i].machine.feed==='x'?
   [p.realW,p.realH]:[p.realH,p.realW]);
  const sorted=values=>Array.from(values,pair=>Array.from(pair,n=>n.toFixed(2)).join('x')).sort();
  assert.deepEqual(sorted(decoded),sorted(actual));
  assert.deepEqual(cuts.map(c=>+c[3]),cuts.map((_,i)=>i));
 });
 return programs;
}
test('a tulajdonosi példa X-blokkon belüli U és V vágásokat, ismétlést és két táblát tartalmaz',()=>{
 const text=fs.readFileSync(path.join(__dirname,'../fixtures/helykitolto-uv-reference.xPrg'),'utf8');
 assert.match(text,/NumFogliPacco="2.00"/);
 assert.match(text,/<Cut T="U" Dim="72.00" Rip="2"/);
 assert.match(text,/<Cut T="U" Dim="626.00"[^>]*>\s*<Cut T="V" Dim="882.00"[^>]*>\s*<Cut T="V" Dim="149.00"/);
});
test('a keskeny darab melletti blokkmaradék U-sávot és V készméretet kap',()=>{
 const rows=[row('Nagy',1800,600),row('Keskeny',900,400),row('Oldalsó kitöltő',700,150)];
 const result=plan(rows),xml=check(result,rows)[0];
 const strips=result.bins[0].machine.strips;
 assert.equal(strips.length,1);assert.equal(strips[0].items.length,2);
 assert.equal(strips[0].items[1].lanes[1].items[0].item.name,'Oldalsó kitöltő');
 assert.match(xml,/<Cut T="X" Dim="900.00"[^>]*>\s*<Cut T="U" Dim="400.00"[^>]*>\s*<Cut T="F"[^>]*>\s*<Cut T="U" Dim="150.00"[^>]*>\s*<Cut T="V" Dim="700.00"/);
});
test('azonos U-sávban több V darab következhet, a fűrészréssel együtt',()=>{
 const rows=[row('Nagy',1800,600),row('Keskeny',900,400),row('A',500,150),row('B',350,150)];
 const result=plan(rows),xml=check(result,rows)[0];
 assert.match(xml,/<Cut T="V" Dim="500.00"[^>]*>\s*<Cut T="V" Dim="350.00"/);
 assert.equal(result.bins[0].machine.strips.length,1);
});
test('az új alábontás kevesebb csíkszélességet foglal a régi tervnél',()=>{
 const rows=[row('Nagy',1800,600),row('Keskeny',900,400),row('A',500,150),row('B',350,150)];
 const fill=plan(rows),legacy=plan(rows,'x','machine');
 check(fill,rows);check(legacy,rows);
 assert.ok(fill.bins[0].machine.feedUsed<legacy.bins[0].machine.feedUsed);
 assert.ok(!legacy.bins.some(b=>b.machine.strips.some(s=>s.items.some(p=>p.lanes))));
});
test('mindkét gépállásban és több keresési változatban minden darab egyszer, kerffel fér el',()=>{
 for(const feed of ['x','y','auto','long','short'])for(const mode of [0,1,12,42]){
  const rows=[row('Nagy',1800,600),row('Keskeny',900,400),row('A',500,150),row('B',350,150)];
  check(plan(rows,feed,'fill',mode),rows);
 }
});
test('más szín nem kerülhet a blokk oldalsó maradékába',()=>{
 const rows=[row('Nagy',1800,600),row('Keskeny',900,400),row('Idegen',700,150,1,false,'Fehér')];
 const result=plan(rows);check(result,rows);
 assert.equal(result.bins.length,2);
 for(const bin of result.bins)assert.equal(new Set(bin.placements.map(p=>p.part.materialColor)).size,1);
});
test('sok U/V darabnál is pontos a parancsszám, legfeljebb 99 táblánként',()=>{
 const rows=[row('Nagy',1800,600,12),row('Keskeny',900,400,12),row('A',500,150,12),row('B',350,150,12)];
 const result=plan(rows);check(result,rows);
 assert.ok(result.bins.some(b=>b.machine.strips.some(s=>s.items.some(p=>p.lanes))));
});
test('a feltöltött xPrg-ből visszaszámolt összes alkatrész szabható a továbbfejlesztett móddal',()=>{
 // P=2070 -> y gépállás; U az a, V/X a b méret.
 const rows=[row('Fő lap',2000,921),row('72 sáv',72,1064,4),
  row('103 sáv',103,1044),row('99 sáv',99,1044),row('626 nagy',626,882),
  row('626 kicsi',626,149),row('748 nagy',748,848),row('748 kicsi',748,149),
  row('59 kitöltő',59,564,4),row('626 lap',626,2000),row('72 hosszú',72,1214)];
 check(plan(rows,'y'),rows);
});
test('változó raszterméretű darabok, forgatás és 0/3/5 mm kerf: geometria és export egyezik',()=>{
 let seed=12345;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 for(const kerf of [0,3,5])for(let trial=0;trial<6;trial++){
  const rows=Array.from({length:24},(_,i)=>row('Darab'+i,
   100+Math.floor(random()*12)*70,60+Math.floor(random()*9)*55,1,random()>.5));
  check(plan(rows,trial%2?'x':'y','fill',trial,kerf),rows,kerf);
 }
});
test('a régi módok teljes geometriája, gyártási sorrendje és XML-je megegyezik az 1.3.7-tel',()=>{
 const golden=JSON.parse(fs.readFileSync(path.join(__dirname,'../fixtures/helykitolto-legacy-golden.json'),'utf8'));
 for(const expected of golden.cases){
  const result=plan(golden.rows,expected.feed,'machine',expected.mode);
  const sequence=production(result.bins);
  assert.equal(hash(result.bins),expected.bins);
  assert.equal(hash(sequence),expected.production);
  assert.equal(hash(save(result.bins,'Minta','Freya',5,'16/11/2026').files),expected.files);
 }
});
