'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const cnc=require('../machine/cnc-auto.cjs');
const source=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
const token='const GATTERKA_CABINET_INLINE_HTML=';
const p=source.indexOf(token),s=source.indexOf('"',p);
const e=source.indexOf('";\n\n  function syncCabinetDesignerTheme',s);
assert.ok(p>=0&&s>=0&&e>=s,'A bútortervező kódja hiányzik');
const designer=JSON.parse(source.slice(s,e+1));
const a=designer.indexOf('function cncSupportRegions(p,boards,which){');
const b=designer.indexOf('function getStructuredParts(p){',a);
assert.ok(a>=0&&b>a);
const context={boards:[]};
vm.createContext(context);
vm.runInContext('function fixedDividerPieces(){return boards;}'+
 'function baseShelfBack(){return 0;}\n'+designer.slice(a,b)+'\n'+
 'this.runCnc=buildCncInstancesForParts;',context);
function fixture(options={}){
 const t=options.t??18,sideH=options.sideH??900;
 const top=options.top??'between',bottom=options.bottom??'between';
 const bodyBottomOffset=options.bodyBottomOffset??0;
 const h=sideH+bodyBottomOffset+(top==='full'?t:0)+(bottom==='full'?t:0);
 return {w:1000,h,d:600,t,sideH,innerW:1000-2*t,
  bodyBottomOffset,hasTop:true,hasBottom:true,top,bottom,
  drilling:options.drilling??'full',raster:32,holes:3,supportInset:50,front:0,
  cncGapBottom:0,cncGapTop:0,cncGapDivider:0,hasLegs:false,
  falseBottom:options.falseBottom??false,rabbet:false,topHdfCut:'trim',
  bottomHdfCut:'trim',...options};
}
function generated(p,boards){
 context.boards=boards;
 const rows=[{key:'side-left',sourceKeys:['side-left','side-right']},
  {key:'top'},{key:'bottom'},
  ...(boards.some(x=>x.key==='f-divider-1')?[{key:'f-divider-1'}]:[])];
 context.runCnc(p,rows);
 return JSON.parse(JSON.stringify(rows));
}
function exportRows(p,rows){
 const parts=rows.map(row=>{
  const entry=row.cncInstances[0];
  return {id:row.key,cabinetDesignKey:row.key,name:row.key,
    a:String(entry.dx),b:String(entry.dy),q:'1',cncInstances:row.cncInstances,
    cabinetCncUnverified:true};
 });
 return cnc.makeAutoPrograms({name:'Teszt',parts},parts.map(x=>x.id));
}
test('Közémenő tető/fenék + F-osztó: minden CNC fájl kijön, top LAPA fél vastagság',()=>{
 const p=fixture({drilling:'full'});
 const f={key:'f-divider-1',kind:'f',name:'F-osztó',index:0,
  x1:491,x2:509,z1:18,z2:882,y0:0,y1:600,a:864,b:600};
 const rows=generated(p,[f]);
 const output=exportRows(p,rows);
 assert.deepEqual(output.blocked,[],JSON.stringify(output.blocked));
 assert.equal(output.files.length,5,'Bal és jobb oldal, tető, fenék és F-osztó CNC');
 for(const key of ['side-left','side-right','top','bottom','f-divider-1'])
  assert.ok(output.files.some(x=>x.filename.includes('_'+key+'.xxl')),
   'Hiányzó CNC-program: '+key);
 const side=rows[0].cncInstances[0];
 assert.ok(side.operations.some(op=>op.macro==='LAPA'&&op.X===9&&op.Y===0),
  'A tető furata 18/2 mm-re van a felső éltől');
 assert.ok(side.operations.some(op=>op.macro==='LAPA'&&op.X===891&&op.Y===0),
  'A fenék furata nem kerülhet a tetőhöz');
 const fCnc=rows[3].cncInstances[0];
 assert.ok(fCnc.operations.some(op=>op.macro==='ELF3'),'F felső csatlakozás');
 assert.ok(fCnc.operations.some(op=>op.macro==='ELF2'),'F alsó csatlakozás');
 assert.ok(output.warnings.some(x=>/belső polctartó/.test(x.reason)),
  'A még hiányzó F-belső polctartót valós figyelmeztetés jelzi');
});
test('Végigmenő fenék pótfenékkel: fenék meglévő CNC-je nem tiltható',()=>{
 const p=fixture({bottom:'full',falseBottom:true,bodyBottomOffset:18,
  drilling:'fixed'});
 const rows=generated(p,[]);
 const bottom=rows.find(x=>x.key==='bottom').cncInstances[0];
 assert.deepEqual(bottom.issues,[]);
 assert.ok(bottom.operations.some(x=>x.macro==='LAPA'));
 const result=exportRows(p,rows);
 assert.deepEqual(result.blocked,[],JSON.stringify(result.blocked));
 assert.ok(result.files.some(x=>x.filename.endsWith('_bottom.xxl')),
  'A végigmenő fenék külön XXL programját is menteni kell');
});
test('A tető CNC makrói és a lapok megmunkálási sorrendje változatlan',()=>{
 const p=fixture({drilling:'fixed'});
 const rows=generated(p,[]);
 const top=rows.find(x=>x.key==='top').cncInstances[0];
 const bottom=rows.find(x=>x.key==='bottom').cncInstances[0];
 assert.deepEqual(top.operations.map(x=>x.macro),['ELF3','ELF2']);
 assert.deepEqual(bottom.operations.map(x=>x.macro),['ELF3','ELF2']);
 const result=exportRows(p,rows);
 assert.equal(result.files.length,4);
});
