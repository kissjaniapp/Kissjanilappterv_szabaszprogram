'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const auto=require('../machine/cnc-auto.cjs'),core=require('../machine/cnc-xxl.cjs');
const src=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
const packed=src.match(/const GATTERKA_CABINET_INLINE_HTML=("(?:\\.|[^"\\])*");/s);
assert.ok(packed,'Beágyazott bútortervező hiányzik');
const html=JSON.parse(packed[1]);
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x=>x[1]);
const fragment=scripts[0].slice(scripts[0].indexOf('function cncSupportRegions(p,boards,which){'),
  scripts[0].indexOf('function getStructuredParts(p){'));
function cabinet(drilling='local'){
 return {w:1000,h:1500,d:450,t:18,sideH:1500,innerW:964,
  bodyBottomOffset:0,hasTop:true,hasBottom:true,top:'between',bottom:'between',
  drilling,holes:3,raster:32,supportInset:50,front:0,rabbet:false,hasLegs:false,
  falseBottom:false,fCount:1,n:1};
}
function scene(){
 const f={kind:'f',index:0,key:'f-divider-1',name:'F-osztó 1',x1:491,x2:509,
  y0:0,y1:450,z1:18,z2:1482,a:1464,b:450};
 const shelf=(side,x1,x2)=>({kind:'shelf',index:0,key:'shelf-'+side,
  name:'Polc '+side,x1,x2,y0:10,y1:390,z1:600,z2:618,
  a:x2-x1,b:380,angle:0,undercutDegrees:0});
 return [f,shelf('bal',18,491),shelf('jobb',509,982)];
}
function build(mode,boards=scene()){
 const ctx={fixedDividerPieces:()=>boards,baseShelfBack:()=>0};
 vm.createContext(ctx);vm.runInContext(fragment,ctx);
 const rows=[{key:'f-divider-1'},{key:'top'},{key:'bottom'}];
 ctx.buildCncInstancesForParts(cabinet(mode),rows);
 return rows;
}
test('F-osztó helyi polctartó: minden csatlakozó polc előtt/hátul mindkét oldalon furatot kap',()=>{
 const rows=build('local'),f=rows[0].cncInstances[0];
 assert.deepEqual(Array.from(f.issues),[]);
 const xbo=f.operations.filter(op=>op.macro==='XBO');
 assert.equal(xbo.length,4);
 assert.equal(xbo.filter(op=>op.face==='primary').length,2);
 assert.equal(xbo.filter(op=>op.face==='reverse').length,2);
 assert.deepEqual(Array.from(xbo,op=>[op.X,op.Y,op.R,op.x]),[
  [547.5,60,3,32],[547.5,340,3,32],
  [547.5,60,3,32],[547.5,340,3,32]]);
 const program=auto.compileEntry(f,{assemblyJoint:'excenter'});
 assert.match(program,/XBO X=547\.5 Y=60 z=13 V=1 R=3 x=32 y=0 D=5 N=P F=1/);
 assert.match(program,/XMSG Q=1 N="FORDIT"/);
 assert.equal((program.match(/XBO X=/g)||[]).length,4);
});
test('F-osztó teljes raszter: külön REF/POLC szakaszt kap mindkét csatlakozó lapoldal',()=>{
 const f=build('full')[0].cncInstances[0];
 assert.deepEqual(Array.from(f.issues),[]);
 assert.equal(f.operations.filter(x=>x.macro==='REF').length,4);
 assert.equal(f.operations.filter(x=>x.macro==='POLC').length,4);
 assert.deepEqual(Array.from(f.operations.filter(x=>x.macro==='POLC'),x=>x.Y),[60,340,60,340]);
 const program=auto.compileEntry(f,{assemblyJoint:'excenter'});
 assert.equal((program.match(/REF DX=1464/g)||[]).length,2);
 assert.match(program,/POLC Y=60 Q=0# s=32 G=1# F=1/);
 assert.match(program,/XMSG Q=1 N="FORDIT"/);
});
test('A fix polc meglévő F-osztó LAPA kapcsolata nem cserélhető XBO-ra',()=>{
 const f=build('fixed')[0].cncInstances[0];
 assert.equal(f.operations.filter(x=>x.macro==='XBO'||x.macro==='POLC').length,0);
 assert.ok(f.operations.some(x=>x.macro==='LAPA'));
});
test('LAB X/Y G=2: a négy sarokban érvényes; hibás, kilógó koordináta tiltott',()=>{
 const spec={dx:600,dy:450,dz:18,side:'IJ'};
 const labs=['LAB X=59 Y=59 G=2','LAB X=59 Y=391 G=2',
  'LAB X=541 Y=59 G=2','LAB X=541 Y=391 G=2'];
 const txt=core.compileXxl({...spec,commands:labs.join('\n')});
 assert.equal((txt.match(/LAB X=/g)||[]).length,4);
 for(const bad of ['LAB X=601 Y=59 G=2','LAB X=59 Y=451 G=2',
  'LAB X=59 Y=59 G=3','LAB X=-1 Y=59 G=2']){
   assert.throws(()=>core.compileXxl({...spec,commands:bad}),/LAB/);
 }
});
test('A szerkesztő Vissza/Előre gombja és kétirányú előzménytára létezik',()=>{
 assert.match(html,/id="visualUndo"[^>]*disabled/);
 assert.match(html,/id="visualRedo"[^>]*disabled/);
 assert.match(scripts[1],/function moveHistory\(step\)/);
 assert.match(scripts[1],/history=history\.slice\(0,historyIndex\+1\)/);
 assert.match(scripts[1],/function resetHistory\(\)/);
 assert.match(scripts[1],/notify\(true,true\)/);
 assert.match(scripts[0],/clearHistoryOverrides=/);
 for(const script of scripts)assert.doesNotThrow(()=>new vm.Script(script));
});

test('A Vissza/Előre valódi, különálló rajzállapotokat tárol; új lépés törli az Előre ágat',()=>{
 const begin=scripts[1].indexOf(" let quiet=false,last=''"),
       end=scripts[1].indexOf(' function publishHeight(){',begin);
 assert.ok(begin>=0&&end>begin,'Hiányzó tényleges visszavonó motor');
 const callbacks={},buttons={visualUndo:{disabled:true},visualRedo:{disabled:true}};
 for(const [name,el] of Object.entries(buttons))
   el.addEventListener=(_name,fn)=>{callbacks[name]=fn;};
 const document={
   getElementById:id=>buttons[id]||null,
   addEventListener:(name,fn)=>{callbacks[name]=fn;}
 };
 const context={
   document,console,clearTimeout:()=>{},setTimeout:()=>0,
   window:{addEventListener:()=>{},parent:null,gatterkaCabinetDirectSave:()=>{}},
   Event:class Event{},
   snapshot:()=>({...context.state,parts:[]}),
   apply:({design})=>{context.state=JSON.parse(JSON.stringify(design));}
 };
 context.window.parent=context.window;
 context.window.GatterkaCabinetModel={clearHistoryOverrides:()=>{}};
 context.state={inputs:{h:'1500',count:'2'},radios:{drilling:'local'},
   custom:{'gap-0':'100'},visual:{edits:{'f-divider-1':{shift:0}}}};
 vm.createContext(context);
 vm.runInContext(scripts[1].slice(begin,end)+
  '\nresetHistory();this.getHistory=()=>({index:historyIndex,length:history.length});',context);
 assert.equal(buttons.visualUndo.disabled,true,'Kezdeti állapotnál nincs Vissza');
 context.state.visual.edits['f-divider-1'].shift=40;
 callbacks.change();
 assert.equal(context.getHistory().length,2);
 assert.equal(buttons.visualUndo.disabled,false);
 // A korábban rögzített objektum mutációja nem írhatja át a mentett állapotot.
 context.state.visual.edits['f-divider-1'].shift=70;
 callbacks.change();
 assert.equal(context.getHistory().length,3);
 callbacks.visualUndo();
 assert.equal(context.state.visual.edits['f-divider-1'].shift,40);
 callbacks.visualUndo();
 assert.equal(context.state.visual.edits['f-divider-1'].shift,0);
 callbacks.visualRedo();
 assert.equal(context.state.visual.edits['f-divider-1'].shift,40);
 context.state.inputs.count='3';
 callbacks.change();
 assert.equal(buttons.visualRedo.disabled,true,'Új szerkesztéskor nincs régi Előre');
 callbacks.visualUndo();
 assert.equal(context.state.inputs.count,'2','Pontosan az utolsó módosítás vonandó vissza');
 assert.equal(context.state.visual.edits['f-divider-1'].shift,40,'A korábbi rajzi állapot nem sérülhet');
});
