'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const cnc=require('../machine/cnc-auto.cjs');
const source=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
const match=source.match(/const GATTERKA_CABINET_INLINE_HTML=("(?:\\.|[^"\\])*");/s);
assert.ok(match,'Hiányzik a beépített bútortervező');
const html=JSON.parse(match[1]);
function section(start,end){
 const a=html.indexOf(start),b=html.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,'Hiányzó CNC eljárás: '+start);
 return html.slice(a,b);
}
const sourceCode=
  'function fixedDividerPieces(){return fixtureBoards;}\n'+
  'function baseShelfBack(){return 0;}\n'+
  section('function cncSupportRegions(p,boards,which){','// Az egyedi polctartó-furatok')+
  section('function cncShelfHoleGroup(p,shelf){','// A Xilog XFALC')+
  section('function cncRabbetQ(leftClosed,rightClosed){','function getStructuredParts(p){')+
  '\nthis.support=cncSupportRegions;this.build=buildCncInstancesForParts;'+
  'this.xbo=cncShelfHoleGroup;';
const context={fixtureBoards:[]};
vm.createContext(context);
vm.runInContext(sourceCode,context);
const plain=o=>JSON.parse(JSON.stringify(o));
function cabinet(overrides={}){
 const t=Number(overrides.t||18);
 const top=overrides.top||'between',bottom=overrides.bottom||'between';
 const sideH=Number(overrides.sideH||900),offset=Number(overrides.bodyBottomOffset||0);
 return {w:1000,h:sideH+offset+(top==='full'?t:0)+(bottom==='full'?t:0),
  d:600,t,sideH,innerW:1000-2*t,hasTop:true,hasBottom:true,top,bottom,
  bodyBottomOffset:offset,drilling:'full',cncGapBottom:0,cncGapTop:0,
  cncGapDivider:0,raster:32,holes:3,supportInset:50,front:0,
  hasLegs:false,falseBottom:false,rabbet:true,topHdfCut:'falc',
  bottomHdfCut:'falc',...overrides};
}
function run(p,boards=[]){
 context.fixtureBoards=boards;
 const rows=[{key:'side-left',sourceKeys:['side-left','side-right']},
  {key:'top'},{key:'bottom'}];
 context.build(p,rows);
 return plain(rows.flatMap(x=>x.cncInstances||[]));
}
function side(rows,key='side-left'){return rows.find(r=>r.key===key);}
function ops(rows,key,macro){return side(rows,key).operations.filter(x=>x.macro===macro);}
const combinations=[
 ['between','between',864,18,2],
 ['between','full',882,null,4],
 ['full','between',882,18,3],
 ['full','full',900,null,1]
];

test('REF: négy tető/fenék mód 900 mm valódi oldallaphosszból, alulról számolva',()=>{
 for(const [top,bottom,DX,BX] of combinations){
  const p=cabinet({top,bottom});
  const ref=plain(context.support(p,[],'left'));
  assert.deepEqual(ref.issues,[],top+'/'+bottom);
  assert.equal(ref.segments.length,1);
  assert.equal(ref.segments[0].DX,DX,top+'/'+bottom);
  assert.equal(ref.segments[0].BX??null,BX,top+'/'+bottom);
  assert.deepEqual(ref.segments[0].Y,[50,550],'Y elölről hátrafelé');
  assert.equal(ref.segments[0].BX===undefined,BX===null);
 }
});
test('REF: a lapvastagság és a fizikai oldallaphossz számít, nem a bútor külső H-ja',()=>{
 let p=cabinet({t:20,top:'between',bottom:'between'});
 let ref=plain(context.support(p,[],'left'));
 assert.equal(ref.segments[0].DX,860);
 assert.equal(ref.segments[0].BX,20);
 p=cabinet({t:18,top:'full',bottom:'full',sideH:900});
 assert.equal(p.h,936,'A külső H nagyobb, de a valós oldallap 900 mm');
 ref=plain(context.support(p,[],'left'));
 assert.equal(ref.segments[0].DX,900);
 assert.equal(ref.segments[0].BX,undefined);
 p=cabinet({bodyBottomOffset:18,top:'between',bottom:'between'});
 ref=plain(context.support(p,[],'left'));
 assert.equal(ref.segments[0].DX,864);
 assert.equal(ref.segments[0].BX,18,'A pótfenék nem tolhatja el a lap saját alsó nullpontját');
});
test('Oldallap LAPA: a korábban gépen bevált tető X=9, fenék X=891, mindkét oldalnál',()=>{
 for(const [top,bottom,, ,Q] of combinations){
  const p=cabinet({top,bottom,drilling:'fixed'});
  const result=run(p);
  for(const key of ['side-left','side-right']){
   const points=ops(result,key,'LAPA').map(x=>x.X);
   assert.equal(points.includes(9),top==='between',key+' tető X');
   assert.equal(points.includes(891),bottom==='between',key+' fenék X');
   assert.ok(ops(result,key,'LAPA').every(x=>x.Y===0&&x.y===600),
    'A front Y=0 marad');
   assert.equal(ops(result,key,'XFALC')[0].Q,Q,'Az XFALC kifutási irány az ALSÓ ütközőt követi');
  }
 }
});
test('Fix polc oldalcsatlakozása a visszaállított, működő LAPA X-iránnyal készül',()=>{
 const p=cabinet({drilling:'fixed',rabbet:false});
 const shelf={kind:'shelf',key:'shelf-1',index:1,name:'Polc',
  x1:18,x2:982,y0:20,y1:550,z1:291,z2:309,a:964,b:530,undercutDegrees:0};
 const result=run(p,[shelf]);
 for(const key of ['side-left','side-right']){
  const contact=ops(result,key,'LAPA').find(x=>x.Y===20);
  assert.ok(contact,key);
  assert.equal(contact.X,600,'A felső CNC programvég felől számított LAPA X=600');
  assert.equal(contact.y,530,'Első-hátsó tényleges polcmélység');
 }
});
test('XBO polctartó: első X az ALSÓ furat, raszter felfelé; Y továbbra is elölről',()=>{
 for(const bottom of ['between','full']){
  const p=cabinet({drilling:'local',bottom,rabbet:false});
  const origin=bottom==='full'?18:0;
  const center=origin+450;
  const shelf={kind:'shelf',key:'shelf-1',index:1,name:'Polc',
   x1:18,x2:982,y0:20,y1:550,z1:center-9,z2:center+9,a:964,b:530,
   angle:0,undercutDegrees:0};
  const result=run(p,[shelf]);
  for(const key of ['side-left','side-right']){
   const drilling=ops(result,key,'XBO');
   assert.equal(drilling.length,2,key);
   assert.deepEqual(drilling.map(x=>x.Y),[70,500],'Az Y elölről indul');
   assert.ok(drilling.every(x=>x.X===406.5&&x.x===32&&x.R===3),
    'Alulról 406.5, 438.5, 470.5 mm a furatsor');
  }
 }
});
test('REF BX csak szükség esetén íródik, a normál CNC makró és sorrend érintetlen',()=>{
 const full=cabinet({top:'full',bottom:'full'});
 const between=cabinet();
 const parse=p=>run(p).find(x=>x.key==='side-left').operations;
 const lines0=parse(full);
 const lines1=parse(between);
 const ref0=lines0.find(x=>x.macro==='REF'&&x.DX!==undefined);
 const ref1=lines1.find(x=>x.macro==='REF'&&x.DX!==undefined);
 assert.equal(cnc.macroLine(ref0,{}),'REF DX=900');
 assert.equal(cnc.macroLine(ref1,{}),'REF DX=864 BX=18');
 assert.deepEqual(lines1.filter(x=>x.macro==='REF').map(x=>x.DX),[864,undefined]);
 assert.deepEqual(lines0.filter(x=>x.macro==='REF').map(x=>x.DX),[900,undefined]);
});
