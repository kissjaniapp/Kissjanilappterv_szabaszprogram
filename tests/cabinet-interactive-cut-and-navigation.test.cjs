'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
const match=source.match(/const GATTERKA_CABINET_INLINE_HTML=("(?:\\.|[^"\\])*");/s);
assert.ok(match,'Beágyazott bútorprogram hiányzik');
const html=JSON.parse(match[1]);
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x=>x[1]);
assert.equal(scripts.length,2);
const js=scripts[0];
const between=(a,b,text=js)=>{
 const start=text.indexOf(a),end=text.indexOf(b,start+a.length);
 assert.ok(start>=0&&end>start,'Nem található kódrész: '+a);
 return text.slice(start,end);
};
const apply=between('function visualApplyParts(p,base,layout){','const DEFAULTS=');
const defaultP={w:1000,h:1500,d:450,t:18,n:0,vCount:0,fCount:1,sideH:1500,
 hasTop:true,hasBottom:true,top:'between',bottom:'between',bodyBottomOffset:0,
 innerW:964,innerH:1464,fullBack:false,rabbet:false,falseBottom:false};
const layoutF={horizontals:[],f:[{center:500}],x0:18,x3:982,z0:18,z3:1482};
const layoutV={horizontals:[{kind:'v',index:0,z:400}],f:[],x0:18,x3:982,z0:18,z3:1482};
function board(kind){
 return kind==='f'?
 {kind:'f',key:'f-divider-1',name:'F-osztó 1',index:0,
  x1:491,x2:509,z1:18,z2:1482,y0:0,y1:450,a:1464,b:450}:
 {kind:'v',key:'v-divider-1',name:'V-osztó 1',index:0,
  x1:18,x2:982,z1:391,z2:409,y0:0,y1:450,a:964,b:450};
}
function geometry(kind,cuts={},removed={},edits={}){
 const ctx={},data=[board(kind)];data.connectionIssues=[];
 vm.runInNewContext('let visualEdited=true,visualMaskF=[],visualMaskH={},visualPieceEdits='+JSON.stringify(edits)+
  ',visualCuts='+JSON.stringify(cuts)+',visualRemoved='+JSON.stringify(removed)+';\n'+
  'function visualMaskValue(){return true;}\n'+apply+
  '\nthis.apply=visualApplyParts;\nthis.setRemoved=v=>{visualRemoved=v;};'+
  'this.setCuts=v=>{visualCuts=v;};'+
  'this.setEdits=v=>{visualPieceEdits=v;};',ctx);
 return {ctx,parts:()=>ctx.apply(defaultP,(()=>{const v=[board(kind)];v.connectionIssues=[];return v;})(),kind==='f'?layoutF:layoutV)};
}
test('F-osztó: kijelölt lap kettévágható 30 mm hézaggal, önálló stabil gyermekazonosítókkal',()=>{
 const g=geometry('f',{'f-divider-1':{ratio:.5,gap:30}});
 const out=g.parts();
 assert.equal(out.length,2);
 assert.deepEqual(Array.from(out,b=>b.key),['f-divider-1-part-a','f-divider-1-part-b']);
 assert.equal(out[0].z2,735);assert.equal(out[1].z1,765);
 assert.equal(out[0].a,717);assert.equal(out[1].a,717);
 assert.ok(out.connectionIssues.some(x=>/CNC/.test(x)));
});
test('V-osztó: pontosan ugyanazzal az elvvel kettévágható',()=>{
 const g=geometry('v',{'v-divider-1':{ratio:.5,gap:30}});
 const out=g.parts();
 assert.equal(out.length,2);
 assert.deepEqual(Array.from(out,b=>b.key),['v-divider-1-part-a','v-divider-1-part-b']);
 assert.equal(out[0].x2,485);assert.equal(out[1].x1,515);
 assert.equal(out[0].a,467);assert.equal(out[1].a,467);
});
test('Bontott F és V alkatrészek önállóan húzhatók: a másik gyermek változatlan',()=>{
 for(const kind of ['f','v']){
  const key=kind+'-divider-1';
  const g=geometry(kind,{[key]:{ratio:.5,gap:30}},{},{[key+'-part-b']:{shift:60}});
  const out=g.parts();
  assert.equal(out[0].kind,kind);
  if(kind==='f'){
   assert.equal(out[0].x1,491);assert.equal(out[1].x1,551);
  }else{
   assert.equal(out[0].z1,391);assert.equal(out[1].z1,451);
  }
 }
});
test('Bontott F és V darab kivétele és visszarakása az eredeti kulccsal',()=>{
 for(const kind of ['f','v']){
  const id=kind+'-divider-1',child=id+'-part-b';
  const g=geometry(kind,{[id]:{ratio:.5,gap:30}},{[child]:true});
  const removed=g.parts();
  assert.equal(removed.length,1);
  assert.equal(removed[0].key,id+'-part-a');
  assert.deepEqual(Array.from(removed.visualRemoved,q=>q.key),[child]);
  g.ctx.setRemoved({});
  const restored=g.parts();
  assert.equal(restored.length,2);
  assert.equal(restored[1].key,child);
 }
});
test('A már kettévágott F/V-darab önállóan újra kettévágható',()=>{
 for(const kind of ['f','v']){
  const id=kind+'-divider-1';
  const g=geometry(kind,{[id]:{ratio:.5,gap:30},[id+'-part-b']:{ratio:.5,gap:30}});
  const out=g.parts();
  assert.equal(out.length,3);
  assert.deepEqual(Array.from(out,x=>x.key),
   [id+'-part-a',id+'-part-b-part-a',id+'-part-b-part-b']);
 }
});
test('Paraméteres szerkesztő és alkatrészösszesítő azonos fizikai darabazonosítókat kap',()=>{
 const cuts={'f-divider-1':{ratio:.5,gap:30}};
 const g=geometry('f',cuts);
 const ctx={fixedDividerPieces:()=>g.parts(),fmt:n=>String(n),baseShelfBack:()=>0,shelfBackAt:()=>0};
 vm.runInNewContext(between('function getStructuredParts(p){','let currentParts=[]')+
  '\nthis.makeList=getStructuredParts;',ctx);
 const rec=ctx.makeList(defaultP);
 const actual=g.parts().map(x=>x.key).sort();
 const fromList=rec.flatMap(x=>x.sourceKeys||[x.key]).filter(x=>x.startsWith('f-divider-')).sort();
 assert.deepEqual(Array.from(fromList),Array.from(actual));
 assert.equal(rec.reduce((a,r)=>a+r.qty,0),4+actual.length);
 // Ugyanaz a fizikai lista megy az anyagkészletre és a CNC-kapcsolatokhoz.
});
test('Kivett gyermek nem maradhat egyik alkatrészlistában sem',()=>{
 const g=geometry('f',{'f-divider-1':{ratio:.5,gap:30}},{'f-divider-1-part-b':true});
 const ctx={fixedDividerPieces:()=>g.parts(),fmt:n=>String(n),baseShelfBack:()=>0,shelfBackAt:()=>0};
 vm.runInNewContext(between('function getStructuredParts(p){','let currentParts=[]')+
  '\nthis.makeList=getStructuredParts;',ctx);
 const list=ctx.makeList(defaultP);
 assert.deepEqual(Array.from(list.flatMap(r=>r.sourceKeys||[r.key]).filter(x=>x.startsWith('f-divider-'))),
  ['f-divider-1-part-a']);
});
function sync(){
 const context={result:null,materialCatalog:[],hdfMaterial:()=>null,
 sidesFromCode:()=>({x1:false,x2:false,y1:false,y2:false}),
 partEdgeThicknesses:p=>({x1:p.edgeThickness||2,x2:0,y1:0,y2:0}),
 cabinetAutoEdging:()=>{},uuid:(()=>{let i=0;return ()=>'generated-'+ ++i;})()};
 vm.runInNewContext(between('  function syncCabinetDesignerParts(f,records){','  function cabinetDesignerDims(f){',source)+
 '\nthis.sync=syncCabinetDesignerParts;',context);
 return context;
}
test('Az új F/V gyerek örökli a szülő 0,4 ABS-ét, anyagát és reszelését',()=>{
 const c=sync(),parent={
  id:'old',cabinetDesignKey:'f-divider-1',name:'F-osztó 1',autoCabinetName:'F-osztó 1',
  a:'1464',b:'450',q:'1',materialId:'tolgy',materialColor:'Tölgy',
  edge:'2-0',edgeThickness:2,edgeThicknesses:{x1:.4,x2:2,y1:0,y2:0},
  filingSides:{x1:false,x2:false,y1:true,y2:false}
 };
 const f={parts:[parent],cabinetDesign:{inputs:{},radios:{}}};
 c.sync(f,[
  {key:'f-divider-1-part-a',name:'F-osztó 1 · A',a:717,b:450,qty:1},
  {key:'f-divider-1-part-b',name:'F-osztó 1 · B',a:717,b:450,qty:1}
 ]);
 assert.equal(f.parts.length,2);
 for(const p of f.parts){
  assert.equal(p.materialId,'tolgy');
  assert.equal(p.materialColor,'Tölgy');
  assert.equal(p.edge,'2-0');
  assert.equal(p.edgeThicknesses.x1,.4);
  assert.equal(p.filingSides.y1,true);
 }
});
test('Szerkezeti CNC-figyelmeztetés nem alakulhat DXF-hibává (anyagkészlet megnyitható)',()=>{
 const c=sync(),f={parts:[],cabinetDesign:{inputs:{},radios:{}}};
 c.sync(f,[{key:'side-left',name:'Oldal',a:1500,b:450,qty:2,
  sourceKeys:['side-left','side-right'],ready:false,
  cncInstances:[{key:'side-left',side:'IJ',operations:[{macro:'LAPA'}]}]}]);
 assert.equal(f.parts.length,1);
 assert.equal(f.parts[0].dxfUnverified,false);
 assert.equal(f.parts[0].cabinetCncUnverified,true);
 assert.ok(f.parts[0].cncInstances[0].issues.length>0,'az ellenőrizetlen CNC-mentés továbbra is tiltott');
});
test('Kivett F/V-darab visszatéve megőrzi a személyre szabott ABS-ét',()=>{
 const c=sync(),f={parts:[{id:'s',cabinetDesignKey:'v-divider-1-part-b',
  name:'V-osztó 1 · B',autoCabinetName:'V-osztó 1 · B',a:'465',b:'450',q:'1',
  edge:'2-0',edgeThicknesses:{x1:.4,x2:2,y1:0,y2:0}}],cabinetDesign:{inputs:{},radios:{}}};
 c.sync(f,[]);assert.equal(f.parts.length,0);
 c.sync(f,[{key:'v-divider-1-part-b',name:'V-osztó 1 · B',a:461,b:450,qty:1}]);
 assert.equal(f.parts.length,1);assert.equal(f.parts[0].edge,'2-0');
 assert.equal(f.parts[0].edgeThicknesses.x1,.4);
});
test('Beágyazott szerkesztő: kettévágás, kivétel, visszaállítás, zoom és mentés működési útvonal',()=>{
 assert.match(js,/id="visualCutButton"/);
 assert.match(js,/id="visualRemoveButton"/);
 assert.match(js,/data-vis-removed/);
 assert.match(js,/visualCuts\[board\.key\]/);
 assert.match(js,/visualSnapshot\(\)/);
 assert.match(js,/data-vis-part/);
 for(const script of scripts)assert.doesNotThrow(()=>new vm.Script(script));
});
