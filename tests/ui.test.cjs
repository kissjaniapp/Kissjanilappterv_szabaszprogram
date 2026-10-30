'use strict';
const {test}=require('node:test');
const {readFileSync}=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const html=readFileSync(path.join(__dirname,'..','app','index.htm'),'utf8');
test('a Gatterka és a grafikus táblaelrendezés megmaradt',()=>{
  assert.match(html,/function computeNesting\(/);
  assert.match(html,/function svgBoard\(/);
  assert.match(html,/function orderedLabels\(/);
  assert.match(html,/function buildPartsPngPages\(/);
});
test('a kezdőoldal a helyben elmentett bútorok listája',()=>{
  assert.match(html,/let projectScreen='library'/);
  assert.match(html,/function projectLibraryView\(/);
  assert.match(html,/function openSavedProject\(/);
  assert.match(html,/data-action="create-project"/);
});
test('a PNG alkatrészlista és az XPrg/XMix export látható, Excel már nincs',()=>{
  assert.match(html,/data-action="download-xprg-project"/);
  assert.match(html,/data-action="download-png"/);
  assert.match(html,/data-action="download-parts-png"/);
  assert.doesNotMatch(html,/data-action="download-parts-xlsx"/);
  assert.doesNotMatch(html,/function partsWorkbook\(/);
  assert.doesNotMatch(html,/data-action="download-svg"/);
  assert.doesNotMatch(html,/data-action="download-machine-simulator"/);
  assert.doesNotMatch(html,/data-action="download-xprg-review"/);
  assert.match(html,/class="btn primary library-open"/);
});
test('beágyazott Gatterka JavaScript hibátlanul fordítható',()=>{
  const m=html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(m,'Nem található beágyazott szkript');
  assert.doesNotThrow(()=>new vm.Script(m[1],{filename:'app/index.htm'}));
});

test('a Gatterka felirat jelenik meg a régi Lapterv név helyett',()=>{
  assert.match(html,/<title>Gatterka/);
  assert.match(html,/brand-name">gatterka/);
  assert.doesNotMatch(html,/<title>Lapterv/);
  assert.match(html,/lapterv-library-v1/);
});

test('a Szálirány kötelező megnevezés szerepel az alkatrészeknél',()=>{
 assert.match(html,/Szálirány kötelező/);
 assert.doesNotMatch(html,/Szál kötelező/);
});
test('az xPrg ZIP letöltés panelje nem nyit anyagkód- vagy jóváhagyó ablakot',()=>{
 assert.match(html,/data-key="xprgMaterialCode"/);
 assert.match(html,/xprgMaterialCode:'BLAP003'/);
 assert.match(html,/data-action="download-xprg-project"/);
 const first=html.indexOf('async function downloadXprgProject()');
 const last=html.indexOf('\n  function downloadCutList(',first);
 const source=html.slice(first,last);
 assert.doesNotMatch(source,/\bprompt\s*\(/);
 assert.doesNotMatch(source,/\bconfirm\s*\(/);
});
