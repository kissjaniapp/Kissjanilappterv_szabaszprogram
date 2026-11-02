'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const html=readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
const computeSource=html.slice(html.indexOf('function computeNesting(){'),
 html.indexOf('\n  const colors=',html.indexOf('function computeNesting(){')));
assert.ok(computeSource.includes('function computeNesting()'));
function run(mode){
 const calls=[],state={layoutMode:mode,cutDirection:'auto',trim:12,kerf:5};
 const base=()=>({bins:[{a:2800,b:2070,used:10000,usedArea:10000,
  cuts:[{stage:'head-trim',order:1},{stage:'strip',order:2},{stage:'cross',order:3}],
  machine:{feed:'x',strips:[{width:200,usedLength:1000}],crossSize:2750,feedSize:2020,feedUsed:200}
 }],failed:[],usedArea:10000,sheetArea:2800*2070,items:[{name:'Test'}],machineReady:true});
 const env={
  state,getParts:()=>({total:1,errors:[],rows:[{qty:1}]}),
  makeStripPlan:(m,p,axis)=>{calls.push(['strip',m,axis]);return base()},
  makePlan:(m,p,axis)=>{calls.push(['free',m,axis]);return base()},
  buildProductionSequence:bins=>({phases:['savozas','hosszvagas'],boards:bins.length}),
  Math,Number,Array
 };
 const compute=vm.runInNewContext('('+computeSource.trim()+')',env);
 const out=compute();
 assert.equal(out.machineReady,true);
 assert.deepEqual(Array.from(out.production.phases),['savozas','hosszvagas']);
 assert.ok(calls.length>0);
 assert.ok(calls.every(c=>c[0]==='strip'),
  'Nem gépi mozaikos vágás került az elrendezésbe: '+mode);
 return out;
}
test('mind az öt algoritmus azonos kétmenetes gépi csíkos vágást alkalmaz',()=>{
 for(const mode of ['machine','economy','auto','mosaic','rows'])run(mode);
});
test('minden gépi elrendezésnél az első vágás a teljes tábla szélezése',()=>{
 for(const mode of ['machine','economy','auto','mosaic','rows']){
  const out=run(mode),cut=out.bins[0].cuts;
  assert.equal(cut[0].stage,'head-trim');
  assert.equal(cut[1].stage,'strip');
  assert.equal(cut[2].stage,'cross');
 }
});
test('csíkok visszaadása, utána darabolás, alábontás: egy közös sorrend minden módnak',()=>{
 const source=html.slice(html.indexOf('function buildProductionSequence(bins){'),
  html.indexOf('\n  function computeNesting(){'));
 assert.match(source,/stage==='head-trim'\|\|c\.stage==='strip'/);
 assert.match(source,/type:'refeed'/);
 assert.match(source,/fo_darabolas/);
 assert.match(source,/alabontas/);
 assert.match(html,/function makeStripPlan\(mode,parts,feed\)/);
});
test('az anyagok, szériák és maradékok külön katalógusban maradnak',()=>{
 assert.match(html,/gatterka-anyagkatalogus-v1/);
 assert.match(html,/gatterka-szeriatar-v1/);
 assert.match(html,/gatterka-maradekkeszlet-v1/);
 assert.match(html,/function copyFurniture\(template\)/);
 assert.match(html,/function saveSeriesTemplate\(\)/);
 assert.match(html,/function materialForPart\(part,f\)/);
 assert.match(html,/function materialsAndRemnantsView\(\)/);
 assert.match(html,/data-key="materialId"/);
 assert.match(html,/data-key="materialColor"/);
});
test('a polcszabály 1200 és 1800 mm-nél is a megfelelő darabszámot adja',()=>{
 const src=html.slice(html.indexOf('function effectiveShelves(f){'),
  html.indexOf('\n  function effectiveDivider(f){'));
 const calc=vm.runInNewContext('('+src.trim()+')');
 const f={shelfMode:'auto',shelfFormula:'H>=1800?4:H>=1200?3:2',s:7};
 for(const [height,count] of [[900,2],[1199,2],[1200,3],[1750,3],[1800,4],[2300,4]]){
  f.ht=height;assert.equal(calc(f),count);
 }
 f.shelfMode='manual';f.s=5;assert.equal(calc(f),5);
});
