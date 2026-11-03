'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
function region(from,to){
  const a=html.indexOf(from),b=html.indexOf(to,a+from.length);
  assert.ok(a>=0&&b>a,'Hiányzik a programszakasz: '+from);
  return html.slice(a,b);
}
const code=region('  function makeCustomPartDefinition(){','  function startSeriesEditor(')+
  region('function calc(formula,vars){','  function getParts(){')+
  region('  function getParts(){','  function intro(')+
  region('  function intro(','  function steps(){')+
  region('  function partsReviewView(){','  function materialEditorView(){');
function makeFurniture(){
  return {
    id:'f1',name:'Konyhaszekrény',w:1000,ht:1400,d:600,t:18,qty:1,s:0,
    customParameters:[{id:'rule',name:'szokli',value:'2',parts:[]}],
    parts:[
      {id:'front',name:'Elülső szokli',a:'500',b:'150',q:'1',ifCondition:'szokli=1',edge:'0-0'},
      {id:'side',name:'Oldalsó szokli',a:'400',b:'120',q:'2',ifCondition:'[szokli]==2',
        edge:'1-0',edgeSides:{x1:true,x2:false,y1:false,y2:false},edgeThickness:2,mill:true,millDepth:1},
      {id:'side2',name:'Második oldal',a:'380',b:'120',q:'1',ifCondition:'szokli=3',edge:'0-0'},
      {id:'shelf',name:'Fenék',a:'W-2*T',b:'D',q:'1',ifCondition:'',edge:'0-1',edgeSides:{x1:false,x2:false,y1:true,y2:false},
        edgeThickness:0.4,mill:false},
      {id:'none',name:'Nulla darab',a:'120',b:'40',q:'0',edge:'0-0'}
    ]
  };
}
function makeEngine(furniture=makeFurniture()){
  let n=0;
  const state={furnitures:[furniture],trim:10,kerf:5,boards:[]};
  const ctx={state,
    uuid:()=>String(++n),h:x=>String(x??'').replace(/&/g,'&amp;').replace(/</g,'&lt;'),
    nfmt:x=>String(Math.round(Number(x)*10)/10),effectiveShelves:()=>0,
    effectiveDivider:()=>0,materialForPart:()=>({thickness:18,color:'Fehér'}),
    sidesFromCode:x=>({x1:false,x2:false,y1:false,y2:false}),pnum:Number,
    remnantCatalog:[]
  };
  const engine=vm.runInNewContext('(function(){'+code+
    ';return {getParts,partsReviewView};})()',ctx);
  return {...engine,state,ctx};
}
test('üres IF vagy igaz IF bekerül, hamis IF és 0 db kizárva',()=>{
  const {getParts}=makeEngine(),rows=getParts().rows,eligible=rows.filter(r=>r.qty>0);
  assert.deepEqual(Array.from(eligible,r=>r.part.id),['side','shelf']);
  assert.equal(eligible[0].qty,2);
  assert.equal(eligible[1].qty,1);
  assert.equal(rows.find(r=>r.part.id==='front').ifSkipped,true);
  assert.equal(rows.find(r=>r.part.id==='side2').ifSkipped,true);
  assert.equal(rows.find(r=>r.part.id==='none').qty,0);
});
test('összesítő csak a szabásba kerülő alkatrészeket írja ki, szerkesztő nélkül',()=>{
  const html=makeEngine().partsReviewView();
  assert.match(html,/Alkatrész-összesítő/);
  assert.match(html,/Oldalsó szokli/);
  assert.match(html,/Fenék/);
  assert.doesNotMatch(html,/Elülső szokli/);
  assert.doesNotMatch(html,/Második oldal/);
  assert.doesNotMatch(html,/Nulla darab/);
  assert.match(html,/Készméret \(X × Y\)/);
  assert.match(html,/Szabásméret \(X × Y\)/);
  assert.match(html,/1-0 · X1/);
  assert.match(html,/<td class="abs-value">2 mm<\/td>/);
  assert.match(html,/0-1 · Y1/);
  assert.match(html,/<td class="abs-value">0.4 mm<\/td>/);
  assert.match(html,/400 × 120 mm/);
  assert.match(html,/400 × 119 mm/);
  assert.doesNotMatch(html,/data-scope="part"/);
  assert.doesNotMatch(html,/<input/);
  assert.match(html,/data-page="stock"/);
});
test('IF=3 esetén a részlista automatikusan az aktuális szokli-értékre változik',()=>{
  const f=makeFurniture(),e=makeEngine(f);
  f.customParameters[0].value='3';
  assert.deepEqual(Array.from(e.getParts().rows.filter(r=>r.qty>0),r=>r.part.id),
    ['side2','shelf']);
  const body=e.partsReviewView();
  assert.match(body,/Második oldal/);
  assert.doesNotMatch(body,/Oldalsó szokli/);
});
test('hibás IF nem kerül a szabásba, és az összesítő megállítja a továbblépést',()=>{
  const f=makeFurniture();
  f.parts[1].ifCondition='nem létező képlet';
  const e=makeEngine(f),summary=e.getParts(),page=e.partsReviewView();
  assert.ok(summary.errors.some(x=>x.includes('IF')));
  assert.equal(summary.rows.find(x=>x.part.id==='side').qty,0);
  assert.doesNotMatch(page,/Oldalsó szokli<\/strong>/);
  assert.match(page,/Hibás IF vagy alkatrészképlet/);
  assert.match(page,/disabled title="Előbb javítsd az alkatrészhibákat"/);
});
test('ha minden IF hamis, az összesítő nem mutat gépi alkatrészt',()=>{
  const f=makeFurniture();
  f.parts=f.parts.filter(p=>p.id==='front'||p.id==='side2');
  const body=makeEngine(f).partsReviewView();
  assert.match(body,/Nincs szabásba kerülő alkatrész/);
  assert.match(body,/0 db kerül a szabásba/);
  assert.match(body,/disabled title/);
});
test('Alkatrészek → Alkatrész-összesítő → Anyagkészlet, az xMix érintetlen',()=>{
  const start=html.indexOf("function steps(){");
  const order=html.slice(start,html.indexOf('\n  function renderNav()',start));
  assert.ok(order.indexOf("'parts'")<order.indexOf("'parts-review'"));
  assert.ok(order.indexOf("'parts-review'")<order.indexOf("'stock'"));
  assert.match(html,/data-page="parts-review">Alkatrész-összesítő →/);
  assert.match(html,/state.active==='parts-review'\?partsReviewView\(\)/);
  assert.match(html,/data-action="save-xprg-folder"/);
});

test('a tényleges gépi táblakiosztó sem kap hamis IF-es alkatrészt',()=>{
  const e=makeEngine();
  const strip=region('  const STANDARD_BOARD=','  // Gyártási sorrend:');
  const makeStripPlan=vm.runInNewContext('(function(){'+strip+
    ';return makeStripPlan;})()',{
      state:e.state,remnantCatalog:[]
    });
  const output=makeStripPlan(0,e.getParts(),'auto');
  assert.equal(output.failed.length,0,'minden igaz IF-es alkatrész elfér');
  const placed=output.bins.flatMap(bin=>bin.placements.map(placement=>placement.part.name));
  assert.equal(placed.length,3,'két oldalsó és egy fenék');
  assert.equal(placed.filter(name=>name==='Oldalsó szokli').length,2);
  assert.equal(placed.filter(name=>name==='Fenék').length,1);
  assert.ok(!placed.includes('Elülső szokli'));
  assert.ok(!placed.includes('Második oldal'));
  assert.ok(!placed.includes('Nulla darab'));
});
