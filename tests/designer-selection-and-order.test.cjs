const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync(require('node:path').join(__dirname,'../app/index.htm'),'utf8');
const html=JSON.parse(app.match(/const GATTERKA_CABINET_INLINE_HTML=("(?:\\.|[^"\\])*");/s)[1]);
const js=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
function section(a,b){const start=js.indexOf(a),end=js.indexOf(b,start+a.length);assert.ok(start>=0&&end>start);return js.slice(start,end);}
function harness(kind,mode='piece'){
 const p={w:1000,h:1500,t:18,bodyBottomOffset:0,hasBottom:true,hasTop:true};
 const layout={x0:18,x3:982,z0:18,z3:1482,
  f:[{center:500}],horizontals:[{kind:'v',index:0,z:500},{kind:'v',index:1,z:1000}]};
 const board=kind==='f'?{key:'f-divider-1',kind:'f',index:0,name:'F',x1:491,x2:509,z1:18,z2:1482,a:1464,b:450}:
  {key:'v-divider-1',kind:'v',index:0,name:'V',x1:18,x2:982,z1:491,z2:509,a:964,b:450};
 const elements=new Map();
 function element(id){if(!elements.has(id))elements.set(id,{listeners:{},addEventListener(name,fn){this.listeners[name]=fn;},
  setPointerCapture(){},focus(){},classList:{remove(){},add(){}}});return elements.get(id);}
 const ctx={p,layout,base:[board],mode,$:element,Event:class{},MouseEvent:class{},
  document:{querySelectorAll:()=>[],querySelector:()=>null},window:{addEventListener(){}},
  read:()=>p,visualLayout:()=>layout,clamp:(n,a,b)=>Math.min(b,Math.max(a,n)),
  visualEditingMode:()=>mode,visualMaskValue:()=>true,visualMsg(){},visualPointerWorld:e=>e.world,
  visualFindPiece:()=>board,visualSetAxis:(axis,index,target)=>{ctx.rowMove={axis,index,target};}};
 vm.runInNewContext('let visualEdited=false,visualMaskF=[],visualMaskH={},visualPieceEdits={},visualCuts={},visualRemoved={},visualSelected=null,visualRowSelected=null,visualDragging=null;\n'+
  section('function visualApplyParts(p,base,layout){','const DEFAULTS=')+
  '\nfunction fixedDividerPieces(){const b=base.map(p=>({...p}));b.connectionIssues=[];return visualApplyParts(p,b,layout);}\n'+
  section('function visualSelectablePieces(','function visualUpdateInspector(')+
  section('function visualSegmentAt(','function visualFindPiece(')+
  '\nfunction visualRender(){} function visualAfterChange(){}\n'+
  section('function visualWire(){','function render(){')+
  '\nvisualWire();this.parts=()=>fixedDividerPieces();this.state=()=>({visualSelected,visualRowSelected,visualDragging,visualCuts,visualRemoved,visualPieceEdits});this.restore=()=>visualRemoveSelected(true);',ctx);
 function pointer(name,key,world={x:500,z:700,svgX:500,svgY:700}){
  const target={dataset:key.startsWith('row:')?{visAxis:kind==='f'?'f':'h',idx:'0',section:'0'}:{visPart:key},
   hasAttribute:attr=>key.startsWith('row:')?attr==='data-vis-axis':attr==='data-vis-part'};
  element('visualSvg').listeners[name]({button:0,pointerId:1,world,target:{closest:()=>target},preventDefault(){}});
 }
 return {ctx,pointer,element};
}
test('F és V egyedi módban a kijelölt rekeszszakasz külön mozdul és Delete csak azt veszi ki',()=>{
 for(const kind of ['f','v']){
  const h=harness(kind),key=kind+'-divider-1-section-0';
  h.pointer('pointerdown',key);
  assert.equal(h.ctx.state().visualSelected,key);
  assert.equal(h.ctx.parts().length,1,'puszta kijelölés még nem vágja szét a fizikai lapot');
  h.pointer('pointermove',key,{x:560,z:760,svgX:560,svgY:760});
  h.pointer('pointerup',key);
  const parts=h.ctx.parts();assert.equal(parts.length,kind==='f'?3:2);
  const moved=parts.find(b=>b.key===key),other=parts.find(b=>b.key!==key);
  assert.equal(moved[kind==='f'?'x1':'z1'],551);
  assert.equal(other[kind==='f'?'x1':'z1'],491);
  let prevented=false;
  h.element('visualEditor').listeners.keydown({key:'Delete',target:{closest:()=>null},preventDefault(){prevented=true;}});
  assert.equal(prevented,true);
  assert.ok(!h.ctx.parts().some(b=>b.key===key));
  assert.ok(h.ctx.parts().some(b=>b.key===other.key));
  assert.equal(h.ctx.restore(),true);
  assert.equal(h.ctx.parts().find(b=>b.key===key)[kind==='f'?'x1':'z1'],551);
 }
});
test('teljes sor módban az egész F/V-sor kijelölt, mozgatása a sorra hat',()=>{
 for(const kind of ['f','v']){
  const h=harness(kind,'row');h.pointer('pointerdown','row:0');
  assert.equal(h.ctx.state().visualRowSelected.axis,kind==='f'?'f':'h');
  assert.equal(h.ctx.state().visualSelected,null);
  h.pointer('pointermove','row:0',{x:560,z:760,svgX:560,svgY:760});
  assert.equal(h.ctx.rowMove.axis,kind==='f'?'f':'h');
  assert.equal(Object.keys(h.ctx.state().visualCuts).length,0);
 }
});
test('Delete a szöveg-/számmezőben nem vesz ki osztót',()=>{
 const h=harness('f');h.pointer('pointerdown','f-divider-1-section-0');
 h.element('visualEditor').listeners.keydown({key:'Delete',target:{closest:()=>({tagName:'INPUT'})},preventDefault(){throw Error('Input Delete nem blokkolható');}});
 assert.equal(Object.keys(h.ctx.state().visualRemoved).length,0);
});
test('bal oldali blokksorrend menthető, idegen/ismételt kulcs nélkül visszaállítható',()=>{
 const nodes=Array.from({length:4},(_,i)=>({dataset:{controlPanel:'control-'+i}}));
 const holder={querySelectorAll:()=>nodes.slice(),appendChild(node){nodes.splice(nodes.indexOf(node),1);nodes.push(node);}};
 const ctx={document:{querySelector:()=>holder}};
 vm.runInNewContext('let controlPanelOrder=[];'+section('function controlPanelsApply(','function controlPanelsWire(')+
  '\nthis.apply=controlPanelsApply;this.order=()=>controlPanelOrder;',ctx);
 ctx.apply(['control-2','control-0','control-2','invalid']);
 assert.deepEqual(Array.from(ctx.order()),['control-2','control-0','control-1','control-3']);
 assert.deepEqual(nodes.map(p=>p.dataset.controlPanel),Array.from(ctx.order()));
 ctx.apply([]);assert.deepEqual(nodes.map(p=>p.dataset.controlPanel),['control-0','control-1','control-2','control-3']);
 assert.match(js,/panelOrder:controlPanelOrder/);assert.match(js,/controlPanelsApply\(data\?\.panelOrder/);
 assert.match(js,/cut\.sections===true/);
});
test('blokkok fogantyús húzása és nyílbillentyűs átrendezése mentési eseményt küld',()=>{
 const nodes=[],listeners={};let saves=0;
 const holder={querySelectorAll:()=>nodes.slice(),addEventListener:(key,fn)=>listeners[key]=fn,
  appendChild(panel){nodes.splice(nodes.indexOf(panel),1);nodes.push(panel);},
  insertBefore(panel,before){nodes.splice(nodes.indexOf(panel),1);const i=nodes.indexOf(before);nodes.splice(i<0?nodes.length:i,0,panel);}};
 for(let i=0;i<4;i++){
  const head={querySelector:()=>({textContent:'Blokk '+i}),prepend(handle){this.handle=handle;}};
  const panel={dataset:{},querySelector:()=>head,classList:{add(){},remove(){}},
   closest:()=>panel,getBoundingClientRect:()=>({top:0,height:100})};
  Object.defineProperty(panel,'nextSibling',{get:()=>nodes[nodes.indexOf(panel)+1]||null});nodes.push(panel);
 }
 const ctx={Event:class{},document:{querySelector:()=>holder,dispatchEvent(){saves++;},
  createElement:()=>({setAttribute(){},focus(){},closest(){return nodes.find(p=>p.querySelector().handle===this);}})}};
 vm.runInNewContext('let controlPanelOrder=[];'+section('function controlPanelsApply(','function visualSnapshot(')+
  '\ncontrolPanelsWire();this.order=()=>controlPanelOrder;',ctx);
 const first=nodes[0],handle=first.querySelector().handle;
 listeners.keydown({key:'ArrowDown',target:{closest:()=>handle},preventDefault(){}});
 assert.equal(nodes[1],first);assert.equal(saves,1);
 const transfer={setData(){}};
 listeners.dragstart({target:{closest:()=>handle},dataTransfer:transfer});
 listeners.dragover({target:{closest:()=>nodes[3]},clientY:90,dataTransfer:transfer,preventDefault(){}});
 listeners.drop({preventDefault(){}});listeners.dragend();
 assert.equal(nodes[3],first);assert.ok(saves>=2);
 assert.equal(ctx.order()[3],first.dataset.controlPanel);
});
