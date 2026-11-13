'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const core=require('../machine/cnc-xxl.cjs');
const auto=require('../machine/cnc-auto.cjs');
const source=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
const matched=source.match(/const GATTERKA_CABINET_INLINE_HTML=("(?:\\.|[^"\\])*");/s);
assert.ok(matched,'A bútortervező HTML-je hiányzik');
const html=JSON.parse(matched[1]);
const first=html.indexOf('function cncSupportRegions(p,boards,which){');
const last=html.indexOf('// Az egyedi polctartó-furatok',first);
assert.ok(first>=0&&last>first,'REF-polcfúrási geometria hiányzik');
const ctx={baseShelfBack:()=>0};
vm.createContext(ctx);
vm.runInContext(html.slice(first,last)+'\nthis.support=cncSupportRegions;',ctx);
const base={w:1000,h:900,d:600,t:18,bodyBottomOffset:0,
 hasTop:true,hasBottom:true,top:'between',bottom:'between',
 drilling:'full',cncGapBottom:0,cncGapTop:0,cncGapDivider:0,
 raster:32,supportInset:50,front:0};
function section(p,boards=[]){
 const result=ctx.support({...base,...p},boards,'left');
 assert.deepEqual(Array.from(result.issues),[]);
 return Array.from(result.segments,x=>({...x,Y:Array.from(x.Y)}));
}
test('Közémenő fenék: DX a tető/fenék szabad köze; BX a fenéklap 18 mm vastagsága',()=>{
 const parts=section({});
 assert.equal(parts.length,1);
 assert.deepEqual(parts[0],{index:0,DX:864,BX:18,Y:[50,550],Q:0,s:32});
});
test('Fenék alul végig: DX változatlan szabad köz, BX paraméter teljesen elmarad',()=>{
 const parts=section({bottom:'full'});
 assert.equal(parts.length,1);
 assert.equal(parts[0].DX,864);
 assert.ok(!Object.prototype.hasOwnProperty.call(parts[0],'BX'));
 assert.deepEqual(parts[0].Y,[50,550]);
});
test('18 mm helyett a kiválasztott anyagvastagság határozza meg a BX és DX értékeket',()=>{
 const parts=section({t:20});
 assert.equal(parts[0].BX,20);
 assert.equal(parts[0].DX,860);
 const full=section({t:20,bottom:'full'});
 assert.equal(full[0].DX,860);
 assert.equal(full[0].BX,undefined);
});
test('Pótfenékkel a bútor aljától számított oldallapi eredet következetes',()=>{
 const between=section({bodyBottomOffset:18});
 assert.equal(between[0].BX,18);
 assert.equal(between[0].DX,846);
 const full=section({bottom:'full',bodyBottomOffset:18});
 assert.equal(full[0].BX,undefined);
 assert.equal(full[0].DX,846);
});
test('V-osztóval több REF szakasz: minden BX az oldallap alsó nullahelyétől mér',()=>{
 const blocks=[{kind:'v',x1:18,x2:982,z1:350,z2:368,y0:0,y1:600}];
 const seg=section({},blocks);
 assert.equal(seg.length,2);
 assert.deepEqual(seg.map(s=>[s.BX,s.DX]),[[18,332],[368,514]]);
 const full=section({bottom:'full'},blocks);
 assert.equal(full[0].BX,undefined);
 assert.equal(full[0].DX,332);
 assert.equal(full[1].BX,350);
 assert.equal(full[1].DX,514);
});
test('Xilog REF BX opcionális; explicit régi BX=0 továbbra is támogatott',()=>{
 for(const [op,line] of [
  [{macro:'REF',DX:864},'REF DX=864'],
  [{macro:'REF',DX:864,BX:18},'REF DX=864 BX=18'],
  [{macro:'REF',DX:864,BX:0},'REF DX=864 BX=0']
 ]){
  assert.equal(auto.macroLine(op,{}),line);
  const program=core.compileXxl({dx:900,dy:600,dz:18,side:'IJ',commands:[
   'LAPA X=100 Y=0 A=0 y=600 G=1',line,
   'POLC Y=50 Q=0# s=32 G=1# F=1','REF'
  ].join('\n')});
  assert.match(program,new RegExp(line+'\\r\\nPOLC Y=50 Q=0# s=32 G=1# F=1\\r\\nREF'));
 }
 assert.throws(()=>core.compileXxl({dx:900,dy:600,dz:18,
  commands:'LAPA X=100 Y=0 A=0 y=600 G=1\nREF DX=890 BX=18\nPOLC Y=50 Q=0# s=32 G=1# F=1\nREF'}),/REF szakasz/);
});
test('A REF-polcfúrás változása nem módosítja a már bevált FORDIT sorrendet',()=>{
 const prog=auto.compileEntry({dx:900,dy:600,dz:18,issues:[],side:'IJ',
 operations:[
  {macro:'LAPA',X:100,Y:0,y:600,face:'primary'},
  {macro:'REF',DX:864,BX:18,face:'primary'},
  {macro:'POLC',Y:50,Q:0,s:32,face:'primary'},
  {macro:'REF',face:'primary'},
  {macro:'ELF3',Y:0,y:600,face:'reverse'}
 ]},{assemblyJoint:'excenter'});
 assert.match(prog,/REF DX=864 BX=18\r\nPOLC Y=50 Q=0# s=32 G=1# F=1\r\nREF\r\n;\r\nVEGE\r\nXMSG Q=1 N="FORDIT"/);
});
