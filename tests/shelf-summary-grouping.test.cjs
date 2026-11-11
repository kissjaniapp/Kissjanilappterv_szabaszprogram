'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','app','index.htm'),'utf8');
const start=source.indexOf('function groupIdenticalShelfSummaryRows(rows){');
const end=source.indexOf('function partsReviewView(){',start);
assert.ok(start>=0&&end>start,'Az alkatrész-összesítő polcösszevonója hiányzik');
const ctx={};
vm.runInNewContext(source.slice(start,end)+'\nthis.group=groupIdenticalShelfSummaryRows;',ctx);
const group=rows=>Array.from(ctx.group(rows));
const sides={x1:true,x2:false,y1:false,y2:false};
function shelf(index,extra={}){
 const key='shelf-'+index,part={
  id:key,cabinetDesignKey:key,name:'Polc '+index,autoCabinetName:'Polc '+index,
  edgeSides:{...sides},
  filingSides:{x1:false,x2:false,y1:false,y2:false},
  millDepthSides:{},shelfTiltDegrees:0,shelfBevelDegrees:0,fixedDrilling:true,
  cncInstances:[{key,name:'Polc '+index,dx:964,dy:450,dz:18,side:'IJ',
    operations:[{macro:'ELF3',Y:0,y:450},{macro:'ELF2',Y:0,y:450}],issues:[]}]
 };
 const row={
  furniture:{id:'cabinet-1'},
  part,originalA:964,originalB:450,a:963,b:450,thickness:18,
  materialId:'material-1',materialColor:'Fehér',edge:'1-0',
  edgeThicknesses:{x1:2,x2:0,y1:0,y2:0},
  mill:true,millDepth:1,grainRequired:true,rot:false,
  qty:1,resolvedName:part.name
 };
 if(extra.part)Object.assign(part,extra.part);
 const {part:ignored,...other}=extra;
 Object.assign(row,other);
 if(!Object.prototype.hasOwnProperty.call(other,'resolvedName'))row.resolvedName=part.name;
 return row;
}
test('Három azonos polc egy összesítő-sor, de három fizikai darab és ép forrásrekord',()=>{
 const input=[shelf(1),shelf(2),shelf(3)];
 const output=group(input);
 assert.equal(output.length,1);
 assert.equal(output[0].qty,3);
 assert.equal(output[0].resolvedName,'Polc');
 assert.equal(output[0].sourceParts.length,3);
 assert.equal(input.length,3);
 assert.equal(input[0].qty,1,'A védett gépi alkatrész- és darabszám adatok maradnak');
});
test('Eltérő élzárás, anyag, CNC-művelet, dőlés és kézi név nem vonható össze',()=>{
 const first=shelf(1);
 const altered=[
  shelf(2,{materialColor:'Sonoma'}),
  shelf(3,{edgeThicknesses:{x1:0.4,x2:0,y1:0,y2:0}}),
  shelf(4,{part:{shelfTiltDegrees:10}}),
  shelf(5,{part:{name:'Egyedi polc'}}),
  shelf(6,{part:{cncInstances:[{key:'shelf-6',name:'Polc 6',
    dx:964,dy:450,dz:18,side:'IJ',operations:[{macro:'ELF3',Y:15,y:420}],issues:[]}]}}),
  shelf(7,{part:{filingSides:{x1:true,x2:false,y1:false,y2:false}}}),
  shelf(8,{furniture:{id:'cabinet-2'}})
 ];
 const output=group([first,...altered]);
 assert.equal(output.length,8);
});
test('Kézzel szerkesztett azonos nevű és megmunkálású polcok is csoportosíthatók',()=>{
 const a=shelf(1,{part:{name:'Fix polc'}}),b=shelf(2,{part:{name:'Fix polc'}});
 const output=group([a,b]);
 assert.equal(output.length,1);assert.equal(output[0].qty,2);
 assert.equal(output[0].resolvedName,'Fix polc');
});
test('Az összesítő és a műhely példány PNG ugyanazt az összevonást használja',()=>{
 assert.match(source,/groupIdenticalShelfSummaryRows\(included\):included/);
 assert.match(source,/groupIdenticalShelfSummaryRows\(originalRows\):originalRows/);
 assert.match(source,/r\.displayName\|\|r\.resolvedName\|\|r\.part\.name/);
 assert.match(source,/Egyedi módosítás: Alkatrészek oldal/);
});
