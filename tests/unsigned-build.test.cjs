'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const workflow=fs.readFileSync(path.join(__dirname,'../.github/workflows/lapterv-windows.yml'),'utf8');
const build=fs.readFileSync(path.join(__dirname,'../desktop-go/Build-Windows.cmd'),'utf8');
const launcher=fs.readFileSync(path.join(__dirname,'../desktop-go/launcher/main.go'),'utf8');
const installer=fs.readFileSync(path.join(__dirname,'../desktop-go/installer/main.go'),'utf8');
test('Gatterka 1.0.13 tanúsítvány és GitHub-titkok nélkül épül',()=>{
 for(const forbidden of ['GATTERKA_SIGNING_ENABLED','artifact-signing-action','Get-AuthenticodeSignature','GATTERKA_AZURE_','ALAIRAS_STATUSZ']){
  assert.ok(!workflow.includes(forbidden),'Váratlan aláírási függőség: '+forbidden);
 }
 for(const required of ['run: call desktop-go','Gatterka-Windows-Telepito-1.0.13','Gatterka_Telepito_1.0.13_x64.exe','Gatterka_Portable_1.0.13.zip','SHA256.txt']){
  assert.ok(workflow.includes(required),'Hiányzik: '+required);
 }
});
test('program, telepítő és build fájlverziója következetes',()=>{
 assert.ok(build.includes('Gatterka_Telepito_1.0.13_x64.exe'));
 assert.ok(launcher.includes('var version = "1.0.13"'));
 assert.ok(installer.includes('const version = "1.0.13"'));
});
