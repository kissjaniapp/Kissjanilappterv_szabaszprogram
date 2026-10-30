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

function makeHarness({approved=true,failed=false}={}){
  const calls={downloads:[],alerts:[],confirms:[],zipInputs:[]};
  const folder='/Letoltesek_nem_direkt_meghajto';
  const bundle={
    cabinetFolder:'Konyha',
    names:['tabla_01.xPrg','tabla_02.xPrg'],
    files:[
      ['Konyha/konyha.xMix','[Intestazione]\r\n'],
      ['Konyha/tabla_01.xPrg','<SchemaDoc>1</SchemaDoc>'],
      ['Konyha/tabla_02.xPrg','<SchemaDoc>2</SchemaDoc>']
    ]
  };
  const sandbox={
    state:{layoutMode:'machine',projectName:'Konyha',kerf:5},
    result:{machineReady:true,bins:[{machine:{strips:[{}]}}],failed:failed?[{}]:[]},
    getFurniture:()=>({name:'Konyha'}),
    prompt:()=> 'BLAP003',
    confirm:text=>{calls.confirms.push(text);return approved;},
    buildOfflineXprgProject:(bins,project,materialCode)=>{
      assert.equal(project,'Konyha');
      assert.equal(materialCode,'BLAP003');
      return bundle;
    },
    xlsxZip:(files,mime)=>{
      assert.equal(mime,'application/zip');
      calls.zipInputs.push(files);
      return {zip:true,files};
    },
    fileName:v=>v,
    downloadBlob:(blob,filename)=>calls.downloads.push({blob,filename}),
    showNotice:msg=>calls.alerts.push(msg),
    window:{
      showDirectoryPicker:()=>{throw new Error('Nem szabad X: mappát választani!')},
      showSaveFilePicker:()=>{throw new Error('Nem szabad Mentés másként ablakot nyitni!')}
    }
  };
  const fn=vm.runInNewContext(code,sandbox);
  return {fn,calls,bundle,folder};
}
test('a szabásprogramok egy közös bútormappás ZIP letöltést indítanak',async()=>{
  const {fn,calls,bundle}=makeHarness();
  await fn();
  assert.equal(calls.downloads.length,1);
  assert.equal(calls.downloads[0].filename,'Konyha_XPRG_XMIX_OFFLINE.zip');
  assert.equal(calls.zipInputs.length,1);
  assert.equal(calls.zipInputs[0],bundle.files);
  assert.equal(calls.downloads[0].blob.zip,true);
  assert.equal(calls.confirms.length,1);
  assert.match(calls.confirms[0],/Letöltések/);
  assert.match(calls.confirms[0],/C:\\WinCut/);
  assert.match(calls.confirms[0],/NEM igazolt/);
  assert.equal(calls.alerts.length,0);
});
test('a böngészős mappaválasztó semmikor nem kerül meghívásra',()=>{
  assert.doesNotMatch(html,/saveXprgInFurnitureDirectory/);
  assert.doesNotMatch(html,/showDirectoryPicker/);
  assert.match(html,/downloadBlob\(zip,name\)/);
});
test('lemondott vagy hiányos nesting esetén nem jön létre ZIP',async()=>{
  for(const config of [{approved:false},{failed:true}]){
    const {fn,calls}=makeHarness(config);
    await fn();
    assert.equal(calls.downloads.length,0);
  }
});
