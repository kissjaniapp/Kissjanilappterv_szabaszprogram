'use strict';
const {test}=require('node:test');
const {readFileSync}=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const html=readFileSync(path.join(__dirname,'..','app','index.htm'),'utf8');
test('a meglévő Lapterv és gépi ellenőrző export a helyén van',()=>{
  assert.match(html,/function computeNesting\(/);
  assert.match(html,/function cutExportData\(/);
  assert.match(html,/data-action="download-machine-review"/);
  assert.match(html,/function downloadMachineReview\(/);
  assert.match(html,/NEM xMix és NEM xPrg/);
});
test('működő xPrg-t nem hirdet a felület',()=>{
  assert.doesNotMatch(html,/data-action="download-xprg"/);
});

test('beágyazott Lapterv JavaScript hibátlanul fordítható',()=>{
  const m=html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(m,'Nem található beágyazott szkript');
  assert.doesNotThrow(()=>new vm.Script(m[1],{filename:'app/index.htm'}));
});
