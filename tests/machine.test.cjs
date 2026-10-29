'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createXMix,createXPrg,validateFilename,DIRECTORY}=require('../machine/xmix.cjs');

test('a WinCut xMix pontos INI szerkezete és 2 abszolút hivatkozása',()=>{
  const mix=createXMix({programs:[
    {filename:'2026_10_29_Konyha_Feya_tabla_01.xPrg'},
    {filename:'2026_10_29_Konyha_Feya_tabla_02.xPrg'}
  ]});
  assert.equal(mix,
    '[Intestazione]\r\nDescrizione=\r\n\r\n[Righe]\r\nNumeroRighe=2\r\n'+
    '1=C:\\WinCut\\Prg\\2026_10_29_Konyha_Feya_tabla_01.xPrg\r\n'+
    '2=C:\\WinCut\\Prg\\2026_10_29_Konyha_Feya_tabla_02.xPrg\r\n');
  assert.equal(DIRECTORY,'C:\\WinCut\\Prg\\');
});
test('a sorok száma minden tényleges táblaszámot követ',()=>{
  const files=[1,2,3,4].map(i=>'2026_10_29_Konyha_tabla_0'+i+'.xPrg');
  const mix=createXMix({programs:files});
  assert.match(mix,/NumeroRighe=4\r\n/);
  assert.equal((mix.match(/C:\\WinCut\\Prg\\/g)||[]).length,4);
});
test('érvénytelen útvonalat vagy vezérlőkaraktert nem enged beírni',()=>{
  assert.throws(()=>validateFilename('../rossz.xPrg'));
  assert.throws(()=>validateFilename('C:\\WinCut\\Prg\\b.xPrg'));
  assert.throws(()=>createXMix({programs:['egy.xPrg'],description:'rossz\n[Righe]\nNumeroRighe=88'}));
});
test('a nem hitelesített xPrg generálásának korlátja megmarad',()=>{
  assert.throws(createXPrg,/Nincs hiteles xPrg/);
});
