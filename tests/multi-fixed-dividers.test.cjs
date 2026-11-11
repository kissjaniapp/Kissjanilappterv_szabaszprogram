'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const fs=require('node:fs'),path=require('node:path');
const main=fs.readFileSync(path.join(__dirname,'..','app','index.htm'),'utf8');
const match=main.match(/const GATTERKA_CABINET_INLINE_HTML=("(?:\\.|[^"\\])*");/s);
assert.ok(match,'Hiányzó bútortervező');
const html=JSON.parse(match[1]);
const first=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0]?.[1];
assert.ok(first,'Hiányzó 3D program');
function section(a,b){
 const start=first.indexOf(a),end=first.indexOf(b,start);
 assert.ok(start>=0&&end>start,a+' hiányzik');
 return first.slice(start,end);
}
function setup(){
 const prefix='const fixedGaps=[],horizontalGaps=[],verticalGaps=[],fStarts=[],fEnds=[],vLefts=[],vRights=[];\n'+
  'const baseShelfBack=p=>p.rabbet?p.rabbetWidth:p.fullBack?p.t+p.fullBackSetback:0;\n'+
  'const shelfBackAt=(p,i)=>baseShelfBack(p);\n'+
  'const shelfFrontAt=(p,i)=>p.front;\n'+
  'const shelfDepthAt=(p,i)=>p.d-p.front-baseShelfBack(p);\n'+
  'const shelfAngleAt=i=>0;\n'+
  'const fmt=n=>String(n);\n';
 const code=prefix+
   section('function horizontalMembers(p){','function updateCustom(p){')+
   section('function fixedDividerPieces(p){','let currentParts=[]')+
   '\nthis.calc={pieces:fixedDividerPieces,list:getStructuredParts,horizontal:horizontalLayout,'+
   'positions:positions,gaps:calculateGaps,state:{fixedGaps,horizontalGaps,verticalGaps,fStarts,fEnds,vLefts,vRights}};';
 const context={};
 vm.runInNewContext(code,context);
 return context.calc;
}
function cabinet(other={}){
 return {w:1000,h:910,d:600,t:18,n:0,vCount:0,fCount:0,dividerThrough:'f',
  front:0,innerW:964,innerH:874,bodyBottomOffset:0,sideH:910,
  hasTop:true,hasBottom:true,falseBottom:false,top:'between',bottom:'between',
  rabbet:false,fullBack:false,fullBackSetback:0,backType:'none',hdfW:989,hdfH:899,
  topHdfDeduction:5.5,bottomHdfDeduction:5.5,drilling:'fixed',
  distribution:'equal',...other};
}
const by=(rows,kind)=>rows.filter(x=>x.kind===kind);
const close=(a,b)=>assert.ok(Math.abs(a-b)<.01,String(a)+' != '+String(b));
test('Régi polcok méretei változatlanok',()=>{
 const g=setup(),p=cabinet({n:3}),parts=g.pieces(p);
 assert.equal(parts.length,3);
 assert.deepEqual(Array.from(parts,x=>x.key),['shelf-1','shelf-2','shelf-3']);
 for(const shelf of parts){assert.equal(shelf.a,964);assert.equal(shelf.b,600);}
 assert.equal(g.list(p).filter(x=>x.key.startsWith('shelf-')).length,3);
});
test('F-osztó végig: egy F, két V fél, 18 mm osztóvastagság levonva',()=>{
 const g=setup(),p=cabinet({fCount:1,vCount:1,dividerThrough:'f'});
 const parts=g.pieces(p),f=by(parts,'f'),v=by(parts,'v');
 assert.equal(f.length,1);assert.equal(v.length,2);
 assert.equal(f[0].a,874);
 close(v[0].a,(964-18)/2);close(v[1].a,(964-18)/2);
});
test('V-osztó végig: egy V, két fél F',()=>{
 const g=setup(),p=cabinet({fCount:1,vCount:1,dividerThrough:'v'});
 const parts=g.pieces(p),f=by(parts,'f'),v=by(parts,'v');
 assert.equal(f.length,2);assert.equal(v.length,1);
 assert.equal(v[0].a,964);
 close(f[0].a,(874-18)/2);close(f[1].a,(874-18)/2);
});
test('Két F- és két V-osztó megfelelő darabszámmal és egyedi nevekkel',()=>{
 const g=setup(),p=cabinet({fCount:2,vCount:2,dividerThrough:'f'});
 let parts=g.pieces(p);
 assert.equal(by(parts,'f').length,2);assert.equal(by(parts,'v').length,6);
 p.dividerThrough='v';parts=g.pieces(p);
 assert.equal(by(parts,'v').length,2);assert.equal(by(parts,'f').length,6);
 assert.equal(new Set(Array.from(parts,x=>x.key)).size,parts.length);
});
test('Polcok és V-osztók azonos szabad hézagokat kapnak, egyedi közökkel',()=>{
 const g=setup(),p=cabinet({n:2,vCount:2,fCount:0});
 const items=g.horizontal(p),gap=(874-4*18)/5;
 assert.equal(items.length,4);
 for(let i=0;i<items.length;i++){
  const last=i?items[i-1].level+9:0;
  close(items[i].level-9-last,gap);
 }
 close(874-items.at(-1).level-9,gap);
 p.distribution='manual';
 g.state.horizontalGaps[0]=60;g.state.horizontalGaps[1]=120;
 const manual=g.horizontal(p);
 close(manual[0].level-9,60);
 close(manual[1].level-manual[0].level-18,120);
});
test('F-osztó két polc közé is helyezhető',()=>{
 const g=setup(),p=cabinet({n:2,vCount:1,fCount:1,dividerThrough:'v'});
 const positions=g.horizontal(p);
 g.state.fStarts[0]='shelf-0';g.state.fEnds[0]='shelf-1';
 const pieces=by(g.pieces(p),'f');
 assert.ok(pieces.length>=1);
 const first=positions.find(x=>x.kind==='shelf'&&x.index===0);
 const second=positions.find(x=>x.kind==='shelf'&&x.index===1);
 const low=18+first.level+9,high=18+second.level-9;
 assert.ok(pieces.every(x=>x.z1>=low-.01&&x.z2<=high+.01));
});
test('Egyedi F hézagok, mentési mezők, 3D polcdőlés iránya',()=>{
 const g=setup(),p=cabinet({fCount:2,vCount:1,n:1});
 g.state.verticalGaps[0]=75;
 const pieces=by(g.pieces(p),'f');
 close(pieces[0].x1-18,75);
 assert.match(html,/id="vCount"/);assert.match(html,/id="fCount"/);
 assert.match(html,/id="dividerCrossing"/);
 assert.match(html,/data-f-from/);assert.match(html,/data-f-to/);
 assert.match(html,/data-horizontal-gap/);
 assert.match(html,/const tilt=Math\.tan\(piece\.angle\*Math\.PI\/180\)\*\(y2-y1\)/);
 assert.match(html,/delta=-Math\.tan\(shelfAngleAt\(i\)\*Math\.PI\/180\)\*depthPx/);
 assert.match(html,/gatterka-designer-save/);
});

test('V-osztó két F-osztó közé rögzíthető, a szélessége a két F belső síkja',()=>{
 const g=setup(),p=cabinet({fCount:2,vCount:1,dividerThrough:'f'});
 g.state.vLefts[0]='f-0';g.state.vRights[0]='f-1';
 const f=by(g.pieces(p),'f'),v=by(g.pieces(p),'v');
 assert.equal(f.length,2);assert.equal(v.length,1);
 close(v[0].x1,f[0].x2);close(v[0].x2,f[1].x1);
 close(v[0].a,f[1].x1-f[0].x2);
});
test('V-osztó F és jobb oldallap, illetve bal oldallap és F között',()=>{
 const g=setup(),p=cabinet({fCount:1,vCount:1,dividerThrough:'f'});
 g.state.vLefts[0]='f-0';g.state.vRights[0]='right';
 let v=by(g.pieces(p),'v'),f=by(g.pieces(p),'f')[0];
 assert.equal(v.length,1);close(v[0].x1,f.x2);close(v[0].x2,p.w-p.t);
 g.state.vLefts[0]='left';g.state.vRights[0]='f-0';
 v=by(g.pieces(p),'v');f=by(g.pieces(p),'f')[0];
 assert.equal(v.length,1);close(v[0].x1,p.t);close(v[0].x2,f.x1);
});
test('F-osztó két V-osztó vagy polc és V-osztó között pontosan méretre áll',()=>{
 const g=setup(),p=cabinet({fCount:1,vCount:2,dividerThrough:'v'});
 g.state.fStarts[0]='v-0';g.state.fEnds[0]='v-1';
 let parts=g.pieces(p),f=by(parts,'f'),hs=g.horizontal(p);
 let low=hs.find(x=>x.kind==='v'&&x.index===0).level;
 let high=hs.find(x=>x.kind==='v'&&x.index===1).level;
 assert.equal(f.length,1);close(f[0].a,high-low-p.t);
 const p2=cabinet({fCount:1,vCount:1,n:1,dividerThrough:'v'});
 g.state.fStarts[0]='shelf-0';g.state.fEnds[0]='v-0';
 parts=g.pieces(p2);f=by(parts,'f');hs=g.horizontal(p2);
 low=hs.find(x=>x.kind==='shelf').level;high=hs.find(x=>x.kind==='v').level;
 assert.equal(f.length,1);close(f[0].a,high-low-p2.t);
});
test('Hibás vagy egymást megkerülő V-osztó csatlakozás nem ad gyártható elemet',()=>{
 const g=setup(),p=cabinet({fCount:2,vCount:1,dividerThrough:'f'});
 g.state.vLefts[0]='f-1';g.state.vRights[0]='f-0';
 const shapes=g.pieces(p);
 assert.equal(by(shapes,'v').length,0);
 assert.ok(shapes.connectionIssues.length>0);
 assert.equal(g.list(p)[0].ready,false);
});
test('V-osztó bal/jobb csatlakozások UI-ja és a visszamentés kulcsai szerepelnek',()=>{
 assert.match(html,/data-v-left/);
 assert.match(html,/data-v-right/);
 assert.match(html,/vLeft-.*vRight-|vLeft:'data-v-left'/s);
});

test('Az egyedi F-osztóhézagok nem engedhetnek kilógó harmadik F-osztót',()=>{
 const g=setup(),p=cabinet({fCount:3,vCount:0,dividerThrough:'f'});
 g.state.verticalGaps[0]=400;
 g.state.verticalGaps[1]=200;
 g.state.verticalGaps[2]=400; // a 3. hézag megegyezik az 1.-vel, de már nem fér el
 const pieces=g.pieces(p);
 assert.equal(by(pieces,'f').length,2,'csak a fizikailag beférő F-ek szerepelhetnek');
 assert.ok(pieces.connectionIssues.some(x=>/3/.test(x)),'egyértelmű hibajelzés kell');
 assert.ok(by(pieces,'f').every(x=>x.x1>=p.t-0.01&&x.x2<=p.w-p.t+0.01));
 assert.equal(g.list(p).find(x=>x.key==='side-left').ready,false,'hibás szerkezettel a CNC nem mehet');
});
test('Három egyforma, de beférő szabad F-hézag mindhárom F-et megtartja',()=>{
 const g=setup(),p=cabinet({fCount:3,vCount:0});
 g.state.verticalGaps[0]=160;
 g.state.verticalGaps[1]=160;
 g.state.verticalGaps[2]=160;
 const pieces=g.pieces(p);
 assert.equal(by(pieces,'f').length,3);
 assert.deepEqual(Array.from(pieces.connectionIssues),[]);
 assert.ok(by(pieces,'f').every(x=>x.x2<=p.w-p.t+0.01));
});
