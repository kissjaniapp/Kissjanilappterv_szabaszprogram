'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createXMix,createXPrg,validateFilename,validateFolder,DIRECTORY}=require('../machine/xmix.cjs');

test('a X: meghajtó Mix minden sort a bútor nevű mappába irányít',()=>{
  const mix=createXMix({folder:'Konyha_szekreny',programs:[
    {filename:'2026_10_29_Konyha_Feya_tabla_01.xPrg'},
    {filename:'2026_10_29_Konyha_Feya_tabla_02.xPrg'}
  ]});
  assert.equal(mix,
    '[Intestazione]\r\nDescrizione=\r\n\r\n[Righe]\r\nNumeroRighe=2\r\n'+
    '1=X:\\JANI\\szabas_programmal\\Konyha_szekreny\\2026_10_29_Konyha_Feya_tabla_01.xPrg\r\n'+
    '2=X:\\JANI\\szabas_programmal\\Konyha_szekreny\\2026_10_29_Konyha_Feya_tabla_02.xPrg\r\n');
  assert.equal(DIRECTORY,'X:\\JANI\\szabas_programmal\\');
});
test('az xMix sorok száma továbbra is a táblák számát követi',()=>{
  const files=Array.from({length:4},(_,i)=>'2026_10_29_Konyha_tabla_0'+(i+1)+'.xPrg');
  const mix=createXMix({folder:'Konyha',programs:files});
  assert.match(mix,/NumeroRighe=4\r\n/);
  assert.equal((mix.match(/X:\\JANI\\szabas_programmal\\Konyha\\/g)||[]).length,4);
});
test('tiltott útvonalat vagy INI-befecskendezést nem enged a bútornévbe',()=>{
  assert.throws(()=>validateFilename('../rossz.xPrg'));
  assert.throws(()=>validateFilename('X:\\JANI\\szabas_programmal\\b.xPrg'));
  assert.throws(()=>validateFolder('..\\MasikMappa'));
  assert.throws(()=>validateFolder('Konyha/Nappali'));
  assert.throws(()=>validateFolder('Konyha\n[Righe]'));
  assert.throws(()=>createXMix({folder:'Konyha',programs:['egy.xPrg'],description:'rossz\n[Righe]\nNumeroRighe=88'}));
});
test('a gépi xPrg generálás korlátja változatlan',()=>assert.throws(createXPrg,/Nincs hiteles xPrg/));
