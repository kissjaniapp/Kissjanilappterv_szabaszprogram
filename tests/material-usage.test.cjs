'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
const begin=html.indexOf('function suggestedBoardSize(');
const end=html.indexOf('\n  function nestingView()',begin);
assert.ok(begin>0&&end>begin,'Hiányzik az anyagszükséglet-számítás');
const state={trim:10,kerf:5};
const calculate=vm.runInNewContext('('+html.slice(begin,end).trim()+')',{state,Number,Math});

test('a gépi kisebb táblajavaslat a felhasznált anyagot adja, nem a maradékot',()=>{
  const bin={a:2800,b:2070,thickness:18,trim:10,used:500000,
    placements:[{x:0,y:0,realW:500,realH:1000}],
    machine:{feed:'y',feedUsed:620,strips:[{usedLength:1100}]}};
  const v=calculate(bin);
  assert.ok(v);
  assert.equal(v.a,650);
  assert.equal(v.b,1130);
  assert.equal(v.neededArea,650*1130);
  assert.equal(v.netPartArea,500000);
  assert.ok(Math.abs(v.neededShare-(650*1130)/(2800*2070))<1e-10);
  assert.notEqual(v.neededArea,bin.a*bin.b-v.neededArea,'Maradék területet adott vissza.');
});
test('a szabad nesting becslése is az alkatrészek befoglaló méretéből indul',()=>{
  const bin={a:2800,b:2070,trim:10,used:400000,
    placements:[{x:50,y:70,realW:200,realH:600},
      {x:260,y:70,realW:400,realH:400}]};
  const v=calculate(bin);
  assert.equal(v.a,640); // (660 - 50) + 2*10 + 5 -> 635 mm, felfelé 640
  assert.equal(v.b,630); // (670 - 70) + 2*10 + 5 -> 625 mm, felfelé 630
  assert.equal(v.neededArea,640*630);
  assert.equal(v.netPartArea,400000);
});
test('az összesítő nem a hulladékterületet helyezi anyagigényként előtérbe',()=>{
  assert.match(html,/Alkatrészek anyagigénye/);
  assert.match(html,/result\.usedArea\/1e6/);
  assert.match(html,/Javasolt anyagszükséglet:/);
  assert.match(html,/smaller\.neededArea\/1e6/);
  assert.match(html,/smaller\.neededShare\*100/);
  assert.doesNotMatch(html,/smaller\.saved\*100/);
  assert.doesNotMatch(html,/Fel nem használt felület<\/div>/);
});
