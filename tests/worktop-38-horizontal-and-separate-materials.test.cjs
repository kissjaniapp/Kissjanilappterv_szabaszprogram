'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
const source=(begin,end)=>{
  const a=html.indexOf(begin),b=html.indexOf(end,a+begin.length);
  assert.ok(a>=0&&b>a,'Hiányzó kódrész: '+begin);
  return html.slice(a,b);
};
const stripCode=source('  const STANDARD_BOARD=','  // Gyártási sorrend:');
const exportCode=source('  function buildOfflineXprgProject(','  // Az indító teljes Windows-útvonalat ad vissza.');
const drawCode=source('  function svgBoardSize(bin,compact=false){','  function trimmingSteps(');
const strip=state=>vm.runInNewContext('(function(){'+stripCode+
  ';return {makeStripPlan,validWorktop38Stock,validWorktop38Part,createBin};})()',{
    state,remnantCatalog:[]
  });
const exporter=vm.runInNewContext('(function(){'+exportCode+
  ';return buildOfflineXprgProject;})()',{
    fileName:s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/[^A-Za-z0-9_-]+/g,'_').slice(0,70)
  });
const draw=vm.runInNewContext('(function(){'+drawCode+';return svgBoardSize;})()',{
  state:{cutDirection:'auto'},result:null,colors:['#ccc'],h:x=>String(x),
  nfmt:x=>String(x)
});
const row=(a,b,thickness,materialColor,qty=1)=>({
  part:{id:materialColor+a+b,name:'Darab'},furniture:{name:'Bútor',materialColor},
  a,b,qty,originalA:a,originalB:b,thickness,materialColor,
  edge:'0-0',edgeThickness:2,mill:false,millDepth:0,rot:true
});
function plan(rows,boards=[]){
  const source=strip({trim:10,kerf:5,boards,selectedRemnantIds:[]});
  const result=source.makeStripPlan(0,{rows},'auto');
  const files=exporter(result.bins,'Konyha','Freya',5,'03/11/2026').files;
  const xprgs=files.filter(([p])=>p.endsWith('.xPrg')).map(([,xml])=>xml);
  assert.equal(xprgs.length,result.bins.length);
  assert.equal(result.failed.length,0,'alkatrész nem maradhat ki');
  assert.equal(result.bins.reduce((n,b)=>n+b.placements.length,0),
    rows.reduce((n,r)=>n+r.qty,0));
  for(let i=0;i<result.bins.length;i++){
    const bin=result.bins[i];
    const cuts=(xprgs[i].match(/<Cut /g)||[]).length;
    assert.ok(cuts<=99,'egy xPrg sem lépheti túl a 99 gépi parancsot');
    if(bin.thickness===38){
      const actualCrossCuts=bin.cuts.filter(c=>c.stage==='cross').length;
      const finishedParts=bin.machine.strips.reduce((sum,strip)=>sum+strip.items.length,0);
      // A munkalap XPRG-jében nincs fiktív Y csík és RX/X második menet.
      // P + RY + a tényleges CROSS vágások Y parancsa + darabonként F.
      assert.equal(cuts,2+actualCrossCuts+finishedParts,
        'a 38 mm munkalap parancsszáma a kirajzolt vágások alapján számolandó');
      assert.ok(cuts<=bin.machine.commandCount,
        'az optimalizálási becslés biztonságosan felső korlát marad');
    }else{
      assert.equal(cuts,bin.machine.commandCount,
        'a bútorlapok megszokott kétmenetes parancsszáma változatlan');
    }
    for(const placed of bin.placements){
      assert.equal(placed.part.thickness,bin.thickness);
      assert.equal(placed.part.materialColor.toLowerCase(),bin.materialColor.toLowerCase());
    }
  }
  return {result,xprgs};
}
test('különböző színű és vastagságú alapanyag egyetlen táblán sem keveredhet',()=>{
  const {result}=plan([
    row(700,600,38,'Fehér',3),row(800,900,38,'Fehér',2),
    row(900,600,38,'Fekete',4),row(500,300,18,'Fehér',3)
  ]);
  const keys=new Set(result.bins.map(b=>b.thickness+'|'+b.materialColor+'|'+b.b));
  assert.equal(keys.size,4);
});
test('38 mm-es munkalap kizárólag 4100×600 vagy 4100×900, eredeti szélességgel',()=>{
  const {result}=plan([row(1000,600,38,'Fehér',4),row(800,900,38,'Kő',8)]);
  for(const bin of result.bins){
    assert.equal(bin.a,4100);
    assert.ok([600,900].includes(bin.b));
    assert.equal(bin.thickness,38);
    assert.equal(bin.trim,0,'a 600/900 mm-es kész szélesség nem változhat');
    assert.equal(bin.machine.feed,'x','a munkalap gépi tengelye változatlan');
    assert.equal(bin.cuts.filter(c=>c.stage==='strip'||c.stage==='rip').length,0,
      'tilos a munkalapból hosszanti csíkot vagy U alábontást vágni');
    assert.ok(bin.cuts.every(c=>(c.stage==='cross'||c.stage==='cross-head-trim')&&c.length===bin.b),
      'a keresztvágások a teljes 600/900 mm szélességben haladjanak');
    assert.ok(bin.placements.every(p=>!p.turned));
    const layout=draw(bin);
    assert.equal(layout.rotated,true,'a 38 mm munkalap rajza 90°-kal elfordul');
    assert.equal(layout.boardWidth,bin.b,'a 600/900 mm-es szélesség vízszintes');
    assert.equal(layout.boardHeight,4100,'a 4100 mm-es hossz függőleges');
  }
});
test('250 darab 38 mm-es munkalaprész sem hoz létre hosszanti vágást',()=>{
  const {result,xprgs}=plan([row(200,600,38,'Tölgy',250)]);
  assert.ok(result.bins.length>3);
  assert.ok(result.bins.every(bin=>bin.machine.feed==='x'&&
    bin.cuts.every(c=>(c.stage==='cross'||c.stage==='cross-head-trim')&&c.length===bin.b)));
  assert.ok(xprgs.every(s=>!s.includes('T="U"')));
  assert.ok(xprgs.every(s=>/Lunghezza="600[.]00"/.test(s)&&
    /Larghezza="4100[.]00"/.test(s)&&
    /<Cut T="P" Dim="600[.]00"/.test(s)));
});
test('hibás kézi 38 mm-es tábla és hibás alkatrészméret visszautasítva',()=>{
  const engine=strip({trim:10,kerf:5,boards:[],selectedRemnantIds:[]});
  for(const [a,b] of [[4000,600],[4100,700],[4100,800],[2070,2800]]){
    assert.equal(engine.validWorktop38Stock({a,b,thickness:38}),false);
    assert.equal(engine.createBin({id:'invalid',a,b,thickness:38},1),null);
  }
  for(const [a,b] of [[4500,600],[1000,650],[700,870]]){
    assert.equal(engine.validWorktop38Part({a,b,thickness:38}),false);
  }
  assert.equal(engine.validWorktop38Stock({a:4100,b:600,thickness:38}),true);
  assert.equal(engine.validWorktop38Part({a:1000,b:900,thickness:38}),true);
});
