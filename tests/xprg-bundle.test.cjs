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
  const out=generate([base(),base()], 'Konyha szekreny','LAPTERV_OFFLINE',5,'29/10/2026');
  assert.deepEqual(Array.from(out.names),[
    '2026_10_29_Konyha_szekreny_Feya_2800x2070_tabla_01.xPrg',
    '2026_10_29_Konyha_szekreny_Feya_2800x2070_tabla_02.xPrg'
  ]);
  const mix=out.files.find(([n])=>n.endsWith('.xMix'))[1];
  assert.equal(mix,
    '[Intestazione]\r\nDescrizione=\r\n\r\n[Righe]\r\nNumeroRighe=2\r\n'+
    out.names.map((name,i)=>(i+1)+'=C:\\WinCut\\Prg\\'+name).join('\r\n')+'\r\n');
  assert.equal(out.files.filter(([n])=>n.endsWith('.xPrg')).length,2);
  for(const name of out.names){
    assert.ok(mix.includes('C:\\WinCut\\Prg\\'+name));
    assert.ok(out.files.some(([p])=>p==='WinCut/Prg/'+name));
  }
  assert.equal(out.complexBoards,0);
});
test('a csomag tetszőleges táblaszámhoz pontos NumeroRighe értéket ír',()=>{
  for(const n of [1,3,5]){
    const out=generate(Array.from({length:n},()=>base()),'Szekreny','LAPTERV_OFFLINE',5,'29/10/2026');
    const mix=out.files.find(([p])=>p.endsWith('.xMix'))[1];
    assert.match(mix,new RegExp('NumeroRighe='+n+'\\r\\n'));
    assert.equal((mix.match(/C:\\WinCut\\Prg\\/g)||[]).length,n);
    assert.equal(new Set(out.names).size,n);
  }
});
test('összetett táblát nem ad ki hitelesített gépi SchemaDoc-ként',()=>{
  const out=generate([base(),base(true)],'Konyha','LAPTERV_OFFLINE',5,'29/10/2026');
  assert.equal(out.complexBoards,1);
  const xml=out.files.find(([p])=>p==='WinCut/Prg/'+out.names[1])[1];
  assert.match(xml,/<LaptervOfflineReview MachineExecutable="false"/);
  assert.doesNotMatch(xml,/<SchemaDoc>/);
  assert.match(out.files.find(([n])=>n.endsWith('.xMix'))[1],/\[Righe\]/);
  assert.match(out.files.find(([n])=>n==='FONTOS_OLVASD_EL.txt')[1],/CSAK MINTA|Fizikai gepre/i);
});
test('a szekrénynév útvonalat nem szúrhat be az elérési útba',()=>{
  const out=generate([base()],'Konyha / nappali: A&B','LAPTERV_OFFLINE',5,'29/10/2026');
  const mix=out.files.find(([n])=>n.endsWith('.xMix'))[1];
  assert.doesNotMatch(mix,/nappali:|A&B|\\nappali/);
  assert.match(mix,/^1=C:\\WinCut\\Prg\\/m);
  assert.equal(JSON.parse(out.files.find(([n])=>n.endsWith('.json'))[1]).boardCount,1);
});
