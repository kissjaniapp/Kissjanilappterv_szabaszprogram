'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
function section(a,b){
  const i=html.indexOf(a),j=html.indexOf(b,i+a.length);
  assert.ok(i>=0&&j>i,'Hiányzó programrész: '+a);
  return html.slice(i,j);
}
const logic=section('  function makeCustomPartDefinition(){','  function startSeriesEditor(')+
  section('function calc(formula,vars){','  function getParts(){')+
  section('  function getParts(){','  function intro(');
function furniture(id,value){
  return {id,name:'Bútor '+id,qty:1,w:1000,ht:1400,d:500,t:18,s:0,
    customParameters:[{id:id+'-szokli',name:'szokli',value:String(value),condition:'',parts:[]}],
    parts:[
      {id:id+'-common',name:'Minden szoklis kialakításhoz',a:'900',b:'120',q:'1',ifCondition:'szokli=1-2-3'},
      {id:id+'-only2',name:'Csak szokli 2 esetén',a:'300',b:'120',q:'1',ifCondition:'szokli=2'},
      {id:id+'-always',name:'Mindig',a:'850',b:'450',q:'1',ifCondition:''}
    ].map(p=>({...p,edge:'0-0',edgeThickness:2,mill:false}))
  };
}
function engine(furnitures){
  let n=0;
  return vm.runInNewContext('(function(){'+logic+
    ';return {getParts,evaluateFurnitureIf,namedFurnitureParameter,calcPartFormula};})()',{
    state:{furnitures},uuid:()=>String(++n),h:s=>String(s??''),
    effectiveShelves:()=>0,effectiveDivider:()=>0,
    materialForPart:()=>({thickness:18,color:'Fehér'}),
    sidesFromCode:()=>({x1:false,x2:false,y1:false,y2:false}),
    pnum:Number
  });
}
function vars(f){return {W:f.w,H:f.ht,D:f.d,T:f.t,S:0,O:0};}
test('szokli=1-2-3: 1, 2 és 3 esetén igen, 0 és 4 esetén nem',()=>{
  for(const value of [0,1,2,3,4]){
    const f=furniture('f',value),e=engine([f]),rows=e.getParts().rows;
    assert.equal(rows[0].qty,[1,2,3].includes(value)?1:0,'érték: '+value);
    assert.equal(rows[0].ifSkipped,![1,2,3].includes(value)||undefined);
    assert.equal(rows[2].qty,1,'az IF nélküli alkatrész mindig bekerül');
    assert.equal(e.getParts().errors.length,0);
  }
});
test('a korábbi szokli=2 feltétel továbbra is csak 2-nél igaz',()=>{
  for(const value of [0,1,2,3]){
    const f=furniture('f',value),e=engine([f]);
    assert.equal(e.getParts().rows[1].qty,value===2?1:0);
  }
});
test('szóköz, zárójeles hivatkozás és dupla egyenlőség is használható',()=>{
  const f=furniture('f',3),e=engine([f]);
  for(const condition of ['szokli=1-2-3','szokli == 1 - 2 - 3','[szokli]=1-2-3','[szokli]==1 -2-3']){
    assert.equal(e.evaluateFurnitureIf(condition,vars(f),f,f.parts[0]),true,condition);
    f.customParameters[0].value='0';
    assert.equal(e.evaluateFurnitureIf(condition,vars(f),f,f.parts[0]),false,condition);
    f.customParameters[0].value='3';
  }
});
test('az értéklista && és || összetett IF képleten belül is működik',()=>{
  const f=furniture('f',2),e=engine([f]);
  assert.equal(e.evaluateFurnitureIf('szokli=1-2-3 && H>=1200',vars(f),f,f.parts[0]),true);
  assert.equal(e.evaluateFurnitureIf('szokli=1-2-3 && H>2000',vars(f),f,f.parts[0]),false);
  f.customParameters[0].value='0';
  assert.equal(e.evaluateFurnitureIf('szokli=1-2-3 || W>2000',vars(f),f,f.parts[0]),false);
});
test('szokli=1-2-3 más bútornál nem vesz át paraméterértéket',()=>{
  const a=furniture('a',0),b=furniture('b',3),e=engine([a,b]);
  assert.equal(e.getParts().rows[0].qty,0);
  assert.equal(e.getParts().rows[3].qty,1);
  b.customParameters[0].value='0';
  assert.equal(e.getParts().rows[3].qty,0);
});
test('a méretképletekben továbbra is aritmetikai kivonás marad a kötőjel',()=>{
  const f=furniture('f',2),e=engine([f]);
  assert.equal(e.calcPartFormula('100-20-3',vars(f),f,f.parts[0]),77);
  f.w=80;
  assert.equal(e.evaluateFurnitureIf('W=100-20',vars(f),f,f.parts[0]),true);
  assert.equal(e.evaluateFurnitureIf('W=100-19',vars(f),f,f.parts[0]),false);
  assert.equal(e.evaluateFurnitureIf('szokli>=2',vars(f),f,f.parts[0]),true);
});
test('a felületen is látszik a szokli=1-2-3 IF példa',()=>{
  assert.match(html,/placeholder="szokli=1-2-3 vagy \[szokli\]==2"/);
  assert.match(html,/mindhárom esetben bekerül, 0-nál nem/);
});

test('a gépi táblakiosztásban 0-nál nincs szoklis alkatrész, 3-nál van',()=>{
  const strip=section('  const STANDARD_BOARD=','  // Gyártási sorrend:');
  const makeStripPlan=vm.runInNewContext('(function(){'+strip+';return makeStripPlan;})()',{
    state:{trim:10,kerf:5,boards:[]},remnantCatalog:[]
  });
  for(const value of [0,3]){
    const f=furniture('f',value),parts=engine([f]).getParts();
    const plan=makeStripPlan(0,parts,'auto');
    assert.equal(plan.failed.length,0);
    const placed=plan.bins.flatMap(b=>b.placements.map(p=>p.part.name));
    assert.equal(placed.includes('Minden szoklis kialakításhoz'),value===3);
    assert.equal(placed.includes('Mindig'),true);
    assert.equal(placed.includes('Csak szokli 2 esetén'),false);
    assert.equal(placed.length,value===3?2:1);
  }
});
