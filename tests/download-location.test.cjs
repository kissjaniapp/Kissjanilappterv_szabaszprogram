'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');

test('az exportok nem nyitnak Mentés másként ablakot',()=>{
  assert.doesNotMatch(html,/showSaveFilePicker/);
  assert.match(html,/function downloadBlob\(blob,filename\)/);
  assert.match(html,/function download\(data,filename,mime\)\{downloadBlob/);
  assert.match(html,/downloadBlob\(zip,name\)/);
  assert.match(html,/downloadBlob\(xlsxZip\(files,'application\/zip'\)/);
});
test('a korábbi PNG mentés közvetlen letöltéssé vált',async()=>{
  const begin=html.indexOf('async function saveFileToDisk(');
  const end=html.indexOf('\n  async function downloadPartsPng()',begin);
  assert.ok(begin>=0&&end>begin);
  const calls=[];
  const save=vm.runInNewContext('('+html.slice(begin,end).trim()+')',{
    downloadBlob:(blob,name)=>calls.push({blob,name})
  });
  const blob={type:'image/png'};
  assert.equal(await save(blob,'Teszt.png','.png','image/png'),true);
  assert.equal(calls.length,1);
  assert.deepEqual(calls[0],{blob,name:'Teszt.png'});
});
test('többoldalas alkatrész-PNG csak egyetlen ZIP-letöltést indít',async()=>{
  const start=html.indexOf('async function downloadPartsPng(){');
  const end=html.indexOf('\n  function selectedBin()',start);
  assert.ok(start>=0&&end>start);
  const downloads=[],zipCalls=[];
  const png=vm.runInNewContext('('+html.slice(start,end).trim()+')',{
    getParts:()=>({}),
    buildPartsPngPages:()=>Array.from({length:3},(_,i)=>({
      toBlob:cb=>cb({arrayBuffer:async()=>Uint8Array.of(i+1).buffer})
    })),
    getFurniture:()=>({name:'Konyha'}),
    state:{projectName:'Konyha'},
    fileName:x=>x,
    xlsxZip:(files,type)=>{zipCalls.push({files,type});return {zip:true};},
    downloadBlob:(blob,name)=>downloads.push({blob,name}),
    showNotice:msg=>{throw Error(msg)},
    Uint8Array
  });
  await png();
  assert.equal(downloads.length,1);
  assert.equal(zipCalls.length,1);
  assert.equal(zipCalls[0].type,'application/zip');
  assert.equal(zipCalls[0].files.length,3);
  assert.equal(downloads[0].name,'Konyha_alkatreszlista_PNG.zip');
});
