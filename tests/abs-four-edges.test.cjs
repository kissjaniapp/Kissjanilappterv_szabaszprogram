'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const html=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
const slice=(start,end)=>{
  const a=html.indexOf(start),b=html.indexOf(end,a);
  assert.ok(a>=0&&b>a,start+' megtalálható');
  return html.slice(a,b);
};
const support=vm.runInNewContext('(()=>{'+slice('function sidesFromCode(','  function codeFromSides(')+
  'return {sidesFromCode,partEdgeThicknesses,setPartEdgeCode,swapPartGrainAxes};})()',{
    Number,Object,Array,Math,RegExp,String
  });

test('négy külön ABS-él a szabásméretben külön nettó levonást kap',()=>{
  const part={id:'p1',name:'Polc',a:'1000',b:'500',q:'1',
    edge:'2-2',edgeThickness:2,edgeThicknesses:{x1:2,x2:.4,y1:.4,y2:.4},
    mill:true,millDepth:1,filingSides:{},grainRequired:true};
  const furniture={id:'f',name:'Teszt',parts:[part],qty:1,w:1000,ht:910,d:500,t:18,customParameters:[]};
  const getter=vm.runInNewContext('('+slice('function getParts(){','  function intro(').trim()+')',{
    state:{furnitures:[furniture]},
    materialForPart:()=>({thickness:18,color:'Freya'}),
    effectiveShelves:()=>0,effectiveDivider:()=>0,
    partIfState:()=>({active:true,error:''}),
    calcPartFormula:expr=>Number(expr),resolvedPartName:name=>name,
    partEdgeThicknesses:support.partEdgeThicknesses,
    allPartSides:['x1','x2','y1','y2'],
    pnum:Number,Number,Math,Array,String
  });
  const result=getter();
  assert.equal(result.errors.length,0,JSON.stringify(result.errors));
  assert.equal(result.rows[0].a,999.2,'a rövid Y élekből 0,4 + 0,4 vonódik');
  assert.equal(result.rows[0].b,498.6,'a hosszú X élekből (2 - 1) + 0,4 vonódik');
  assert.equal(result.rows[0].edgeThicknesses.x1,2);
  assert.equal(result.rows[0].edgeThicknesses.y2,.4);
});

test('szálirány megfordításakor a négy külön ABS-vastagság követi a fizikai éleket',()=>{
  const part={a:'1000',b:'500',edge:'2-2',edgeThickness:2,
    edgeThicknesses:{x1:2,x2:.4,y1:.4,y2:2},
    filingSides:{x1:true,x2:false,y1:false,y2:true}};
  support.swapPartGrainAxes(part);
  assert.equal(part.a,'500');
  assert.equal(part.b,'1000');
  assert.equal(part.edgeThicknesses.x1,.4);
  assert.equal(part.edgeThicknesses.x2,2);
  assert.equal(part.edgeThicknesses.y1,2);
  assert.equal(part.edgeThicknesses.y2,.4);
  support.swapPartGrainAxes(part);
  assert.equal(part.a,'1000');
  assert.equal(part.edgeThicknesses.x1,2);
});

test('egyedül az X2 hosszú él is lehet 0,4 mm-es, és forgatás után Y2 marad',()=>{
  const part={a:'1000',b:'500',edge:'1-0',edgeThickness:2,
    edgeSides:{x1:false,x2:true,y1:false,y2:false},
    edgeThicknesses:{x1:0,x2:.4,y1:0,y2:0},filingSides:{}};
  assert.equal(support.partEdgeThicknesses(part).x1,0);
  assert.equal(support.partEdgeThicknesses(part).x2,.4);
  support.swapPartGrainAxes(part);
  assert.equal(part.edge,'0-1');
  assert.equal(part.edgeSides.y1,false);
  assert.equal(part.edgeSides.y2,true);
  assert.equal(support.partEdgeThicknesses(part).y2,.4);
});

test('3MF bal és jobb oldallap egy közös szabászati tétel, de megmarad a két testazonosító',()=>{
  const fn=vm.runInNewContext('('+slice('function threeMfCombinedCuttingGroups(','  function threeMfApplyImport(').trim()+')',{
    String,Array,Math,Object
  });
  const data={groups:[
    {name:'bal-Oldal',indices:[0],dimensions:[754,520,18]},
    {name:'Fenék',indices:[1],dimensions:[964,464,18]},
    {name:'Jobb_oldal',indices:[2],dimensions:[754,520,18]}
  ]};
  const groups=fn(data);
  assert.equal(groups.length,2);
  const merged=groups.find(g=>g.combinedSides);
  assert.ok(merged);
  assert.deepEqual(Array.from(merged.indices),[0,2]);
});
