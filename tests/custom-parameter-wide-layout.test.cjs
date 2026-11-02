'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
const css=html.slice(html.indexOf('<style>'),html.indexOf('</style>'));
function region(a,b){
  const start=html.indexOf(a),end=html.indexOf(b,start+a.length);
  assert.ok(start>=0&&end>start,'Nem található a '+a+' kódrész');
  return html.slice(start,end);
}
const paramSource=region('  function customParametersPanel(f){','  function startSeriesEditor(');
const view=vm.runInNewContext('(function(){'+paramSource+';return customParametersPanel;})()',{
  h:s=>String(s??'').replace(/&/g,'&amp;').replace(/"/g,'&quot;'),
  customRuleStatus:()=> 'Feltétel teljesül'
});
const furniture={customParameters:[{
  id:'param1',name:'f-osztóka',enabled:true,condition:'W>=1100',
  parts:[{id:'p1',name:'',a:'964',b:'240',q:'2'}]
}]};

test('a saját paraméter teljes szélességű panel, nem oldalsó keskeny oszlop',()=>{
  const markup=view(furniture);
  assert.match(markup,/class="panel top-gap custom-parameters-panel"/);
  assert.match(css,/\.two-col>\.panel\.furniture-editor:first-child \.panel-body > \.custom-parameters-panel[\s\S]*?grid-column:1\/-1/);
  assert.match(css,/\.custom-parameters-panel\{width:100%;max-width:none/);
});
test('asztali nézetben egy sor: alkatrésznév, első méret, második méret, darabszám, törlés',()=>{
  const markup=view(furniture);
  assert.match(markup,/class="custom-parameter-part-row"/);
  assert.match(markup,/class="custom-parameter-part-field"/);
  assert.match(css,/\.custom-parameter-part-row\{[\s\S]*?grid-template-columns:minmax\(200px,2fr\) minmax\(120px,1fr\) minmax\(120px,1fr\) minmax\(100px,\.8fr\) 40px/);
  assert.match(css,/\.custom-parameter-part-field \.expr-cell\{width:100%;min-width:0\}/);
  for(const field of ['name','a','b','q'])
    assert.match(markup,new RegExp('data-key="'+field+'"'));
});
test('paraméter neve, kapcsoló és törlés széles fejlécsorban marad',()=>{
  const markup=view(furniture);
  assert.match(markup,/class="custom-parameter-head"/);
  assert.match(markup,/class="custom-parameter-condition"/);
  assert.match(markup,/data-key="condition"/);
  assert.match(markup,/data-action="delete-custom-param"/);
  assert.match(css,/\.custom-parameter-head\{[\s\S]*?grid-template-columns:minmax\(250px,2\.5fr\)/);
});
test('Bútor megnevezése csak a paraméter nélküli bútoron marad látható',()=>{
  const editor=region('  function furnitureView(stage=', '  function materialEditorView()');
  assert.match(editor,/class="panel furniture-editor/);
  assert.match(editor,/f\.customParameters\|\|\[\]\)\.length===0\?/);
  assert.match(editor,/Bútor megnevezése/);
  assert.match(editor,/customParametersPanel\(f\)/);
});
test('mobilon a mezők átrendeződnek, nem lógnak le',()=>{
  assert.match(css,/@media\(max-width:980px\)\{[\s\S]*?\.custom-parameter-part-row\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/@media\(max-width:560px\)\{[\s\S]*?\.custom-parameter-head,\.custom-parameter-part-row\{/);
});
test('a paraméteres szerkesztés megtartja a mezők és képletek adatkapcsolatait',()=>{
  const markup=view(furniture);
  assert.match(markup,/data-custom-parameter="param1"/);
  assert.match(markup,/data-scope="custom-param"/);
  assert.match(markup,/data-scope="custom-part"/);
  assert.match(markup,/data-part-id="p1"/);
  assert.match(markup,/value="964"/);
  assert.match(markup,/value="240"/);
  assert.match(markup,/value="2"/);
});
