'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const engine=require('../machine/scn-obj.cjs');
function cuboid(name,lo,size){
 const [x,y,z]=lo,[w,d,h]=size;
 const pts=[[0,0,0],[w,0,0],[w,d,0],[0,d,0],[0,0,h],[w,0,h],[w,d,h],[0,d,h]]
 .map(([a,b,c])=>'v '+(x+a)+' '+(y+b)+' '+(z+c)).join('\n');
 const faces=[[1,4,3,2],[5,6,7,8],[1,2,6,5],
              [4,8,7,3],[1,5,8,4],[2,3,7,6]]
 .flatMap(([a,b,c,d])=>['f '+a+' '+b+' '+c,'f '+a+' '+c+' '+d]).join('\n');
 return 'o '+name+'\n'+pts+'\n'+faces+'\n';
}
test('SCN SDK2 OBJ valódi téglatestből külön bútort, alkatrészt és rajzot készít',()=>{
 const obj=cuboid('Bútor 1/Oldal',[0,0,0],[600,400,18]);
 const manifest={sceneName:'Konténer',objects:[{name:'Bútor 1/Oldal',
   isPart:true,widthMm:600,depthMm:400,heightMm:18}]};
 const r=engine.parseObj(obj,manifest);
 assert.equal(r.source,'scn');
 assert.equal(r.parts.length,1);
 assert.equal(r.groups[0].scnCabinet,'Bútor 1');
 assert.equal(r.groups[0].scnPartVerified,true);
 assert.equal(r.parts[0].isRectangular,true);
 assert.equal(r.parts[0].previewTriangles.length,12);
 assert.deepEqual(r.parts[0].axisBoundsMm,[600,400,18]);
 assert.deepEqual(r.scnCabinets,['Bútor 1']);
});
test('dekorációt, metaadat nélküli és hiányos OBJ csoportokat nem nyilvánít automatikusan gyártandó lapnak',()=>{
 const d=cuboid('Kávéfőző',[0,0,0],[200,160,180]);
 const a=engine.parseObj(d,{objects:[{name:'Kávéfőző',isPart:false,widthMm:200,depthMm:160,heightMm:180}]});
 assert.equal(a.parts.length,1,'a dekoráció látható marad a 3D-ben');
 assert.equal(a.groups[0].isRectangular,false);
 assert.equal(a.groups[0].scnPartVerified,false);
 const b=engine.parseObj(cuboid('Bútor 2/Polc',[0,0,0],[500,380,18]),null);
 assert.equal(b.groups[0].isRectangular,true);
 assert.equal(b.groups[0].scnPartVerified,false);
 assert.equal(b.groups[0].scnNeedsReview,true);
});
test('hiányos, csak egy síkból álló OBJ nem kaphat automatikus szabászati/CNC jóváhagyást',()=>{
 const obj='o Bútor 4/Oldal\nv 0 0 0\nv 500 0 0\nv 0 400 0\nf 1 2 3';
 assert.throws(()=>engine.parseObj(obj,null),/Nincs használható OBJ-objektum|érvénytelen/);
 // Ez még a 3D-ben sem értelmezhető térfogat; nem lehet alkatrész.
});
test('SCN OBJ geometria nem képezhető automatikusan hibás aránnyal vagy csúccsal',()=>{
 assert.throws(()=>engine.parseObj('o demo\nv 0 0 0\nf 1 2 3'),/érvénytelen csúcs|nem tartalmaz|Hibás/);
 assert.throws(()=>engine.parseObj(cuboid('Bútor 1/Oldal',[0,0,0],[600,400,18]),null,{mmPerUnit:0}),/érvénytelen/);
});
test('Gatterka SCN import, szekrénybontás és objektumtörlés mindkét listából kapcsolódik',()=>{
 const app=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
 const module=fs.readFileSync(path.join(__dirname,'../machine/scn-obj.cjs'),'utf8').trim();
 assert.ok(app.includes(module),'a böngészős Gatterka SCN-modulja és a tesztelt OBJ-értelmező azonos');
 for(const snippet of [
 'data-mode="scn"','data-action="cabinet-scn-choose"',
 'data-action="scn-toggle-object"','data-action="scn-split-cabinets"',
 'data-scn-cabinet-index','scnImportControls(f)',
 'scnApplyGeometry(f,geometry,file.name)',
 'scnSplitCabinets(getFurniture())',
 'getParts(){','part.scnRemoved||part.scnCutEnabled===false',
 'window.gatterkaBuildAutoCnc',
 'gatterka-scn-obj-file'
 ])assert.ok(app.includes(snippet),'Hiányzó SCN funkció: '+snippet);
});
