'use strict';
const {test}=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'), path=require('node:path'), vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','app','index.htm'),'utf8');
const packed=source.match(/const GATTERKA_CABINET_INLINE_HTML=("(?:\\.|[^"\\])*");/s);
assert.ok(packed,'A 3D-tervező beágyazott forrása hiányzik');
const html=JSON.parse(packed[1]);
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
assert.equal(scripts.length,2,'A két tervező-programrész külön függvényhatókörben fut');
const first=scripts[0],second=scripts[1];
function between(text,a,b){
  const start=text.indexOf(a),end=text.indexOf(b,start);
  assert.ok(start>=0&&end>start,'Nem található programrész: '+a);
  return text.slice(start,end);
}
const getParts=between(first,'function getStructuredParts(p){','\nlet currentParts=[]');
const bridge=first.match(/window\.GatterkaCabinetModel=\{snapshotParts:\(\)=>getStructuredParts\(read\(\)\)\};/)?.[0];
assert.ok(bridge,'A geometriai számítás nincs elérhetővé téve a mentőprogram számára');
const ids=second.match(/const ids=\[[^\n]+\];/)?.[0];
assert.ok(ids);
const snapshot=between(second,'function snapshot(){','\n // Oldalváltáskor');
const methods=between(second,'function put(id,value){','\n let quiet=false');

test('3 majd 4 polcos szekrény méretei és hátfalbeállítása megmarad az átadás és visszalépés után',()=>{
  const fields=new Map(),radioItems=[];
  const field=(id,value,type='text')=>{
    const el={type,value:String(value),checked:Boolean(value),dispatchEvent(){}};
    fields.set(id,el);return el;
  };
  field('w',1000);field('h',910);field('d',600);field('t',18);
  field('count',3);field('hasTop',true,'checkbox');field('hasBottom',true,'checkbox');
  field('falseBottom',false,'checkbox');field('rabbetWidth',4);
  field('topHdfCut','falc');field('bottomHdfCut','falc');
  const radio=(name,value,selected)=>{
    const el={name,value,dispatchEvent(){}};
    Object.defineProperty(el,'checked',{
      get(){return Boolean(this._checked);},
      set(v){if(v){for(const other of radioItems)if(other.name===name)other._checked=false;}this._checked=Boolean(v);}
    });
    radioItems.push(el);el.checked=selected;return el;
  };
  radio('top','between',true);radio('bottom','between',true);
  radio('backType','rabbet',true);radio('backType','full',false);
  radio('drilling','fixed',true);radio('distribution','equal',true);
  const document={
    getElementById:id=>fields.get(id)||null,
    querySelectorAll:selector=>{
      if(selector==='input[type="radio"]:checked')return radioItems.filter(x=>x.checked);
      if(selector==='input[type="radio"]')return radioItems;
      return [];
    },
    querySelector:()=>null
  };
  const window={};
  const ctx={window,document,Event:class Event{},fmt:x=>String(x),
    shelfAngleAt:()=>0,shelfBackAt:()=>4,shelfDepthAt:p=>p.d-4,
    baseShelfBack:p=>p.rabbet?Math.max(p.rabbetWidth||0,p.hdfThickness||4):p.fullBack?p.t+(p.fullBackSetback||0):0};
  const readStub=[
    'function read(){',
    '  const num=id=>Number(document.getElementById(id).value);',
    '  const checked=id=>document.getElementById(id).checked;',
    '  const pick=name=>document.querySelectorAll(\'input[type="radio"]:checked\').find(r=>r.name===name)?.value||"between";',
    '  const w=num("w"),h=num("h"),d=num("d"),t=num("t");',
    '  const backType=pick("backType"),hasTop=checked("hasTop"),hasBottom=checked("hasBottom");',
    '  const top=pick("top"),bottom=pick("bottom");',
    '  const topDed=hasTop?(document.getElementById("topHdfCut").value==="falc"?5.5:2):0;',
    '  const bottomDed=hasBottom?(document.getElementById("bottomHdfCut").value==="falc"?5.5:2):0;',
    '  const sideH=h-(hasTop&&top==="full"?t:0)-(hasBottom&&bottom==="full"?t:0);',
    '  return {w,h,d,t,n:num("count"),hasTop,hasBottom,top,bottom,',
    '    hdfW:w-11,hdfH:sideH-topDed-bottomDed,topHdfDeduction:topDed,bottomHdfDeduction:bottomDed,',
    '    innerW:w-2*t,innerH:h-(hasTop?t:0)-(hasBottom?t:0),',
    '    sideH:h-(hasTop&&top==="full"?t:0)-(hasBottom&&bottom==="full"?t:0),',
    '    falseBottom:checked("falseBottom"),rabbet:backType==="rabbet",fullBack:backType==="full",',
    '    fullBackSetback:0};',
    '}'
  ].join('\n');
  ctx.fixedDividerPieces=p=>Array.from({length:p.n||0},(_,i)=>({kind:'shelf',index:i,key:'shelf-'+(i+1),name:'Polc '+(i+1),a:p.innerW,b:p.d-4,angle:0}));
  ctx.shelfBackAt=()=>4;
  vm.runInNewContext('(function(){'+getParts+readStub+bridge+'})();',ctx);
  // A mentés külön IIFE-ben van. A read() és getStructuredParts() ott nem látható.
  vm.runInNewContext('(function(){'+ids+snapshot+methods+
    'window.GatterkaCabinetBridge={snapshot,restore:apply};})();',ctx);
  const firstSave=window.GatterkaCabinetBridge.snapshot();
  assert.equal(firstSave.inputs.count,'3');
  assert.equal(firstSave.radios.backType,'rabbet');
  assert.equal(firstSave.parts.length,7,'Az oldallapok két darabként, közös sorban szerepelnek');
  assert.equal(firstSave.parts.find(x=>x.key==='side-left').qty,2);
  assert.equal(firstSave.parts.find(x=>x.key==='top').a,964);
  assert.equal(firstSave.parts.find(x=>x.key==='side-left').b,600);
  assert.equal(firstSave.parts.find(x=>x.key==='back-rabbet').ready,true);
  assert.equal(firstSave.parts.find(x=>x.key==='back-rabbet').a,989);
  assert.equal(firstSave.parts.find(x=>x.key==='back-rabbet').b,899);
  assert.equal(firstSave.parts.find(x=>x.key==='back-rabbet').thickness,4);
  fields.get('topHdfCut').value='trim';
  const mixedCut=window.GatterkaCabinetBridge.snapshot().parts.find(x=>x.key==='back-rabbet');
  assert.equal(mixedCut.b,902.5);

  fields.get('w').value='1200';fields.get('h').value='1000';
  fields.get('d').value='550';fields.get('count').value='4';
  radioItems.find(x=>x.name==='backType'&&x.value==='full').checked=true;
  const saved=window.GatterkaCabinetBridge.snapshot();
  assert.equal(saved.parts.length,8);
  assert.equal(saved.parts.find(x=>x.key==='top').a,1164);
  assert.equal(saved.parts.find(x=>x.key==='side-left').a,1000);
  assert.equal(saved.parts.find(x=>x.key==='back-full').a,964);
   assert.equal(saved.parts.find(x=>x.key==='back-full').b,1164);

  // A mentett konfigurációból az oldal újramegnyitásakor újra felépül az űrlap.
  fields.get('w').value='1000';fields.get('h').value='910';
  fields.get('d').value='600';fields.get('count').value='0';
  radioItems.find(x=>x.name==='backType'&&x.value==='rabbet').checked=true;
  window.GatterkaCabinetBridge.restore({design:saved,dims:{
    w:Number(saved.inputs.w),h:Number(saved.inputs.h),
    d:Number(saved.inputs.d),t:Number(saved.inputs.t)
  }});
  const restored=window.GatterkaCabinetBridge.snapshot();
  assert.equal(restored.inputs.count,'4');
  assert.equal(restored.radios.backType,'full');
  assert.equal(restored.inputs.topHdfCut,'trim');
  assert.equal(restored.parts.length,8);
  assert.equal(restored.parts.find(x=>x.key==='top').a,1164);
  assert.equal(restored.parts.find(x=>x.key==='back-full').a,964);
   assert.equal(restored.parts.find(x=>x.key==='back-full').b,1164);

  const begin=source.indexOf('  function syncCabinetDesignerParts(f,records){');
  const end=source.indexOf('  function cabinetDesignerDims(f){',begin);
  assert.ok(begin>=0&&end>begin);
  const parent={result:null,materialCatalog:[{id:'hdf4',thickness:4,color:'HDF'}],
    hdfMaterial:()=>({id:'hdf4',thickness:4,color:'HDF'}),
    sidesFromCode:()=>({x1:false,x2:false,y1:false,y2:false}),
    // This test covers dimension round-trips, not edging rules.
    cabinetAutoEdging:()=>{},
    uuid:(()=>{let id=0;return ()=>'generated-'+ ++id;})()};
  vm.runInNewContext(source.slice(begin,end),parent);
  const furniture={parts:[]};
  parent.syncCabinetDesignerParts(furniture,restored.parts);
  assert.equal(furniture.parts.length,8);
  assert.equal(furniture.parts.find(x=>x.cabinetDesignKey==='top').a,'1164');
  assert.equal(furniture.parts.find(x=>x.cabinetDesignKey==='back-full').a,'964');
   assert.equal(furniture.parts.find(x=>x.cabinetDesignKey==='back-full').b,'1164');
  assert.equal(furniture.parts.filter(x=>x.cabinetDesignKey?.startsWith('shelf-')).length,4);
});
