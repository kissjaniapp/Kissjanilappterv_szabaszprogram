'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
function region(a,b){
  const start=html.indexOf(a),end=html.indexOf(b,start+a.length);
  assert.ok(start>=0&&end>start,'Hiányzó programrész: '+a);
  return html.slice(start,end);
}
const custom=region('  function makeCustomPartDefinition(){','  function startSeriesEditor(');
const formula=region('function calc(formula,vars){','  function getParts(){');
const parts=region('  function getParts(){','  function intro(');
function engine(furnitures){
  let id=0;
  return vm.runInNewContext('(function(){'+custom+formula+parts+
    ';return {getParts,calcPartFormula,evaluateFurnitureIf,namedFurnitureParameter,migrateLegacyCustomParts,partIfText};})()',{
      state:{furnitures},uuid:()=>String(++id),h:x=>String(x??''),
      effectiveShelves:()=>0,effectiveDivider:()=>0,
      materialForPart:()=>({thickness:18,color:'Freya'}),
      sidesFromCode:()=>({x1:false,x2:false,y1:false,y2:false}),
      pnum:x=>Number(String(x).replace(',','.'))
    });
}
function furniture(id,w=1200,name='f-osztóka'){
  return {id,name:'Szekrény '+id,qty:1,w,ht:1350,d:500,t:18,s:0,
    parts:[{id:'part-'+id,name:'Merevítő',a:'W-2*T',b:'240',q:'2',
      ifCondition:name,edge:'0-0',edgeThickness:2,mill:false}],
    customParameters:[{id:'param-'+id,name,condition:'W>=1100',enabled:true,parts:[]}]};
}
test('csak a paraméter létrehozása még nem hoz létre alkatrészt',()=>{
  const f=furniture('a');
  f.parts=[];
  const e=engine([f]);
  e.migrateLegacyCustomParts(f);
  assert.equal(f.parts.length,0);
  assert.equal(e.getParts().total,0);
});
test('ugyanaz a paraméternév külön bútoron csak a saját IF-et értékeli ki',()=>{
  const a=furniture('a',1200),b=furniture('b',900);
  const summary=engine([a,b]).getParts();
  assert.equal(summary.total,2);
  assert.equal(summary.rows[0].qty,2);
  assert.equal(summary.rows[1].qty,0);
  assert.equal(summary.rows[1].ifSkipped,true);
});
test('alkatrész méret- és darabszámképletben is működik a [paraméter neve] hivatkozás',()=>{
  const f=furniture('a',1200),e=engine([f]);
  f.parts[0].a='W-2*T-[f-osztóka]*10';
  f.parts[0].q='1+[f-osztóka]';
  const r=e.getParts();
  assert.equal(r.rows[0].originalA,1154);
  assert.equal(r.rows[0].qty,2);
  f.w=900;
  assert.equal(e.calcPartFormula('W+[f-osztóka]',
    {W:900,H:1350,D:500,T:18,S:0,O:0},f,f.parts[0]),900);
});
test('IF: >=, <=, &&, ||, !, 0 és 1 használhatók',()=>{
  const f=furniture('a',1200),e=engine([f]),v={W:1200,H:1350,D:500,T:18,S:0,O:0};
  assert.equal(e.evaluateFurnitureIf('W>=1100 && H>1000',v,f,f.parts[0]),true);
  assert.equal(e.evaluateFurnitureIf('W<1100 || H<=1350',v,f,f.parts[0]),true);
  assert.equal(e.evaluateFurnitureIf('0',v,f,f.parts[0]),false);
  assert.equal(e.evaluateFurnitureIf('1',v,f,f.parts[0]),true);
  assert.equal(e.evaluateFurnitureIf('![f-osztóka]',v,f,f.parts[0]),false);
});
test('érvénytelen IF nem kerülhet észrevétlenül a szabásba',()=>{
  const f=furniture('a');f.parts[0].ifCondition='H EGYENLŐ 1200';
  const result=engine([f]).getParts();
  assert.equal(result.total,0);
  assert.equal(result.errors.length,1);
  assert.match(result.errors[0],/IF/);
});
test('másik bútor paraméterére való hivatkozás nem megengedett',()=>{
  const a=furniture('a'),b=furniture('b',1200,'másik');
  const v={W:1200,H:1350,D:500,T:18,S:0,O:0},e=engine([a,b]);
  assert.throws(()=>e.evaluateFurnitureIf('[másik]',v,a,a.parts[0]),/Ismeretlen bútorparaméter/);
  assert.equal(e.evaluateFurnitureIf('[másik]',v,b,b.parts[0]),true);
});
test('egymásba ágyazott paraméter támogatott; körhivatkozás tiltott',()=>{
  const f=furniture('a'),e=engine([f]);
  f.customParameters.push({id:'extra',name:'feltetel-2',condition:'[f-osztóka]',parts:[]});
  const v={W:1200,H:1350,D:500,T:18,S:0,O:0};
  assert.equal(e.evaluateFurnitureIf('feltetel-2',v,f),true);
  f.customParameters[0].condition='[feltetel-2]';
  assert.throws(()=>e.evaluateFurnitureIf('feltetel-2',v,f),/Körkörös/);
});
test('régi kapcsolós paraméter: alkatrészek egyszer migrálnak, képletek megmaradnak',()=>{
  const f=furniture('régi');f.parts=[];
  f.customParameters=[{id:'old',name:'Merevítő',enabled:false,
    condition:'W>=1100',parts:[{id:'spec',name:'Merevítő',a:'964',b:'240',q:'2'}]}];
  const e=engine([f]);e.migrateLegacyCustomParts(f);
  assert.equal(f.parts.length,1);
  assert.equal(f.parts[0].a,'964');
  assert.equal(f.parts[0].b,'240');
  assert.equal(f.parts[0].q,'2');
  assert.equal(f.parts[0].ifCondition,'0');
  assert.equal(f.customParameters[0].parts.length,0);
  e.migrateLegacyCustomParts(f);
  assert.equal(f.parts.length,1,'nem duplikálhatja a munkát');
  f.parts[0].ifCondition='[Merevítő]';
  assert.equal(e.getParts().total,2,'az átmentett alkatrész kézzel újra bekapcsolható');
});
test('a Bútor adatai sorrendje: hová készül + alapanyag, méretek, paraméterek',()=>{
  const view=region('  function furnitureView(stage=', '  function materialEditorView()');
  const job=view.indexOf('<div class="job-info">');
  assert.ok(job>0);
  assert.ok(job<view.indexOf('<div class="field-grid">'));
  assert.ok(view.indexOf('<div class="field-grid">')<view.indexOf('customParametersPanel(f)'));
  assert.match(view,/data-key="ifCondition"/);
  assert.match(view,/class="part-if-panel"/);
});
