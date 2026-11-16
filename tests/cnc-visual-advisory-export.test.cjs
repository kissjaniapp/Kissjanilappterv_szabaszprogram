'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const auto=require('../machine/cnc-auto.cjs');

function output(issues){
 const entry={key:'v-divider-1',dx:600,dy:400,dz:18,side:'IJ',
  issues,operations:[{macro:'ELF3',Y:0,y:400,face:'primary'}]};
 const part={id:'part1',cabinetDesignKey:'v-divider-1',name:'V-osztó 1',
  a:'600',b:'400',cncInstances:[entry]};
 return auto.makeAutoPrograms({name:'Bútor',parts:[part]},['part1']);
}

test('Korábbi egyedi lapvég/eltolás minősítési jelzés nem tiltja a gépen kipróbált XXL-t',()=>{
 for(const issue of [
  'Polc 1 · 2. rész: az egyedi lapvég/eltolás CNC-csatlakozását ellenőrizni kell.',
  'V-osztó 1: egyedi eltolás/végpont CNC-csatlakozása ellenőrizendő.',
  'F-osztó 2: kézi F/V darabolás, CNC-kötések ellenőrzendők.',
  'Rajzon kivett osztószakasz: a csatlakozó CNC-furatok ellenőrzendők.'
 ]){
  const result=output([issue]);
  assert.deepEqual(result.blocked,[],issue);
  assert.equal(result.files.length,1,issue);
  assert.match(result.files[0].content,/ELF3/);
 }
});
test('Tényleges szerkezeti CNC-hiba továbbra is blokkolja a hibás alkatrészt',()=>{
 const result=output(['Érvénytelen csatlakozási kezdőpont vagy szakaszhossz']);
 assert.equal(result.files.length,0);
 assert.equal(result.blocked.length,1);
});
test('Az eltávolított CNC mezők és régi V/F csatlakozásválasztók nem jelennek meg',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
 const m=source.match(/const GATTERKA_CABINET_INLINE_HTML=("(?:\\.|[^"\\])*");/s);
 assert.ok(m,'A beágyazott bútortervező nem található');
 const html=JSON.parse(m[1]);
 assert.doesNotMatch(html,/CNC: kihagyás/);
 assert.doesNotMatch(html,/<label>Bal csatlakozás<\/label>/);
 assert.doesNotMatch(html,/<label>Jobb csatlakozás<\/label>/);
 assert.doesNotMatch(html,/<label>Alsó csatlakozás<\/label>/);
 assert.doesNotMatch(html,/<label>Felső csatlakozás<\/label>/);
 assert.doesNotMatch(html,/Bal oldallaptól szabad hézag/);
 assert.match(html,/const cncGapBottom=0,cncGapTop=0,cncGapDivider=0/);
 assert.match(html,/function cncSupportRegions\(p,boards,which\)/);
});
