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
  const a=html.indexOf('function cncSupportRegions(');
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
  assert.ok(side[0].operations.some(op=>op.macro==='LAPA'&&op.X===609&&op.Y===0&&op.y===396));
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
  assert.match(left.content,/LAPA X=609 Y=0 A=0 y=396 G=1/);
  assert.match(shelfFile.content,/ELF3 Y=0 A=0 y=396 G=1/);
  assert.match(shelfFile.content,/ELF2 Y=0 A=0 y=396 G=1/);
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
   [0,584],[634,350],[1034,426]
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

test('V-osztó sima excenter és hosszú excenter: azonos LAPA G=1, eltérő ELF G=1/2',()=>{
  const {ctx}=extractedGeometry();
  const p={...base(),hasTop:false,hasBottom:false,bodyBottomOffset:0,
    sideH:1500,drilling:'fixed',fCount:0};
  const v={key:'v-divider-1',name:'V-osztó',kind:'v',index:0,
    x1:18,x2:982,y0:0,y1:396,z1:600,z2:618,a:964,b:396,
    angle:0,undercutDegrees:0};
  ctx.fixedDividerPieces=()=>[v];
  const records=[
    {key:'side-left',sourceKeys:['side-left','side-right']},
    {key:'v-divider-1'}
  ];
  ctx.buildCncInstancesForParts(p,records);
  const side=records[0].cncInstances,divider=records[1].cncInstances;
  assert.equal(side.length,2,'a két oldallap külön CNC programot kap');
  assert.equal(divider.length,1);
  assert.equal(divider[0].operations.filter(op=>op.macro==='ELF3').length,1);
  assert.equal(divider[0].operations.filter(op=>op.macro==='ELF2').length,1);
  for(const [assemblyJoint,expectedEdgeG] of [['excenter',1],['hosszuExcenter',2]]){
    const parts=[
      board('oldalak','Oldal',1500,400,side),
      board('v','V-osztó',964,396,divider)
    ];
    const res=auto.makeAutoPrograms({name:'Szekrény',parts},
      ['oldalak','v'],{assemblyJoint});
    assert.equal(res.blocked.length,0,assemblyJoint);
    assert.equal(res.files.length,3,assemblyJoint);
    const vProgram=res.files.find(file=>file.filename.includes('v-divider-1'));
    const sidePrograms=res.files.filter(file=>file.filename.includes('side-'));
    assert.ok(vProgram,assemblyJoint);
    assert.equal(sidePrograms.length,2,assemblyJoint);
    assert.match(vProgram.content,new RegExp('ELF3 Y=0 A=0 y=396 G='+expectedEdgeG));
    assert.match(vProgram.content,new RegExp('ELF2 Y=0 A=0 y=396 G='+expectedEdgeG));
    for(const sideFile of sidePrograms){
      assert.match(sideFile.content,/LAPA X=609 Y=0 A=0 y=396 G=1/,
        'a lapfurat mindkét excenteres kötésnél G=1');
    }
  }
});

test('állítható polc + F-osztó: kétoldali REF/POLC és FORDIT_X készül',()=>{
 const {ctx}=extractedGeometry(),p={...base(),drilling:'full',n:1,
    fCount:1,raster:32,supportInset:50,cncGapBottom:0,
    cncGapTop:0,cncGapDivider:0};
 ctx.fixedDividerPieces=()=>[{key:'f-divider-1',name:'F-osztó',kind:'f',
   index:0,x1:491,x2:509,y0:0,y1:396,z1:18,z2:1482,a:1464,b:396}];
 const records=[{key:'f-divider-1'}];ctx.buildCncInstancesForParts(p,records);
 const entry=records[0].cncInstances[0];
 assert.equal(entry.issues.length,0);
 assert.equal(entry.operations.filter(op=>op.macro==='POLC').length,4);
 assert.equal(entry.operations.filter(op=>op.macro==='REF'&&op.DX).length,2);
 const out=auto.makeAutoPrograms({name:'Teszt',parts:[
   board('f','F-osztó',1464,396,[entry])]},['f']);
 assert.equal(out.blocked.length,0);
 assert.equal(out.files.length,1);
 assert.match(out.files[0].content,/REF DX=1464 BX=0/);
 assert.match(out.files[0].content,/XMSG Q=1 N="FORDIT_X"/);
});
test('pótfenék: 2 LAPA a felső oldalon, 4 LAB a másikon, láb nélkül LAB nincs',()=>{
 const {ctx}=extractedGeometry();
 const p={...base(),w:1000,d:400,hasTop:false,
  hasBottom:true,falseBottom:true,hasFeet:true,bottom:'between'};
 const records=[{key:'false-bottom'}];ctx.buildCncInstancesForParts(p,records);
 const entry=records[0].cncInstances[0];
 assert.equal(entry.dx,1001);
 assert.equal(entry.operations.filter(op=>op.macro==='LAPA').length,2);
 assert.equal(entry.operations.filter(op=>op.macro==='LAB').length,4);
 assert.equal(entry.operations.filter(op=>op.macro==='LAB'&&op.face==='reverse').length,4);
 assert.deepEqual(Array.from(entry.operations.filter(op=>op.macro==='LAB'),op=>[op.X,op.Y]),
  [[59,59],[59,341],[942,59],[942,341]]);
 const out=auto.makeAutoPrograms({name:'Teszt',parts:[
   board('fb','Pótfenék',1001,400,[entry])]},['fb']);
 assert.equal(out.blocked.length,0);
 assert.equal(out.files.length,1);
 assert.match(out.files[0].content,/LAPA X=9\.5 Y=0 A=0 y=400 G=1/);
 assert.match(out.files[0].content,/LAB X=942 Y=341 G=2/);
 assert.match(out.files[0].content,/XMSG Q=1 N="FORDIT"/);
 p.hasFeet=false;
 const noFeet=[{key:'false-bottom'}];ctx.buildCncInstancesForParts(p,noFeet);
 assert.equal(noFeet[0].cncInstances[0].operations.filter(op=>op.macro==='LAB').length,0);
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


test('CNC alul ütköző oldallap: V-osztó, tető és fenék a fizikai alsó végtől mérve',()=>{
 const {ctx}=extractedGeometry(),p={...base(),drilling:'fixed',rabbet:false,
   vCount:1,hasTop:true,hasBottom:true,top:'between',bottom:'between'};
 ctx.fixedDividerPieces=()=>[{key:'v-divider-1',name:'V-osztó',kind:'v',index:0,
   x1:18,x2:982,y0:0,y1:396,z1:600,z2:618,a:964,b:396,undercutDegrees:0}];
 const records=[{key:'side-left',sourceKeys:['side-left','side-right']}];
 ctx.buildCncInstancesForParts(p,records);
 for(const e of records[0].cncInstances){
   assert.deepEqual(Array.from(e.operations.filter(o=>o.macro==='LAPA'),o=>o.X),
     [609,1491,9]);
 }
});

test('a CNC fenékből eltűnt kihagyás beállítását régi mentésből is figyelmen kívül hagyjuk',()=>{
 const {ctx,html}=extractedGeometry();
 assert.doesNotMatch(html,/id="cncGapBottom"/);
 const p={...base(),drilling:'full',hasTop:false,hasBottom:false,
   cncGapBottom:99,cncGapTop:0,cncGapDivider:0,raster:32,supportInset:50};
 const seg=ctx.cncSupportRegions(p,[{kind:'v',x1:18,x2:982,z1:600,z2:618}],'left');
 assert.equal(seg.issues.length,0);
 assert.equal(seg.segments[0].BX,0);
 assert.equal(seg.segments[0].DX,600);
});

test('végigfuratolt polc CNC-nél is választható az egyedi magasság',()=>{
 const {html}=extractedGeometry();
  assert.ok(html.includes("const distribution=choice('distribution');"));
  assert.ok(html.includes("const manual=p.distribution==='manual';"));
  assert.ok(html.includes("p.drilling==='full'&&p.distribution!=='manual'"));
  assert.ok(!html.includes("e.target.name==='drilling'&&e.target.value==='full'"));
 const start=html.indexOf('function horizontalLayout(p){'),
       stop=html.indexOf('function positions(p){',start);
 assert.ok(start>=0&&stop>start);
 const vm=require('node:vm'),context={
   horizontalMembers:()=>[{kind:'shelf',index:0}],
   rasterLevels:()=>[128],
   calculateGaps:()=>({gaps:[200,782]}),
 };
 vm.createContext(context);
 vm.runInContext(html.slice(start,stop),context);
 const manual=context.horizontalLayout({n:1,vCount:0,drilling:'full',distribution:'manual',t:18,innerH:1000});
 const automatic=context.horizontalLayout({n:1,vCount:0,drilling:'full',distribution:'equal',t:18,innerH:1000});
 assert.equal(manual[0].level,209);
 assert.equal(automatic[0].level,128);
});

test('falcos HDF: XFALC csak falc=1 esetén; 4 db szomszédos lapra, trim esetén kihagy',()=>{
 const {ctx}=extractedGeometry();
 const p={...base(),drilling:'fixed',rabbet:true,topHdfCut:'falc',bottomHdfCut:'falc'};
 ctx.fixedDividerPieces=()=>[];
 const records=[
   {key:'side-left',sourceKeys:['side-left','side-right']},{key:'top'},{key:'bottom'}
 ];
 ctx.buildCncInstancesForParts(p,records);
 for(const r of records){
   for(const e of r.cncInstances)assert.equal(e.operations.filter(o=>o.macro==='XFALC').length,1);
 }
 const core=require('../machine/cnc-xxl.cjs');
 assert.equal(core.parseMacro('XFALC Q=1# G=2# T=103',1500,400),'XFALC Q=1# G=2# T=103');
 assert.throws(()=>core.parseMacro('XFALC Q=1# G=2# T=104',1500,400),/XFALC/);
 assert.throws(()=>core.parseMacro('XFALC Q=5# G=2# T=103',1500,400),/XFALC/);
 const out=auto.compileEntry(records[0].cncInstances[0],{assemblyJoint:'excenter'});
 assert.match(out,/XFALC Q=1# G=2# T=103/);
 p.topHdfCut='trim';
 const trimmed=records.map(r=>({key:r.key,sourceKeys:r.sourceKeys}));
 ctx.buildCncInstancesForParts(p,trimmed);
 assert.equal(trimmed[1].cncInstances[0].operations.filter(o=>o.macro==='XFALC').length,0);
 assert.equal(trimmed[2].cncInstances[0].operations.filter(o=>o.macro==='XFALC').length,1);
 p.rabbet=false;
 const plain=records.map(r=>({key:r.key,sourceKeys:r.sourceKeys}));
 ctx.buildCncInstancesForParts(p,plain);
 assert.equal(plain.flatMap(r=>r.cncInstances||[]).flatMap(e=>e.operations).filter(o=>o.macro==='XFALC').length,0);
});

test('F-osztó alul és elöl ütközik; a fenék alsó összehúzója után FORDIT következik',()=>{
 const {ctx}=extractedGeometry();
 const p={...base(),drilling:'fixed',fCount:1,rabbet:false};
 const f={key:'f-divider-1',name:'F-osztó',kind:'f',index:0,
   x1:491,x2:509,z1:18,z2:1482,y0:0,y1:396,a:1464,b:396};
 const s={key:'shelf-1',name:'Polc 1',kind:'shelf',index:0,
   x1:18,x2:491,z1:1241,z2:1259,y0:0,y1:396,a:473,b:396,undercutDegrees:0};
 ctx.fixedDividerPieces=()=>[f,s];
 const records=[{key:'top'},{key:'bottom'},{key:'f-divider-1'}];
 ctx.buildCncInstancesForParts(p,records);
 const upper=records[0].cncInstances[0],lower=records[1].cncInstances[0],vertical=records[2].cncInstances[0];
 // A polc középpontja z=1250; az F-osztó ALSÓ ütközője z=18.
 assert.equal(vertical.operations.find(o=>o.macro==='LAPA')?.X,1232);
 assert.equal(vertical.operations.find(o=>o.macro==='LAPA')?.face,'reverse');
 assert.equal(upper.operations.find(o=>o.macro==='LAPA')?.face,'reverse');
 assert.equal(lower.operations.find(o=>o.macro==='LAPA')?.face,'reverse');
 const code=auto.compileEntry(lower,{assemblyJoint:'excenter'});
 assert.match(code,/ELF3 Y=0 A=0 y=400 G=1/);
 assert.match(code,/XMSG Q=1 N="FORDIT"/);
  assert.match(code,/XMSG Q=1 N="FORDIT"[\s\S]+LAPA X=482 Y=0 A=0 y=396 G=1/);
});


test('F-osztó: alsó X0, elülső Y0; jobb oldal, FORDIT_X, bal oldal',()=>{
 const {ctx}=extractedGeometry(),p={...base(),drilling:'fixed',fCount:1,
   rabbet:false,front:0};
 const f={key:'f-divider-1',name:'F-osztó',kind:'f',index:0,
   x1:491,x2:509,z1:18,z2:1482,y0:0,y1:396,a:1464,b:396};
 const left={key:'shelf-left',name:'Bal polc',kind:'shelf',index:0,
   x1:18,x2:491,z1:1241,z2:1259,y0:0,y1:396,a:473,b:396,undercutDegrees:0};
 const right={key:'shelf-right',name:'Jobb polc',kind:'shelf',index:1,
   x1:509,x2:982,z1:1241,z2:1259,y0:0,y1:396,a:473,b:396,undercutDegrees:0};
 ctx.fixedDividerPieces=()=>[f,left,right];
 const records=[{key:'f-divider-1'}];
 ctx.buildCncInstancesForParts(p,records);
 const entry=records[0].cncInstances[0];
 assert.equal(entry.flipAxis,'X');
 const rightOps=entry.operations.filter(o=>o.macro==='LAPA'&&o.face==='primary');
 const leftOps=entry.operations.filter(o=>o.macro==='LAPA'&&o.face==='reverse');
 assert.equal(rightOps.length,1);
 assert.equal(leftOps.length,1);
 assert.equal(rightOps[0].X,1232);
 assert.equal(leftOps[0].X,1232);
 assert.equal(rightOps[0].Y,15,'jobb oldalon megmarad az eredeti eltolás');
 assert.equal(rightOps[0].y,366);
 assert.equal(leftOps[0].Y,0);
 assert.equal(leftOps[0].y,396);
 const text=auto.compileEntry(entry,{assemblyJoint:'excenter'});
 assert.match(text,/LAPA X=1232 Y=15 A=0 y=366 G=1/);
 assert.match(text,/LAPA X=1232 Y=0 A=0 y=396 G=1/);
 const rightPos=text.indexOf('LAPA X=1232 Y=15 A=0 y=366 G=1'),
   flipped=text.indexOf('XMSG Q=1 N="FORDIT_X"'),
   leftPos=text.indexOf('LAPA X=1232 Y=0 A=0 y=396 G=1');
 assert.ok(rightPos>=0&&flipped>rightPos&&leftPos>flipped);
});

test('F-osztó REF: X szakaszok alulról emelkednek az egyedi V-osztó körül',()=>{
 const {ctx}=extractedGeometry(),p={...base(),drilling:'full',
   raster:32,supportInset:50,cncGapTop:0,cncGapDivider:0,fCount:1,
   rabbet:false};
 const f={key:'f-divider-1',name:'F-osztó',kind:'f',index:0,
   x1:491,x2:509,z1:18,z2:1482,y0:0,y1:396,a:1464,b:396};
 const vRight={key:'v-right',kind:'v',index:0,x1:509,x2:982,
   z1:600,z2:618,y0:0,y1:396,a:473,b:396};
 const vLeft={key:'v-left',kind:'v',index:0,x1:18,x2:491,
   z1:600,z2:618,y0:0,y1:396,a:473,b:396};
 const boards=[f,vRight,vLeft];
 const right=ctx.cncSupportRegions(p,boards,'right',f);
 const left=ctx.cncSupportRegions(p,boards,'left',f);
 assert.equal(right.issues.length,0);
 assert.equal(left.issues.length,0);
 assert.deepEqual(Array.from(right.segments,s=>[s.BX,s.DX]),[[0,582],[600,864]]);
 assert.deepEqual(Array.from(left.segments,s=>[s.BX,s.DX]),[[0,582],[600,864]]);
 ctx.fixedDividerPieces=()=>boards;
 const records=[{key:f.key}];
 ctx.buildCncInstancesForParts(p,records);
 const entry=records[0].cncInstances[0];
 assert.equal(entry.flipAxis,'X');
 const rightFirst=entry.operations.filter(o=>o.macro==='REF'&&o.DX!==undefined&&o.face==='primary');
 const leftAfter=entry.operations.filter(o=>o.macro==='REF'&&o.DX!==undefined&&o.face==='reverse');
 assert.deepEqual(Array.from(rightFirst,x=>[x.BX,x.DX]),[[0,582],[600,864]]);
 assert.deepEqual(Array.from(leftAfter,x=>[x.BX,x.DX]),[[0,582],[600,864]]);
 const text=auto.compileEntry(entry,{assemblyJoint:'excenter'});
 assert.match(text,/REF DX=582 BX=0/);
 assert.match(text,/REF DX=864 BX=600/);
 assert.match(text,/XMSG Q=1 N="FORDIT_X"/);
});
