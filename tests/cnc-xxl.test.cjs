'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const cnc=require('../machine/cnc-xxl.cjs');
test('a CNC G módok külön lap/él értékeket használnak',()=>{
  assert.deepEqual(cnc.jointCodes('tipli'),{lap:0,el:0});
  assert.deepEqual(cnc.jointCodes('excenter'),{lap:1,el:1});
  assert.deepEqual(cnc.jointCodes('hosszuExcenter'),{lap:1,el:2});
  assert.deepEqual(cnc.jointCodes('csavar'),{lap:2,el:0});
  assert.throws(()=>cnc.jointCodes('ismeretlen'),/Ismeretlen/);
});
test('középvonal és tükörhelyzet a saját alkatrész méretével számol',()=>{
  assert.equal(cnc.centerline(38,18),47);
  assert.equal(cnc.centerline(586.62,18),595.62);
  assert.equal(cnc.mirroredX(754,47),707);
  assert.throws(()=>cnc.mirroredX(754,900),/kívül/);
});
test('az ismert oldallap minta fejlécét és LAPA/LAPF sorait előállítja',()=>{
  const x=cnc.compileXxl({dx:754,dy:520,dz:18,side:'IJ',commands:
   'LAPA X=158.38 Y=56 A=0 y=464 G=1\nLAPA X=745 Y=56 A=0 y=464 G=1\n'+
   'LAPF X=0 Y=47 A=0 x=754 G=1\nLAPF X=0 Y=29 A=0 x=754 G=1'});
  assert.match(x,/^H DX=754 DY=520 DZ=18 -IJ C=0 T=196608 R=100 \*MM \/"DEF" BX=0 BY=0 BZ=0 V=1\r\n/);
  assert.match(x,/LAPA X=158\.38 Y=56 A=0 y=464 G=1/);
  assert.match(x,/LAPF X=0 Y=47 A=0 x=754 G=1/);
  assert.match(x,/;\r\nVEGE\r\n$/);
});
test('az ellenőrzött lap/él és FORDIT külön megmunkálási csoportot ad',()=>{
  const x=cnc.compileXxl({dx:964,dy:464,dz:18,side:'LK',commands:
   'LAPA X=509 Y=0 A=0 y=464 G=2\nFORDIT\nLAPA X=482 Y=0 A=0 y=464 G=2\n'+
   'ELF3 Y=0 A=0 y=464 G=1\nELF2 Y=0 A=0 y=464 G=1\nELF5 X=0 A=0 x=964 G=1'});
  assert.match(x,/-LK C=0/);
  assert.match(x,/;\r\nVEGE\r\nXMSG Q=1 N="FORDIT"\r\n;\r\n/);
  assert.match(x,/ELF5 X=0 A=0 x=964 G=1/);
});
test('hibás G, makró, méret és nem igazolt fordítás nem exportálható',()=>{
  const base={dx:964,dy:464,dz:18,side:'IJ'};
  for(const commands of [
   'LAPA X=482 Y=0 A=0 y=464 G=3',
   'UNKNOWN X=0 Y=0 A=0 y=464 G=1',
   'LAPA X=965 Y=0 A=0 y=464 G=1',
   'LAPF X=0 Y=0 A=90 x=964 G=1',
   'FORDIT\nLAPA X=482 Y=0 A=0 y=464 G=1',
   'LAPA X=482 Y=0 A=0 y=464 G=1\nFORDIT'
  ])assert.throws(()=>cnc.compileXxl({...base,commands}));
  assert.throws(()=>cnc.compileXxl({...base,dx:0,commands:'LAPA X=0 Y=0 A=0 y=464 G=1'}));
  assert.throws(()=>cnc.compileXxl({...base,side:'AUTO',commands:'LAPA X=0 Y=0 A=0 y=464 G=1'}));
});
test('a CNC teljes bútorra ad egyetlen közös mentést, a kódok rejtve maradnak',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const app=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
 assert.match(app,/window\.gatterkaBuildAutoCnc=function/);
 assert.match(app,/window\.gatterkaSetAssemblyJoint=function/);
 assert.match(app,/GatterkaCncAuto=api/);
 assert.match(app,/Az egész bútor összefúrásának kötésmódja/);
 assert.match(app,/data-action="save-all-cnc-xxl"/);
 assert.doesNotMatch(app,/data-action="save-cnc-xxl"/);
 assert.doesNotMatch(app,/id="cnc-xxl-commands"/);
 assert.match(app,/cncInstances=Array\.isArray\(row\.cncInstances\)/);
});
