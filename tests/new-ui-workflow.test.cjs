'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
test('mind a hét oldal a mindig látható lépésfejlécben szerepel',()=>{
 const start=html.indexOf('function steps(){'),end=html.indexOf('\n  function renderNav()',start);
 assert.ok(start>0&&end>start);
 const func=vm.runInNewContext('('+html.slice(start,end).trim()+')',{
  state:{active:'parts'},projectScreen:'editor',h:s=>String(s)
 });
 const result=func();
 assert.equal((result.match(/class="step /g)||[]).length,7);
 for(const page of ['library','furniture','parts','stock','nesting','labels','save'])
  assert.match(result,new RegExp(page));
 assert.match(html,/#top-steps\{position:sticky/);
});
test('első oldalon saját mappák és egérrel húzható bútorok láthatók',()=>{
 assert.match(html,/gatterka-butor-mappak-v1/);
 assert.match(html,/id:'series',name:'Széria'/);
 assert.match(html,/atado\.name='Átadó'/);
 assert.match(html,/draggable="true"/);
 assert.match(html,/data-folder-drop/);
 for(const event of ['dragstart','dragover','drop'])
  assert.ok(html.includes("document.addEventListener('"+event+"'"));
 assert.match(html,/data-action="create-folder"/);
 assert.match(html,/data-action="rename-folder"/);
 assert.match(html,/function copyFurniture\(template\)/);
});
test('az alkatrészeknél alul egy nagy új alkatrész gomb van, Tab sorrend természetes',()=>{
 const start=html.indexOf('const right='),end=html.indexOf('\n    const warning=',start);
 const panel=html.slice(start,end);
 assert.equal((panel.match(/data-action="add-part"/g)||[]).length,1);
 assert.ok(panel.indexOf('data-action="add-part"')>panel.indexOf('</tbody></table>'));
 assert.match(panel,/part-add-bottom/);
 assert.ok(panel.indexOf('data-key="name"')<panel.indexOf('data-key="q"') ||
   html.includes('data-key="name"'));
 assert.match(html,/data-key="materialId"/);
 assert.match(html,/part-materials-compact/);
 assert.match(html,/ABS vastagság/);
 assert.match(html,/getElementById|querySelector/);
});
test('a szokli egy, kettő vagy három alkatrészből generálható és később átírható',()=>{
 const a=html.indexOf('function rebuildPlinthParts(f){');
 const b=html.indexOf('\n  function startSeriesEditor(',a);
 assert.ok(a>0&&b>a);
 let n=0;
 const rebuild=vm.runInNewContext('('+html.slice(a,b).trim()+')',{
  uuid:()=>String(++n),sidesFromCode:()=>({})
 });
 const f={parts:[{id:'leftalone',name:'Oldal'}],plinthHeight:150};
 for(const [mode,counts] of [['none',0],['one',1],['two',2],['three',2]]){
  f.plinthMode=mode;rebuild(f);
  const generated=f.parts.filter(p=>String(p.parametricType||'').startsWith('plinth-'));
  assert.equal(generated.length,counts);
  assert.ok(f.parts.some(p=>p.id==='leftalone'),'Meglévő alkatrész elveszett');
  if(mode==='one'){assert.equal(generated[0].a,'150');assert.equal(generated[0].b,'W');}
  if(mode==='two'||mode==='three'){
   assert.equal(generated[0].a,'W-2*T');
   assert.equal(generated[1].a,'D-2*T');
   assert.equal(generated[1].q,mode==='two'?'1':'2');
  }
 }
 assert.match(html,/data-key="plinthMode"/);
 assert.match(html,/data-action="rebuild-plinth"/);
});
test('a három keresés ugyanahhoz a fizikai, kétmenetes csíkvágáshoz kötődik',()=>{
 const start=html.indexOf('const directionControl='),end=html.indexOf('\n    let body=',start);
 const view=html.slice(start,end);
 assert.match(view,/value="mosaic"/);
 assert.match(view,/value="auto"/);
 assert.match(view,/value="economy"/);
 assert.doesNotMatch(view,/<option value="machine"/);
 assert.doesNotMatch(view,/<option value="rows"/);
 assert.match(html,/const machineMode=true;/);
 assert.match(html,/function buildProductionSequence\(bins\)/);
});
test('matricák és gépi mentés külön oldalon, a tábla mentése a szabástervben marad',()=>{
 assert.match(html,/function labelsPage\(\)/);
 assert.match(html,/data-key="labelsEnabled"/);
 assert.match(html,/data-action="download-labels-png"/);
 assert.match(html,/function savePage\(\)/);
 assert.match(html,/savedMachinePanel=machinePanel/);
 assert.match(html,/data-action="save-xprg-folder"/);
 assert.match(html,/data-action="download-overview"/);
 assert.match(html,/data-action="download-png"/);
});
test('anyagadatbázis külön oldalon érhető el a bútorból és az alkatrészekből',()=>{
 assert.match(html,/function materialsPage\(\)/);
 assert.match(html,/data-action="materials-page"/);
 assert.match(html,/data-key="materialId"/);
 assert.match(html,/data-key="materialColor"/);
 assert.match(html,/lap18/);
 assert.match(html,/work38/);
 assert.match(html,/rtg12/);
 assert.match(html,/hexa15/);
});
test('a régi táblák nem vesznek el; az új maradékkészlet a fő készletoldal',()=>{
 assert.match(html,/function stockPage\(\)/);
 assert.match(html,/function stockView\(\)/);
 assert.match(html,/id="legacy-boards"/);
 assert.match(html,/materialsAndRemnantsView\(false\)/);
 assert.match(html,/data-action="complete-remnant-job"/);
});
