'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
const a=html.indexOf('async function downloadXprgProject()');
const b=html.indexOf('\n  function downloadCutList(',a);
assert.ok(a>0&&b>a,'Hiányzik a letöltés-generáló funkció');
const code='('+html.slice(a,b).trim()+')';

function harness({failed=false,hasBins=true,materialCode='BLAP003',folder='.\\xPrg\\'}={}){
 const calls={downloads:[],alerts:[],zipInputs:[],usedCode:null};
 const bundle={
  cabinetFolder:'Konyha',
  names:['tabla_01.xPrg','tabla_02.xPrg'],
  files:[
   ['Konyha/konyha.xMix','<xMix>\r\n'],
   ['Konyha/xPrg/tabla_01.xPrg','<SchemaDoc>1</SchemaDoc>'],
   ['Konyha/xPrg/tabla_02.xPrg','<SchemaDoc>2</SchemaDoc>']
  ]
 };
 const sandbox={
  state:{layoutMode:'machine',projectName:'Konyha',kerf:5,xprgMaterialCode:materialCode,xprgFolder:folder},
  result:{machineReady:true,bins:hasBins?[{machine:{strips:[{}]}}]:[],failed:failed?[{}]:[]},
  getFurniture:()=>({name:'Konyha'}),
  prompt:()=>{throw Error('A letöltés NEM kérhet anyagkódot felugró ablakban');},
  confirm:()=>{throw Error('A letöltés NEM kérhet megerősítést');},
  buildOfflineXprgProject:(bins,project,code,kerf,date,path)=>{
   assert.equal(project,'Konyha');
   assert.equal(kerf,5);
   assert.match(date,/^\d{2}\/\d{2}\/\d{4}$/);
   calls.folder=path;
   calls.usedCode=code;return bundle;
  },
  xlsxZip:(files,mime)=>{
   assert.equal(mime,'application/zip');
   calls.zipInputs.push(files);return {zip:true,files};
  },
  fileName:value=>value,
  downloadBlob:(blob,filename)=>calls.downloads.push({blob,filename}),
  showNotice:message=>calls.alerts.push(message)
 };
 return {fn:vm.runInNewContext(code,sandbox),calls,bundle};
}
test('a ZIP egy kattintásra azonnal letöltődik, prompt és confirm nélkül',async()=>{
 const {fn,calls,bundle}=harness();
 await fn();
 assert.equal(calls.downloads.length,1);
 assert.equal(calls.downloads[0].filename,'Konyha_XPRG_XMIX_OFFLINE.zip');
 assert.equal(calls.downloads[0].blob.zip,true);
 assert.equal(calls.zipInputs.length,1);
 assert.equal(calls.zipInputs[0],bundle.files);
 assert.equal(calls.usedCode,'BLAP003');
 assert.deepEqual(calls.alerts,[]);
});
test('a panelen megadott anyagkódot használja, a gomb melletti beállításból',async()=>{
 const {fn,calls}=harness({materialCode:'FREYA2026'});
 await fn();
 assert.equal(calls.usedCode,'FREYA2026');
 assert.equal(calls.downloads.length,1);
});
test('hibás anyagkód vagy hiányos nesting nem okoz letöltést',async()=>{
 for(const options of [{materialCode:'rossz kód!'},{failed:true},{hasBins:false}]){
  const {fn,calls}=harness(options);
  await fn();
  assert.equal(calls.downloads.length,0);
  assert.ok(calls.alerts.length>0);
 }
});
test('a közvetlen ZIP mentés nem használ mappaválasztást',()=>{
 assert.doesNotMatch(html,/saveXprgInFurnitureDirectory/);
 assert.doesNotMatch(html,/showDirectoryPicker/);
 assert.match(html,/downloadBlob\(zip,name\)/);
 assert.match(html,/data-key="xprgMaterialCode"/);
});

test('a Mixben megadott XPrg elérési utat továbbadjuk a letöltéshez',async()=>{
  const {fn,calls}=harness({folder:'D:\\Gyartas\\Prg\\'});
  await fn();
  assert.equal(calls.folder,'D:\\Gyartas\\Prg\\');
  assert.equal(calls.downloads.length,1);
});
