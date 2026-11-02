'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
function region(start,end){
  const a=html.indexOf(start),b=html.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,'Nem található programrész: '+start);
  return html.slice(a,b);
}
let counter=0;
const conditionCode=region('function makeCustomPartDefinition(){','\n  function startSeriesEditor(');
const calcCode=region('function calc(formula,vars){','\n  // Névképlet:');
const logic=vm.runInNewContext('(function(){'+calcCode+conditionCode+
  ';return {customConditionState,syncCustomParameterParts,customParametersPanel};})()',{
    uuid:()=>String(++counter),h:x=>String(x??''),effectiveShelves:f=>Number(f.s||0),
    effectiveDivider:()=>0,sidesFromCode:()=>({x1:false,x2:false,y1:false,y2:false})
  });
function furniture(id,height,condition){
  return {id,name:'Szekrény',w:850,ht:height,d:500,t:18,s:0,parts:[],
    customParameters:[{id:id+'-rule',enabled:true,condition,
      name:'Merevítő hozzáadása',parts:[{id:id+'-part',name:'Merevítő',a:'W-2*T',b:'100',q:'1'}]}]};
}
test('Igen + feltétel: a bútor mérete dönti el, bekerül-e az alkatrész',()=>{
  const a=furniture('a',1000,'H>=1200');
  const b=furniture('b',1400,'H>=1200');
  logic.syncCustomParameterParts(a);logic.syncCustomParameterParts(b);
  assert.equal(a.parts.length,0);
  assert.equal(b.parts.length,1);
  a.ht=1300;logic.syncCustomParameterParts(a);
  assert.equal(a.parts.length,1);
  a.ht=800;logic.syncCustomParameterParts(a);
  assert.equal(a.parts.length,0);
  assert.equal(b.parts.length,1,'másik bútor alkatrésze érintetlen');
});
test('Az Igen/Nem kapcsoló és az összetett feltétel együtt működik',()=>{
  const f=furniture('a',1300,'H>=1200 && W>800');
  assert.equal(logic.customConditionState(f,f.customParameters[0]).active,true);
  f.w=600;
  assert.equal(logic.customConditionState(f,f.customParameters[0]).active,false);
  f.customParameters[0].condition='H>=1200 || W>800';
  assert.equal(logic.customConditionState(f,f.customParameters[0]).active,true);
  f.customParameters[0].enabled=false;
  assert.equal(logic.customConditionState(f,f.customParameters[0]).active,false);
  f.customParameters[0].enabled=true;
  f.customParameters[0].condition='H egyszer 1200';
  assert.match(logic.customConditionState(f,f.customParameters[0]).error,/összehasonlítást/i);
});
test('A feltétel kikapcsolásakor az egyedileg átírt képlet megmarad',()=>{
  const f=furniture('a',1300,'H>=1200');
  logic.syncCustomParameterParts(f);
  f.parts[0].a='W-36';
  f.ht=900;logic.syncCustomParameterParts(f);
  assert.equal(f.customParameters[0].parts[0].a,'W-36');
  f.ht=1300;logic.syncCustomParameterParts(f);
  assert.equal(f.parts[0].a,'W-36');
});
test('A bútorok másolása új, egymástól különböző kapcsolóazonosítókat hoz létre',()=>{
  const code=region('function copyFurniture(template){','\n  // A szokli darabszáma');
  let id=0;
  const copy=vm.runInNewContext('(function(){'+code+';return copyFurniture;})()',{
    uuid:()=>String(++id)
  });
  const f=furniture('a',1250,'H>=1200');
  f.parts=[{id:'p',name:'Merevítő',customParameterId:'a-rule',customPartId:'a-part'}];
  const a=copy(f),b=copy(f);
  assert.notEqual(a.id,b.id);
  assert.notEqual(a.customParameters[0].id,b.customParameters[0].id);
  assert.equal(a.parts[0].customParameterId,a.customParameters[0].id);
  assert.equal(b.parts[0].customPartId,b.customParameters[0].parts[0].id);
  assert.equal(f.parts[0].id,'p','eredeti bútor változatlan');
});
test('A közös szabás a bútoradatokat nyitja meg, és külön mentett munkaként jelenik meg',()=>{
  assert.match(html,/state\.active='furniture';result=null;furnitureCutSelection\.clear\(\)/);
  assert.match(html,/isCombinedSelectionWorkspace\(entry\)/);
  assert.match(html,/Mentett közös szabások/);
  assert.match(html,/data-action="next-selected-furniture"/);
  assert.match(html,/data-action="previous-selected-furniture"/);
});
test('A névfelajánlás saját paraméternél is működik, de bútoronként szűr',()=>{
  assert.match(html,/data-scope="custom-part".*data-key=/s);
  assert.match(html,/const selected=custom\?getFurniture\(\)/);
  assert.match(html,/selected\.parts/);
  assert.match(html,/partReferenceSuggestions\(el\)/);
});
test('Az SVG szabástervben az anyag neve és a lapvastagság is megjelenik',()=>{
  const code=region('function svgBoardSize(bin,compact=false){','\n  function trimmingSteps(');
  const draw=vm.runInNewContext('(function(){'+code+';return svgBoard;})()',{
    result:null,state:{cutDirection:'auto'},colors:['#eeeeee'],
    h:x=>String(x??''),nfmt:x=>String(x)
  });
  const svg=draw({a:2800,b:2070,thickness:18,materialColor:'Freya',trim:12,
    name:'Új tábla',used:0,placements:[],cuts:[]});
  assert.match(svg,/Tábla anyaga: Freya · 18 mm/);
  assert.match(html,/const svg=svgBoard\(bin\)/,'a PNG ugyanebből az SVG-ből készül');
});
