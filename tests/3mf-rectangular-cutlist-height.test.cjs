'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
function block(a,b){
 const start=html.indexOf(a),end=html.indexOf(b,start+a.length);
 assert.ok(start>=0&&end>start,'Hiányzó programrész: '+a);
 return html.slice(start,end);
}
const rectangular=vm.runInNewContext('('+block('  function threeMfRectangularSolid(','  // A szögben leszabott').trim()+')');
function box(w,d,h) {
 const p=[[0,0,0],[w,0,0],[w,d,0],[0,d,0],
          [0,0,h],[w,0,h],[w,d,h],[0,d,h]];
 const faces=[[0,3,2,1],[4,5,6,7],[0,1,5,4],
              [3,7,6,2],[0,4,7,3],[1,2,6,5]];
 return {p,tris:faces.flatMap(([a,b,c,d])=>[[a,b,c],[a,c,d]]).map(ids=>({
   getAttribute:(key)=>String(ids[{v1:0,v2:1,v3:2}[key]])
 }))};
}
test('valódi téglatest marad szabható, nem csak a négyzetes lap',()=>{
 const {p,tris}=box(900,500,18);
 assert.equal(rectangular(p,tris,[900,500,18],[0,0,0]),true);
});
test('ferde, hiányos vagy íves / befoglaló doboz szerinti alak nem lesz automatikus szabászati alkatrész',()=>{
 const {p,tris}=box(900,500,18);
 assert.equal(rectangular(p,tris.slice(2),[900,500,18],[0,0,0]),false);
 const slanted=p.map(v=>v.slice());slanted[6][2]=29;
 assert.equal(rectangular(slanted,tris,[900,500,29],[0,0,0]),false);
 const curved=p.map(v=>v.slice());curved.push([450,250,18]);
 const modified=tris.slice();modified[2]={getAttribute:key=>String([{v1:4,v2:5,v3:8}[key]])};
 assert.equal(rectangular(curved,modified,[900,500,18],[0,0,0]),false);
});
const minimum=vm.runInNewContext('('+block('  function threeMfGroupMeetsMinimum(','  function threeMfPartMeetsMinimum(').trim()+')');
const angled=vm.runInNewContext('('+block('  function threeMfAngledPanel(','  // Standalone 3MF/ZIP reader.').trim()+')');
function extrudedPanel(points,t=18){
  const n=points.length;
  const p=[...points.map(([x,y])=>[x,y,0]),...points.map(([x,y])=>[x,y,t])];
  const faces=[];
  for(let i=1;i<n-1;i++){faces.push([0,i+1,i]);faces.push([n,n+i,n+i+1]);}
  for(let i=0;i<n;i++){
    const j=(i+1)%n;
    faces.push([i,j,n+j],[i,n+j,n+i]);
  }
  const tris=faces.map(ids=>({getAttribute:key=>String(ids[{v1:0,v2:1,v3:2}[key]])}));
  const lo=[Math.min(...p.map(q=>q[0])),Math.min(...p.map(q=>q[1])),0];
  const extents=[Math.max(...p.map(q=>q[0]))-lo[0],Math.max(...p.map(q=>q[1]))-lo[1],t];
  return {p,tris,lo,extents};
}
test('ferde vágású trapéz és háromszög befoglaló mérettel szabható',()=>{
  for(const points of [
    [[0,0],[900,0],[760,500],[0,500]],
    [[0,0],[900,0],[0,500]]
  ]){
    const {p,tris,extents,lo}=extrudedPanel(points);
    assert.equal(angled(p,tris,extents,lo),true);
    assert.deepEqual(extents,[900,500,18]);
    assert.equal(rectangular(p,tris,extents,lo),false);
    assert.equal(angled(p,tris.slice(2),extents,lo),false,'hiányos mesh nem megengedett');
  }
});
test('íves és homorú test továbbra sem kap automatikusan előgyártmányt',()=>{
  const concave=extrudedPanel([[0,0],[900,0],[900,200],[500,200],[500,500],[0,500]]);
  assert.equal(angled(concave.p,concave.tris,concave.extents,concave.lo),false);
});
test('3MF-ben a 50 × 50 mm a minimum, a 38 mm munkalap nem alkatrész',()=>{
 assert.equal(minimum({dimensions:[37,30,18]}),false);
 assert.equal(minimum({dimensions:[50,50,18]}),true);
 assert.equal(minimum({dimensions:[50,49.99,18]}),false);
 assert.equal(minimum({dimensions:[900,600,38]}),false);
 assert.equal(minimum({dimensions:[900,600,36]}),true);
});
test('38 mm munkalap és apró 3MF test megmarad a 3D magasságában',()=>{
 const code=block('  function threeMfApplyImport(','  function fusionEulerAngles(');
 let sequence=0;
 const apply=vm.runInNewContext('(function(){'+code+';return threeMfApplyImport;})()',{
   uuid:()=>String(++sequence),threeMfCombinedCuttingGroups:data=>data.groups,
   threeMfGroupMeetsMinimum:minimum,
   sidesFromCode:()=>({x1:false,x2:false,y1:false,y2:false}),
   threeMfViewStates:new Map(),result:{},Math,Number,String
 });
 const f={id:'cabinet',w:1,ht:1,d:1,parts:[]};
 const specs=[
   ['Kicsi',37,30,18,0],['Határ',50,50,18,20],
   ['Munkalap',900,600,38,200],['Lap',850,500,18,50]
 ];
 const data={parts:specs.map(([name,x,y,t,z],i)=>({
   id:String(i),name,originMm:[0,0,z],axisBoundsMm:[x,y,t]
 })),groups:specs.map(([name,x,y,t],i)=>({
   name,dimensions:[x,y,t],indices:[i],isRectangular:true
 }))};
 apply(f,data);
 assert.deepEqual(Array.from(f.parts,p=>p.name),['Határ','Lap']);
 assert.equal(f.ht,238);
 assert.equal(f.threeMfImport.parts.length,4);
 assert.equal(f.threeMfImport.groups.length,4);
});
test('3MF-nél csak a téglatest kerül alkatrészlistába, de magasabb szabálytalan test növeli a bútormagasságot',()=>{
 const code=block('  function threeMfApplyImport(','  function fusionEulerAngles(');
 let sequence=0;
 const ctx={
   uuid:()=>String(++sequence),
   threeMfCombinedCuttingGroups:data=>data.groups,
   sidesFromCode:()=>({x1:false,x2:false,y1:false,y2:false}),
   threeMfViewStates:new Map(),
   threeMfGroupMeetsMinimum:minimum,
   result:{},Math,Number,String
 };
 const apply=vm.runInNewContext('(function(){'+code+';return threeMfApplyImport;})()',ctx);
 const f={id:'cabinet',w:1,ht:1,d:1,parts:[{id:'kezzel',name:'Kézi alkatrész'}]};
 const imported={
   groups:[
     {name:'Oldal',dimensions:[900,500,18],indices:[0],isRectangular:true},
     {name:'Íves tetődísz',dimensions:[200,100,50],indices:[1],isRectangular:false}
   ],
   parts:[
     {id:'a',name:'Oldal',originMm:[0,0,0],axisBoundsMm:[900,500,18]},
     {id:'b',name:'Íves tetődísz',originMm:[350,200,910],axisBoundsMm:[200,100,50]}
   ]
 };
 apply(f,imported);
 assert.equal(f.parts.length,2);
 assert.ok(f.parts.some(p=>p.name==='Oldal'));
 assert.ok(!f.parts.some(p=>p.name==='Íves tetődísz'));
 assert.ok(f.parts.some(p=>p.name==='Kézi alkatrész'));
 assert.equal(f.ht,960);
 assert.equal(f.w,900);assert.equal(f.d,500);
 assert.equal(f.threeMfImport.parts.length,2,'A szabálytalan test marad a 3D modellen');
});
