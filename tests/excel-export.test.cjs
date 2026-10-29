'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
const a=html.indexOf('function xlsxZip(');
const b=html.indexOf('function partsWorkbook()',a);
const c=html.indexOf('function downloadPartsXlsx()',b);
assert.ok(a>0&&b>a&&c>b,'Hiányzik az Excel generáló');
const source=html.slice(a,c);
function readZipEntry(buffer,name){
  for(let i=0;i<buffer.length-30;){
    if(buffer.readUInt32LE(i)!==0x04034B50)break;
    const size=buffer.readUInt32LE(i+18);
    const nameLen=buffer.readUInt16LE(i+26);
    const extra=buffer.readUInt16LE(i+28);
    const n=buffer.subarray(i+30,i+30+nameLen).toString('utf8');
    const dataStart=i+30+nameLen+extra;
    if(n===name)return buffer.subarray(dataStart,dataStart+size).toString('utf8');
    i=dataStart+size;
  }
  throw Error('ZIP fájl hiányzik: '+name);
}
test('Az Excel első sora az anyag, második a célhely, csak öt alkatrész-oszlop',async()=>{
  const stub={
    getParts:()=>({errors:[],rows:[{skipped:false,error:null,qty:2,
      furniture:{materialColor:'Feya',destination:'Kiskunfélegyháza'},
      part:{name:'Oldallap'},originalA:910,originalB:600,edge:'1-0',
      edgeThickness:2,mill:true}]}),
    h:v=>String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'),
    TextEncoder,Blob,Uint8Array,ArrayBuffer,DataView,Number,Math,String,Set
  };
  const file=vm.runInNewContext(source+'\npartsWorkbook()',stub);
  const buffer=Buffer.from(await file.arrayBuffer());
  const sheet=readZipEntry(buffer,'xl/worksheets/sheet1.xml');
  assert.match(sheet,/ANYAG: Feya/);
  assert.match(sheet,/HOVÁ KÉSZÜL: Kiskunfélegyháza/);
  assert.match(sheet,/Alkatrész megnevezése/);
  assert.match(sheet,/Kész X \(mm\)/);
  assert.match(sheet,/Kész Y \(mm\)/);
  assert.match(sheet,/Élzárás/);
  assert.match(sheet,/Oldallap/);
  assert.match(sheet,/1-0 · 2 mm · 1 mm előmarás/);
  assert.match(sheet,/mergeCell ref="A1:E1"/);
  assert.doesNotMatch(sheet,/Szabás X/);
  const types=readZipEntry(buffer,'[Content_Types].xml');
  assert.match(types,/spreadsheetml.sheet.main/);
});
