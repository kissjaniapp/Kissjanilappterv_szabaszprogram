'use strict';
const {test}=require('node:test');
const {readFileSync}=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const html=readFileSync(path.join(__dirname,'..','app','index.htm'),'utf8');
test('a Lapterv és a grafikus táblaelrendezés megmaradt',()=>{
  assert.match(html,/function computeNesting\(/);
  assert.match(html,/function svgBoard\(/);
  assert.match(html,/function orderedLabels\(/);
  assert.match(html,/function partsWorkbook\(/);
});
test('a kezdőoldal a helyben elmentett bútorok listája',()=>{
  assert.match(html,/let projectScreen='library'/);
  assert.match(html,/function projectLibraryView\(/);
  assert.match(html,/function openSavedProject\(/);
  assert.match(html,/data-action="create-project"/);
});
test('csak PNG, Excel és ellenőrzési XPrg/XMix projektcsomag mentés látható',()=>{
  assert.match(html,/data-action="download-xprg-project"/);
  assert.match(html,/data-action="download-png"/);
  assert.match(html,/data-action="download-parts-xlsx"/);
  assert.doesNotMatch(html,/data-action="download-svg"/);
  assert.doesNotMatch(html,/data-action="download-machine-simulator"/);
  assert.doesNotMatch(html,/data-action="download-xprg-review"/);
  assert.match(html,/class="btn primary library-open"/);
});
test('beágyazott Lapterv JavaScript hibátlanul fordítható',()=>{
  const m=html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(m,'Nem található beágyazott szkript');
  assert.doesNotThrow(()=>new vm.Script(m[1],{filename:'app/index.htm'}));
});
