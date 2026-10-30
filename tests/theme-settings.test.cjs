'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const html=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
function mockSettings(initial=null){
  const storage=new Map(initial?[['gatterka-theme-v1',JSON.stringify(initial)]]:[]);
  const style={};
  const root={dataset:{},style:{setProperty(k,v){style[k]=v;}}};
  const overlay={
    innerHTML:'',classList:{contains(){return false;},add(){},remove(){}},
    querySelector(){return {focus(){}};},querySelectorAll(){return [];}
  };
  const document={
    documentElement:root,
    querySelector(sel){
      if(sel==='#settings-overlay')return overlay;
      if(sel==='meta[name="theme-color"]')return {setAttribute(k,v){style.themeColor=v;}};
      if(sel==='[data-action="open-settings"]')return {focus(){}};
      return null;
    }
  };
  const begin=html.indexOf("const themeKey='gatterka-theme-v1';");
  const end=html.indexOf('\n  applyTheme();',begin);
  assert.ok(begin>=0&&end>begin,'A téma beállításainak kódja nem található');
  const source=html.slice(begin,end+'\n  applyTheme();'.length);
  const load='(function(){\n'+source+
    '\nreturn {get:()=>themeSettings,applyTheme,selectTheme,changeThemeColor,loadTheme,settingsPanel,buttonTextColor};\n})()';
  const result=vm.runInNewContext(load,{
    localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,val)=>storage.set(key,val)},
    document,
    $:selector=>selector==='#settings-overlay'?overlay:null,
    h:x=>String(x),
    console
  });
  return {result,root,style,storage};
}

test('a kezdőképernyő felső részén is elérhető a beállítások fogaskereke',()=>{
  assert.match(html,/data-action="open-settings"/);
  assert.match(html,/id="settings-overlay"/);
  assert.match(html,/data-action="library-home"/);
});
test('a világos és a sötét téma a program egészére vonatkozik',()=>{
  const app=mockSettings();
  assert.equal(app.result.get().mode,'light');
  assert.equal(app.style['--bg'],'#f5f7f4');
  app.result.selectTheme('dark');
  assert.equal(app.root.dataset.gatterkaBase,'dark');
  assert.equal(app.style['--bg'],'#131e19');
  assert.equal(app.style['--ink'],'#e6f0e8');
  assert.ok(app.result.settingsPanel().includes('Sötét téma'));
  app.result.selectTheme('light');
  assert.equal(app.root.dataset.gatterkaBase,'light');
  assert.equal(app.style['--bg'],'#f5f7f4');
});
test('szöveg, gomb és háttér színe külön beállítható és újraindításkor visszatöltődik',()=>{
  const app=mockSettings();
  app.result.selectTheme('dark');
  app.result.changeThemeColor('text','#fafafa');
  app.result.changeThemeColor('button','#114488');
  app.result.changeThemeColor('background','#090e12');
  assert.equal(app.result.get().mode,'custom');
  assert.equal(app.style['--ink'],'#fafafa');
  assert.equal(app.style['--pine'],'#114488');
  assert.equal(app.style['--bg'],'#090e12');
  const stored=JSON.parse(app.storage.get('gatterka-theme-v1'));
  const restarted=mockSettings(stored);
  assert.equal(restarted.root.dataset.gatterkaBase,'dark');
  assert.equal(restarted.result.get().mode,'custom');
  assert.equal(restarted.style['--bg'],'#090e12');
});
test('az érvénytelen, mentett témaszíneket nem használja fel a program',()=>{
  const bad=mockSettings({mode:'custom',base:'dark',colors:{text:'red;body{}',button:'#123456',background:'#bads'}}).result.get();
  assert.equal(bad.colors.text,'#e6f0e8');
  assert.equal(bad.colors.button,'#123456');
  assert.equal(bad.colors.background,'#131e19');
});
