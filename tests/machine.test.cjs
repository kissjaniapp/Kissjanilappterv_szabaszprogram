'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createXMix,createXPrg,validateFilename,validateFolder,
  normalizeXprgDirectory,DIRECTORY}=require('../machine/xmix.cjs');

test('a gépen működő xMix XML Header, Materials és RigaMix szerkezetét írjuk',()=>{
  const mix=createXMix({folder:'Konyha_szekreny',date:'30/10/2026',
    materialCode:'U960',materials:['Onixszürke'],
    programs:['2026_10_30_Konyha_tabla_01.xPrg','2026_10_30_Konyha_tabla_02.xPrg']});
  assert.equal(mix,
    '<xMix>\r\n'+
    '\t<Header Descrizione="" Import="" Date="30/10/2026" />\r\n'+
    '\t<Materials>\r\n'+
    '\t\t<Material Tipologia="Onixszürke" Codice="U960" Quantita="999" />\r\n'+
    '\t</Materials>\r\n'+
    '\t<RigheMix>\r\n'+
    '\t\t<RigaMix File=".\\xPrg\\2026_10_30_Konyha_tabla_01.xPrg" Rep="1" Pacco="1" CambioMateriale="0" />\r\n'+
    '\t\t<RigaMix File=".\\xPrg\\2026_10_30_Konyha_tabla_02.xPrg" Rep="1" Pacco="1" CambioMateriale="0" />\r\n'+
    '\t</RigheMix>\r\n</xMix>\r\n');
  assert.equal(DIRECTORY,'.\\xPrg\\');
});
test('az xMix RigaMix sorainak száma az összes táblaprogramot követi',()=>{
  const names=Array.from({length:4},(_,i)=>'tabla_0'+(i+1)+'.xPrg');
  const mix=createXMix({folder:'Konyha',date:'30/10/2026',programs:names});
  assert.equal((mix.match(/<RigaMix File=/g)||[]).length,4);
  assert.equal((mix.match(/Quantita="999"/g)||[]).length,1);
  assert.ok(mix.trimEnd().endsWith('</xMix>'));
});
test('a testreszabott relatív útvonal a ZIP-ben is tükrözhető',()=>{
  const parsed=normalizeXprgDirectory('.\\Nappali\\xPrg\\');
  assert.equal(parsed.directory,'.\\Nappali\\xPrg\\');
  assert.equal(parsed.archiveSubdir,'Nappali/xPrg');
  assert.equal(parsed.relative,true);
  const mix=createXMix({folder:'Konyha',date:'30/10/2026',programs:['tabla.xPrg'],
    xprgDirectory:parsed.directory});
  assert.match(mix,/File="\.\\Nappali\\xPrg\\tabla.xPrg"/);
});
test('abszolút és hálózati hivatkozásnál nem kerül meghajtóútvonal a ZIP-be',()=>{
  for(const dir of ['C:\\WinCut\\Prg\\','X:\\Adatok\\Programok\\','\\\\SAW\\Megosztas\\Prg\\']){
    const parsed=normalizeXprgDirectory(dir);
    assert.equal(parsed.relative,false);
    assert.equal(parsed.archiveSubdir,'xPrg');
    const mix=createXMix({folder:'Konyha',date:'30/10/2026',programs:['tabla.xPrg'],
      xprgDirectory:dir});
    assert.ok(mix.includes('File="'+parsed.directory+'tabla.xPrg"'));
  }
});
test('XML karaktereket biztonságosan escape-el, nem enged tiltott útvonalat',()=>{
  const mix=createXMix({folder:'Konyha',date:'30/10/2026',
    description:'Bútor & dekor',materials:['Fehér & natúr "A"'],
    programs:['tabla.xPrg']});
  assert.match(mix,/Descrizione="Bútor &amp; dekor"/);
  assert.match(mix,/Tipologia="Fehér &amp; natúr &quot;A&quot;"/);
  assert.throws(()=>validateFilename('../rossz.xPrg'));
  assert.throws(()=>validateFilename('C:\\WinCut\\Prg\\b.xPrg'));
  assert.throws(()=>validateFolder('..\\MasikMappa'));
  assert.throws(()=>validateFolder('Konyha/Nappali'));
  assert.throws(()=>createXMix({folder:'Konyha',date:'30/10/2026',
    programs:['b.xPrg'],xprgDirectory:'.\\xPrg\\..\\'}));
  assert.throws(()=>createXMix({folder:'Konyha',date:'2026-10-30',programs:['b.xPrg']}));
});
test('az xPrg gyártási hitelesítés hiánya változatlan',()=>assert.throws(createXPrg,/Nincs hiteles xPrg/));
