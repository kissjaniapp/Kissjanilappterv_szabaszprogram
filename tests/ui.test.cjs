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

test('a Nesting terv nem jeleníti meg a három felesleges magyarázó blokkot',()=>{
 const start=html.indexOf('const machinePanel=');
 const end=html.indexOf('// A gépi csíkok és vágási műveletek',start);
 assert.ok(start>=0&&end>start);
 const panel=html.slice(start,end);
 assert.doesNotMatch(panel,/A BLAP003 mintakód; ellenőrizd az anyagtörzsben/);
 assert.match(panel,/C:\\\\WinCut\\\\Prg/);
 assert.doesNotMatch(panel,/Csak offline ellenőrző minta/);
 assert.doesNotMatch(panel,/nem hitelesített/);
 assert.match(panel,/data-key="xprgMaterialCode"/);
 assert.match(panel,/data-action="download-xprg-project"/);
 assert.doesNotMatch(html,/<div class="callout top-gap"><strong>Fontos:<\/strong>/);
 assert.match(html,/data-action="download-parts-png"/);
});

test('az alkatrészméret az élő eredményt és a szerkeszthető képletet egymás alatt mutatja',()=>{
 assert.match(html,/function partDimensionInput\(/);
 assert.match(html,/function partDimensionPreview\(/);
 assert.match(html,/hasFormula\?'has-formula':''/);
 assert.match(html,/\.expr-cell\.has-formula \.expr-result/);
 assert.match(html,/class="expr-result/);
 assert.match(html,/data-expr-axis/);
 assert.match(html,/data-live-part-total/);
 assert.match(html,/data-live-part-area/);
});
test('nincs újraszámolás gomb; a nesting és az élő képletszámítás automatikus',()=>{
 assert.doesNotMatch(html,/Újraszámolás/);
 assert.match(html,/const run='';/);
 assert.match(html,/if\(!result\)result=computeNesting\(\)/);
 assert.match(html,/document\.addEventListener\('input'/);
 assert.match(html,/refreshLiveFormulaValues\(\)/);
 assert.match(html,/scheduleLiveNesting\(\)/);
 assert.match(html,/result=hadNesting\|\|state\.active==='nesting'\?computeNesting\(\):null/);
});

test('az XML xMix-ben az xPrg mappa beállítható és a régi bútorprojektek is működnek',()=>{
  assert.match(html,/data-key="xprgFolder"/);
  assert.match(html,/xprgFolder:'\.\\\\xPrg\\\\'/);
  assert.match(html,/XPrg fájlok helye az XMix-ben/);
  assert.match(html,/key==='xprgMaterialCode'\|\|key==='xprgFolder'/);
  assert.match(html,/state\.xprgFolder\?\?/);
});

test('xPrg a gépen működő próbakód fejlécstílusát választja alapértelmezetten',()=>{
 assert.match(html,/xprgHeaderMode:'sample'/);
 assert.match(html,/data-key="xprgHeaderMode"/);
 assert.match(html,/value="sample"/);
 assert.match(html,/value="color"/);
 assert.match(html,/Próba szerint · anyagkód/);
 assert.match(html,/Anyagszín \/ dekor/);
 assert.match(html,/state\.xprgHeaderMode\?\?'sample'/);
 assert.match(html,/key==='xprgHeaderMode'/);
});
