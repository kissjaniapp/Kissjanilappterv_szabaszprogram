'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const html=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
test('a négy ABS mező két függőleges X és Y oszlopban jelenik meg',()=>{
  assert.match(html,/\.edge-thickness-four\{[^}]*grid-template-columns:repeat\(2,[^}]*grid-template-rows:repeat\(2,auto\)[^}]*grid-auto-flow:column/);
  assert.ok(html.indexOf("const allPartSides=['x1','x2','y1','y2']")>=0);
});
test('az alkatrészlista nem hoz létre belső függőleges görgetősávot',()=>{
  assert.match(html,/\.parts-table-scroll\{max-height:none;overflow:visible;/);
  assert.match(html,/\.parts-table-scroll thead th\{position:sticky;top:0;/);
});
test('3D forgatáskor a nézet rögzített modellmérethez illeszkedik és a nagyítás csak görgővel változik',()=>{
  const start=html.indexOf('function mountThreeMfViews(){');
  const end=html.indexOf('function threeMfCombinedCuttingGroups(',start);
  assert.ok(start>=0&&end>start);
  const renderer=html.slice(start,end);
  assert.match(renderer,/diameter=Math\.max\(1,Math\.hypot\(\.\.\.span\)\)/);
  assert.match(renderer,/scale=Math\.min\(W-48,H-48\)\/diameter\*state3d\.zoom/);
  const mouseStart=renderer.indexOf("orbit.addEventListener('pointermove'");
  const wheelStart=renderer.indexOf("orbit.addEventListener('wheel'");
  assert.ok(mouseStart>=0&&wheelStart>mouseStart);
  assert.doesNotMatch(renderer.slice(mouseStart,wheelStart),/state3d\.zoom\s*=/);
  assert.match(renderer.slice(wheelStart),/state3d\.zoom=Math\.max/);
});
