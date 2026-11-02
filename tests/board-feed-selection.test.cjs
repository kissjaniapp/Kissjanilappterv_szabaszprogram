'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
const first=html.indexOf('  const STANDARD_BOARD=');
const last=html.indexOf('  // Gyártási sorrend:',first);
assert.ok(first>=0&&last>first);
const state={kerf:5,trim:12,boards:[]};
const create=vm.runInNewContext('(function(){'+html.slice(first,last)+';return {makeStripPlan};})()', {state});
const makePart=(name,a,b)=>({part:{id:name,name},furniture:{name:'Konyha',materialColor:'Freya'},qty:1,a,b,originalA:a,originalB:b,thickness:18,rot:false,edge:'0-0',edgeThickness:2,mill:false,millDepth:1});
const doPlan=(feed,boards,rows)=>{state.boards=boards;return create.makeStripPlan(0,{rows,errors:[],total:rows.reduce((sum,r)=>sum+r.qty,0)},feed);};
const stock=(id,a,b)=>({id,name:id,a,b,thickness:18,qty:1});
const firstCutAt=(cut)=>cut.axis==='y'?cut.x1:cut.y1;
test('hosszú ütközőél a gépnél és a rövidebb irányú behúzás',()=>{
 for(const [a,b,feed] of [[2800,2070,'x'],[2070,2800,'y']]){
  const p=doPlan('long',[stock('t',a,b)],[makePart('teteje',200,200)]);
  assert.equal(p.failed.length,0);
  assert.equal(p.bins[0].machine.feed,feed);
  const first=p.bins[0].cuts[0];
  assert.equal(first.stage,'head-trim');
  assert.equal(firstCutAt(first),Math.min(a,b)-state.trim);
  assert.equal(first.length,Math.max(a,b)); // első, teljes szélességű vágás
 }
});
test('rövid ütközőél a gépnél és a hosszabb irányú behúzás',()=>{
 for(const [a,b,feed] of [[2800,2070,'y'],[2070,2800,'x']]){
  const p=doPlan('short',[stock('t',a,b)],[makePart('teteje',200,200)]);
  assert.equal(p.bins[0].machine.feed,feed);
  const first=p.bins[0].cuts[0];
  assert.equal(firstCutAt(first),Math.max(a,b)-state.trim);
  assert.equal(first.length,Math.min(a,b));
 }
});
test('vegyes állásban valóban különböző táblák eltérő éllel is ütközhetnek',()=>{
 const p=doPlan('auto',[stock('A',1600,1000),stock('B',1000,1600)],
  [makePart('hosszu',1550,200),makePart('kereszt',200,1550)]);
 assert.equal(p.failed.length,0);
 assert.equal(p.bins.length,2);
 const feeds=Object.fromEntries(p.bins.map(b=>[b.id,b.machine.feed]));
 assert.equal(feeds.A,'y');
 assert.equal(feeds.B,'x');
 for(const b of p.bins){
  const main=b.cuts.filter(c=>c.stage==='head-trim'||c.stage==='strip');
  assert.ok(main.length>=1);
  assert.equal(main[0].stage,'head-trim');
  const locations=main.map(firstCutAt);
  assert.ok(locations.every((v,i)=>!i||locations[i-1]>v), 'A fő vágásoknak kintről befelé kell haladniuk');
 }
});
test('korábbi x/y gépállású mentett projekt továbbra is ugyanazt az irányt adja',()=>{
 for(const feed of ['x','y']){
  const p=doPlan(feed,[stock('A',2800,2070)],[makePart('elem',500,200)]);
  assert.equal(p.bins[0].machine.feed,feed);
 }
});
test('egyező szélesség és alkatrész: két csík egymásra helyezhető, nem három',()=>{
 const from=html.indexOf('function buildProductionSequence(bins){');
 const to=html.indexOf('\n  function computeNesting(){',from);
 const schedule=vm.runInNewContext('('+html.slice(from,to).trim()+')');
 const cuts=[];
 const add=(stage,idx,order,size)=>cuts.push({stage,axis:stage==='strip'?'x':'y',stripIndex:idx,
  order,offset:size,pieceSize:size,length:1000,kerf:5,partSide:'end',kind:'part'});
 add('head-trim',0,1,12);
 for(let i=1;i<=3;i++){add('strip',i,2+i,200);add('cross',i,6+i,400);}
 const strip=i=>({index:i,width:200,section:{id:'S'+i},items:[{along:400,breadth:200,turned:false,
  item:{uid:'A',name:'elem',materialColor:'Freya',edge:'0-0',edgeThickness:2,mill:false}}]});
 const bin={cuts,placements:[],a:2800,b:2070,trim:12,thickness:18,
  machine:{feed:'y',crossSize:2050,strips:[strip(1),strip(2),strip(3)]}};
 const p=schedule([bin]);
 const refeed=p.events.filter(e=>e.type==='refeed');
 assert.equal(refeed.length,2);
 assert.equal(refeed[0].stackCount,2);
 assert.equal(refeed[1].stackCount,1);
 assert.equal(p.pairedGroups,1);
});
