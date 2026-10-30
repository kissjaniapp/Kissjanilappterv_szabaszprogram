'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
const begin=html.indexOf('function machineExportBundle(){');
const end=html.indexOf('\n  function downloadCutList(',begin);
assert.ok(begin>=0&&end>begin,'Hiányzik a projektexport három mentési funkciója');
const fns=html.slice(begin,end);
const makeDirectory=(name='Kivalasztott')=>{
 const files=new Map(),dirs=new Map();
 function dir(label,full){
  return {name:label,files,dirs,
    async getDirectoryHandle(sub,{create=false}={}){
      const path=full?full+'/'+sub:sub;
      if(!dirs.has(path)&&!create){const error=Error('Nem található');error.name='NotFoundError';throw error;}
      if(!dirs.has(path))dirs.set(path,dir(sub,path));
      return dirs.get(path);
    },
    async getFileHandle(filename,{create=false}={}){
      if(!create)throw Error('Test expected create');
      const filePath=full+'/'+filename;
      return {async createWritable(){return {
        async write(data){files.set(filePath,data);},
        async close(){}
      };}};
    }
  };
 }
 return dir(name,'');
};
function harness({failed=false,hasBins=true,color='Onixszürke',destination='Konyha',folderPicker=true,parent}={}){
 const calls={exports:[],downloads:[],zipInputs:[],notices:[],pickerCount:0};
 const archive={
  cabinetFolder:'2026_10_30_Konyha',
  names:['tabla_01.xPrg','tabla_02.xPrg'],
  files:[
    ['2026_10_30_Konyha/Konyha_OFFLINE.xMix','<xMix><RigheMix /></xMix>'],
    ['2026_10_30_Konyha/xPrg/tabla_01.xPrg','<SchemaDoc>1</SchemaDoc>'],
    ['2026_10_30_Konyha/xPrg/tabla_02.xPrg','<SchemaDoc>2</SchemaDoc>']
  ]
 };
 const chosen=parent||makeDirectory();
 const sandbox={
  state:{layoutMode:'machine',projectName:'Szekreny',kerf:5,furnitures:[]},
  result:{machineReady:true,error:null,bins:hasBins?[{machine:{strips:[{}]}}]:[],failed:failed?[{}]:[]},
  getFurniture:()=>({name:'Szekrény',destination,materialColor:color}),
  buildOfflineXprgProject:(bins,project,code,kerf,date,folder,mode,target)=>{
    calls.exports.push({project,code,kerf,date,folder,mode,target});
    return archive;
  },
  window:{...(folderPicker?{showDirectoryPicker:async config=>{
    calls.pickerCount++;assert.equal(config.mode,'readwrite');return chosen;
  }}:{})},
  xlsxZip:(files,mime)=>{
    assert.equal(mime,'application/zip');calls.zipInputs.push(files);
    return {zip:true,files};
  },
  downloadBlob:(blob,name)=>calls.downloads.push({blob,name}),
  showNotice:message=>calls.notices.push(message),
  Date,
 };
 const f=vm.runInNewContext('(function(){'+fns+
    ';return {machineExportBundle,downloadXprgProject,saveXprgToSelectedFolder};})()',sandbox);
 return {f,calls,archive,parent:chosen};
}
test('a Bútor adatai színe a gépi anyagkód és az xPrg fejlécleírás, nem a régi végső mező',()=>{
 const {f,calls}=harness({color:'Onixszürke',destination:'Lakás'});
 f.machineExportBundle();
 assert.equal(calls.exports.length,1);
 const e=calls.exports[0];
 assert.equal(e.code,'Onixszürke');
 assert.equal(e.mode,'color');
 assert.equal(e.folder,'.\\xPrg\\');
 assert.equal(e.target,'Lakás');
 assert.equal(e.kerf,5);
 assert.match(e.date,/^\d\d\/\d\d\/\d{4}$/);
});
test('a ZIP letöltés továbbra is közvetlen, párbeszéd és mappaválasztás nélkül',async()=>{
 const {f,calls}=harness();
 await f.downloadXprgProject();
 assert.equal(calls.downloads.length,1);
 assert.equal(calls.downloads[0].filename,'2026_10_30_Konyha_XPRG_XMIX.zip');
 assert.equal(calls.pickerCount,0);
 assert.equal(calls.zipInputs.length,1);
 assert.equal(calls.zipInputs[0].length,3);
});
test('a mappaválasztó egy új projektmappába menti a Mixet és két XPrg-t',async()=>{
 const {f,calls,parent,archive}=harness();
 await f.saveXprgToSelectedFolder();
 assert.equal(calls.pickerCount,1);
 assert.equal(parent.files.size,3);
 for(const [archivePath,contents] of archive.files){
   assert.equal(parent.files.get(archivePath),contents);
 }
 assert.ok(calls.notices.at(-1).includes('2 xPrg és 1 xMix'));
 assert.equal(calls.downloads.length,0);
});
test('azonos nevű meglévő munkamappát nem ír felül',async()=>{
 const parent=makeDirectory();
 await parent.getDirectoryHandle('2026_10_30_Konyha',{create:true});
 const {f,calls}=harness({parent});
 await f.saveXprgToSelectedFolder();
 assert.equal(parent.files.size,3);
 for(const name of parent.files.keys())
  assert.ok(name.startsWith('2026_10_30_Konyha_2/'),name);
 assert.ok(calls.notices.at(-1).includes('Konyha_2'));
});
test('az export hiányos nestingnél vagy anyagszín nélkül nem indul',async()=>{
 for(const option of [{failed:true},{hasBins:false},{color:''}]){
  const {f,calls}=harness(option);
  await f.downloadXprgProject();
  assert.equal(calls.downloads.length,0);
  assert.ok(calls.notices.length>0);
 }
});
test('mappaválasztó hiányában a ZIP letöltés marad elérhető',async()=>{
 const {f,calls}=harness({folderPicker:false});
 await f.saveXprgToSelectedFolder();
 assert.ok(calls.notices.some(n=>n.includes('ZIP')));
 assert.equal(calls.downloads.length,0);
});
