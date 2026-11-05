'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const html=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
const geometryStart=html.indexOf('function threeMfProjectPoint(');
const geometryEnd=html.indexOf('  function threeMfApplyImport(',geometryStart);
assert.ok(geometryStart>0&&geometryEnd>geometryStart);

test('3MF 3D rajzolóban a közeli szilárd lap eltakarja a távoli lapot (Z-buffer)',()=>{
  let rendered;
  const canvas={
    width:680,height:350,dataset:{'3mfView':'front'},
    getContext(){
      return {
        createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),
        putImageData:image=>{rendered=image.data;}
      };
    }
  };
  // Two overlapping opaque panels; reverse painter order intentionally.
  const square=y=>[
    [0,y,0,100,y,0,100,y,-100],
    [0,y,0,100,y,-100,0,y,-100]
  ];
  const furniture={
    id:'3mf-z-buffer-test',
    threeMfImport:{
      parts:[
        {previewTriangles:square(0),originMm:[0,0,-100],axisBoundsMm:[100,1,100]},
        {previewTriangles:square(100),originMm:[0,100,-100],axisBoundsMm:[100,1,100]}
      ],
      groups:[{indices:[0]},{indices:[1]}]
    }
  };
  const doc={
    querySelectorAll:()=>[canvas],
    querySelector:()=>null
  };
  const body=html.slice(geometryStart,geometryEnd);
  vm.runInNewContext(body+';mountThreeMfViews();',{
    document:doc,getFurniture:()=>furniture
  });
  assert.ok(rendered,'A canvas rajza elkészült');
  const pos=(175*680+340)*4;
  const pixel=Array.from(rendered.slice(pos,pos+4));
  assert.equal(pixel[3],255,'A megjelenítés teljesen fedő legyen');
  assert.ok(pixel[1]>pixel[0],'A közeli zöld panel takarjon, ne a hátsó sárga panel');
  assert.ok(pixel[0]<150,'A közeli zöld panel RGB értéke legyen megőrizve');
});

test('X/Y szálirány megfordítás az élzárást és reszelést is helyesen cseréli',()=>{
  const start=html.indexOf('function swapPartGrainAxes(');
  const end=html.indexOf('  function codeFromSides(',start);
  assert.ok(start>0&&end>start);
  const swap=vm.runInNewContext('('+html.slice(start,end).trim()+')',{
    sidesFromCode:code=>{
      const [x,y]=code.split('-').map(Number);
      return {x1:x>0,x2:x===2,y1:y>0,y2:y===2};
    }
  });
  const part={a:'964',b:'464',edge:'1-2',filingSides:{x1:true,x2:false,y1:false,y2:true},mill:true,millDepth:1};
  swap(part);
  assert.equal(part.a,'464');
  assert.equal(part.b,'964');
  assert.equal(part.edge,'2-1');
  assert.equal(part.filingSides.x2,true);
  assert.equal(part.filingSides.y1,true);
  assert.equal(part.mill,true);
  assert.equal(part.millDepth,1);
  swap(part);
  assert.equal(part.a,'964');
  assert.equal(part.b,'464');
  assert.equal(part.edge,'1-2');
});
