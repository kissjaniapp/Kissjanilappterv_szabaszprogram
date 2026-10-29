'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const html=readFileSync(path.join(__dirname,'..','app','index.htm'),'utf8');
const a=html.indexOf('function xlsxZip(');
const b=html.indexOf('\n  // Önálló, nagy felbontású PNG',a);
assert.ok(a>0&&b>a,'ZIP encoder nem található');
const zip=vm.runInNewContext('('+html.slice(a,b).trim()+')',{
  TextEncoder,DataView,Uint8Array,ArrayBuffer,Blob
});
function zipEntries(buffer){
  const files=new Map();
  let i=0;
  while(i+30<=buffer.length&&buffer.readUInt32LE(i)===0x04034B50){
    const length=buffer.readUInt32LE(i+18);
    const fileNameLength=buffer.readUInt16LE(i+26);
    const extraLength=buffer.readUInt16LE(i+28);
    const name=buffer.subarray(i+30,i+30+fileNameLength).toString('utf8');
    const dataStart=i+30+fileNameLength+extraLength;
    files.set(name,buffer.subarray(dataStart,dataStart+length).toString('utf8'));
    i=dataStart+length;
  }
  assert.equal(buffer.readUInt32LE(i),0x02014B50,'Hiányzik a ZIP central directory');
  return files;
}
test('a Letöltésekbe kerülő ZIP egyetlen bútormappájában csak xMix és xPrg van',async()=>{
  const contents=[
    ['Konyha/Konyha_OFFLINE.xMix','[Intestazione]\r\nDescrizione=\r\n\r\n[Righe]\r\nNumeroRighe=2\r\n'+
      '1=X:\\JANI\\szabas_programmal\\Konyha\\elso.xPrg\r\n'+
      '2=X:\\JANI\\szabas_programmal\\Konyha\\masodik.xPrg\r\n'],
    ['Konyha/elso.xPrg','<SchemaDoc>\r\n\t<Pattern></Pattern>\r\n</SchemaDoc>'],
    ['Konyha/masodik.xPrg','<SchemaDoc>\r\n\t<Pattern></Pattern>\r\n</SchemaDoc>']
  ];
  const blob=zip(contents,'application/zip');
  assert.equal(blob.type,'application/zip');
  const files=zipEntries(Buffer.from(await blob.arrayBuffer()));
  assert.deepEqual([...files.keys()],contents.map(([name])=>name));
  assert.equal(files.size,3);
  for(const [name,body] of files){
    assert.equal(body,contents.find(x=>x[0]===name)[1]);
    if(!name.endsWith('.xMix'))
      assert.doesNotMatch(body,/X:\\JANI\\szabas_programmal\\/);
  }
  assert.match(files.get('Konyha/Konyha_OFFLINE.xMix'),/NumeroRighe=2/);
});
