'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
const from=html.indexOf('  function orderedLabels(){');
const to=html.indexOf('  // Egyetlen SVG matricarajzot',from);
assert.ok(from>=0&&to>from);
const bins=[
  {placements:[
    {part:{name:'Később készülő'},completionStep:12},
    {part:{name:'Első kész'},completionStep:6},
    {part:{name:'Második kész'},completionStep:9}]},
  {placements:[{part:{name:'Második tábla'},completionStep:1}]}
];
const labels=vm.runInNewContext('(function(){'+html.slice(from,to)+';return orderedLabels;})()',{
  result:{bins,error:null}
})();
test('matricák táblánként a befejező gépi vágás sorszáma szerint',()=>{
  assert.deepEqual(Array.from(labels,x=>x.placement.part.name),[
    'Első kész','Második kész','Később készülő','Második tábla']);
});
test('A4 matricaív balról jobbra, utána következő sor',()=>{
  const body=html.slice(html.indexOf('  function labelPages(){'),
    html.indexOf('  function labelSheetPreview('));
  assert.match(body,/index%cols/);
  assert.match(body,/Math\.floor\(index\/cols\)/);
});
