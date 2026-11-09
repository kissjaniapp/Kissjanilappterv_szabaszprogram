'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
const match=source.match(/const GATTERKA_CABINET_INLINE_HTML=("(?:\\.|[^"\\])*");/s);
assert.ok(match,'A beágyazott bútortervező HTML-je elérhető');
const designer=JSON.parse(match[1]);

test('a bútorméretek csak a külső W/H/D mezőkben szerkeszthetők',()=>{
  assert.match(source,/Szélesség \(W\)/);
  assert.match(source,/Magasság \(H\)/);
  assert.match(source,/Mélység \(D\)/);
  assert.match(designer,/id="cabinet-dimensions-from-gatterka"/);
  assert.doesNotMatch(designer,/<h2>▧ &nbsp; Külső méretek<\/h2>/);
  assert.match(source,/syncCabinetDesignerDimensions\(\)/);
  assert.match(designer,/gatterka-designer-dimensions/);
});

test('a polcszám 0 alapértékű legördülő, a polcfurat ugyanabban a panelben van',()=>{
  assert.match(designer,/<select id="count"/);
  assert.match(designer,/<option value="0" selected>/);
  assert.match(designer,/count:0,/);
  assert.match(designer,/class="panel-head shelf-drill-heading"/);
  assert.doesNotMatch(designer,/<h2>⫶ &nbsp; Polcfuratozás/);
  assert.doesNotMatch(source,/section.style.display=visible/);
});

test('az alkatrészek automatikusan a Gatterkához kerülnek, külön gomb nélkül',()=>{
  assert.doesNotMatch(designer,/id="exportParts"/);
  assert.match(designer,/last='';notify\(\)/);
  assert.match(designer,/gatterka-designer-save/);
  assert.match(source,/syncCabinetDesignerParts\(f,event.data.design.parts\)/);
});

test('három natív, egyéni színválasztó és egységes sötét szerkesztő',()=>{
  assert.match(source,/type="color" data-theme-color/);
  assert.match(source,/\['text','button','background'\]/);
  assert.match(designer,/--ui-soft:color-mix/);
  assert.match(source,/theme:\{mode:themeSettings.base/);
});

test('a gépi szabás és mentés továbbra is érintetlenül elérhető',()=>{
  assert.match(source,/function buildProductionSequence\(bins\)/);
  assert.match(source,/function buildOfflineXprgProject\(/);
  assert.match(source,/async function saveXprgToSelectedFolder\(\)/);
});
