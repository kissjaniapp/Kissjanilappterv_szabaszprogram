'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
function region(start,end){const i=html.indexOf(start),j=html.indexOf(end,i+start.length);assert.ok(i>=0&&j>i,'missing region '+start);return html.slice(i,j);}
let count=0;
const pcode=region('function makeCustomPartDefinition(){','\n  function startSeriesEditor(');
const params=vm.runInNewContext('(function(){'+pcode+';return {makeCustomPartDefinition,syncCustomParameterParts,customParametersPanel};})()',{
 uuid:()=>String(++count),
 sidesFromCode:()=>({x1:false,x2:false,y1:false,y2:false}),
 h:s=>String(s??'').replace(/"/g,'&quot;')
});
test('saját paraméter több alkatrészt enged, bekapcsolva berakja, kikapcsolva kiveszi',()=>{
 const f={parts:[{id:'old',name:'Kézi elem'}],customParameters:[]};
 const rule={id:'rule1',name:'Saját keret',enabled:false,
   parts:[{id:'aa',name:'Keret előlap',a:'W-2*T',b:'H',q:'1'},
          {id:'bb',name:'Oldalsó keret',a:'D-2*T',b:'150',q:'2'}]};
 f.customParameters.push(rule);
 params.syncCustomParameterParts(f);
 assert.equal(f.parts.length,1);
 rule.enabled=true;params.syncCustomParameterParts(f);
 assert.equal(f.parts.length,3);
 params.syncCustomParameterParts(f);
 assert.equal(f.parts.length,3,'Duplikált a bekapcsolás');
 assert.deepEqual(Array.from(f.parts.map(p=>p.name)),['Kézi elem','Keret előlap','Oldalsó keret']);
 const active=f.parts.find(p=>p.customPartId==='aa');
 active.a='W-36';active.q='3';
 rule.enabled=false;params.syncCustomParameterParts(f);
 assert.equal(f.parts.length,1);
 assert.equal(rule.parts[0].a,'W-36');
 assert.equal(rule.parts[0].q,'3');
 rule.enabled=true;params.syncCustomParameterParts(f);
 assert.equal(f.parts.find(p=>p.customPartId==='aa').a,'W-36');
 assert.equal(f.parts[0].name,'Kézi elem');
});
test('saját paraméter törlése csak a hozzá tartozó alkatrészeket távolítja el',()=>{
 const f={parts:[{id:'manual'}],customParameters:[{id:'r',enabled:true,parts:[{id:'x',name:'X',a:'W',b:'D',q:'1'}]}]};
 params.syncCustomParameterParts(f);
 assert.equal(f.parts.length,2);
 f.customParameters=[];
 params.syncCustomParameterParts(f);
 assert.deepEqual(Array.from(f.parts.map(x=>x.id)),['manual']);
});
test('új saját paraméterhez csak név és számérték tartozik; az alkatrészt külön vesszük fel',()=>{
 const f={customParameters:[{id:'p1',name:'Merevítés',enabled:true,condition:'W>=1100',parts:[]}]};
 const markup=params.customParametersPanel(f);
 assert.match(markup,/data-scope="custom-param"/);
 assert.match(markup,/data-key="name"/);
 assert.match(markup,/data-key="value"/);
 assert.match(markup,/data-action="add-custom-param"/);
 assert.doesNotMatch(markup,/data-key="enabled"/);
 assert.doesNotMatch(markup,/data-scope="custom-part"/);
 assert.doesNotMatch(markup,/data-action="add-custom-part"/);
});
test('a bútorválasztó Másolás/Törlés gombjai és Ctrl+húzás a tényleges műveletekhez kötöttek',()=>{
 assert.match(html,/data-action="copy-folder-item"/);
 assert.match(html,/data-action="delete-folder-item"/);
 assert.match(html,/e\.ctrlKey\|\|e\.altKey/);
 assert.match(html,/effectAllowed='copyMove'/);
 assert.match(html,/cloneFolderItem\(data\.kind,data\.id,data\.furnitureId,destination\)/);
 assert.match(html,/deleteFolderFurniture\(el\.dataset\.kind,el\.dataset\.id,el\.dataset\.furnitureId\)/);
 assert.match(html,/folderId:idx>=0\?/);
 assert.match(html,/gatterka-atado-szeria-elso-inditas-v1/);
});
test('a másolat új mappába kerül új azonosítóval, az eredeti széria és projekt nem változik',()=>{
 const src=region('function cloneFolderItem(kind,id,furnitureId,dest){','\n  function folderLibraryView(){');
 let next=0,series=[{id:'s1',folderId:'series',furniture:{id:'f1',name:'Átadó',parts:[]}}];
 const a={id:'p1',data:{projectName:'Test',furnitures:[{id:'a',name:'Oldal',parts:[]},
   {id:'b',name:'Fenék',parts:[]}],selectedFurniture:'a',boards:[{id:'maradek'}]}};
 let library=[a];
 const env={
  uuid:()=>String(++next),Date,
  copyFurniture:x=>({...JSON.parse(JSON.stringify(x)),id:'new'+ ++next,parts:[]}),
  seriesCatalog:series,library,storeCatalog:()=>{},seriesKey:'series-test',libraryKey:'test',localStorage:{setItem:()=>{}},
  confirm:()=>true,render:()=>{},result:null,state:{},currentProjectId:'',projectScreen:'library',
  defaultState:()=>({})
 };
 const handlers=vm.runInNewContext('(function(){'+src+';return {cloneFolderItem,deleteFolderFurniture,getSeries:()=>seriesCatalog,getLibrary:()=>library};})()',env);
 assert.equal(handlers.cloneFolderItem('series','s1','','other'),true);
 assert.equal(handlers.getSeries().length,2);
 assert.equal(handlers.getSeries()[1].folderId,'other');
 assert.equal(handlers.getSeries()[0].furniture.name,'Átadó');
 assert.equal(handlers.cloneFolderItem('project','p1','b','other'),true);
 assert.equal(handlers.getLibrary().length,2);
 const cloned=handlers.getLibrary()[1];
 assert.equal(cloned.data.furnitures.length,1);
 assert.equal(cloned.furnitureFolders[cloned.data.furnitures[0].id],'other');
 assert.equal(handlers.getLibrary()[0].data.furnitures.length,2);
 handlers.deleteFolderFurniture('project','p1','b');
 assert.equal(handlers.getLibrary()[0].data.furnitures.length,1);
 assert.equal(handlers.getLibrary()[0].data.furnitures[0].id,'a');
 handlers.deleteFolderFurniture('project','p1','a');
 assert.equal(handlers.getLibrary().length,1);
});
