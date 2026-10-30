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
  assert.match(html,/brand-name">Gatterka/);
  assert.doesNotMatch(html,/<title>Lapterv/);
  assert.match(html,/lapterv-library-v1/);
});

test('a Szálirány kötelező megnevezés szerepel az alkatrészeknél',()=>{
 assert.match(html,/Szálirány kötelező/);
 assert.doesNotMatch(html,/Szál kötelező/);
});
test('az xPrg ZIP letöltés panelje nem nyit anyagkód- vagy jóváhagyó ablakot',()=>{
 assert.doesNotMatch(html,/data-key="xprgMaterialCode"/);
 assert.match(html,/xprgMaterialCode:'BLAP003'/);
 assert.match(html,/data-action="download-xprg-project"/);
 const first=html.indexOf('async function downloadXprgProject()');
 const last=html.indexOf('\n  function downloadCutList(',first);
 const source=html.slice(first,last);
 assert.doesNotMatch(source,/\bprompt\s*\(/);
 assert.doesNotMatch(source,/\bconfirm\s*\(/);
});

test('a szabásterv panelen csak mappaválasztás és ZIP letöltés van',()=>{
 const start=html.indexOf('const machinePanel=');
 const end=html.indexOf('// A gépi csíkok és vágási műveletek',start);
 assert.ok(start>=0&&end>start);
 const panel=html.slice(start,end);
 assert.match(panel,/data-action="save-xprg-folder"/);
 assert.match(panel,/data-key="xmixMachineRoot"/);
 assert.match(panel,/Gépi gyökérmappa/);
 assert.match(panel,/data-action="download-xprg-project"/);
 assert.doesNotMatch(panel,/data-key="xprgMaterialCode"/);
 assert.doesNotMatch(panel,/data-key="xprgFolder"/);
 assert.doesNotMatch(panel,/data-key="xprgHeaderMode"/);
 assert.doesNotMatch(panel,/Csak offline ellenőrző minta/);
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


test('a kezdőképernyőn Kiss János szerzői és tulajdonosi felirata jelenik meg',()=>{
 assert.match(html,/A programot készítette: <strong>Kiss János<\/strong>/);
 assert.match(html,/A program Kiss János tulajdona/);
 assert.match(html,/brand-name\{font-size:20px;font-weight:600/);
});
test('a bútoradatok, alkatrészek, anyagkészlet és a szabásterv külön képernyő',()=>{
 const start=html.indexOf('function steps(){');
 const end=html.indexOf('\n  function renderNav()',start);
 const nav=html.slice(start,end);
 for(const page of ["'furniture'","'parts'","'stock'","'nesting'"])
  assert.ok(nav.includes(page),page);
 assert.match(html,/state\.active==='parts'\?furnitureView\('parts'\)/);
 assert.match(html,/if\(stage==='parts'\)/);
 assert.match(html,/data-action="open-parts"/);
 assert.match(html,/state\.active='parts'/);
 assert.match(html,/return intro\('01 \/ BÚTOR ADATAI'/);
 assert.match(html,/return intro\('02 \/ ALKATRÉSZEK'/);
 assert.match(html,/intro\('03 \/ ANYAGKÉSZLET'/);
 assert.match(html,/intro\('04 \/ SZABÁSTERV'/);
});
test('a kezdőképernyő anyagszínét a gépi export nem engedi a végén átírni',()=>{
 assert.match(html,/getFurniture\(\)\?\.materialColor/);
 assert.match(html,/const color=String\(f\?\.materialColor/);
 assert.match(html,/machineExportBundle\(/);
 assert.match(html,/showDirectoryPicker/);
 assert.doesNotMatch(html,/data-key="xprgMaterialCode"/);
 assert.doesNotMatch(html,/data-key="xprgHeaderMode"/);
 assert.doesNotMatch(html,/data-key="xprgFolder"/);
});

test('az alapértelmezett bútor anyagszíne Freya, nem a korábban elírt Feya',()=>{
 assert.match(html,/materialColor:'Freya'/);
 assert.equal((html.match(/materialColor:'Freya'/g)||[]).length,2,
   'Az új bútor és az új projekt azonos alapanyagot kap');
 assert.doesNotMatch(html,/materialColor:'Feya'/);
 assert.match(html,/f\.materialColor\|\|'Freya'/);
});
test('a régi Feya beállítás kizárólag Freyára javul, az egyéb anyagok érintetlenek',()=>{
 const from=html.indexOf('function normalizeFurnitureMeta(');
 const to=html.indexOf('\n  function normalizeFurnitureSizes(',from);
 assert.ok(from>0&&to>from);
 const normalize=vm.runInNewContext('('+html.slice(from,to).trim()+')');
 const furniture=[
   {materialColor:'Feya'}, {materialColor:'Freya'},
   {materialColor:'Tölgy'}, {materialColor:'Fehér tölgy'},
   {materialColor:'Onixszürke'}
 ];
 normalize(furniture,{labelMaterial:''});
 assert.deepEqual(furniture.map(f=>f.materialColor),
   ['Freya','Freya','Tölgy','Fehér tölgy','Onixszürke']);
 assert.match(html,/if\(corrected\)localStorage\.setItem\(libraryKey,JSON\.stringify\(library\)\)/);
});

test('a WinCut Mix a megadott teljes X: gépi utat menti, nem csak a relatív xPrg nevet',()=>{
 assert.match(html,/const defaultXmixMachineRoot='X:\\\\JANI\\\\szabas_programmal\\\\Legujabb_mentessel'/);
 assert.match(html,/xmixMachineRoot:defaultXmixMachineRoot/);
 assert.match(html,/data-key="xmixMachineRoot"/);
 assert.match(html,/function machineRootPath\(\)/);
 assert.match(html,/machineRootPath\(\)\+'\\\\'\+cabinet\+'\\\\xPrg\\\\'/);
 assert.match(html,/String\(parent.name\)\.toLocaleLowerCase/);
 assert.match(html,/machineExportBundle\(\{cabinetFolder:folderName\}\)/);
 assert.match(html,/key==='xmixMachineRoot'/);
});
