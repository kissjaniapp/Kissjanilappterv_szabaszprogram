'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const workflow=fs.readFileSync(path.join(__dirname,'../.github/workflows/lapterv-windows.yml'),'utf8');
const build=fs.readFileSync(path.join(__dirname,'../desktop-go/Build-Windows.cmd'),'utf8');
const local=fs.readFileSync(path.join(__dirname,'../tools/Sign-Gatterka.ps1'),'utf8');
test('Gatterka 1.0.10 telepítő és hordozható kiadás',()=>{
 assert.ok(build.includes('Gatterka_Telepito_1.0.10_x64.exe'));
 assert.ok(workflow.includes('Gatterka-Windows-Telepito-1.0.10'));
 assert.ok(workflow.includes('Gatterka_Portable_1.0.10.zip'));
});
test('a hiteles kiadói aláírás opcionális és ellenőrzött',()=>{
 assert.ok(workflow.includes("GATTERKA_SIGNING_ENABLED == 'true'"));
 assert.ok(workflow.includes('azure/artifact-signing-action@v2'));
 assert.ok(workflow.includes('secrets.GATTERKA_AZURE_CLIENT_SECRET'));
 assert.ok(workflow.includes('Telepítő újraépítése aláírt belső EXE-kből'));
 assert.ok(workflow.includes('Get-AuthenticodeSignature'));
 assert.ok(workflow.includes('NINCS DIGITALIS ALAIRAS'));
 assert.ok(workflow.includes('ALAIRAS_STATUSZ.txt'));
});
test('a helyi aláíró nem önaláírt tanúsítványt gyárt',()=>{
 assert.ok(local.includes('ValidatePattern'));
 assert.ok(local.includes('Get-ChildItem $store'));
 assert.ok(local.includes('signtool'));
 assert.ok(local.includes('verify /pa /v'));
 assert.ok(local.includes('Gatterka_Telepito_1.0.10_x64.exe'));
 assert.ok(!local.includes('New-SelfSignedCertificate'));
});
