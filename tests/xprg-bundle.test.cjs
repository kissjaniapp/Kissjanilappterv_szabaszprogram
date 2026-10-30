'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','app','index.htm'),'utf8');
const a=html.indexOf('function buildOfflineXprgProject(');
const b=html.indexOf('\n  async function downloadXprgProject()',a);
assert.ok(a>=0&&b>a,'Hiányzik a projekt alapú XPrg/XMix generáló');
const generate=vm.runInNewContext('('+html.slice(a,b).trim()+')',{
  fileName:x=>String(x).normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-zA-Z0-9_-]+/g,'_').slice(0,70)
});
const base=(complex=false,name='Feya',boardName='Feya 2800x2070')=>({
  name:boardName,a:2800,b:2070,thickness:18,trim:10,
  machine:{feed:'x',strips:[{index:1,width:400,items:[{
    along:700,breadth:complex?300:400,item:{name:'Fiók fenék',materialColor:name}
  }]}]}
});

test('a mai dátum, szekrénynév, táblanév és tábla száma szerepel a fájlnevekben',()=>{
  const out=generate([base(),base()], 'Konyha szekreny','BLAP003',5,'29/10/2026');
  assert.deepEqual(Array.from(out.names),[
    '2026_10_29_Konyha_szekreny_Feya_2800x2070_tabla_01.xPrg',
    '2026_10_29_Konyha_szekreny_Feya_2800x2070_tabla_02.xPrg'
  ]);
  const mix=out.files.find(([n])=>n.endsWith('.xMix'))[1];
  assert.ok(mix.startsWith('<xMix>\r\n\t<Header Descrizione="" Import="" Date="29/10/2026" />\r\n'));
  assert.match(mix,/<Material Tipologia="Feya" Codice="BLAP003" Quantita="999" \/>/);
  assert.equal((mix.match(/<RigaMix File=/g)||[]).length,2);
  assert.equal(out.files.filter(([n])=>n.endsWith('.xPrg')).length,2);
  for(const name of out.names){
    assert.ok(mix.includes('File=".\\xPrg\\'+name+'" Rep="1" Pacco="1" CambioMateriale="0"'));
    assert.ok(out.files.some(([p])=>p==='Konyha_szekreny/xPrg/'+name));
  }
  assert.ok(out.files.some(([p])=>p==='Konyha_szekreny/'+out.mixName));
  assert.equal(out.cabinetFolder,'Konyha_szekreny');
  assert.equal(out.xprgDirectory,'.\\xPrg\\');
  assert.equal(out.archiveSubdir,'xPrg');
  assert.equal(out.relativeXprgDirectory,true);
  assert.equal(out.complexBoards,0);
});
test('a közös XML xMix tetszőleges táblaszámhoz egy-egy RigaMix sort ír',()=>{
  for(const n of [1,2,3,5]){
    const out=generate(Array.from({length:n},()=>base()),'Szekreny','BLAP003',5,'29/10/2026');
    const mix=out.files.find(([p])=>p.endsWith('.xMix'))[1];
    assert.equal((mix.match(/<RigaMix File=/g)||[]).length,n);
    assert.equal((mix.match(/<Material /g)||[]).length,1);
    assert.ok(mix.trimEnd().endsWith('</xMix>'));
    assert.equal(new Set(out.names).size,n);
  }
});
test('az összetett táblánál is SchemaDoc a gyökér és X-U-F a részvágás',()=>{
  const out=generate([base(),base(true)],'Konyha','BLAP003',5,'29/10/2026');
  assert.equal(out.complexBoards,1);
  const xml=out.files.find(([p])=>p==='Konyha/xPrg/'+out.names[1])[1];
  assert.ok(xml.startsWith('<SchemaDoc>\r\n'));
  assert.match(xml,/<Header NumFogliPacco="1.00" Descrizione="Feya" Spessore="18.00" Date="29\/10\/2026" Lunghezza="2800.00" Larghezza="2070.00" SpessoreLama="5.00"/);
  assert.match(xml,/<Material Tipologia="" Codice="BLAP003" \/>/);
  assert.match(xml,/<Pattern>\r\n/);
  assert.match(xml,/<Cut T="X" Dim="700.00" Rip="1" ID="4" \/>/);
  assert.match(xml,/<Cut T="U" Dim="300.00" Rip="1" ID="5" \/>/);
  assert.match(xml,/<Cut T="F" Dim="0.00" Rip="1" ID="6" \/>/);
  assert.ok(xml.trimEnd().endsWith('</SchemaDoc>'));
  assert.doesNotMatch(xml,/<LaptervOfflineReview/);
  assert.match(out.files.find(([n])=>n.endsWith('.xMix'))[1],/<RigheMix>/);
  assert.equal(out.files.length,3);
  assert.ok(out.files.every(([path])=>/\.(?:xMix|xPrg)$/.test(path)));
  assert.equal(out.files.filter(([path])=>path.endsWith('.xMix')).length,1);
  // A fizikai célútvonal csak a Mix szövegében szerepelhet.
  assert.ok(out.files.filter(([path])=>path.endsWith('.xPrg'))
    .every(([,source])=>!source.includes('X:\\JANI\\szabas_programmal\\')));
});
test('a szekrénynév nem szúrhat be meghajtót az XML fájlhivatkozásába',()=>{
  const out=generate([base()],'Konyha / nappali: A&B','BLAP003',5,'29/10/2026');
  const mix=out.files.find(([n])=>n.endsWith('.xMix'))[1];
  assert.doesNotMatch(mix,/nappali:|A&B|\\nappali/);
  assert.match(mix,/<RigaMix File="\.\\xPrg\\/);
  assert.equal(out.names.length,1);
  assert.equal(out.files.length,2);
});
test('a ZIP-ben az xMix mellett a hivatkozott xPrg almappa található',()=>{
  const out=generate([base(),base(),base(true)],'Szekrény konyhába','BLAP003',5,'29/10/2026');
  const folder='Szekreny_konyhaba';
  const programs=out.files.filter(([name])=>name.endsWith('.xPrg')||name.endsWith('.xMix'));
  assert.equal(programs.length,4);
  assert.equal(programs.filter(([name])=>name.endsWith('.xMix'))[0][0],folder+'/'+out.mixName);
  const mix=programs.find(([name])=>name.endsWith('.xMix'))[1];
  for(const name of out.names){
    assert.ok(mix.includes('File=".\\xPrg\\'+name+'"'));
    assert.ok(programs.some(([path])=>path===folder+'/xPrg/'+name));
  }
  assert.doesNotMatch(mix,/X:\\JANI\\szabas_programmal\\/);
});
test('egyszerű táblánál pontos XPrg minta: SchemaDoc, P-RY-Y-RX-X-F, folyamatos ID',()=>{
  const out=generate([base()],'Konyha','BLAP003',5,'29/10/2026');
  const xml=out.files.find(([p])=>p.endsWith('.xPrg'))[1];
  assert.ok(xml.startsWith('<SchemaDoc>\r\n\t<Header'));
  const cuts=[...xml.matchAll(/<Cut T="(\w+)" Dim="(\d+\.\d{2})" Rip="1" ID="(\d+)" \/>/g)];
  assert.deepEqual(cuts.map(m=>m[1]),['P','RY','Y','RX','X','F']);
  assert.deepEqual(cuts.map(m=>Number(m[3])),[0,1,2,3,4,5]);
  assert.equal(cuts[0][2],'2070.00');
  assert.equal(cuts[1][2],'10.00');
  assert.equal(cuts[2][2],'400.00');
  assert.equal(cuts[4][2],'700.00');
  assert.equal(out.complexBoards,0);
});
test('100 vagy több vágási parancs helyett a generátor világos hibát ad',()=>{
  const lots=base();
  lots.machine.strips[0].items=Array.from({length:51},()=>({
    along:20,breadth:400,item:{name:'Elem',materialColor:'Feya'}
  }));
  assert.throws(()=>generate([lots],'Szekreny','BLAP003',5,'29/10/2026'),/99.*korlát/);
});

test('egyéni abszolút Windows-mappa csak az xMix-ben szerepel',()=>{
  const out=generate([base(),base(true)],'Konyha','BLAP003',5,'29/10/2026','C:\\WinCut\\Prg\\');
  assert.equal(out.files.length,3);
  assert.equal(out.xprgDirectory,'C:\\WinCut\\Prg\\');
  assert.equal(out.relativeXprgDirectory,false);
  for(const [path,content] of out.files){
    assert.equal(content.includes('C:\\WinCut\\Prg\\'),path.endsWith('.xMix'));
  }
  assert.ok(out.files.filter(([path])=>path.endsWith('.xPrg')).every(([path])=>path.startsWith('Konyha/xPrg/')));
});
test('működő XML xMix Header, Materials és RigheMix szerkezete megmarad',()=>{
 for(const count of [1,2,4]){
  const out=generate(Array.from({length:count},()=>base()),'Konyha','BLAP003',5,'30/10/2026');
  const mix=out.files.find(([name])=>name.endsWith('.xMix'))[1];
  assert.ok(mix.startsWith('<xMix>\r\n\t<Header Descrizione="" Import="" Date="30/10/2026" />\r\n'));
  assert.match(mix,/\t<Materials>\r\n\t\t<Material Tipologia="Feya" Codice="BLAP003" Quantita="999" \/>\r\n\t<\/Materials>/);
  assert.match(mix,/\t<RigheMix>\r\n/);
  assert.equal((mix.match(/<RigaMix File=/g)||[]).length,count);
  assert.equal(out.files.filter(([name])=>name.endsWith('.xPrg')).length,count);
 }
});
test('XML xMix: minden táblaprogram egy RigaMix sor Rep/Pacco/CambioMateriale adatokkal',()=>{
 const out=generate([base(),base(),base()],'Konyha','BLAP003',5,'30/10/2026');
 const mix=out.files.find(([name])=>name.endsWith('.xMix'))[1];
 const rows=mix.split('\r\n').filter(line=>line.includes('<RigaMix File='));
 assert.equal(rows.length,3);
 for(const [i,row] of rows.entries()){
  assert.equal(row,'\t\t<RigaMix File=".\\xPrg\\'+out.names[i]+'" Rep="1" Pacco="1" CambioMateriale="0" />');
 }
 assert.ok(out.names.every(name=>name.endsWith('.xPrg')));
 assert.ok(out.files.filter(([name])=>name.endsWith('.xPrg')).every(([,xml])=>xml.startsWith('<SchemaDoc>')));
});
test('xPrg fejléc = szabásrajz teteje / bal oldala minden gépállásban',()=>{
 const sizes=[{a:2800,b:2070},{a:2070,b:2800}];
 const svgBegin=html.indexOf('function svgBoardSize(');
 const svgEnd=html.indexOf('\n  function svgBoard(',svgBegin);
 assert.ok(svgBegin>=0&&svgEnd>svgBegin,'Nincs rajzméret-számoló');
 for(const size of sizes){
  for(const feed of ['x','y']){
   const bin=base();
   bin.a=size.a;bin.b=size.b;bin.machine.feed=feed;
   const displaySize=vm.runInNewContext('('+html.slice(svgBegin,svgEnd).trim()+')',{
     result:{cutAxis:feed},state:{cutDirection:feed}
   })(bin);
   assert.equal(displaySize.boardWidth,feed==='y'?size.b:size.a);
   assert.equal(displaySize.boardHeight,feed==='y'?size.a:size.b);
   const out=generate([bin],'Teszt','BLAP003',5,'30/10/2026');
   const xml=out.files.find(([name])=>name.endsWith('.xPrg'))[1];
   const header=xml.match(/<Header\s+[^>]+\/>/);
   assert.ok(header);
   assert.match(header[0],new RegExp('Lunghezza="'+displaySize.boardWidth.toFixed(2)+'"'));
   assert.match(header[0],new RegExp('Larghezza="'+displaySize.boardHeight.toFixed(2)+'"'));
   const actualP=xml.match(/<Cut T="P" Dim="([0-9.]+)"/);
   assert.ok(actualP);
   assert.equal(actualP[1],(feed==='x'?size.b:size.a).toFixed(2),
     'A kezdő P parancs beadásirányhoz kötött méretét megtartjuk');
  }
 }
});

test('az xPrg Header Descrizione a bútor anyagszíne, nem a gépi anyagkód vagy készlettáblanév',()=>{
  const bin=base(false,'Freya','Alaptábla · automatikus');
  const out=generate([bin],'Proba','BLAP003',5,'30/10/2026');
  const xml=out.files.find(([name])=>name.endsWith('.xPrg'))[1];
  assert.match(xml,/<Header[^>]*Descrizione="Freya"/);
  assert.match(xml,/<Material Tipologia="" Codice="BLAP003" \/>/);
  assert.doesNotMatch(xml,/Descrizione="BLAP003"/);
  assert.doesNotMatch(xml,/Descrizione="Alaptábla/);
  assert.match(xml,/<Cut T="P" Dim="2070.00" Rip="1" ID="0" \/>/);
});
test('a leírás külön készül minden táblához, a táblaprogramok vágási parancsai érintetlenek',()=>{
  const first=base(false,'Freya');
  const second=base(false,'Fehér tölgy');
  const out=generate([first,second],'Szekreny','BLAP003',5,'30/10/2026');
  const programs=out.files.filter(([name])=>name.endsWith('.xPrg'));
  assert.equal(programs.length,2);
  assert.match(programs[0][1],/Descrizione="Freya"/);
  assert.match(programs[1][1],/Descrizione="Fehér tölgy"/);
  assert.equal(programs[0][1].match(/<Cut /g).length,programs[1][1].match(/<Cut /g).length);
  assert.equal(programs[0][1].replace(/Descrizione="[^"]*"/,'Descrizione=""'),
               programs[1][1].replace(/Descrizione="[^"]*"/,'Descrizione=""'));
});
test('az anyagszínt XML-biztosan írja, az anyagkód külön marad',()=>{
  const bin=base(false,'Fehér & natúr "dekor"');
  const out=generate([bin],'Teszt','BLAP003',5,'30/10/2026');
  const xml=out.files.find(([name])=>name.endsWith('.xPrg'))[1];
  assert.match(xml,/Descrizione="Fehér &amp; natúr &quot;dekor&quot;"/);
  assert.match(xml,/Codice="BLAP003"/);
});
test('ha egy táblán különböző anyagszínek keverednek, ne adjunk félrevezető gépi leírást',()=>{
  const bin=base();
  bin.machine.strips[0].items.push({
    along:300,breadth:400,item:{name:'Másik elem',materialColor:'Másik szín'}
  });
  assert.throws(()=>generate([bin],'Teszt','BLAP003',5,'30/10/2026'),/több eltérő anyagszín/);
});
test('hiányzó anyagszínt ne írja ki tévesen BLAP003 anyagmegnevezésként',()=>{
  const bin=base(false,'');
  const out=generate([bin],'Teszt','BLAP003',5,'30/10/2026');
  const xml=out.files.find(([name])=>name.endsWith('.xPrg'))[1];
  assert.match(xml,/Descrizione=""/);
  assert.match(xml,/Codice="BLAP003"/);
});

test('két különböző tábla anyagszíne az xMix Materials szakaszában is szerepel',()=>{
 const out=generate([base(false,'Freya'),base(false,'Onixszürke')],'Konyha','U960',5,'30/10/2026');
 const mix=out.files.find(([name])=>name.endsWith('.xMix'))[1];
 assert.match(mix,/<Material Tipologia="Freya" Codice="U960" Quantita="999" \/>/);
 assert.match(mix,/<Material Tipologia="Onixszürke" Codice="U960" Quantita="999" \/>/);
 assert.equal((mix.match(/<Material /g)||[]).length,2);
 assert.equal((mix.match(/<RigaMix /g)||[]).length,2);
});
test('saját relatív mappa esetén a ZIP-beli elhelyezés és az XML referencia pontosan egyezik',()=>{
 const out=generate([base()],'Konyha','BLAP003',5,'30/10/2026','.\\Gep\\Programok\\');
 const xml=out.files.find(([name])=>name.endsWith('.xMix'))[1];
 assert.match(xml,/File="\.\\Gep\\Programok\\/);
 assert.equal(out.files.find(([name])=>name.endsWith('.xPrg'))[0],
   'Konyha/Gep/Programok/'+out.names[0]);
});
test('tiltott útvonal és mappa helyett .xPrg fájlnév visszautasítva',()=>{
 for(const folder of ['..\\xPrg\\','.\\xPrg\\..\\','C:\\xPrg\\..\\Prg\\',
   '.\\cut.xPrg','.\\xPrg\\evil?.xPrg','winCut\\Prg\\']){
  assert.throws(()=>generate([base()],'Konyha','BLAP003',5,'30/10/2026',folder));
 }
});
test('UNC hálózati gépi útvonal a Mix-ben hivatkozik a szerverre, a ZIP biztonságos marad',()=>{
 const out=generate([base()],'Konyha','BLAP003',5,'30/10/2026','\\\\SAW\\Share\\Prg\\');
 const mix=out.files.find(([name])=>name.endsWith('.xMix'))[1];
 assert.match(mix,/File="\\\\SAW\\Share\\Prg\\/);
 assert.ok(out.files.find(([name])=>name.endsWith('.xPrg'))[0].startsWith('Konyha/xPrg/'));
});
test('a gépi vágási parancsok nem módosulnak az xMix útvonal beállításától',()=>{
 const b=base(true);
 const a=generate([b],'Konyha','BLAP003',5,'30/10/2026','.\\xPrg\\');
 const c=generate([b],'Konyha','BLAP003',5,'30/10/2026','D:\\Gepek\\Prg\\');
 assert.equal(a.files.find(([name])=>name.endsWith('.xPrg'))[1],
              c.files.find(([name])=>name.endsWith('.xPrg'))[1]);
});
