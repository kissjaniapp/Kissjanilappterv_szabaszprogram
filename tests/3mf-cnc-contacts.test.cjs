'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const auto=require('../machine/cnc-auto.cjs');
const fs=require('node:fs'),path=require('node:path');
const model=[
 {name:'Body1',lo:[0,-1450,0],size:[1490,1450,36]},
 {name:'Body2',lo:[25,-1424.999936,-755],size:[300,36,755]},
 {name:'Body3',lo:[27,-1388.999936,-755],size:[18,1144,755]},
 {name:'Body4',lo:[245,-45,-755],size:[1169,18,755]},
 {name:'Body5',lo:[45,-1088.999936,-755],size:[280,18,755]},
 {name:'Body6',lo:[1414,-575,-755],size:[36,550,755]}
];
function furniture(bodies=model){
 const parts=bodies.map((shape,i)=>{
  const dims=[...shape.size].sort((a,b)=>b-a);
  return {id:'body-'+(i+1),name:shape.name,cabinetDesignKey:'3mf-'+(i+1),
    threeMfGenerated:true,threeMfThickness:dims[2],
    a:String(dims[0]),b:String(dims[1]),q:'1'};
 });
 const original=bodies.map((shape,i)=>{
  const dims=[...shape.size].sort((a,b)=>b-a);
  return {id:String(i+1),name:shape.name,originMm:[...shape.lo],
    axisBoundsMm:[...shape.size],dimensions:dims,isRectangular:true,isAngledCut:false};
 });
 return {name:'1db asztal',parts,threeMfImport:{
   parts:original,groups:original.map((b,i)=>({name:b.name,dimensions:b.dimensions,
     indices:[i],isRectangular:true,isAngledCut:false}))
 }};
}
function options(f){
 return {assemblyJoint:'excenter',actualThicknesses:Object.fromEntries(f.parts.map(p=>[p.id,p.threeMfThickness])),
   actualDimensions:Object.fromEntries(f.parts.map(p=>[p.id,{a:Number(p.a),b:Number(p.b)}]))};
}
function produce(f){
 return auto.makeAutoPrograms(f,f.parts.map(p=>p.id),options(f));
}
test('a csatolt 1db asztal 3MF hat téglatestje pontosan nyolc valódi lapél kapcsolattal rendelkezik',()=>{
 const f=furniture(),plan=auto.threeMfContactDrafts(f,f.parts.map(p=>p.id),options(f));
 assert.equal(plan.contacts.length,8,JSON.stringify(plan.contacts));
 assert.equal(plan.errors.size,0,JSON.stringify([...plan.errors]));
 assert.equal(plan.byPart.size,6);
 const pairs=plan.contacts.map(c=>[c.faceName,c.edgeName].sort().join('-')).sort();
 assert.deepEqual(pairs,[
  'Body1-Body2','Body1-Body3','Body1-Body4','Body1-Body5','Body1-Body6',
  'Body2-Body3','Body3-Body5','Body4-Body6'
 ]);
});
test('a hat alkatrész 3MF CNC TERV .xxl-t kap az excenter G=1 beállításával',()=>{
 const f=furniture(),out=produce(f);
 assert.equal(out.contacts.length,8);
 assert.equal(out.blocked.length,0,JSON.stringify(out.blocked));
 assert.equal(out.files.length,6,'mindegyik Body szerkezeti CNC-tervet kap');
 assert.ok(out.files.every(x=>x.draft===true&&x.filename.startsWith('3MF_TERV_')&&x.filename.endsWith('.xxl')));
 assert.ok(out.files.every(x=>x.content.startsWith('H DX=')&&x.content.includes(';3MF_ERINTKEZES_ALAPU_TERV_NEM_HITELESITETT')));
 assert.ok(out.files.every(x=>/ G=1/.test(x.content)));
 const top=out.files.find(x=>x.filename.includes('Body1'));
 assert.match(top.content,/LAPA X=36 Y=61 A=0 y=1144 G=1/);
 assert.match(top.content,/LAPF X=25 Y=43 A=0 x=300 y=0 G=1/);
 const side=out.files.find(x=>x.filename.includes('Body3'));
 assert.match(side.content,/LAPA X=309 Y=0 A=0 y=755 G=1/);
 assert.equal(new Set(out.files.map(x=>x.filename.toLowerCase())).size,6);
});
test('3MF ütköző vagy 0.3 mm-nél jobban elálló test nem kap hamis kötésfuratot',()=>{
 const f=furniture();
 f.threeMfImport.parts[1].originMm[2]=5;
 const out=produce(f);
 assert.equal(out.contacts.length,7);
 assert.ok(out.files.every(x=>!x.commands.includes('ELF2 Y=0 A=0 y=300')));
});
test('kézzel megváltoztatott méret és anyagvastagság esetén nem exportál régi CNC koordinátát',()=>{
 const f=furniture();
 f.parts[0].a='1491';
 const out=produce(f);
 assert.ok(out.blocked.some(x=>x.part==='Body1'&&/eltér/.test(x.reason)));
 assert.ok(!out.files.some(x=>x.filename.includes('Body1')));
 const f2=furniture();
 const opts=options(f2);opts.actualThicknesses['body-3']=19;
 const other=auto.makeAutoPrograms(f2,f2.parts.map(p=>p.id),opts);
 assert.ok(other.blocked.some(x=>x.part==='Body3'&&/vastagsága/.test(x.reason)));
});
test('íves 3MF vagy régi, alakellenőrzés nélküli test nem kap tesztprogramot sem',()=>{
 const f=furniture();f.threeMfImport.parts[0].isRectangular=false;
 const out=produce(f);
 assert.ok(out.blocked.some(x=>x.part==='Body1'));
 assert.ok(!out.files.some(x=>x.filename.includes('Body1')));
});
test('a szerkezeti 3MF CNC terv nem módosítja a szabászati vágási algoritmust',()=>{
 const app=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
 const program=fs.readFileSync(path.join(__dirname,'../machine/cnc-auto.cjs'),'utf8').trim();
 const start=app.indexOf('* CNC Xilog XXL automata terv');
 const open=app.lastIndexOf('<script>',start),end=app.indexOf('</script>',start);
 assert.equal(app.slice(open+8,end).trim(),program,'az inline és külön modul legyen azonos');
 assert.match(app,/data-action="save-cnc-xxl-as"/);
 assert.match(app,/3MF TESZTTERV/);
 assert.match(app,/actualDimensions:Object\.fromEntries/);
});
