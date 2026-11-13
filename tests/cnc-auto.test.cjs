'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const auto=require('../machine/cnc-auto.cjs');
const raw=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
function extractedGeometry(){
  const token='const GATTERKA_CABINET_INLINE_HTML=';
  const start=raw.indexOf(token),first=raw.indexOf('"',start);
  const next=raw.indexOf('function syncCabinetDesignerTheme()',first);
  const last=raw.lastIndexOf('";',next);
  assert.ok(start>=0&&first>=0&&last>first);
  const html=JSON.parse(raw.slice(first,last+1));
  const a=html.indexOf('function cncSupportRegions(p,boards,which){');
  const b=html.indexOf('function getStructuredParts(p){',a);
  assert.ok(a>=0&&b>a,'A CNC-szerkezeti geometria hiányzik a tervezőből');
  const ctx={fixedDividerPieces:()=>[],baseShelfBack:()=>4};
  vm.createContext(ctx);
  vm.runInContext(html.slice(a,b),ctx);
  return {ctx,html};
}
function base(){
  return {w:1000,h:1500,d:400,t:18,sideH:1500,innerW:964,
    hasTop:true,hasBottom:true,top:'between',bottom:'between',
    bodyBottomOffset:0,rabbet:true,fullBack:false,rabbetWidth:4,
    hdfThickness:4,front:0,vSetback:0,fSetback:0,drilling:'fixed'};
}
function board(key,name,a,b,cncInstances,extra={}){
  return {id:key,cabinetDesignKey:key,name,a:String(a),b:String(b),
    cncInstances,...extra};
}
test('a bútortervező valódi csatlakozási helyeket ad a két külön oldallapnak és a polcnak',()=>{
  const {ctx}=extractedGeometry(),p=base();
  ctx.fixedDividerPieces=()=>[{
    key:'shelf-1',name:'Polc 1',kind:'shelf',index:0,
    x1:18,x2:982,y0:0,y1:396,z1:600,z2:618,a:964,b:396,
    angle:0,undercutDegrees:0
  }];
  const records=[
    {key:'side-left',sourceKeys:['side-left','side-right']},
    {key:'top'},{key:'bottom'},{key:'shelf-1'}
  ];
  ctx.buildCncInstancesForParts(p,records);
  const side=records[0].cncInstances,shelf=records[3].cncInstances[0];
  assert.equal(side.length,2);
  assert.equal(side[0].side,'IJ');
  assert.equal(side[1].side,'LK');
  assert.ok(side[0].operations.some(op=>op.macro==='LAPA'&&op.X===891&&op.Y===0&&op.y===396));
  assert.deepEqual(Array.from(shelf.operations,op=>op.macro),['ELF3','ELF2']);
  const parts=[
    board('sides','Oldal',1500,400,side),
    board('top','Tető',964,400,records[1].cncInstances),
    board('bottom','Fenék',964,400,records[2].cncInstances),
    board('shelf','Polc 1',964,396,records[3].cncInstances)
  ];
  const result=auto.makeAutoPrograms({name:'Konyha',parts},parts.map(p=>p.id));
  assert.equal(result.blocked.length,0);
  assert.equal(result.files.length,5,'két oldal és három további lap külön CNC fájl');
  assert.equal(new Set(result.files.map(x=>x.filename)).size,5);
  const left=result.files.find(f=>f.filename.includes('side-left'));
  const right=result.files.find(f=>f.filename.includes('side-right'));
  const shelfFile=result.files.find(f=>f.filename.includes('shelf-1'));
  assert.match(left.content,/-IL C=0 T=16973825/);
  assert.match(right.content,/-LI C=0 T=16973825/);
  assert.match(left.content,/LAPA X=891 Y=0 A=0 y=396 G=1/);
  assert.match(shelfFile.content,/ELF3 Y=0 A=0 y=396 G=1/);
  assert.match(shelfFile.content,/ELF2 Y=0 A=0 y=396 G=1/);
});
test('Bútorlábnál a kijelölt tartólap négy LAB furata és az oldalak menthetők',()=>{
  const {ctx}=extractedGeometry();
  for(const falseBottom of [false,true]){
    const p={...base(),hasLegs:true,falseBottom,bottom:'between'};
    ctx.fixedDividerPieces=()=>[];
    const records=[{key:'side-left',sourceKeys:['side-left','side-right']},
      {key:'top'},{key:'bottom'},...(falseBottom?[{key:'false-bottom'}]:[])];
    ctx.buildCncInstancesForParts(p,records);
    const sides=records[0].cncInstances;
    assert.equal(sides.length,2);
    assert.equal(sides[0].issues.length,0,'A LAB nem a bal oldallapot tiltja');
    assert.equal(sides[1].issues.length,0,'A LAB nem a jobb oldallapot tiltja');
    const target=records.find(x=>x.key===(falseBottom?'false-bottom':'bottom'));
    assert.equal(target.cncInstances[0].operations.filter(o=>o.macro==='LAB').length,4);
    const parts=records.map(row=>{
      const entry=row.cncInstances[0];
      return board(row.key,row.key,entry.dx,entry.dy,row.cncInstances);
    });
    const out=auto.makeAutoPrograms({name:'LAB teszt',parts},parts.map(x=>x.id));
    assert.ok(out.files.some(x=>x.filename.includes('side-left')),
      'A hiteles bal oldal CNC-programjának menthetőnek kell maradnia');
    assert.ok(out.files.some(x=>x.filename.includes('side-right')),
      'A hiteles jobb oldal CNC-programjának menthetőnek kell maradnia');
    assert.ok(out.files.some(x=>(x.content.match(/LAB X=/g)||[]).length===4),
      'A tartólap négy LAB furata ténylegesen a mentett programba kerül');
  }
});
test('Végigmenő fenék mellett a pótfenék kapja mind a négy LAB furatot',()=>{
 const {ctx}=extractedGeometry(),p={...base(),hasLegs:true,falseBottom:true,bottom:'full'};
 ctx.fixedDividerPieces=()=>[];
 const records=[{key:'side-left',sourceKeys:['side-left','side-right']},
   {key:'top'},{key:'bottom'},{key:'false-bottom'}];
 ctx.buildCncInstancesForParts(p,records);
 assert.equal(records.find(r=>r.key==='bottom').cncInstances[0].operations.filter(o=>o.macro==='LAB').length,0);
 assert.equal(records.find(r=>r.key==='false-bottom').cncInstances[0].operations.filter(o=>o.macro==='LAB').length,4);
});

test('F-osztó csatlakozásánál a megfelelő makró saját G kódja automatikus',()=>{
  const part=board('f','F-osztó',700,400,[{
    key:'f-divider-1',dx:700,dy:400,dz:18,side:'IJ',operations:[
      {macro:'LAPA',X:100,Y:0,y:400,joint:'divider',face:'primary'},
      {macro:'ELF3',Y:0,y:400,joint:'divider',face:'primary'}
    ]
  }]);
  for(const [mode,face,edge] of [
    ['tipli',0,0],['excenter',1,1],['csavar',2,0],['hosszuExcenter',1,2]
  ]){
    const r=auto.makeAutoPrograms({name:'Szekrény',parts:[part]},['f'],{dividerJoint:mode});
    assert.equal(r.blocked.length,0,mode);
    assert.match(r.files[0].content,new RegExp('LAPA X=100 Y=0 A=0 y=400 G='+face));
    assert.match(r.files[0].content,new RegExp('ELF3 Y=0 A=0 y=400 G='+edge));
  }
});
test('kétoldalas csatlakozás FORDIT után a második oldalon folytatódik',()=>{
  const part=board('v','V-osztó',964,464,[{
    key:'v-divider-1',dx:964,dy:464,dz:18,operations:[
      {macro:'LAPA',X:509,Y:0,y:464,joint:'divider',face:'primary'},
      {macro:'LAPA',X:482,Y:0,y:464,joint:'divider',face:'reverse'}
    ]
  }]);
  const r=auto.makeAutoPrograms({name:'Test',parts:[part]},['v'],{dividerJoint:'csavar'});
  assert.equal(r.blocked.length,0);
  assert.match(r.files[0].content,/LAPA X=509 Y=0 A=0 y=464 G=2\r\n;\r\nVEGE\r\nXMSG Q=1 N="FORDIT"\r\n;\r\nLAPA X=482 Y=0 A=0 y=464 G=2/);
});
test('a hibás/hiányzó geometria, ferde polc és a kézzel átírt méret nem jut ki a CNC-re',()=>{
  const entry={key:'shelf-1',dx:964,dy:396,dz:18,operations:[
    {macro:'ELF3',Y:0,y:396,joint:'fixed'}
  ]};
  const parts=[
    board('a','Eltérő méret',964,390,[entry]),
    board('b','Ferde',964,396,[entry],{shelfBevelDegrees:25}),
    board('c','Nincs geometria',900,400,[]),
    board('d','Teli hátlap',964,900,[])
  ];
  parts[3].cabinetDesignKey='back-full';
  const r=auto.makeAutoPrograms({name:'Test',parts},parts.map(p=>p.id));
  assert.equal(r.files.length,0);
  assert.equal(r.blocked.length,3);
  assert.equal(r.skipped.length,1);
});
test('ismeretlen vagy túllógó CNC makró nem menthető, külső 3MF import nem kap automatikus programot',()=>{
  const p=board('a','Oldal',1500,400,[{
    key:'side-left',dx:1500,dy:400,dz:18,
    operations:[{macro:'LAPA',X:1501,Y:0,y:400,joint:'fixed'}]
  }]);
  const other=board('b','3MF alkatrész',1500,400,[{
    key:'side-right',dx:1500,dy:400,dz:18,
    operations:[{macro:'LAPA',X:100,Y:0,y:400,joint:'fixed'}]
  }],{threeMfGenerated:true});
  const r=auto.makeAutoPrograms({name:'Test',parts:[p,other]},['a','b']);
  assert.equal(r.files.length,0);
  assert.equal(r.blocked.length,2);
});

test('REF: 1500-as oldallapnál a 609 mm magasságú V-osztó alul BX=0 DX=600',()=>{
 const {ctx}=extractedGeometry(),p={...base(),
   hasTop:false,hasBottom:false,bodyBottomOffset:0,sideH:1500,
   drilling:'full',raster:32,supportInset:50,
   cncGapBottom:0,cncGapTop:0,cncGapDivider:0,
   distribution:'equal'
 };
 const boards=[{key:'v-divider-1',kind:'v',x1:18,x2:982,
   z1:600,z2:618,y0:0,y1:396,index:0}];
 const result=ctx.cncSupportRegions(p,boards,'left');
 assert.equal(result.issues.length,0);
 assert.equal(result.segments.length,2);
 assert.equal(result.segments[0].BX,0);
 assert.equal(result.segments[0].DX,600);
 assert.equal(result.segments[1].BX,618);
 assert.equal(result.segments[1].DX,882);
 assert.deepEqual(Array.from(result.segments[0].Y),[50,346]);
 assert.equal(result.segments[0].Q,0);
});
test('két V-osztó három független REF szakaszt készít, a 3 távolságkülön engedélyezett',()=>{
 const {ctx}=extractedGeometry(),p={...base(),
   hasTop:false,hasBottom:false,sideH:1500,drilling:'full',
   raster:32,supportInset:50,
   cncGapBottom:20,cncGapTop:40,cncGapDivider:16
 };
 const boards=[
  {kind:'v',index:0,x1:18,x2:982,z1:600,z2:618},
  {kind:'v',index:1,x1:18,x2:982,z1:1000,z2:1018}
 ];
 const {segments,issues}=ctx.cncSupportRegions(p,boards,'right');
 assert.equal(issues.length,0);
 assert.deepEqual(Array.from(segments,s=>[s.BX,s.DX]),[
   [20,564],[634,350],[1034,426]
 ]);
});
test('Q=0 végigfúrást, Q>0 a rekeszbe eső polcszámot jelenti; a REF és POLC nem írja át a kötés G kódját',()=>{
 const {ctx}=extractedGeometry(),p={...base(),
   hasTop:false,hasBottom:false,sideH:1500,drilling:'local',
   distribution:'equal',raster:32,supportInset:50,
   cncGapBottom:0,cncGapTop:0,cncGapDivider:0
 };
 const boards=[
   {kind:'v',index:0,x1:18,x2:982,z1:600,z2:618},
   {kind:'shelf',index:0,x1:18,x2:982,z1:291,z2:309,y0:0,y1:396},
   {kind:'shelf',index:1,x1:18,x2:982,z1:998,z2:1016,y0:0,y1:396}
 ];
 const regions=ctx.cncSupportRegions(p,boards,'left');
 assert.equal(regions.issues.length,0);
 assert.deepEqual(Array.from(regions.segments,s=>s.Q),[1,1]);
 const core=require('../machine/cnc-xxl.cjs');
 const entry={dx:1500,dy:400,dz:18,side:'IJ',operations:[
   {macro:'LAPA',X:609,Y:0,y:396,joint:'fixed'},
   {macro:'REF',DX:600,BX:0},
   {macro:'POLC',Y:50,Q:0,s:32},
   {macro:'POLC',Y:346,Q:0,s:32},
   {macro:'REF'},
   {macro:'REF',DX:882,BX:618},
   {macro:'POLC',Y:50,Q:2,s:32},
   {macro:'POLC',Y:346,Q:2,s:32},
   {macro:'REF'}
 ]};
 const text=auto.compileEntry(entry,{assemblyJoint:'csavar'});
 assert.match(text,/LAPA X=609 Y=0 A=0 y=396 G=2/);
 assert.match(text,/REF DX=600 BX=0\r\nPOLC Y=50 Q=0# s=32 G=1# F=1/);
 assert.match(text,/REF DX=882 BX=618\r\nPOLC Y=50 Q=2# s=32 G=1# F=1/);
 assert.match(text,/REF\r\n;\r\nVEGE\r\n$/);
 assert.throws(()=>core.compileXxl({dx:1500,dy:400,dz:18,commands:'REF DX=1200 BX=500\nPOLC Y=50 Q=0# s=32 G=1# F=1\nREF'}));
});
test('egyedi polcmagasságot nem cserél fel automatikus, egyenletes POLC Q megmunkálásra',()=>{
 const {ctx}=extractedGeometry(),p={...base(),hasTop:false,hasBottom:false,
   drilling:'local',distribution:'manual',cncGapBottom:0,
   cncGapTop:0,cncGapDivider:0,raster:32,supportInset:50};
 const boards=[{kind:'shelf',index:0,x1:18,x2:982,z1:300,z2:318,y0:0,y1:396}];
 const r=ctx.cncSupportRegions(p,boards,'left');
 assert.equal(r.segments.length,0);
 assert.match(r.issues.join(' '),/nem egyenletes polcmagasság/);
});

test('egyedileg pozicionált V-osztó mellett a REF Q=1 működik, ha a polc a saját rekeszének közepén van',()=>{
 const {ctx}=extractedGeometry(),p={...base(),
   hasTop:false,hasBottom:false,sideH:1500,
   drilling:'local',distribution:'manual',cncGapBottom:0,
   cncGapTop:0,cncGapDivider:0,raster:32,supportInset:50
 };
 const boards=[
   {kind:'v',index:0,x1:18,x2:982,z1:600,z2:618},
   {kind:'shelf',index:0,x1:18,x2:982,z1:291,z2:309,y0:0,y1:396},
   {kind:'shelf',index:1,x1:18,x2:982,z1:1050,z2:1068,y0:0,y1:396}
 ];
 // Alsó közép 300 mm, felső közép: (618+1500)/2=1059 mm.
 const v=ctx.cncSupportRegions(p,boards,'left');
 assert.equal(v.issues.length,0);
 assert.deepEqual(Array.from(v.segments,s=>[s.BX,s.DX,s.Q]),[[0,600,1],[618,882,1]]);
});

test('állítható polc kizárólag polctartót kap: nincs mellette fix LAPA/ELF kötésfurat',()=>{
 const {ctx}=extractedGeometry(),p={...base(),drilling:'full',n:1,vCount:1,
   raster:32,supportInset:50,cncGapBottom:0,cncGapTop:0,cncGapDivider:0};
 const v={key:'v-divider-1',name:'V-osztó',kind:'v',index:0,
   x1:18,x2:982,y0:0,y1:396,z1:600,z2:618,a:964,b:396,
   undercutDegrees:0};
 const shelf={key:'shelf-1',name:'Állítható polc',kind:'shelf',index:0,
   x1:18,x2:982,y0:0,y1:396,z1:250,z2:268,a:964,b:396,
   undercutDegrees:0};
 ctx.fixedDividerPieces=()=>[v,shelf];
 const records=[{key:'side-left',sourceKeys:['side-left','side-right']},
   {key:'shelf-1'},{key:'v-divider-1'}];
 ctx.buildCncInstancesForParts(p,records);
 const side=records[0].cncInstances[0],support=records[1].cncInstances[0];
 assert.equal(support.noCnc,true);
 assert.equal(support.operations.length,0);
 assert.equal(side.operations.some(o=>o.macro==='LAPA'&&o.X===1241),false,
   'Az állítható polc középvonalán nem lehet fix kötésfurat');
 assert.equal(side.operations.filter(o=>o.macro==='REF'&&o.DX).length,2);
 assert.equal(side.operations.filter(o=>o.macro==='POLC').length,4);
 const onlyShelf=auto.makeAutoPrograms({name:'Test',parts:[
   board('s','Állítható polc',964,396,[support])
 ]},['s'],{assemblyJoint:'excenter'});
 assert.equal(onlyShelf.files.length,0);
 assert.equal(onlyShelf.blocked.length,0);
 assert.equal(onlyShelf.skipped.length,1);
});
test('állítható polc + F-osztó találkozásánál a belső polctartómakró hiányát jelzi',()=>{
 const {ctx}=extractedGeometry(),p={...base(),drilling:'full',n:1,
    fCount:1,raster:32,supportInset:50,cncGapBottom:0,
    cncGapTop:0,cncGapDivider:0};
 ctx.fixedDividerPieces=()=>[{key:'f-divider-1',name:'F-osztó',kind:'f',
   index:0,x1:491,x2:509,y0:0,y1:396,z1:18,z2:1482,a:1464,b:396}];
 const records=[{key:'f-divider-1'}];ctx.buildCncInstancesForParts(p,records);
 const entry=records[0].cncInstances[0];
 assert.match(entry.issues.join(' '),/F-osztó oldalainak polctartó/);
 const out=auto.makeAutoPrograms({name:'Teszt',parts:[
   board('f','F-osztó',1464,396,[entry])]},['f']);
 assert.equal(out.files.length,0);
 assert.equal(out.blocked.length,1);
});

test('az automatikus CNC mentés DX=1350+ és DY=800+ esetén AD/DA összevont térfelet kap',()=>{
 for(const [side,expected] of [['IJ','AD'],['LK','DA']]){
   const entry={key:'piece-'+side,dx:1400,dy:900,dz:18,side,operations:[
     {macro:'LAPA',X:300,Y:20,y:800,joint:'fixed',face:'primary'}
   ]};
   const result=auto.compileEntry(entry,{assemblyJoint:'excenter'});
   assert.match(result,new RegExp('^H DX=1400 DY=900 DZ=18 -'+expected+' C=0 T=16973825'));
 }
});
