'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const html=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
const start=html.indexOf('function threeMfProjectPoint(');
const end=html.indexOf('  const threeMfViewStates=new Map();',start);
assert.ok(start>0&&end>start,'3MF kameravetítési és lapcsoportosító függvények');
const api=vm.runInNewContext('(()=>{'+html.slice(start,end)+
  'return {threeMfProjectPoint,threeMfNearSideIndex,threeMfPlanarFaces};})()',{
    Math,Map,Array,Number
  });

test('3MF elöl- és 3D nézet a negatív Z-n lévő feneket a munkalap alá rajzolja',()=>{
  for(const view of ['front','side','three']){
    const top=api.threeMfProjectPoint([0,0,0],view);
    const bottom=api.threeMfProjectPoint([0,0,-754],view);
    assert.ok(bottom[1]>top[1],view+' fejtetőre állítaná a bútort');
  }
});
test('3MF elölnézetben a kisebb Y koordinátájú első felület takar',()=>{
  const front=api.threeMfProjectPoint([10,0,-100],'front');
  const rear=api.threeMfProjectPoint([10,500,-100],'front');
  assert.ok(front[2]>rear[2]);
});
test('az oldalnézet elrejti a felénk eső külső oldallapot',()=>{
  const parts=[
    {originMm:[0,49,-754],axisBoundsMm:[18,520,754],dimensions:[754,520,18]},
    {originMm:[982,49,-754],axisBoundsMm:[18,520,754],dimensions:[754,520,18]},
    {originMm:[18,49,-400],axisBoundsMm:[964,464,18],dimensions:[964,464,18]}
  ];
  assert.equal(api.threeMfNearSideIndex(parts),0);
});
test('egy négyszög két coplanar háromszögének belső átlója nem kontúrvonal',()=>{
  const triangles=[
    [0,0,0,10,0,0,10,10,0],
    [0,0,0,10,10,0,0,10,0]
  ];
  const groups=api.threeMfPlanarFaces(triangles,p=>api.threeMfProjectPoint(p,'three'));
  assert.equal(groups.length,1);
  const edges=Array.from(groups[0].edges.values());
  assert.equal(edges.filter(x=>x.count===1).length,4);
  assert.equal(edges.filter(x=>x.count===2).length,1);
});
