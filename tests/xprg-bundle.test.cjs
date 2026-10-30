'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
const from=html.indexOf('function buildOfflineXprgProject(');
const to=html.indexOf('\n  // A Chromium showDirectoryPicker',from);
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
  '\t<Header NumFogliPacco="1.00" Descrizione="Feya" Spessore="18.00" Date="30/10/2026" Lunghezza="2070.00" Larghezza="2800.00" SpessoreLama="5.00" />\r\n'+
  '\t<Material Tipologia="" Codice="Feya" />\r\n'+
  '\t<Pattern>\r\n'+
  '\t\t<Cut T="P" Dim="2070.00" Rip="1" ID="0" />\r\n'+
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
test('a dátum és a Hová készül mező adja a projektmappa nevét',()=>{
 const out=exportBundle([base()],'Kiss János / konyha');
 assert.equal(out.cabinetFolder,'2026_10_30_Kiss_Janos_konyha');
 assert.ok(out.files.every(([name])=>name.startsWith(out.cabinetFolder+'/')));
});
test('a kezdő P mérete minden gépállásban egyezik a fejléccel',()=>{
 for(const [a,b] of [[2800,2070],[753,1983],[2070,2800]]){
  for(const feed of ['x','y']){
   const xml=xprgs(exportBundle([base('Feya',feed,{a,b})]))[0][1];
   const actual=xml.match(/<Cut T="P" Dim="([0-9.]+)"/)[1];
   const expected=(feed==='x'?b:a).toFixed(2);
   assert.equal(actual,expected);
   assert.ok(xml.includes('Lunghezza="'+expected+'"'));
  }
 }
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
