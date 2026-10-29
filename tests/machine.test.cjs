'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const path=require('node:path');
const {createXMix,createXPrg,validateFilename}=require('../machine/xmix.cjs');
const original=readFileSync(path.join(__dirname,'..','fixtures','eredeti_pelda.xMix'),'utf8');
test('xMix eredeti mintával egyező anyag- és RigaMix-mezőket készít',()=>{
  const x=createXMix({date:'21/10/2026',material:{name:'Hátfallap fehér',code:'B-FEH.HF',quantity:999},programs:[
    {filename:'2026_10_21__08_35_16_1.xPrg'},{filename:'2026_10_21__08_35_16_2.xPrg'}]});
  assert.match(x,/Tipologia="Hátfallap fehér"/);
  assert.match(x,/RigaMix File="\.\\xPrg\\2026_10_21__08_35_16_1\.xPrg" Rep="1" Pacco="1" CambioMateriale="0"/);
  assert.match(original,/RigaMix File="\.\\xPrg\\2026_10_21__08_35_16_1\.xPrg" Rep="1" Pacco="1" CambioMateriale="0"/);
  assert.equal((x.match(/<RigaMix /g)||[]).length,2);
});
test('véd az elérési út beágyazásától és XML injectiontől',()=>{
  assert.throws(()=>validateFilename('../rossz.xPrg'));
  const xml=createXMix({date:'21/10/2026',material:{name:'A&B "teszt"',code:'C<D'},programs:[{filename:'eredeti.xPrg'}]});
  assert.match(xml,/A&amp;B &quot;teszt&quot;/);
  assert.match(xml,/C&lt;D/);
});
test('a nem ellenőrzött xPrg kiadása tiltott',()=>assert.throws(createXPrg,/Nincs hiteles xPrg/));
