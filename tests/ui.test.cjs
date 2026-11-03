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
  assert.match(html,/data-action="save-xprg-folder"/);
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
 assert.match(html,/data-action="save-xprg-folder"/);
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
 assert.doesNotMatch(panel,/data-key="xmixMachineRoot"/);
 assert.doesNotMatch(panel,/Gépi gyökérmappa/);
 assert.doesNotMatch(panel,/data-action="download-xprg-project"/);
 assert.match(panel,/Mentés másként/);
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
test('a bútoradatok, alkatrészek, összesítő, anyagkészlet és szabásterv külön képernyő',()=>{
 const start=html.indexOf('function steps(){');
 const end=html.indexOf('\n  function renderNav()',start);
 const nav=html.slice(start,end);
 for(const page of ["'furniture'","'parts'","'parts-review'","'stock'","'nesting'"])
  assert.ok(nav.includes(page),page);
 assert.match(html,/state\.active==='parts'\?furnitureView\('parts'\)/);
 assert.match(html,/if\(stage==='parts'\)/);
 assert.match(html,/data-action="open-parts"/);
 assert.match(html,/state\.active='parts'/);
 assert.match(html,/state\.active==='parts-review'\?partsReviewView\(\)/);
 assert.match(html,/function partsReviewView\(\)/);
 assert.match(html,/return intro\('02 \/ BÚTOR ADATAI'/);
 assert.match(html,/return intro\('03 \/ ALKATRÉSZEK'/);
 assert.match(html,/intro\('05 \/ ANYAGKÉSZLET'/);
 assert.match(html,/intro\('06 \/ SZABÁSTERV'/);
});
test('a kezdőképernyő anyagszínét a gépi export nem engedi a végén átírni',()=>{
 // A mentési panel az összes szabástábla anyagszínét jelzi,
 // de a felhasználó ott nem írhat át egyetlen gépi anyagkódot sem.
 assert.match(html,/result\.bins\.map\(bin=>bin\.materialColor/);
 assert.match(html,/const color=String\(f\?\.materialColor/);
 assert.match(html,/machineExportBundle\(/);
 assert.match(html,/showDirectoryPicker/);
 assert.doesNotMatch(html,/data-key="xprgMaterialCode"/);
 assert.doesNotMatch(html,/data-key="xprgHeaderMode"/);
 assert.doesNotMatch(html,/data-key="xprgFolder"/);
});

test('az alapértelmezett bútor anyagszíne Freya, nem a korábban elírt Feya',()=>{
 assert.match(html,/materialColor:'Freya'/);
 assert.match(html,/function createBaseFurniture\(/);
 assert.ok((html.match(/materialColor:'Freya'/g)||[]).length>=1,
   'Az új bútor és a szériából készülő munkapéldány is Freya alapanyagot kap');
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
 assert.match(html,/xmixMachineRoot:savedMachineRoot/);
 assert.doesNotMatch(html.slice(html.indexOf('const machinePanel='),html.indexOf('// A gépi csíkok és vágási műveletek')),/data-key="xmixMachineRoot"/);
 assert.match(html,/function machineRootPath\(\)/);
 assert.match(html,/machineRootPath\(\)\+'\\\\'\+cabinet\+'\\\\xPrg\\\\'/);
 assert.match(html,/if\(options\.relative\)return preview/);
 assert.match(html,/machineExportBundle\(\{relative:true\}\)/);
 assert.match(html,/key==='xmixMachineRoot'/);
});

test('a gépi gyökérmappát gépelés közben menti és natív ablakból módosítja',()=>{
 assert.match(html,/function rememberMachineRoot\(value\)/);
 assert.match(html,/localStorage\.setItem\('gatterka-machine-root-v1'/);
 assert.match(html,/rememberMachineRoot\(el\.value\)/);
 assert.match(html,/async function requestNativeMachine\(action,payload\)/);
 assert.match(html,/const saved=await requestNativeMachine\('write-files'/);
 assert.match(html,/if\(options\.relative\)return preview/);
 assert.doesNotMatch(html.slice(html.indexOf('const machinePanel='),html.indexOf('// A gépi csíkok és vágási műveletek')),/xmix-machine-root/);
 assert.match(html,/const saved=await requestNativeMachine\('write-files'/);
});

test('az Alkatrészek oldalon csak egy Anyagkészlet továbbgomb van',()=>{
  const first=html.indexOf('function furnitureView(');
  const end=html.indexOf('\n  function stockView()',first);
  assert.ok(first>=0&&end>first);
  const view=html.slice(first,end);
  assert.equal((view.match(/Anyagkészlet →/g)||[]).length,1);
});
test('a Windows mentési panelen egyetlen Mentés másként gomb van, útvonal nélkül',()=>{
  const panel=html.slice(html.indexOf('const machinePanel='),html.indexOf('// A gépi csíkok és vágási műveletek'));
  assert.equal((panel.match(/data-action="save-xprg-folder"/g)||[]).length,1);
  assert.doesNotMatch(panel,/xmix-machine-root/);
  assert.doesNotMatch(panel,/ZIP letöltése/);
  assert.match(panel,/Mentés másként/);
  assert.match(html,/requestNativeMachine\('choose-save-as'/);
  assert.match(html,/requestNativeMachine\('write-files'/);
  assert.match(html,/machineExportBundle\(\{relative:true\}\)/);
  const flow=html.slice(html.indexOf('async function saveXprgToSelectedFolder()'),html.indexOf('function downloadCutList(',html.indexOf('async function saveXprgToSelectedFolder()')));
  // Először a csomag készül el (hibák az ablak előtt), utána nyílik a Mentés másként, végül írás.
  assert.ok(flow.indexOf('machineExportBundle({relative:true})')<flow.indexOf("requestNativeMachine('choose-save-as'"));
  assert.ok(flow.indexOf("requestNativeMachine('choose-save-as'")<flow.indexOf("requestNativeMachine('write-files'"));
  assert.doesNotMatch(flow,/write-zip/);
});

test('a Mentés másként gomb közvetlenül mellette állapot- és hibajelzést mutat',()=>{
 const panel=html.slice(html.indexOf('const machinePanel='),html.indexOf('// A gépi csíkok és vágási műveletek'));
 assert.match(panel,/id="machine-save-status"/);
 assert.match(panel,/aria-live="polite"/);
 assert.match(html,/status\.textContent=message/);
 assert.match(html,/if\(button\)\{button\.disabled=true/);
 assert.match(html,/finally\{/);
});
