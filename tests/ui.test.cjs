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
  assert.match(html,/function downloadXprgProject\(/);
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
 assert.match(html,/async function downloadXprgProject\(\)/);
 const first=html.indexOf('async function downloadXprgProject()');
 const last=html.indexOf('\n  function downloadCutList(',first);
 const source=html.slice(first,last);
 assert.doesNotMatch(source,/\bprompt\s*\(/);
 assert.doesNotMatch(source,/\bconfirm\s*\(/);
});

test('a gépi mentés külön oldalon van, látható célmappa nélkül',()=>{
 const start=html.indexOf('function saveView()');
 const end=html.indexOf('function render(){',start);
 assert.ok(start>=0&&end>start);
 const page=html.slice(start,end);
 assert.match(page,/data-action="save-xprg-folder"/);
 assert.doesNotMatch(page,/data-action="download-xprg-project"/);
 assert.match(page,/id="machine-save-status"/);
 assert.match(page,/Matricák beállításai és nyomtatása/);
 assert.doesNotMatch(page,/id="xmix-machine-root"|Kiválasztott célmappa/);
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
test('az öt munkalépés között a szabásterv és mentés önálló képernyő',()=>{
 const start=html.indexOf('function steps(){');
 const end=html.indexOf('\n  function renderNav()',start);
 const nav=html.slice(start,end);
 for(const page of ["'furniture'","'parts'","'stock'","'nesting'","'save'"])
  assert.ok(nav.includes(page),page);
 assert.match(html,/function saveView\(/);
 assert.match(html,/state\.active==='save'\?saveView\(\)/);
 assert.match(html,/data-page="save"/);
 assert.match(html,/return intro\('01 \/ BÚTOR ADATAI'/);
 assert.match(html,/return intro\('02 \/ ALKATRÉSZEK'/);
 assert.match(html,/intro\('03 \/ ANYAGKÉSZLET'/);
 assert.match(html,/intro\('04 \/ SZABÁSTERV'/);
});

test('a kezdőképernyő anyagszínét a gépi export nem engedi a végén átírni',()=>{
 assert.match(html,/getFurniture\(\)\?\.materialColor/);
 assert.match(html,/const color=String\(f\?\.materialColor/);
 assert.match(html,/machineExportBundle\(/);
 assert.match(html,/requestNativeMachine/);
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

test('a WinCut Mix C:\\Gatterka és napi almappa útvonalat használ',()=>{
 assert.match(html,/const defaultXmixMachineRoot='C:\\\\Gatterka'/);
 assert.match(html,/xmixMachineRoot:savedMachineRoot/);
 assert.match(html,/function machineRootPath\(\)/);
 assert.match(html,/now\.getFullYear\(\)/);
 assert.match(html,/now\.getMonth\(\)/);
 assert.match(html,/now\.getDate\(\)/);
 assert.doesNotMatch(html,/data-key="xmixMachineRoot"/);
});

test('a Windows mappaválasztó alapértelmezése C:\\Gatterka és a tényleges út kerül mentésre',()=>{
 assert.match(html,/function rememberMachineRoot\(value\)/);
 assert.match(html,/initial:defaultXmixMachineRoot/);
 assert.match(html,/async function requestNativeMachine\(action,payload\)/);
 assert.match(html,/const selected=await requestNativeMachine\('choose'/);
 assert.match(html,/rememberMachineRoot\(selected\.path\)/);
 assert.match(html,/const saved=await requestNativeMachine\('save'/);
 assert.doesNotMatch(html,/document\.getElementById\('xmix-machine-root'\)/);
 assert.doesNotMatch(html,/gatterka-machine-root-v1/);
});

test('az Alkatrészek oldalon egyetlen Anyagkészlet tovább gomb marad',()=>{
 const start=html.indexOf('function furnitureView(');
 const end=html.indexOf('function stockView()',start);
 assert.ok(start>=0&&end>start);
 const view=html.slice(start,end);
 assert.equal((view.match(/data-action="page" data-page="stock">Anyagkészlet →<\/button>/g)||[]).length,1);
});

test('a görgetősáv visszatért, hosszú listák lapozással is használhatók',()=>{
 assert.match(html,/function listPager\(kind,count,page\)/);
 assert.match(html,/data-action="list-page"/);
 assert.match(html,/f\.parts\.slice\(partListPage\*listSizes\.parts/);
 assert.match(html,/state\.boards\.slice\(stockListPage\*listSizes\.stock/);
 assert.doesNotMatch(html,/\.app\{height:100dvh;min-height:0;overflow:hidden\}/);
 assert.match(html,/#content\{overflow:visible\}/);
});