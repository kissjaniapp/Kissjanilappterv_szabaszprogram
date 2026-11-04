'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
const from=html.indexOf('function buildOfflineXprgProject(');
const to=html.indexOf('\n  // Az indító teljes Windows-útvonalat ad vissza.',from);
assert.ok(from>=0&&to>from,'Hiányzik az XML xPrg/XMix generátor');
const generate=vm.runInNewContext('('+html.slice(from,to).trim()+')',{
  fileName:x=>String(x).normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-zA-Z0-9_-]+/g,'_').slice(0,70)
});
const base=(color='Feya',feed='x',opts={})=>({
  name:opts.name||'Alaptábla',a:opts.a||2800,b:opts.b||2070,
  thickness:18,trim:opts.trim??12,
  machine:{feed,strips:[{index:1,width:opts.width||200,items:[{
    along:opts.along||964,breadth:opts.breadth||200,
    item:{name:'Oldal',materialColor:color}
  }]}]}
});
const exportBundle=(bins,place='Konyha',folder='.\\xPrg\\')=>
  generate(bins,'Szekrény','BLAP003',5,'30/10/2026',folder,'sample',place);
const xprgs=out=>out.files.filter(([name])=>name.endsWith('.xPrg'));
const xmix=out=>out.files.find(([name])=>name.endsWith('.xMix'))[1];

test('a működő mintakód vágássorrendje, fejlécmérete és fűrészrés megmarad',()=>{
 const xml=xprgs(exportBundle([base('Feya')]))[0][1];
 const expected='<SchemaDoc>\r\n'+
  '\t<Header NumFogliPacco="1.00" Descrizione="Feya" Spessore="18.00" Date="30/10/2026" Lunghezza="2800.00" Larghezza="2070.00" SpessoreLama="5.00" Swap="0" />\r\n'+
  '\t<Material Tipologia="" Codice="Feya" />\r\n'+
  '\t<Pattern>\r\n'+
  '\t\t<Cut T="P" Dim="2800.00" Rip="1" ID="0" />\r\n'+
  '\t\t<Cut T="RY" Dim="12.00" Rip="1" ID="1" />\r\n'+
  '\t\t<Cut T="Y" Dim="200.00" Rip="1" ID="2" />\r\n'+
  '\t\t<Cut T="RX" Dim="12.00" Rip="1" ID="3" />\r\n'+
  '\t\t<Cut T="X" Dim="964.00" Rip="1" ID="4" />\r\n'+
  '\t\t<Cut T="F" Dim="0.00" Rip="1" ID="5" />\r\n'+
  '\t</Pattern>\r\n</SchemaDoc>\r\n';
 assert.equal(xml,expected);
});
test('az xPrg anyagkódja és a fejléc leírása mindig a bútorhoz tartozó anyagszín',()=>{
 const out=generate([base('Onixszürke'),base('Freya & natúr')],
    'Szekrény','BLAP003',5,'30/10/2026','.\\xPrg\\','sample','Nappali');
 const colors=['Onixszürke','Freya &amp; natúr'];
 for(const [i,color] of colors.entries()){
  const xml=xprgs(out)[i][1];
  assert.ok(xml.includes('Descrizione="'+color+'"'));
  assert.ok(xml.includes('Codice="'+color+'"'));
  assert.match(xml,/<Pattern>/);
 }
 const mix=xmix(out);
 for(const color of colors)
  assert.ok(mix.includes('Material Tipologia="'+color+'" Codice="'+color+'"'));
 assert.doesNotMatch(mix,/BLAP003/);
});
test('az elavult leírásmód vagy gépi anyagkód nem írhatja felül az anyagszínt',()=>{
 const b=base('Feya');
 const first=generate([b],'B','OLD_CODE',5,'30/10/2026','.\\xPrg\\','sample','Konyha');
 const second=generate([b],'B','OTHER',5,'30/10/2026','.\\xPrg\\','color','Konyha');
 assert.equal(xprgs(first)[0][1],xprgs(second)[0][1]);
 assert.equal(xmix(first),xmix(second));
});
test('az összes tábla egy közös XML xMix-ben, külön xPrg almappában szerepel',()=>{
 for(const count of [1,2,5]){
  const out=exportBundle(Array.from({length:count},()=>base()));
  assert.equal(xprgs(out).length,count);
  assert.equal((xmix(out).match(/<RigaMix File=/g)||[]).length,count);
  assert.equal(out.files.filter(([name])=>name.endsWith('.xMix')).length,1);
  const folder='2026_10_30_Konyha';
  assert.equal(out.cabinetFolder,folder);
  assert.ok(out.files.some(([name])=>name===folder+'/'+out.mixName));
  for(const name of out.names){
   assert.ok(out.files.some(([p])=>p===folder+'/xPrg/'+name));
   assert.ok(xmix(out).includes('File=".\\xPrg\\'+name+'" Rep="1" Pacco="1" CambioMateriale="0"'));
  }
 }
});
test('xMix: a 38 mm-es munkalapok MINDIG a bútorlapok után kerülnek, stabil sorrendben',()=>{
 const worktop=(color,along=964)=>({
   name:'Munkalap '+color,a:4100,b:600,thickness:38,trim:0,
   cuts:[
     {stage:'cross-head-trim',axis:'y',x1:1018.5,length:600},
     {stage:'cross',axis:'y',x1:14.5,length:600,pieceSize:along}
   ],
   machine:{feed:'x',strips:[{
     index:1,width:600,items:[{
       along,breadth:600,item:{name:'Munkalap darab',materialColor:color}
     }]
   }]}
 });
 const boards=[worktop('Kő'),base('Freya','x',{name:'Bútorlap első'}),
   worktop('Munkalap'),base('Fekete','x',{name:'Bútorlap második'})];
 const out=exportBundle(boards);
 const xml=xmix(out);
 const order=Array.from(xml.matchAll(/<RigaMix File="([^"]+)"/g),
   match=>match[1].split('\\').at(-1));
 assert.deepEqual(order,[out.names[1],out.names[3],out.names[0],out.names[2]],
   'előbb minden 18 mm bútorlap, majd minden 38 mm munkalap');
 assert.equal(out.names.length,4);
 assert.equal(xprgs(out).length,4);
 assert.match(xprgs(out)[0][1],/Spessore="38[.]00"/,
   'a generált xPrg fájlok eredeti sorrendje és tartalma változatlan');
 assert.match(xprgs(out)[1][1],/Spessore="18[.]00"/);
 assert.deepEqual(Array.from(xml.matchAll(/<RigaMix /g)).length,4);
});
test('xMix: kizárólag bútorlapok vagy kizárólag munkalapok esetén a sorrend változatlan',()=>{
 const regular=exportBundle([base('A'),base('B'),base('C')]);
 const names=Array.from(xmix(regular).matchAll(/<RigaMix File="([^"]+)"/g),
   match=>match[1].split('\\').at(-1));
 assert.deepEqual(names,regular.names);
});
test('a dátum és a Hová készül mező adja a projektmappa nevét',()=>{
 const out=exportBundle([base()],'Kiss János / konyha');
 assert.equal(out.cabinetFolder,'2026_10_30_Kiss_Janos_konyha');
 assert.ok(out.files.every(([name])=>name.startsWith(out.cabinetFolder+'/')));
});
test('a kipróbált gépi szabály P = Lunghezza; Larghezza a másik táblaméret',()=>{
 for(const [a,b] of [[2800,2070],[1620,785],[753,1983]]){
  for(const feed of ['x','y']){
   const xml=xprgs(exportBundle([base('Feya',feed,{a,b})]))[0][1];
   const p=(feed==='x'?a:b).toFixed(2),other=(feed==='x'?b:a).toFixed(2);
   assert.ok(xml.includes('Lunghezza="'+p+'" Larghezza="'+other+'"'));
   assert.ok(xml.includes('<Cut T="P" Dim="'+p+'" Rip="1" ID="0" />'));
  }
 }
 const shortFeed=xprgs(exportBundle([base('Feya','y',{a:1620,b:785})]))[0][1];
 assert.match(shortFeed,/Lunghezza="785.00" Larghezza="1620.00"/);
});
test('összetett alkatrésznél az U visszaadás és F zárás megmarad',()=>{
 const xml=xprgs(exportBundle([base('Feya','x',{width:400,breadth:300})]))[0][1];
 assert.match(xml,/<Cut T="U" Dim="300.00" Rip="1" ID="5" \/>/);
 assert.match(xml,/<Cut T="F" Dim="0.00" Rip="1" ID="6" \/>/);
});
test('a vágási parancsok száma és ID-ja folytonos',()=>{
 const xml=xprgs(exportBundle([base()]))[0][1];
 const cuts=[...xml.matchAll(/<Cut T="([^"]+)" Dim="([^"]+)" Rip="1" ID="(\d+)" \/>/g)];
 assert.deepEqual(cuts.map(c=>c[1]),['P','RY','Y','RX','X','F']);
 assert.deepEqual(cuts.map(c=>+c[3]),[0,1,2,3,4,5]);
});
test('egyazon táblán nem engedünk eltérő anyagokat összekeverni',()=>{
 const b=base();
 b.machine.strips[0].items.push({along:10,breadth:200,item:{materialColor:'Másik',name:'B'}});
 assert.throws(()=>exportBundle([b]),/több eltérő anyagszín/);
});
test('hiányzó anyagszínnél nem gyárt félrevezető gépi fájlt',()=>{
 assert.throws(()=>exportBundle([base('')]),/anyagszín hiányzik/);
});
test('100 fölötti vágási programot egyértelműen visszautasítunk',()=>{
 const b=base();
 b.machine.strips[0].items=Array.from({length:51},()=>({
  along:20,breadth:200,item:{name:'Sok',materialColor:'Feya'}
 }));
 assert.throws(()=>exportBundle([b]),/99.*korlát/);
});
test('a csomag a relatív xPrg almappát használja, teljes Windows-hivatkozás esetén is konzervatív',()=>{
 const out=exportBundle([base()]);
 assert.equal(out.xprgDirectory,'.\\xPrg\\');
 assert.equal(out.archiveSubdir,'xPrg');
 const other=exportBundle([base()],'Konyha','C:\\WinCut\\Prg\\');
 assert.equal(other.xprgDirectory,'C:\\WinCut\\Prg\\');
 assert.equal(xprgs(other)[0][1],xprgs(out)[0][1]);
 assert.ok(xprgs(other)[0][0].includes('/xPrg/'));
});
test('egyedi Windows útvonal nem írhat át .xPrg fájlnevet és nem enged útvonalbejárást',()=>{
 for(const folder of ['..\\xPrg\\','.\\xPrg\\..\\','C:\\xPrg\\..\\Prg\\','winCut\\Prg\\']){
  assert.throws(()=>exportBundle([base()],'Konyha',folder));
 }
});

test('WinCut Mix két táblánál a teljes X: gépi útvonalat tartalmazza',()=>{
 const baseDir='X:\\JANI\\szabas_programmal\\Legujabb_mentessel';
 const dest='2026_10_30_Teszt';
 const out=generate([base('Freya'),base('Freya')],'Eles vagas','Freya',5,
  '30/10/2026',baseDir+'\\'+dest+'\\xPrg\\','color','Teszt');
 assert.equal(out.cabinetFolder,dest);
 const mix=xmix(out);
 assert.equal((mix.match(/<RigaMix File=/g)||[]).length,2);
 for(const file of out.names){
  assert.ok(mix.includes('File="'+baseDir+'\\'+dest+'\\xPrg\\'+file+'"'));
  assert.ok(out.files.some(([name])=>name===dest+'/xPrg/'+file));
 }
 assert.doesNotMatch(mix,/File="\.\\xPrg\\/);
});
test('egyedi _2 mentési mappánál ugyanaz a tényleges út szerepel a Mixben',()=>{
 const baseDir='X:\\JANI\\szabas_programmal\\Legujabb_mentessel';
 const folder='2026_10_30_Teszt_2';
 const out=generate([base('Freya')],'Eles vagas','Freya',5,'30/10/2026',
    baseDir+'\\'+folder+'\\xPrg\\','color','Teszt',folder);
 assert.equal(out.cabinetFolder,folder);
 assert.match(xmix(out),/File="X:\\JANI\\szabas_programmal\\Legujabb_mentessel\\2026_10_30_Teszt_2\\xPrg\\/);
 assert.ok(out.files[0][0].startsWith(folder+'/'));
});


test('a gépen elfogadott fejléc tartalmazza a Swap=0 jelölést; az xMix leírása a projektből jön',()=>{
 const out=exportBundle([base('Feya')]);
 assert.match(xprgs(out)[0][1], /SpessoreLama="5.00" Swap="0"/);
 assert.match(xmix(out), /<Header Descrizione="Szekrény" Import="" Date="30\/10\/2026"/);
});

test('négy különböző nesting tábla négy különböző xPrg fájlt kap egyetlen xMix alatt',()=>{
 const boards=[
  base('Freya','x',{name:'Lap_01',a:2800,b:2070,width:200,along:964,breadth:200}),
  base('Freya','y',{name:'Lap_02',a:1620,b:785,width:204,along:480,breadth:204}),
  base('Freya','x',{name:'Lap_03',a:1400,b:900,width:300,along:500,breadth:250}),
  base('Freya','y',{name:'Lap_04',a:1800,b:1000,width:320,along:600,breadth:320})
 ];
 const out=exportBundle(boards,'Konyha');
 const programs=xprgs(out);
 assert.equal(out.names.length,4);
 assert.equal(programs.length,4);
 assert.equal(new Set(out.names).size,4);
 assert.equal((xmix(out).match(/<RigaMix File=/g)||[]).length,4);
 assert.equal((out.files.filter(([name])=>name.endsWith('.xMix'))).length,1);
 for(let i=0;i<boards.length;i++){
   const b=boards[i], xml=programs[i][1];
   const feedLength=b.machine.feed==='x'?b.a:b.b;
   const otherLength=b.machine.feed==='x'?b.b:b.a;
   assert.ok(xml.includes('Lunghezza="'+feedLength.toFixed(2)+'" Larghezza="'+otherLength.toFixed(2)+'"'));
   assert.ok(xml.includes('<Cut T="P" Dim="'+feedLength.toFixed(2)+'" Rip="1" ID="0" />'));
   assert.ok(xml.includes('<Cut T="Y" Dim="'+b.machine.strips[0].width.toFixed(2)+'"'));
   assert.ok(xml.includes('<Cut T="X" Dim="'+b.machine.strips[0].items[0].along.toFixed(2)+'"'));
   assert.ok(xmix(out).includes('File=".\\xPrg\\'+out.names[i]+'"'));
   assert.equal(programs[i][0],out.cabinetFolder+'/xPrg/'+out.names[i]);
   const cutIds=[...xml.matchAll(/<Cut T="[^"]+" Dim="[^"]+" Rip="1" ID="(\d+)" \/>/g)].map(x=>+x[1]);
   assert.deepEqual(cutIds,Array.from({length:cutIds.length},(_,j)=>j));
 }
 assert.notEqual(programs[0][1],programs[1][1]);
 assert.notEqual(programs[1][1],programs[2][1]);
 assert.notEqual(programs[2][1],programs[3][1]);
 // A széles csíkból keskenyebb alkatrészhez továbbra is U alábontás szükséges.
 assert.match(programs[2][1],/<Cut T="U" Dim="250.00" Rip="1"/);
});

test('xPrg vízszintes felfekvési méret független a száliránytól és a hosszabbik éltől',()=>{
 const boards=[[2800,2070],[964,400],[400,964],[700,1200],[1200,700]];
 for(const [a,b] of boards){
  for(const [machine,expected] of [['x',a],['y',b]]){
   const out=exportBundle([base('Freya',machine,{a,b})]);
   const xml=xprgs(out)[0][1];
   assert.match(xml,new RegExp('Lunghezza="'+expected.toFixed(2)+'"'));
   assert.match(xml,new RegExp('<Cut T="P" Dim="'+expected.toFixed(2).replace('.','\\.')+'" Rip="1" ID="0"'));
   assert.match(xml,new RegExp('Larghezza="'+(machine==='x'?b:a).toFixed(2)+'"'));
  }
 }
});
test('xMix neve szekrénynévvel és az elkészült táblák darabszámával készül, OFFLINE nélkül',()=>{
 for(const count of [1,2,4,7]){
  const out=exportBundle(Array.from({length:count},()=>base()),'Polcos szekrény');
  assert.equal(out.mixName,'2026_10_30_Szekreny_'+count+'_tablas.xMix');
  assert.ok(!out.mixName.includes('OFFLINE'));
  assert.ok(out.files.some(([name])=>name===out.cabinetFolder+'/'+out.mixName));
  assert.equal((xmix(out).match(/<RigaMix File=/g)||[]).length,count);
 }
});
