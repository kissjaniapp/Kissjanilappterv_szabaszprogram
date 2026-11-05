'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const html=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
const start=html.indexOf('async function threeMfZipModel(file){');
const end=html.indexOf('\n  function threeMfParse(',start);
assert.ok(start>=0&&end>start,'A 3MF ZIP64 beolvasó legyen elérhető.');

const fixture=Buffer.from('UEsDBC0AAAAIAAAAAADuyWJ3//////////8QABQAM0QvM2Rtb2RlbC5tb2RlbAEAEACWAQAAAAAAAPAAAAAAAAAAdZDNTsMwEIRfxdo72SQtqCDbvXHmAA+QOtvGlX+Q7USBp8exkciFy2qlb2Y9Y35erWELhai9E9A1LTByyo/a3QR8vL8+nOAsufUjGTY7nQRYbYy2lCgAy2YXBUwpfb4gRjWRHWJjtQo++mtqlLd4GO3g5uug0hzyVVQ+EPZt94htD5IHin4OiqLk/nInlZgecxBgbrAk4M0blVWW4iR5zpl0kW4brWwVkAN/lfm9Tdyj56fj/7D6jpskw+60Ufx7IAU9uJvZr2zpim3pS77lIKAvrp0Wa1CsVfKyq3eZtRkl14ksq7w23U78MiwfLX8AUEsBAi0ALQAAAAgAAAAAAO7JYnf//////////xAAHAAAAAAAAAAAAAAA/////zNELzNkbW9kZWwubW9kZWwBABgAlgEAAAAAAADwAAAAAAAAAAAAAAAAAAAAUEsGBiwAAAAAAAAALQAtAAAAAAAAAAAAAQAAAAAAAAABAAAAAAAAAFoAAAAAAAAAMgEAAAAAAABQSwYHAAAAAIwBAAAAAAAAAQAAAFBLBQYAAAAAAQABAFoAAAD/////AAA=','base64');
function reader(Decompressor=DecompressionStream){
  return vm.runInNewContext('('+html.slice(start,end).trim()+')',{
    Uint8Array,DataView,TextDecoder,Blob,Response,DecompressionStream:Decompressor,BigInt,Number
  });
}
const file={arrayBuffer:async()=>fixture.buffer.slice(fixture.byteOffset,fixture.byteOffset+fixture.byteLength)};

test('Fusion ZIP64 3MF archívumból kiolvasható a szilárdtest és a név',async()=>{
  const xml=await reader()(file);
  assert.match(xml,/name="Polc"/);
  assert.match(xml,/x="964"/);
  assert.match(xml,/y="464"/);
  assert.match(xml,/unit="millimeter"/);
});
test('ZIP64 3MF működik, ha a böngésző csak gzip dekompressziót támogat',async()=>{
  class GzipOnly extends DecompressionStream{
    constructor(format){
      if(format==='deflate-raw')throw Error('deflate-raw nincs támogatva');
      super(format);
    }
  }
  const xml=await reader(GzipOnly)(file);
  assert.match(xml,/name="Polc"/);
});
