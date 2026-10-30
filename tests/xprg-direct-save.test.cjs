'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
const begin=html.indexOf('function machineRootPath(){');
const end=html.indexOf('\n  function downloadCutList(',begin);
assert.ok(begin>=0&&end>begin);
const fns=html.slice(begin,end);
const ROOT='C:\\Gatterka';
class FixedDate extends Date {
 constructor(...args){super(...(args.length?args:[2026,9,30]));}
}
function harness({root=ROOT,failed=false,color='Freya'}={}){
 const calls={exports:[],downloads:[],notices:[],zipInputs:[]};
 const sandbox={
  nativeBridge:null,
  state:{layoutMode:'machine',projectName:'Éles vágás',kerf:5,
    furnitures:[],xmixMachineRoot:root},
  defaultXmixMachineRoot:ROOT,
  result:{machineReady:true,error:null,bins:[{machine:{strips:[{}]}}],failed:failed?[{}]:[]},
  getFurniture:()=>({name:'Éles vágás',destination:'Teszt',materialColor:color}),
  buildOfflineXprgProject:(bins,project,code,kerf,date,directory,mode,target,cabinetOverride='')=>{
   calls.exports.push({directory,code,mode,target});
   const cabinet=cabinetOverride||'2026_10_30_Teszt';
   return {cabinetFolder:cabinet,names:['tabla_01.xPrg'],files:[
    [cabinet+'/vagas.xMix','<xMix><RigheMix><RigaMix File="'+directory+'tabla_01.xPrg" /></RigheMix></xMix>'],
    [cabinet+'/xPrg/tabla_01.xPrg','<SchemaDoc></SchemaDoc>']
   ]};
  },
  xlsxZip:(files)=>{calls.zipInputs.push(files);return {zip:true}},
  downloadBlob:(blob,name)=>calls.downloads.push({blob,name}),
  showNotice:msg=>calls.notices.push(msg),
  Date:FixedDate
 };
 const f=vm.runInNewContext('(function(){'+fns+
  ';return {machineRootPath,machineExportBundle,downloadXprgProject,saveXprgToSelectedFolder};})()',sandbox);
 return {f,calls};
}
test('az alapértelmezett gépi mappa a C:\\Gatterka',()=>{
 const {f}=harness();
 assert.equal(f.machineRootPath(),ROOT);
});
test('a ZIP előállításakor dátumos teljes Windows útvonal kerül az XMIX-be',()=>{
 const {f,calls}=harness();
 const bundle=f.machineExportBundle();
 const prefix=ROOT+'\\2026-10-30\\2026_10_30_Teszt\\xPrg\\';
 assert.ok(bundle.files[0][1].includes(prefix+'tabla_01.xPrg'));
 assert.equal(calls.exports.length,2);
 assert.equal(calls.exports[0].directory,'.\\xPrg\\');
 assert.equal(calls.exports[1].code,'Freya');
});
test('a ZIP továbbra is letölthető a gépi fájlokkal',async()=>{
 const {f,calls}=harness();
 await f.downloadXprgProject();
 assert.equal(calls.downloads.length,1);
 assert.equal(calls.downloads[0].name,'2026_10_30_Teszt_XPRG_XMIX.zip');
 assert.equal(calls.zipInputs[0].length,2);
 assert.ok(calls.notices.at(-1).includes('ZIP'));
});
test('egyszerű HTML-böngészőben nincs hamis abszolút mentés',async()=>{
 const {f,calls}=harness();
 await f.saveXprgToSelectedFolder();
 assert.equal(calls.downloads.length,0);
 assert.ok(calls.notices.at(-1).includes('Windowsos Gatterka'));
});
test('hiányos nesting vagy anyagszín esetén nincs gépi ZIP',async()=>{
 for(const option of [{failed:true},{color:''}]){
  const {f,calls}=harness(option);
  await f.downloadXprgProject();
  assert.equal(calls.downloads.length,0);
  assert.ok(calls.notices.length>0);
 }
});
