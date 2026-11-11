'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','app','index.htm'),'utf8');
const match=source.match(/const GATTERKA_CABINET_INLINE_HTML=("(?:\\.|[^"\\])*");/s);
assert.ok(match,'A valóban beágyazott bútortervező hiányzik');
const html=JSON.parse(match[1]);
const scripts=html.split('<script>').slice(1).map(s=>s.split('</script>')[0]);
test('Vizuális szerkesztő: mindkét beágyazott JS szintaktikailag érvényes',()=>{
 assert.equal(scripts.length,2);
 for(const code of scripts)assert.doesNotThrow(()=>new vm.Script(code));
});
test('Nagy elölnézet: a zoom és a kétirányú görgetősáv aktív',()=>{
 assert.match(html,/class="visual-scroll" id="visualScroll"/);
 assert.match(html,/overflow:auto/);
 assert.match(html,/id="visualZoomIn"/);
 assert.match(html,/id="visualZoomOut"/);
 assert.match(html,/visualZoom=clamp\(visualZoom\+d,50,250\)/);
 assert.match(html,/svg\.style\.width=Math\.round/);
});
test('A rajzon közvetlenül kattintható szabad F és V/polc hézagok és pontos mm bevitel',()=>{
 assert.match(html,/data-vis-gap="f"/);
 assert.match(html,/data-vis-gap="h"/);
 assert.match(html,/visualApplyExact\(visualExact\.axis,visualExact\.index,v\)/);
 assert.match(html,/visualExactInput/);
 assert.match(html,/if\(gaps\.some\(v=>v<-0\.0001\)\)return false/);
});
test('Sor / egyedi mód, halvány kivett részek, kézzel módosítható lapvégek',()=>{
 assert.match(html,/name="visualMode" value="row"/);
 assert.match(html,/name="visualMode" value="piece"/);
 assert.match(html,/class="visual-ghost"/);
 assert.match(html,/visualToggleSection/);
 assert.match(html,/data-vis-end/);
 assert.match(html,/data-vis-edit="start"/);
 assert.match(html,/data-vis-edit="end"/);
 assert.match(html,/data-vis-edit="shift"/);
});
test('Vizuális adatok mentése és visszaállítása a bútorral',()=>{
 assert.match(html,/GatterkaCabinetModel\.snapshotVisual=\(\)=>visualSnapshot\(\)/);
 assert.match(html,/GatterkaCabinetModel\.restoreVisual=data=>visualRestore\(data\)/);
 assert.match(html,/visual:typeof window\.GatterkaCabinetModel\.snapshotVisual/);
 assert.match(html,/restoreVisual\?\.\(cfg\.visual\|\|null\)/);
});
test('A be nem hitelesített egyedi szakasz CNC-biztonsági figyelmeztetést kap',()=>{
 assert.match(html,/Rajzon kivett osztószakasz/);
 assert.match(html,/CNC-csatlakozását ellenőrizni kell/);
 assert.match(html,/records\[0\]\.ready=false/);
});
test('A régi fix polc helyett V-osztó, az állítható polc polctartó csapokon ül',()=>{
 assert.match(html,/Állítható polcok/);
 assert.match(html,/fixen befúrt vízszintes elem V-osztó/);
 assert.match(html,/polctartó csapokon/);
});
