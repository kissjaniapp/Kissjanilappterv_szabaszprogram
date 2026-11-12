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
 assert.match(top.content,/LAPF X=25 Y=43 A=0 x=300 G=1/);
 const side=out.files.find(x=>x.filename.includes('Body3'));
 assert.match(side.content,/LAPA X=309 Y=0 A=0 y=755 G=1/);
 assert.equal(new Set(out.files.map(x=>x.filename.toLowerCase())).size,6);
});
test('Body3: 3MF ezredmilliméteres kerekítése mellett a makró nem lóghat ki',()=>{
 const f=furniture();
 // Valós 3MF exportnál a kerek szándékolt méret lebegőpontos:
 f.threeMfImport.parts[2].axisBoundsMm=[18,1143.9997,754.9998];
 const out=produce(f);
 assert.equal(out.contacts.length,8,JSON.stringify(out.contacts));
 assert.equal(out.files.length,6,JSON.stringify(out.blocked));
 assert.equal(out.blocked.length,0,JSON.stringify(out.blocked));
 const body3=out.files.find(x=>x.filename.includes('Body3'));
 assert.match(body3.content,/H DX=1144 DY=755 DZ=18 /);
 assert.match(body3.content,/LAPA X=309 Y=0 A=0 y=755 G=1/);
});
test('3MF ütköző vagy 0.3 mm-nél jobban elálló test nem kap hamis kötésfuratot',()=>{
 const f=furniture();
 f.threeMfImport.parts[1].originMm[2]=5;
 const out=produce(f);
 assert.ok(out.contacts.length<8,'Az elcsúsztatott test kontaktusa nem maradhat érvényes.');
 assert.ok(out.blocked.some(x=>/egymásba lóg|illeszkedő/.test(x.reason)),JSON.stringify(out.blocked));
 assert.ok(!out.files.some(x=>x.filename.includes('Body2')),'Ütköző Body2 nem kaphat gépi tesztprogramot.');
});
test('szabászati méret vagy vastagság eltérésnél a 3MF CNC terv menthető, csak figyelmeztet',()=>{
 const f=furniture();
 f.parts[0].a='1491'; // valódi alkatrészméret eltérése; a CNC nem veheti át a 1491-et
 const out=produce(f);
 assert.equal(out.files.length,6,JSON.stringify(out.blocked));
 assert.equal(out.blocked.length,0,JSON.stringify(out.blocked));
 assert.ok(out.warnings.some(x=>x.part==='Body1'&&/eltérés/.test(x.reason)));
 const top=out.files.find(x=>x.filename.includes('Body1'));
 assert.ok(top.content.startsWith('H DX=1490 DY=1450 DZ=36 '),
   'A megmunkálási tesztterv az eredeti, nem módosított 3MF-kontúrt használja');
 const f2=furniture();
 const opts=options(f2);opts.actualThicknesses['body-3']=19;
 const other=auto.makeAutoPrograms(f2,f2.parts.map(p=>p.id),opts);
 assert.equal(other.files.length,6);
 assert.ok(other.warnings.some(x=>x.part==='Body3'&&/vastagsága|anyagadat/.test(x.reason)));
});
test('hibás anyagadatbázisbeli vastagsággal mind a 6 összekapcsolt 3MF alkatrész CNC-terve menthető',()=>{
 const f=furniture(),opts=options(f);
 for(const part of f.parts){
   opts.actualThicknesses[part.id]=25; // a felhasználó projektjében beállított anyag NEM a 3MF vastagsága
   opts.actualDimensions[part.id]={a:1700,b:800}; // a szabászati képlettel elrontott méret sem írhatja át a 3MF-et
 }
 const out=auto.makeAutoPrograms(f,f.parts.map(p=>p.id),opts);
 assert.equal(out.contacts.length,8);
 assert.equal(out.files.length,6,JSON.stringify(out.blocked));
 assert.equal(out.blocked.length,0);
 assert.equal(out.warnings.length,6);
 assert.ok(out.files.every(x=>x.draft===true&&x.filename.startsWith('3MF_TERV_')));
 const header=out.files.find(x=>x.filename.includes('Body6')).content.split('\\r\\n')[0];
 assert.match(header,/H DX=755 DY=550 DZ=36 /);
});
test('forgatott X/Y alkatrészméret nem változtatja a 3MF valódi lapkapcsolatait',()=>{
 const f=furniture(),opts=options(f);
 opts.actualDimensions['body-3']={a:755,b:1144};
 const out=auto.makeAutoPrograms(f,f.parts.map(p=>p.id),opts);
 assert.equal(out.files.length,6);
 assert.equal(out.warnings.length,0,'a szabászati X/Y felcserélés nem a geometria hibája');
});
test('íves 3MF vagy régi, alakellenőrzés nélküli test nem kap tesztprogramot sem',()=>{
 const f=furniture();f.threeMfImport.parts[0].isRectangular=false;
 const out=produce(f);
 assert.ok(out.blocked.some(x=>x.part==='Body1'));
 assert.ok(!out.files.some(x=>x.filename.includes('Body1')));
});
test('a Body1–Body6 fizikai találkozásaiból él- és lapmakró készül, furatadat keresése nélkül',()=>{
 const f=furniture(),out=produce(f);
 assert.equal(out.contacts.length,8);
 assert.equal(out.files.length,6,JSON.stringify(out.blocked));
 const body5=out.files.find(x=>x.filename.includes('Body5'));
 assert.match(body5.content,/ELF4 X=0 A=0 x=755 G=1/,
   'Body5 elülső éle ELF4 legyen, ne mindig ELF5');
 const body3=out.files.find(x=>x.filename.includes('Body3'));
 assert.match(body3.content,/LAPA X=309 Y=0 A=0 y=755 G=1/);
 assert.ok(out.contacts.every(c=>
   c.faceStart&&c.edgeStart&&c.faceLength>0&&c.edgeLength>0));
});
test('a helyi él irányát a 3D találkozás dönti el: ELŐL ELF4, HÁTUL ELF5',()=>{
 const shape=[
  {name:'Sík',lo:[0,0,0],size:[600,400,18]},
  {name:'Elöl',lo:[50,0,18],size:[18,400,380]},
  {name:'Hátul',lo:[200,0,-380],size:[18,400,380]}
 ];
 const f=furniture(shape),out=produce(f);
 assert.equal(out.contacts.length,2,JSON.stringify(out.contacts));
 assert.equal(out.blocked.length,0,JSON.stringify(out.blocked));
 assert.equal(out.files.length,3);
 const front=out.files.find(x=>x.filename.includes('Elol'));
 const back=out.files.find(x=>x.filename.includes('Hatul'));
 assert.match(front.content,/ELF4 X=0 A=0 x=400 G=1/);
 assert.match(back.content,/ELF5 X=0 A=0 x=400 G=1/);
 const face=out.files.find(x=>x.filename.includes('Sik'));
 assert.match(face.content,/LAPA X=59 Y=0 A=0 y=400 G=1/);
 assert.match(face.content,/LAPA X=209 Y=0 A=0 y=400 G=1/);
 assert.match(face.content,/XMSG Q=1 N="FORDIT"/);
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
 assert.match(app,/data\.warnings\?\.length/);
 assert.match(app,/NEM GENERÁLHATO CNC-PROGRAMOK/);
});
