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
  customRuleStatus:()=> 'Feltétel teljesül',
  customParameterStatus:()=> 'Paraméter igaz'
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
test('az alkatrészek külön IF fülön kapnak feltételt, a paraméter csak név és képlet',()=>{
  const markup=view(furniture);
  assert.match(markup,/class="custom-parameter-head"/);
  assert.match(markup,/class="custom-parameter-condition"/);
  assert.match(markup,/data-key="value"/);
  assert.match(markup,/data-action="delete-custom-param"/);
  assert.doesNotMatch(markup,/data-key="enabled"/);
  assert.doesNotMatch(markup,/data-scope="custom-part"/);
  assert.doesNotMatch(markup,/data-action="add-custom-part"/);
  assert.match(css,/\.custom-parameter-head\{[\s\S]*?grid-template-columns:minmax\(260px,1fr\) auto/);
  assert.match(html,/class="part-if-panel"/);
  assert.match(html,/data-key="ifCondition"/);
  assert.match(html,/IF · megmunkálási feltétel/);
});
test('Bútor megnevezése csak a paraméter nélküli bútoron marad látható',()=>{
  const editor=region('  function furnitureView(stage=', '  function materialEditorView()');
  assert.match(editor,/class="panel furniture-editor/);
  assert.match(editor,/f\.customParameters\|\|\[\]\)\.length===0\?/);
  assert.match(editor,/Bútor megnevezése/);
  assert.match(editor,/customParametersPanel\(f\)/);
});
test('mobilon a paraméter és IF szerkesztő átrendeződik',()=>{
  assert.match(css,/@media\(max-width:980px\)\{[\s\S]*?\.custom-parameter-head\{grid-template-columns:minmax\(0,1fr\) auto\}/);
  assert.match(css,/@media\(max-width:560px\)\{[\s\S]*?\.custom-parameter-head\{grid-template-columns:minmax\(0,1fr\)\}/);
  assert.match(css,/\.part-if-content\{padding:9px/);
});
test('a paraméter neve és számértéke szerkeszthető, alkatrészt nem hoz létre ezen az oldalon',()=>{
  const markup=view(furniture);
  assert.match(markup,/data-custom-parameter="param1"/);
  assert.match(markup,/data-scope="custom-param"/);
  assert.match(markup,/data-key="name"/);
  assert.match(markup,/data-key="value"/);
  assert.match(markup,/type="number"/);
  assert.doesNotMatch(markup,/data-part-id=/);
});
