'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const app=fs.readFileSync(path.join(__dirname,'..','app','index.htm'),'utf8');
const packed=app.match(/const GATTERKA_CABINET_INLINE_HTML=("(?:\\.|[^"\\])*");/s);
assert.ok(packed,'Hiányzó beágyazott bútortervező');
const html=JSON.parse(packed[1]);
const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]);
assert.equal(scripts.length,2);
const first=scripts[0];
function section(a,b){const i=first.indexOf(a),j=first.indexOf(b,i+a.length);
 assert.ok(i>=0&&j>i,'Hiányzó kódrész '+a);return first.slice(i,j);}
function geometry(){
 const ctx={};
 vm.runInNewContext(
 'let visualEdited=true,visualMaskF=[],visualMaskH={},visualPieceEdits={};\n'+
 'function visualMaskValue(axis,key,index){const arr=axis==="f"?visualMaskF[Number(key)]:visualMaskH[String(key)];return !Array.isArray(arr)||arr[index]!==false;}\n'+
 section('function visualApplyParts(p,base,layout){','const DEFAULTS=')+
 '\nthis.apply=visualApplyParts;this.setMasks=(f,h)=>{visualMaskF=f;visualMaskH=h;};this.setEdits=v=>{visualPieceEdits=v;};',ctx);
 return ctx;
}
function board(kind){return {key:kind==='f'?'f-divider-1':'v-divider-1',name:kind==='f'?'F-osztó 1':'V-osztó 1',
 kind,index:0,x1:kind==='f'?491:18,x2:kind==='f'?509:982,y0:0,y1:450,
 z1:kind==='f'?18:491,z2:kind==='f'?892:509,a:kind==='f'?874:964,b:450,thickness:18};}
function base(b){const arr=[b];arr.connectionIssues=[];return arr;}
const p={w:1000,h:910,d:450,t:18};
test('A bontott F-osztó két külön darabja egymástól függetlenül húzható',()=>{
 const g=geometry(),layout={horizontals:[{kind:'v',index:0,z:300},{kind:'v',index:1,z:600}],
 f:[{center:500}],x0:18,x3:982,z0:18,z3:892};
 g.setMasks([[true,false,true]],{});g.setEdits({'f-divider-1-cut-2':{shift:60}});
 const out=g.apply(p,base(board('f')),layout);
 assert.equal(out.length,2);assert.equal(out[0].key,'f-divider-1');
 assert.equal(out[1].key,'f-divider-1-cut-2');
 assert.equal(out[0].x1,491);assert.equal(out[1].x1,551);
 assert.equal(out[0].z2,291);assert.equal(out[1].z1,609);
 assert.ok(out.connectionIssues.length>0);
});
test('A bontott V-osztó két külön darabja egymástól függetlenül húzható',()=>{
 const g=geometry(),layout={horizontals:[{kind:'v',index:0,z:500}],
 f:[{center:300},{center:600}],x0:18,x3:982,z0:18,z3:892};
 g.setMasks([] ,{'v-0':[true,false,true]});g.setEdits({'v-divider-1-cut-2':{shift:-40}});
 const out=g.apply(p,base(board('v')),layout);
 assert.equal(out.length,2);assert.equal(out[0].x2,291);assert.equal(out[1].x1,609);
 assert.equal(out[0].z1,491);assert.equal(out[1].z1,451);
 assert.ok(out.connectionIssues.length>0);
});
test('Az új fogantyú a tényleges külön elhúzott darabot követi',()=>{
 assert.match(first,/data-vis-part/);
 assert.match(first,/visualSegmentAt\(part,world,visualLayout\(read\(\)\)\)/);
 assert.match(first,/visualSelected=part\.key/);
 assert.match(first,/visualEditingMode\(\)==='row'/);
 assert.match(first,/data-vis-end/);
});
function readFixture(){
 const ctx={values:{w:1000,h:1500,d:450,t:18,count:0,vCount:0,fCount:0,
  frontSetback:0,vSetback:0,fSetback:0,supportInset:50,raster:32,holes:3,rabbetWidth:4},
  flags:{hasBottom:true,hasTop:true,hasLegs:true,falseBottom:false}};
 const prefix=
  'const $=id=>({value:values[id]??(id==="shelfBias"?"below":0),checked:!!flags[id]});\n'+
  'const safe=(id,min,max)=>Math.max(min,Math.min(max,Number(values[id]??min)));\n'+
  'const choice=name=>({bottom:"between",top:"between",dividerThrough:"f",drilling:"fixed",distribution:"equal",backType:"none"})[name];\n'+
  'const shelfAngleAt=()=>0,shelfDepthAt=()=>450,baseShelfBack=()=>0,choiceHdfCut=()=>"falc";\n';
 vm.runInNewContext(prefix+section('function read(){','function adjustFixed(p,reset=false){')+
 '\nthis.readCabinet=read;',ctx);
 return ctx;
}
test('A láb 100 mm-rel növeli a teljes H-t, a test és az alkatrészek magasságát nem',()=>{
 const ctx=readFixture();let c=ctx.readCabinet();
 assert.equal(c.hasLegs,true);assert.equal(c.legHeight,100);
 assert.equal(c.overallH,1600);assert.equal(c.h,1500);assert.equal(c.sideH,1500);
 ctx.flags.hasLegs=false;c=ctx.readCabinet();
 assert.equal(c.overallH,1500);assert.equal(c.legHeight,0);assert.equal(c.sideH,1500);
 ctx.flags.hasLegs=true;ctx.flags.hasBottom=false;c=ctx.readCabinet();
 assert.equal(c.hasLegs,false);assert.equal(c.overallH,1500);
});
test('Elöl, oldalnézeten, nagy rajzon és 3D-ben a 28×28×100 mm lábak közepe 59 mm',()=>{
 assert.match(html,/id="hasLegs"/);
 assert.match(first,/for\(const cx of \[59,p\.w-59\]\)/);
 assert.match(first,/for\(const cy of \[59,p\.d-59\]\)/);
 assert.match(first,/board\(cx-14,cx\+14,cy-14,cy\+14,-100,0,legMat\)/);
 assert.match(first,/bar\(cx-14,-100,0,28/);
 assert.match(first,/rect\(sideX\+\(cy-14\)\*sd,fullBottom,28\*sd,100\*s/);
});
test('Az új szerkesztő a tető és fenék közé menő vagy végigmenő módját leköveti',()=>{
 assert.match(first,/p\.top==='between'\?p\.t:0/);
 assert.match(first,/p\.bottom==='between'\?p\.t:0/);
 assert.match(first,/p\.bottom==='full'\?p\.t:0/);
 assert.match(first,/p\.top==='full'\?p\.t:0/);
});
test('A láb nem alkatrész, a hiányzó LAB-CNC makró exportját megtiltjuk',()=>{
 const parts=section('function getStructuredParts(p){','let currentParts=[]');
 assert.doesNotMatch(parts,/\bhasLegs\b|\blegHeight\b|\bLAB\b/);
 assert.match(first,/A 4 bútorláb LAB-furata \(59 × 59 mm\)/);
 assert.match(first,/még nincs hitelesített Xilog makróval megvalósítva/);
 assert.match(first,/\?make\('false-bottom','Pótfenék'/);
});
test('A beágyazott JS szintaktikailag helyes',()=>{
 for(const code of scripts)assert.doesNotThrow(()=>new vm.Script(code));
});
