'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
const slice=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)+a.length));
const workflow=fs.readFileSync(path.join(__dirname,'../machine/skp-workflow.js'),'utf8');
const context={};vm.createContext(context);vm.runInContext(
 slice('  function threeMfRectangularSolid(','  // Standalone 3MF/ZIP reader.')+workflow+';this.finish=skpFinishGeometry;',context);
const raw=JSON.parse(fs.readFileSync(path.join(__dirname,'../fixtures/skp-atado-geometry.json'),'utf8'));
const model=()=>context.finish(raw);
function apply(){
 const c={uuid:(()=>{let i=0;return()=>String(++i);})(),sidesFromCode:()=>({x1:false,x2:false,y1:false,y2:false}),
  cabinetAutoEdging:()=>{throw Error('SKP-hez nem találhatunk ki ABS-t');},threeMfViewStates:new Map(),result:null,
  threeMfCombinedCuttingGroups:d=>d.groups,
  threeMfGroupMeetsMinimum:g=>g.dimensions[0]>=50&&g.dimensions[1]>=50&&Math.abs(g.dimensions[2]-38)>.001};
 vm.createContext(c);vm.runInContext(slice('  function threeMfApplyImport(','  // SKP: a teljes dekóder')+';this.apply=threeMfApplyImport;',c);
 const f={id:'skp-atado',name:'Átadó',parts:[]};c.apply(f,model());return f;
}
const auto=require('../machine/cnc-auto.cjs');
test('Átadó 1200 valós SKP geometriája: 22 elem, 1200/600/910 mm és 12 valódi téglatest',()=>{
 const d=model();assert.equal(d.parts.length,22);assert.equal(d.parts.filter(p=>p.isRectangular).length,12);
 assert.equal(d.parts.filter(p=>p.dimensions[1]<50).length,4);
 const lo=[0,1,2].map(k=>Math.min(...d.parts.map(p=>p.originMm[k])));
 const hi=[0,1,2].map(k=>Math.max(...d.parts.map(p=>p.originMm[k]+p.axisBoundsMm[k])));
 assert.deepEqual(hi.map((v,k)=>Math.round(v-lo[k])),[1200,600,910]);
 assert.ok(d.parts.filter(p=>p.isRectangular).every(p=>/oldal|osztó|lap|Fenék/i.test(p.name)));
 assert.ok(d.parts.every(p=>!('vertices' in p)&&!('triangles' in p)),'a projekt kompakt, a nyers hálót nem mentjük');
});
test('SKP -> ugyanaz a szabászati alkatrészkészlet; munkalap és bútorláb nem szabható',()=>{
 const f=apply();assert.ok(f.parts.length>10);
 assert.ok(f.parts.every(p=>p.threeMfGenerated&&p.skpGenerated));
 assert.ok(f.parts.every(p=>Number(p.threeMfThickness)!==38));
 assert.ok(f.parts.every(p=>Number(p.a)>=50&&Number(p.b)>=50));
 assert.ok(f.parts.every(p=>p.edge==='0-0'&&p.millDepth===1));
 assert.equal(f.ht,910);assert.equal(f.w,1200);assert.equal(f.d,600);
 assert.equal(f.threeMfImport.parts.length,22);
});
test('SKP -> CNC: 25 kapcsolat, 12 XXL és 50 makró, munkalappal és ellenfuratokkal',()=>{
 const f=apply(),r=auto.makeAutoPrograms(f,f.parts.map(p=>p.id));
 assert.equal(r.blocked.length,0,JSON.stringify(r.blocked));assert.equal(r.files.length,12,JSON.stringify(r.blocked));assert.equal(r.contacts.length,25);
 assert.ok(r.files.every(f=>f.filename.startsWith('SKP_TERV_')));
 assert.equal(r.files.filter(f=>f.noMachining).length,1);
 assert.equal(r.files.reduce((n,f)=>n+f.commands.split('\n').filter(Boolean).length,0),50);
 const top=r.files.find(f=>f.filename.includes('Munkalap'));assert.ok(top);assert.match(top.content,/DX=1200 DY=600 DZ=38/);
 assert.equal(top.commands.split('\n').length,5);
 assert.ok(r.files.some(f=>/G=2/.test(f.content)));
 assert.ok(r.files.some(f=>/XMSG Q=1 N="FORDIT"/.test(f.content)));
});
test('mentés/betöltés után az SKP kiválasztott geometriája és CNC-je változatlan',()=>{
 const f=apply(),copy=JSON.parse(JSON.stringify(f));
 assert.deepEqual(auto.makeAutoPrograms(copy,copy.parts.map(p=>p.id)).files,
  auto.makeAutoPrograms(f,f.parts.map(p=>p.id)).files);
});
test('az offline SKP dekóder és a két felületi kódrész a települő index.htm része',()=>{
 assert.ok(html.includes(workflow));assert.ok(html.includes(fs.readFileSync(path.join(__dirname,'../machine/skp-events.js'),'utf8')));
 const bundle=html.match(/<script id="gatterka-skp-reader">([\s\S]*?)<\/script>/);assert.ok(bundle);
 assert.doesNotMatch(bundle[1],/https?:\/\/[^\s]+(?:\.wasm|\.js)["']/);
 assert.match(html,/accept="\.3mf,\.skp"/);assert.match(html,/data-skp-component/);assert.match(html,/data-skp-width/);
 assert.match(html,/new Worker\(url\)/);assert.match(html,/skp-contours/);
 assert.ok(!html.includes('data-mode="skp"'),'nincs negyedik munkamód');
});
test('a csomagolt olvasó DXF-kontúrja zárt mm polivonal; a görbe nem téglalapként exportált',()=>{
 const bundle=html.match(/<script id="gatterka-skp-reader">([\s\S]*?)<\/script>/)[1];
 const api=vm.runInNewContext(bundle+';GatterkaSkp;',{TextDecoder,TextEncoder,ArrayBuffer,Uint8Array});
 const shape=raw.parts[3],dxf=api.contourDxf(shape);
 assert.match(dxf,/\$INSUNITS\r\n70\r\n4/);assert.match(dxf,/LWPOLYLINE/);assert.match(dxf,/70\r\n1/);
 assert.equal((dxf.match(/\r\n10\r\n/g)||[]).length,shape.skpContour.points.length);
 assert.throws(()=>api.contourDxf({}),/körvonal/);
 assert.throws(()=>api.openSkp(new ArrayBuffer(20)),/75 MB/);
});
test('a csomagolt dekóder valódi SKP binárist olvas: beágyazott és elforgatott két oldallap',()=>{
 const bundle=html.match(/<script id="gatterka-skp-reader">([\s\S]*?)<\/script>/)[1];
 const api=vm.runInNewContext(bundle+';GatterkaSkp;',{TextDecoder,TextEncoder,ArrayBuffer,Uint8Array});
 const bytes=fs.readFileSync(path.join(__dirname,'../fixtures/skp-nested-cabinet.skp'));
 const session=api.openSkp(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
 const entry=session.choices.find(c=>c.name==='Próbaszekrény');assert.ok(entry);
 const geometry=api.extractSkp(session,entry.key);assert.equal(geometry.parts.length,3);
 assert.equal(geometry.skpWidthAxis,0);
 for(const shape of geometry.parts.slice(0,2)){assert.deepEqual(Array.from(shape.dimensions),[900,400,18]);assert.equal(shape.triangles.length,12);}
 assert.deepEqual(Array.from(geometry.parts[1].originMm),[982,0,0]);
 const flipped=api.extractSkp(session,entry.key,{widthAxis:1});assert.deepEqual(Array.from(flipped.parts[1].originMm),[0,982,0]);
 // A selected component's scaling remains physical; placement rotation does not distort sizes.
 const node=session.nodes.get(entry.key);for(const k of [0,1,2,4,5,6,8,9,10])node.T[k]*=2;
 const scaled=api.extractSkp(session,entry.key);assert.deepEqual(Array.from(scaled.parts[0].dimensions),[1800,800,36]);
});
test('hiányos lapot és görbét az SKP alkatrészfelismerés nem nevezhet téglatestnek',()=>{
 const broken=JSON.parse(JSON.stringify(raw));broken.parts[0].triangles.pop();
 const parsed=context.finish(broken);assert.equal(parsed.parts[0].isRectangular,false);assert.equal(parsed.parts[0].isAngledCut,false);
 const curves=JSON.parse(JSON.stringify(raw));curves.parts[3].skpHasCurves=true;
 const other=context.finish(curves);assert.equal(other.parts[3].isAngledCut,false);
});
