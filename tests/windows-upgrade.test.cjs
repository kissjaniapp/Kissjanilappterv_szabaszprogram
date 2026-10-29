'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const path=require('node:path');
const go=readFileSync(path.join(__dirname,'..','desktop-go','installer','main.go'),'utf8');

test('a telepítő felismeri a korábbi Laptervet és frissítési párbeszédet mutat',()=>{
 assert.match(go,/func previousInstalled\(root string\)/);
 assert.match(go,/func installedVersion\(\)/);
 assert.match(go,/if updating\s*\{/);
 assert.match(go,/const version = "1\.0\.6"/);
});
test('a fájlfrissítés staged, mentett és visszaállítható',()=>{
 assert.match(go,/stage:=root\+"\.__frissites"/);
 assert.match(go,/backup:=root\+"\.__regi"/);
 assert.match(go,/retryRename\(root,backup\)/);
 assert.match(go,/retryRename\(stage,root\)/);
 assert.match(go,/retryRename\(backup,root\)/);
 assert.match(go,/os\.RemoveAll\(backup\)/);
});
test('a telepítő a dedikált Lapterv böngészőprofilt ismeri fel, nem törli',()=>{
 assert.match(go,/func stopLapterv\(root,local string\)/);
 assert.match(go,/"Lapterv","BongeszoProfil"/);
 assert.match(go,/Get-CimInstance Win32_Process/);
 assert.doesNotMatch(go,/RemoveAll\(profile\)/);
 assert.doesNotMatch(go,/Remove-Item.*BongeszoProfil/);
 assert.match(go,/A MENTETT BUTOROK ES A HELYI PROJEKTEK MEGMARADNAK/);
});
