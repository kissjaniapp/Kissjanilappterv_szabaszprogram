'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const cnc=require('../machine/cnc-xxl.cjs');
const root=path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app/index.htm'),'utf8');
const sample=fs.readFileSync(path.join(root,'samples/GATTERKA_PGM_FORMATUM_PROBA.pgm'),'utf8');

test('Csak a három támogatott munkamód választható, az SCN menügomb eltűnt',()=>{
  assert.doesNotMatch(app,/data-mode="scn"/);
  for(const mode of ['parts','design','manual'])
    assert.match(app,new RegExp('data-mode="'+mode+'"'));
  assert.match(app,/state\.designMode==='scn'\?'parts'/);
});
test('A PGM próba külön gomb, a bevált XXL mentés változatlanul elérhető',()=>{
  assert.match(app,/data-action="download-cnc-pgm-probe"/);
  assert.match(app,/window\.gatterkaDownloadPgmProbe=function/);
  assert.match(app,/data-action="save-cnc-xxl-as"/);
  assert.match(app,/window\.gatterkaSaveAutoCncAs=async function/);
});
test('A PGM próbafájl kizárólag az ismert Xilog makrófordító által adott szöveg',()=>{
  const commands=[
    'LAPA X=120 Y=40 A=0 y=280 G=1',
    'LAPF X=60 Y=180 A=0 x=480 G=1',
    'ELF3 Y=40 A=0 y=280 G=1',
    'ELF2 Y=40 A=0 y=280 G=1',
    'ELF4 X=60 A=0 x=480 G=1',
    'ELF5 X=60 A=0 x=480 G=1',
    'REF DX=400 BX=80',
    'POLC Y=50 Q=0# s=32 G=1# F=1',
    'REF',
    'FORDIT',
    'LAPA X=300 Y=80 A=0 y=240 G=1',
    'XBO X=100 Y=50 z=13 V=1 R=3 x=32 y=0 D=5 N=P F=1'
  ];
  const expected=cnc.compileXxl({dx:600,dy:400,dz:18,side:'IJ',commands:commands.join('\n')});
  assert.equal(sample.replace(/\r\n/g,'\n'),expected.replace(/\r\n/g,'\n'));
  assert.match(sample,/^H DX=600 DY=400 DZ=18 -IJ/);
  assert.match(sample,/XMSG Q=1 N="FORDIT"/);
  assert.match(sample,/;\r?\nVEGE\r?\n$/);
});
