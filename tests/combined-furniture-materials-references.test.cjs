'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8').replace(/\r\n/g,'\n');
function region(a,b){
 const start=html.indexOf(a),end=html.indexOf(b,start+a.length);
 assert.ok(start>=0&&end>start,'missing program region '+a);
 return html.slice(start,end);
}
test('alkatrésznév X/Y: első méret szálirányú akkor is, ha rövidebb',()=>{
 const code=region('function calc(formula,vars){','\n  function getParts(){');
 const helpers=vm.runInNewContext('(function(){'+code+';return {calc,calcPartFormula};})()',{
  materialForPart:()=>({thickness:18})
 });
 const f={parts:[
  {id:'a',name:'Oldal',a:'400',b:'900'},
  {id:'b',name:'Polc',a:'"Oldal"x+10',b:'"Oldal"y-2*T'},
  {id:'c',name:'Láb',a:'"Polc"y-3',b:'100'}
 ]};
 const vars={W:1000,H:1200,D:600,T:18,S:0,O:0};
 assert.equal(helpers.calcPartFormula(f.parts[1].a,vars,f,f.parts[1],'x'),410);
 assert.equal(helpers.calcPartFormula(f.parts[1].b,vars,f,f.parts[1],'y'),864);
 assert.equal(helpers.calcPartFormula(f.parts[2].a,vars,f,f.parts[2],'x'),861);
 assert.equal(helpers.calcPartFormula('"Oldal"x',vars,f,f.parts[1],'x'),400);
 assert.equal(helpers.calcPartFormula('"Oldal"y',vars,f,f.parts[1],'y'),900);
});
test('alkatrészméret hivatkozás: ismeretlen, kétszeres és körkörös nevek elutasítása',()=>{
 const code=region('function calc(formula,vars){','\n  function getParts(){');
 const engine=vm.runInNewContext('(function(){'+code+';return calcPartFormula;})()',{
  materialForPart:()=>({thickness:18})
 });
 const vars={W:1000,H:900,D:500,T:18,S:0,O:0};
 const a={id:'a',name:'Oldal',a:'"Polc"y',b:'650'};
 const b={id:'b',name:'Polc',a:'250',b:'"Oldal"x'};
 const f={parts:[a,b]};
 assert.throws(()=>engine('"Hiányzik"x',vars,f,b,'x'),/Ismeretlen/);
 assert.throws(()=>engine(a.a,vars,f,a,'x'),/Körkörös/);
 f.parts.push({id:'c',name:'Oldal',a:'10',b:'20'});
 assert.throws(()=>engine('"Oldal"y',vars,f,b,'x'),/Nem egyértelmű/);
});
test('több bútor kijelölése: eltérő bútorok közös listában, darabszámok önállóan',()=>{
 const source=region('function startSelectedFurnitureCut(){','\n  function folderLibraryView(){');
 const original1={id:'f1',name:'Átadó',qty:1,parts:[{id:'p1',name:'Oldal',a:'H',b:'D',q:'2'}]};
 const original2={id:'f2',name:'Komód',qty:1,parts:[{id:'p2',name:'Fenék',a:'W',b:'D',q:'1'}]};
 const selection=new Map([['series:s1:',{selected:true,qty:3}],['project:p1:f2',{selected:true,qty:2}]]);
 const state={furnitures:[],active:'library'};
 let saved=0,rendered=0;
 const f=vm.runInNewContext('(function(){'+source+';return startSelectedFurnitureCut;})()',{
  furnitureCutSelection:selection,
  seriesCatalog:[{id:'s1',furniture:original1}],
  library:[{id:'p1',data:{furnitures:[original2]}}],
  copyFurniture:x=>({...JSON.parse(JSON.stringify(x)),id:'copy-'+x.id}),
  freshProject:()=>{state.furnitures=[];},state,
  save:()=>{saved++;},render:()=>{rendered++;},
  showNotice:()=>{},result:null,Number
 });
 f();
 assert.equal(state.furnitures.length,5);
 assert.ok(state.furnitures.slice(0,3).every(f=>f.qty===1));
 assert.ok(state.furnitures.slice(3,5).every(f=>f.qty===1));
 assert.equal(original1.qty,1);
 assert.equal(original2.qty,1);
 assert.equal(state.active,'collector','a közös szabás előbb a bútorgyűjtőt nyitja meg');
 assert.equal(saved,1);
 assert.equal(rendered,1);
 assert.equal(selection.size,0);
});
test('alapbútor: nincsenek előre kitöltött saját paraméterek és polcszámok',()=>{
 const code=region('function createBaseFurniture(){','\n  function copyFurniture(');
 const create=vm.runInNewContext('('+code.trim()+')',{uuid:()=>'f1'});
 const f=create();
 assert.deepEqual(Array.from(f.customParameters),[]);
 assert.deepEqual(Array.from(f.parts),[]);
 assert.equal(f.s,0);
 assert.equal(f.shelfMode,'manual');
 assert.equal(f.qty,1);
});
test('anyagadatbázis egyetlen színmezőt és 12/15/18/36/38 mm-es legördülőt tartalmaz',()=>{
 const src=region('function materialsAndRemnantsView(onlyMaterials=false){','\n  function stockPage(){');
 const available=[{id:'a',color:'Fehér',thickness:18},{id:'b',color:'Tölgy',thickness:36}];
 const view=vm.runInNewContext('(function(){'+src+';return materialsAndRemnantsView;})()',{
  materialCatalog:available,materialThicknesses:[12,15,18,36,38],
  h:s=>String(s),state:{selectedRemnantIds:[]},remnantCatalog:[]
 })(true);
 assert.match(view,/Szín \/ dekor/);
 assert.doesNotMatch(view,/Anyagtípus <input/);
 assert.match(view,/data-key="thickness"/);
 assert.match(view,/<select data-scope="material"/);
 for(const t of [12,15,18,36,38])assert.match(view,new RegExp('<option value="'+t+'"'));
 assert.match(view,/data-material-sort/);
});

test('anyagadatbázis: opcionális X/Y táblaméretek menthetők a szín és vastagság mellé',()=>{
 const source=region('  function catalogSheetDimension(value){','  const materialThicknesses=');
 const legacy=[
  {id:'old',name:'Régi szín',thickness:18},
  {id:'one',color:'Freya',thickness:18,boardA:'2800',boardB:'2070'},
  {id:'two',color:'Munkalap',thickness:38,boardA:4100,boardB:900},
  {id:'bad',color:'Hibás',thickness:15,boardA:-12,boardB:'nem szám'}
 ];
 const data=vm.runInNewContext('(function(){'+source+
   ';return {materialCatalog,materialBoardSizeSuffix,catalogSheetDimension};})()',{
   storedArray:()=>legacy,materialKey:'gatterka-anyagkatalogus-v1',defaults:[],
   Number,String
 });
 const arr=Array.from(data.materialCatalog);
 assert.equal(arr.length,4);
 assert.equal(arr[0].color,'Régi szín');
 assert.equal(arr[0].boardA,'');
 assert.equal(arr[0].boardB,'');
 assert.equal(arr[1].boardA,2800);
 assert.equal(arr[1].boardB,2070);
 assert.equal(data.materialBoardSizeSuffix(arr[1]),' · 2800 × 2070 mm');
 assert.equal(data.materialBoardSizeSuffix(arr[2]),' · 4100 × 900 mm');
 assert.equal(arr[3].boardA,'');
 assert.equal(arr[3].boardB,'');
 assert.equal(data.catalogSheetDimension(''), '');
 assert.equal(data.catalogSheetDimension(0), '');
 assert.equal(data.catalogSheetDimension(11000), '');
 const materialView=region('function materialsAndRemnantsView(onlyMaterials=false){','\n  function stockPage(){');
 const view=vm.runInNewContext('(function(){'+materialView+
   ';return materialsAndRemnantsView;})()',{
   materialCatalog:arr,materialThicknesses:[12,15,18,36,38],h:x=>String(x),
   state:{selectedRemnantIds:[]},remnantCatalog:[]
 })(true);
 assert.match(view,/data-key="boardA"/);
 assert.match(view,/data-key="boardB"/);
 assert.match(view,/Tábla hosszúsága/);
 assert.match(view,/Tábla szélessége/);
 assert.match(view,/value="2800"/);
 assert.match(view,/value="2070"/);
 assert.match(html,/const emptyDimension=boardDimension&&String\(el.value\).trim\(\)===''\;/);
 assert.match(html,/storeCatalog\(scope==='material'\?materialKey/);
 const optionSource=region('function materialOptions(part,f){','\n  function effectiveShelves(');
 const opts=vm.runInNewContext('(function(){'+optionSource+
   ';return materialOptions;})()',{
   materialCatalog:arr,materialForPart:()=>({color:'Freya',thickness:18}),
   materialBoardSizeSuffix:data.materialBoardSizeSuffix,h:x=>String(x),String
 })({materialId:'one'},{materialId:'one'});
 assert.match(opts,/Freya · 18 mm · 2800 × 2070 mm/);
 assert.match(opts,/Munkalap · 38 mm · 4100 × 900 mm/);
});

test('anyagadatbázis rendezése elmentődik, a legördülő ugyanazt a sorrendet használja',()=>{
 const src=region('function reorderMaterialCatalog(id,targetId,after=false){','\n  document.addEventListener(\'dragstart\'');
 const materials=[{id:'a',color:'Fehér',thickness:18},{id:'b',color:'Tölgy',thickness:36},{id:'c',color:'Hexa',thickness:15}];
 let saved=null;
 const move=vm.runInNewContext('('+src.trim()+')',{
  materialCatalog:materials,materialKey:'material-catalog',
  storeCatalog:(k,x)=>{saved=x.map(v=>v.id).join(',');}
 });
 assert.equal(move('c','a',false),true);
 assert.equal(materials.map(m=>m.id).join(','),'c,a,b');
 assert.equal(saved,'c,a,b');
 assert.equal(move('c','b',true),true);
 assert.equal(materials.map(m=>m.id).join(','),'a,b,c');
 assert.equal(move('bad','a',false),false);
 const options=region('function materialOptions(part,f){','\n  function effectiveShelves(');
 assert.match(options,/materialCatalog\.map/);
 assert.doesNotMatch(options,/h\(m\.name\)/);
});
test('az alkatrészméret gépelésekor Oldal X és Oldal Y külön ajánlat, Tab természetes',()=>{
 const code=region('function closePartSuggestions(){','\n  document.addEventListener(\'pointerdown\'');
 assert.match(code,/function partReferenceSuggestions\(el\)/);
 assert.match(code,/for\(const axis of \['x','y'\]\)/);
 assert.match(code,/p\.name\+' '\+axis\.toUpperCase\(\)/);
 assert.match(code,/selected\.parts/);
 assert.match(code,/btn\.addEventListener\('click',insert\)/);
 assert.match(html,/if\(e\.key==='Tab'\|\|e\.key==='Escape'\)closePartSuggestions\(\)/);
 assert.match(html,/if\(el\.tagName==='INPUT'\|\|el\.tagName==='SELECT'\)/);
});
test('felesleges maradék kivezetőgomb hiányzik, de a készletadat megmarad',()=>{
 assert.doesNotMatch(html,/data-action="complete-remnant-job"/);
 assert.match(html,/function materialsAndRemnantsView/);
 assert.match(html,/data-scope="remnant-selection"/);
});
test('a vágás, gépi xMix/xPrg és Mentés másként törzse változatlan marad',()=>{
 const locks=region('function buildProductionSequence(bins){','\n  function computeNesting(){');
 assert.match(locks,/type:'refeed'/);
 assert.match(html,/async function saveXprgToSelectedFolder\(\)/);
 assert.match(html,/function buildOfflineXprgProject\(/);
});
