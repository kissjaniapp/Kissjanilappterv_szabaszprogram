'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
const start=source.indexOf('function calcPartFormula(');
const end=source.indexOf('  function getParts(){',start);
assert.ok(start>=0&&end>start,'Az alkatrész-hivatkozások kódja elérhető');
const get=vm.runInNewContext('(function(){'+source.slice(start,end)+
  ';return calcPartFormula;})()',{
  calc:(text,vars)=>{const expr=String(text).replace(/,/g,'.').replace(/\b([WHDTSO])\b/g,(_,key)=>String(vars[key]));return Function('return '+expr)();},
  materialForPart:()=>({thickness:18})
});
const f={parts:[
 {id:'a',name:'Pótfenék',a:'900',b:'464'},
 {id:'b',name:'Polc',a:'Pótfenékx-2*T',b:'PÓTFENÉKy+10'},
 {id:'c',name:'Másik elem',a:'W-20',b:'D'}
]};
const vars={W:1000,H:910,D:600,T:18,S:0,O:0};
test('Pótfenékx és Pótfenéky a megfelelő X/Y méretet veszi át',()=>{
 assert.equal(get('Pótfenékx',vars,f,{id:'u'},'x'),900);
 assert.equal(get('Pótfenéky',vars,f,{id:'u'},'y'),464);
 assert.equal(get('Polcx',vars,f,{id:'u'},'x'),864);
 assert.equal(get('Polcy',vars,f,{id:'u'},'y'),474);
});
test('kis- és nagybetűk, magyar ékezetes név és régi idézőjeles mód',()=>{
 for(const ref of ['pótfenékX','PÓTFENÉKx','PótFeNéKy']){
  assert.equal(get(ref,vars,f,{id:'u'},'x'),ref.toLowerCase().endsWith('x')?900:464);
 }
 assert.equal(get('"Pótfenék"x',vars,f,{id:'u'},'x'),900);
 assert.equal(get('"másik elem"y',vars,f,{id:'u'},'y'),600);
});
test('a képletben lévő egyszerű W/H/D változók megmaradnak, paraméterek nem lesznek alkatrészek',()=>{
 assert.equal(get('W-2*T+PÓTFENÉKx',vars,f,{id:'u'},'x'),1864);
 assert.equal(get('D',vars,f,{id:'u'},'y'),600);
 const f2={parts:[...f.parts,{id:'p',name:'Polc',a:'20',b:'30'}]};
 assert.throws(()=>get('POLCx',vars,f2,{id:'u'},'x'),/Nem egyértelmű/);
});
test('egymásra hivatkozás körkörös képletnél hibát eredményez',()=>{
 const cycle={parts:[{id:'A',name:'Alj',a:'Tetőx',b:'100'},{id:'B',name:'Tető',a:'Aljx',b:'100'}]};
 assert.throws(()=>get('Aljx',vars,cycle,{id:'C'},'x'),/Körkörös/);
});
