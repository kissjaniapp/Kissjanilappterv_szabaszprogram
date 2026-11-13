const {test}=require('node:test'),assert=require('node:assert/strict');
const auto=require('../machine/cnc-auto.cjs');
const entry=issues=>({key:'side-left',name:'Oldal',dx:1000,dy:400,dz:18,issues,
 operations:[{macro:'LAPA',X:300,Y:0,y:400,face:'primary'}]});
test('Kivett szakasz és általános ellenőrzési megjegyzés nem tiltja a meglévő oldalfuratot',()=>{
 const e=entry(['V-osztó 1 · 2. rész: kivett darab, CNC-csatlakozás ellenőrizendő.',
 'F-osztó 1: önálló F/V rekeszszakaszok, CNC-kötések ellenőrzendők.',
 'Szerkezeti kapcsolat CNC-furatai ellenőrzendők.']);
 assert.match(auto.compileEntry(e,{assemblyJoint:'excenter'}),/LAPA X=300/);
 const result=auto.makeAutoPrograms({name:'Teszt',parts:[{id:'a',name:'Oldal',a:1000,b:400,q:1,cncInstances:[e]}]},['a']);
 assert.equal(result.files.length,1);assert.equal(result.warnings.length,3);
});
test('Valódi geometriai hiba és hiányzó LAB továbbra sem tűnik el',()=>{
 assert.throws(()=>auto.compileEntry(entry(['A lap kilóg a bútorból']),{}),/kilóg/);
 assert.throws(()=>auto.compileEntry(entry(['A 4 bútorláb LAB-furata még nincs megvalósítva']),{}),/LAB/);
 const e=entry([]);e.operations[0].X=1200;
 assert.throws(()=>auto.compileEntry(e,{assemblyJoint:'excenter'}),/kilóg/);
});
