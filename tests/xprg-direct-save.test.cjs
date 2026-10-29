'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
const a=html.indexOf('async function saveXprgInFurnitureDirectory('),b=html.indexOf('\n  async function downloadXprgProject()',a);
assert.ok(a>0&&b>a,'Nincs mappába mentő funkció');
function directory(name='szabas_programmal'){
  const written=new Map(),subfolders=new Map();
  return {
    name,written,subfolders,
    async getDirectoryHandle(folder,opts){
      assert.equal(opts.create,true);
      if(!subfolders.has(folder)){
        subfolders.set(folder,{async getFileHandle(file,options){
          if(!options?.create && !written.has(file)){
            const error=new Error('Missing');error.name='NotFoundError';throw error;
          }
          return {async createWritable(){
            return {async write(content){written.set(file,content);},async close(){},async abort(){}};
          }};
        }});
      }
      return subfolders.get(folder);
    }
  };
}
const bundle={cabinetFolder:'Konyha',names:['a.xPrg','b.xPrg'],
  files:[['Konyha/2026_Konyha_OFFLINE.xMix','[Intestazione]'],
    ['Konyha/a.xPrg','<SchemaDoc/>'],['Konyha/b.xPrg','<LaptervOfflineReview/>'],
    ['FONTOS_OLVASD_EL.txt','notes']]};
function handler(dir,confirm=()=>true){
  const window={showDirectoryPicker:async options=>{
    assert.equal(options.mode,'readwrite');
    assert.equal(options.id,'lapterv-szabas-programmal');
    return dir;
  }};
  return vm.runInNewContext('('+html.slice(a,b).trim()+')',{window,confirm,Error});
}
test('a kiválasztott X: gyökérbeli bútormappába menti a Mixet és minden XPrg-t',async()=>{
  const dir=directory();
  const out=await handler(dir)(bundle);
  assert.equal(out.status,'saved');assert.equal(out.count,3);
  assert.deepEqual([...dir.subfolders.keys()],['Konyha']);
  assert.deepEqual([...dir.written.keys()],['2026_Konyha_OFFLINE.xMix','a.xPrg','b.xPrg']);
  assert.equal(dir.written.has('FONTOS_OLVASD_EL.txt'),false);
});
test('nem ír véletlenül a rossz nevű gyökérmappába',async()=>{
  const dir=directory('Prg');
  await assert.rejects(handler(dir)(bundle),/szabas_programmal/);
  assert.equal(dir.written.size,0);
});
test('hiányzó böngészős mappajogosultságnál ZIP tartalékot választhat',async()=>{
  const fn=vm.runInNewContext('('+html.slice(a,b).trim()+')',{window:{},confirm:()=>true});
  const out=await fn(bundle);
  assert.equal(out.status,'unsupported');
});
test('azonos nevű meglévő fájlt nem ír felül beleegyezés nélkül',async()=>{
  const dir=directory();
  await handler(dir)(bundle);
  const before=dir.written.get('a.xPrg');
  const second={...bundle,files:bundle.files.map(([n,v])=>[n,v+'-changed'])};
  const out=await handler(dir,()=>false)(second);
  assert.equal(out.status,'cancelled');
  assert.equal(dir.written.get('a.xPrg'),before);
});
