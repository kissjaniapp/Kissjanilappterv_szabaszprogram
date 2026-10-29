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
const base=(complex=false,name='Feya')=>({
  name:'2800x2070',a:2800,b:2070,thickness:18,trim:10,
  machine:{feed:'x',strips:[{index:1,width:400,items:[{
    along:700,breadth:complex?300:400,item:{name:'Fiók fenék',materialColor:name}
  }]}]}
});
test('minden táblához egy külön XPrg és egyetlen XMix készül',()=>{
  const out=generate([base(),base()], 'Teszt bútor','LAPTERV_OFFLINE',5,'29/10/2026');
  assert.equal(out.names.length,2);
  assert.equal(out.files.filter(([n])=>n.endsWith('.xMix')).length,1);
  assert.equal(out.files.filter(([n])=>n.endsWith('.xPrg')).length,2);
  const mix=out.files.find(([n])=>n.endsWith('.xMix'))[1];
  assert.equal((mix.match(/<RigaMix /g)||[]).length,2);
  for(const name of out.names){
    assert.ok(mix.includes('.\\xPrg\\'+name),'Az xMix nem találja: '+name);
    assert.ok(out.files.some(([path])=>path==='xPrg/'+name));
  }
  assert.match(mix,/Tipologia="Feya"/);
  assert.match(mix,/Rep="1" Pacco="1"/);
  assert.equal(out.complexBoards,0);
  assert.equal(out.files.some(([n])=>n==='FONTOS_OLVASD_EL.txt'),true);
});
test('összetett tábla esetén is létrejön XPrg ellenőrző fájl, de nem végrehajtható',()=>{
  const out=generate([base(),base(true)],'Konyha','LAPTERV_OFFLINE',5,'29/10/2026');
  assert.equal(out.complexBoards,1);
  assert.equal(out.names.length,2);
  const complex=out.files.find(([path])=>path==='xPrg/'+out.names[1])[1];
  assert.match(complex,/<LaptervOfflineReview MachineExecutable="false"/);
  assert.doesNotMatch(complex,/<SchemaDoc>/);
  assert.match(out.files.find(([n])=>n.endsWith('.xMix'))[1],/RigaMix/);
});
test('az anyagnev és a projekt név XML karaktereit helyesen escape-eli',()=>{
  const out=generate([base(false,'Feya & <tölgy>')],'Konyha & étkező','LAPTERV_OFFLINE',5,'29/10/2026');
  const mix=out.files.find(([n])=>n.endsWith('.xMix'))[1];
  assert.match(mix,/Feya &amp; &lt;tölgy&gt;/);
  assert.match(mix,/Konyha &amp; étkező/);
  assert.equal(JSON.parse(out.files.find(([n])=>n.endsWith('.json'))[1]).boardCount,1);
});
