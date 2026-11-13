'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const core=require('../machine/cnc-xxl.cjs');
const auto=require('../machine/cnc-auto.cjs');
const source=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
const literal=source.match(/const GATTERKA_CABINET_INLINE_HTML=("(?:\\.|[^"\\])*");/s);
assert.ok(literal,'Beágyazott bútortervező hiányzik');
const html=JSON.parse(literal[1]);
const start=html.indexOf('function cncRabbetQ(');
const finish=html.indexOf('function getStructuredParts(p){',start);
assert.ok(start>=0&&finish>start,'XFALC-ot előállító geometria hiányzik');
const body=html.slice(start,finish);
const defaults={w:1000,h:910,d:600,t:18,sideH:910,innerW:964,innerH:874,
  hasTop:true,hasBottom:true,top:'between',bottom:'between',bodyBottomOffset:0,
  hasLegs:false,falseBottom:false,rabbet:true,topHdfCut:'falc',
  bottomHdfCut:'falc',drilling:'fixed'};
function geometry(patch={}){
 const p={...defaults,...patch};
 const ctx={};
 vm.createContext(ctx);
 vm.runInContext(
  'const fixedDividerPieces=()=>[];'+
  'const cncSupportRegions=()=>({segments:[],issues:[]});'+
  'const cncIndividualShelfXbo=()=>({operations:[],issues:[]});'+
  body+'\nthis.build=buildCncInstancesForParts;',ctx);
 const records=[{key:'side-left',sourceKeys:['side-left','side-right']},
  {key:'top'},{key:'bottom'}];
 ctx.build(p,records);
 return JSON.parse(JSON.stringify(records.flatMap(x=>x.cncInstances||[])));
}
const entry=(items,key)=>items.find(x=>x.key===key);
const falc=(items,key)=>entry(items,key)?.operations?.find(x=>x.macro==='XFALC')||null;

test('XFALC Q=1..4 G=2 pontos Xilog makróformátum, más Q/G tiltva',()=>{
 for(const Q of [1,2,3,4]){
  const line=auto.macroLine({macro:'XFALC',Q,G:2});
  assert.equal(line,'XFALC Q='+Q+'# G=2#');
  assert.equal(core.parseXfalc(line),line);
  const output=core.compileXxl({dx:600,dy:400,dz:18,
    commands:'LAPA X=120 Y=0 A=0 y=400 G=1\n'+line});
  assert.match(output,new RegExp('XFALC Q='+Q+'# G=2#'));
 }
 for(const Q of [0,5,-1,1.5])assert.throws(()=>auto.macroLine({macro:'XFALC',Q,G:2}));
 for(const G of [0,1,3])assert.throws(()=>auto.macroLine({macro:'XFALC',Q:1,G}));
 assert.throws(()=>core.parseXfalc('XFALC Q=1# G=1#'));
});

test('Oldallap XFALC kifutás: két zárt vég Q2, csak felső Q3, csak alsó Q4, átmenő Q1',()=>{
 for(const [setup,Q] of [
  [{top:'between',bottom:'between'},2],
  [{top:'between',bottom:'full'},3],
  [{top:'full',bottom:'between'},4],
  [{top:'full',bottom:'full'},1]
 ]){
  const parts=geometry(setup);
  assert.equal(falc(parts,'side-left')?.Q,Q,JSON.stringify(setup));
  assert.equal(falc(parts,'side-right')?.Q,Q,JSON.stringify(setup));
  assert.equal(falc(parts,'side-left')?.G,2);
 }
});

test('Tető/fenék falc: közémenő Q1, végigmenő Q2; trim esetén nincs XFALC',()=>{
 const both=geometry();
 assert.equal(falc(both,'top')?.Q,1);
 assert.equal(falc(both,'bottom')?.Q,1);
 const through=geometry({top:'full',bottom:'full'});
 assert.equal(falc(through,'top')?.Q,2);
 assert.equal(falc(through,'bottom')?.Q,2);
 const trimmed=geometry({topHdfCut:'trim',bottomHdfCut:'trim'});
 assert.equal(falc(trimmed,'top'),null);
 assert.equal(falc(trimmed,'bottom'),null);
 assert.ok(falc(trimmed,'side-left'),'Az oldallap falca továbbra is szükséges');
 const noBack=geometry({rabbet:false});
 for(const x of noBack)assert.equal(x.operations.filter(o=>o.macro==='XFALC').length,0);
});

test('Korábban helyes CNC furatok és felrakási oldalak XFALC-tól nem változnak',()=>{
 const noFalc=geometry({rabbet:false});
 const rabbet=geometry();
 for(const original of noFalc){
  const changed=entry(rabbet,original.key);
  assert.ok(changed,original.key);
  assert.deepEqual(
   changed.operations.filter(o=>o.macro!=='XFALC'),
   original.operations,original.key);
 }
 const output=auto.compileEntry({dx:600,dy:400,dz:18,side:'IJ',issues:[],
   operations:[
    {macro:'LAPA',X:150,Y:0,y:400,face:'primary'},
    {macro:'XFALC',Q:3,G:2,face:'primary'},
    {macro:'ELF3',Y:0,y:400,face:'reverse'}
   ]},{assemblyJoint:'excenter'});
 assert.match(output,/LAPA X=150 Y=0 A=0 y=400 G=1\r\nXFALC Q=3# G=2#\r\n;\r\nVEGE\r\nXMSG Q=1 N="FORDIT"\r\n;\r\nELF3/);
});
