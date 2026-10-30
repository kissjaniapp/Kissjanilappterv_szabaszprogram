'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
const begin=html.indexOf('function machineRootPath(){');
const end=html.indexOf('\n  function downloadCutList(',begin);
assert.ok(begin>=0&&end>begin,'Hiányzik az X: alapú Mix export és mentés');
const fns=html.slice(begin,end);
const ROOT='X:\\JANI\\szabas_programmal\\Legujabb_mentessel';
const makeDirectory=(name='Legujabb_mentessel')=>{
 const files=new Map(),dirs=new Map();
 function dir(label,full){
  return {name:label,files,dirs,
   async getDirectoryHandle(sub,{create=false}={}){
    const next=full?full+'/'+sub:sub;
    if(!dirs.has(next)&&!create){
      const error=Error('Nem található');error.name='NotFoundError';throw error;
    }
    if(!dirs.has(next))dirs.set(next,dir(sub,next));
    return dirs.get(next);
   },
   async getFileHandle(filename,{create=false}={}){
    if(!create)throw Error('Csak létrehozás engedélyezett');
    const key=full+'/'+filename;
    return {async createWritable(){return {
      async write(content){files.set(key,content);},
      async close(){}
    };}};
   }
  };
 }
 return dir(name,'');
};
class FixedDate extends Date{
 constructor(...args){super(...(args.length?args:[2026,9,30]));}
}
function harness({failed=false,hasBins=true,color='Freya',destination='Teszt',
  root=ROOT,folderPicker=true,parent}={}){
 const calls={exports:[],downloads:[],notices:[],pickerCount:0,zipInputs:[]};
 const chosen=parent||makeDirectory();
 const sandbox={
  nativeBridge:null,
  state:{layoutMode:'machine',projectName:'Éles vágás',kerf:5,
         furnitures:[],xmixMachineRoot:root},
  defaultXmixMachineRoot:ROOT,
  result:{machineReady:true,error:null,bins:hasBins?[{machine:{strips:[{}]}}]:[],failed:failed?[{}]:[]},
  getFurniture:()=>({name:'Éles vágás',destination,materialColor:color}),
  buildOfflineXprgProject:(bins,project,code,kerf,date,directory,mode,target,cabinetOverride='')=>{
    calls.exports.push({project,code,kerf,date,directory,mode,target,cabinetOverride});
    const cabinet=cabinetOverride||'2026_10_30_'+target;
    const files=[
      [cabinet+'/Eles_vagas_OFFLINE.xMix',
       '<xMix><RigaMix File="'+directory+'tabla_01.xPrg" /></xMix>'],
      [cabinet+'/xPrg/tabla_01.xPrg','<SchemaDoc>01</SchemaDoc>'],
      [cabinet+'/xPrg/tabla_02.xPrg','<SchemaDoc>02</SchemaDoc>']
    ];
    return {cabinetFolder:cabinet,names:['tabla_01.xPrg','tabla_02.xPrg'],files};
  },
  window:folderPicker?{showDirectoryPicker:async opts=>{
    assert.equal(opts.mode,'readwrite');calls.pickerCount++;return chosen;
  }}:{},
  xlsxZip:(files,mime)=>{
    assert.equal(mime,'application/zip');calls.zipInputs.push(files);return {zip:true};
  },
  downloadBlob:(blob,name)=>calls.downloads.push({blob,name}),
  showNotice:text=>calls.notices.push(text),
  Date:FixedDate
 };
 const f=vm.runInNewContext('(function(){'+fns+
   ';return {machineRootPath,machineExportBundle,downloadXprgProject,saveXprgToSelectedFolder};})()',sandbox);
 return {f,calls,parent:chosen,sandbox};
}
test('az X: gyökérútvonal teljes és alapból a megadott mappa',()=>{
 const {f}=harness();
 assert.equal(f.machineRootPath(),ROOT);
});
test('a gépnek szánt Mix mindkét xPrg sorában a teljes X: útvonal szerepel',()=>{
 const {f,calls}=harness();
 const bundle=f.machineExportBundle();
 const prefix=ROOT+'\\2026_10_30_Teszt\\xPrg\\';
 const mix=bundle.files[0][1];
 assert.ok(mix.includes(prefix+'tabla_01.xPrg'));
 assert.equal(bundle.cabinetFolder,'2026_10_30_Teszt');
 assert.equal(calls.exports.length,2);
 assert.equal(calls.exports[0].directory,'.\\xPrg\\');
 assert.equal(calls.exports[1].directory,prefix);
 assert.equal(calls.exports[1].code,'Freya');
 assert.equal(calls.exports[1].mode,'color');
 assert.equal(calls.exports[1].target,'Teszt');
 assert.equal(bundle.files.length,3);
});
test('a ZIP is teljes gépi hivatkozást tartalmaz, de a fájlokat xPrg almappába csomagolja',async()=>{
 const {f,calls}=harness();
 await f.downloadXprgProject();
 assert.equal(calls.downloads.length,1);
 assert.equal(calls.downloads[0].name,'2026_10_30_Teszt_XPRG_XMIX.zip');
 assert.equal(calls.pickerCount,0);
 assert.equal(calls.zipInputs.length,1);
 const files=calls.zipInputs[0];
 assert.equal(files.length,3);
 assert.ok(files[0][1].includes(ROOT+'\\2026_10_30_Teszt\\xPrg\\'));
 assert.ok(files[1][0].startsWith('2026_10_30_Teszt/xPrg/'));
 assert.ok(calls.notices.at(-1).includes('bontsd ki'));
});
test('mappaválasztó a megadott X: mappába ment, a Mixben is a teljes út szerepel',async()=>{
 const {f,calls,parent}=harness();
 await f.saveXprgToSelectedFolder();
 assert.equal(calls.pickerCount,1);
 assert.equal(parent.files.size,3);
 const mix=parent.files.get('2026_10_30_Teszt/Eles_vagas_OFFLINE.xMix');
 assert.ok(mix.includes(ROOT+'\\2026_10_30_Teszt\\xPrg\\tabla_01.xPrg'));
 assert.equal(parent.files.get('2026_10_30_Teszt/xPrg/tabla_02.xPrg'),'<SchemaDoc>02</SchemaDoc>');
 assert.ok(calls.notices.at(-1).includes(ROOT+'\\2026_10_30_Teszt'));
});
test('mappaütközésnél az új _2 könyvtár szerepel a Mix abszolút hivatkozásában',async()=>{
 const parent=makeDirectory();
 await parent.getDirectoryHandle('2026_10_30_Teszt',{create:true});
 const {f}=harness({parent});
 await f.saveXprgToSelectedFolder();
 const mix=parent.files.get('2026_10_30_Teszt_2/Eles_vagas_OFFLINE.xMix');
 assert.ok(mix);
 assert.ok(mix.includes(ROOT+'\\2026_10_30_Teszt_2\\xPrg\\tabla_01.xPrg'));
 assert.ok(!mix.includes('2026_10_30_Teszt\\xPrg\\'));
});
test('rossz mappaválasztáskor nem írhatunk a másik könyvtárba félrevezető Mix fájlt',async()=>{
 const parent=makeDirectory('MasikMappa');
 const {f,calls}=harness({parent});
 await f.saveXprgToSelectedFolder();
 assert.equal(parent.files.size,0);
 assert.ok(calls.notices.at(-1).includes('eltér'));
});
test('hibás/relatív gyökérútvonal nem eredményez gépi projektet',async()=>{
 for(const root of ['.\\xPrg\\','X:\\JANI\\..\\Masik','C:/hely?/bad','Z:relativ','']){
  const {f,calls}=harness({root});
  await f.downloadXprgProject();
  assert.equal(calls.downloads.length,0,'Invalid root '+root);
  assert.ok(calls.notices.length>0);
 }
});
test('hiányos nesting vagy hiányzó anyagszín nem készít gépi fájlt',async()=>{
 for(const option of [{failed:true},{hasBins:false},{color:''}]){
  const {f,calls}=harness(option);
  await f.downloadXprgProject();
  assert.equal(calls.downloads.length,0);
  assert.ok(calls.notices.length>0);
 }
});
test('mappaválasztó nélkül a ZIP marad elérhető',async()=>{
 const {f,calls}=harness({folderPicker:false});
 await f.saveXprgToSelectedFolder();
 assert.ok(calls.notices.at(-1).includes('ZIP'));
 assert.equal(calls.downloads.length,0);
});
