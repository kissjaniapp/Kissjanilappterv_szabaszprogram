'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const html=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
const from=html.indexOf('function buildProductionSequence(bins){');
const to=html.indexOf('\n  function computeNesting(){',from);
assert.ok(from>=0&&to>from,'A vágási sorrend számítója nem található');
const schedule=vm.runInNewContext('('+html.slice(from,to).trim()+')');

function sampleBoard(){
  const cuts=[];
  function add(stage,axis,stripIndex,x){
    cuts.push({
      stage,axis,stripIndex,x1:x,y1:0,x2:x,y2:100,
      sectionX:x,sectionY:0,sectionH:100,
      order:cuts.length+1,offset:x,pieceSize:100,
      length:1000,kerf:5,partSide:'end',kind:'part'
    });
    return cuts[cuts.length-1];
  }
  const primary=[add('head-trim','x',0,0),add('strip','x',1,1),add('strip','x',2,2)];
  // Mint az atszamozott.png képen: alsó sáv 15 fő darabolóvágás,
  // majd ugyanott 10 másodlagos vágás, végül felső sáv 8 fő vágás.
  const lowerMain=Array.from({length:15},(_,i)=>add('cross','y',1,1500-100*i));
  const lowerDetail=Array.from({length:10},(_,i)=>add('rip','x',1,1000-100*i));
  const upperMain=Array.from({length:8},(_,i)=>add('cross','y',2,800-100*i));
  const strip=(index,items)=>({index,width:index===1?1000:500,
    section:{id:'S'+index},items});
  const items=[{along:500,breadth:1000,turned:false,item:{materialColor:'Feya'}}];
  const bin={a:2800,b:2070,name:'teszt',thickness:18,trim:10,cuts,
    placements:[{finishCutIndex:cuts.indexOf(lowerDetail[0]),completionStep:0}],
    machine:{feed:'x',crossSize:2780,strips:[strip(1,items),strip(2,items)]}};
  return {bin,primary,lowerMain,lowerDetail,upperMain};
}

test('a kép szerinti 1–36 logika: fő sáv, alsó fő, alsó alábontás, felső fő',()=>{
  const {bin,primary,lowerMain,lowerDetail,upperMain}=sampleBoard();
  const out=schedule([bin]);
  assert.equal(out.totalCuts,36);
  assert.deepEqual(primary.map(c=>c.globalOrder),[1,2,3]);
  assert.deepEqual(lowerMain.slice().sort((a,b)=>a.x1-b.x1).map(c=>c.globalOrder),
    Array.from({length:15},(_,i)=>i+4));
  assert.deepEqual(lowerDetail.slice().sort((a,b)=>a.sectionX-b.sectionX).map(c=>c.globalOrder),
    Array.from({length:10},(_,i)=>i+19));
  assert.deepEqual(upperMain.slice().sort((a,b)=>a.x1-b.x1).map(c=>c.globalOrder),
    Array.from({length:8},(_,i)=>i+29));
  const firstRefeed=out.events.findIndex(e=>e.type==='refeed');
  assert.equal(firstRefeed,3);
  assert.ok(out.events.slice(0,firstRefeed).every(e=>e.phase==='savozas'));
  assert.equal(out.events.filter(e=>e.type==='refeed').length,2);
  assert.equal(out.events.filter(e=>e.type==='refeed-detail').length,1);
  assert.equal(out.machineExecutable,false);
});

test('a gyártási sorrend nem adja ki magát hitelesített xPrg programnak',()=>{
  const out=schedule([sampleBoard().bin]);
  assert.equal(out.machineExecutable,false);
  assert.equal(out.maxSuggestedStack,2);
  assert.match(out.note,/nem ellenőrzött|NEM ellenőrzött/i);
});

test('két tábla esetén mindkét rajz sorszámai 1–36 és külön ciklust alkotnak',()=>{
  const first=sampleBoard(),second=sampleBoard();
  const plan=schedule([first.bin,second.bin]);
  assert.equal(plan.totalCuts,72);
  assert.deepEqual(plan.boards.map(b=>b.cutCount),[36,36]);
  for(const board of [first,second]){
    assert.deepEqual(board.primary.map(c=>c.boardOrder),[1,2,3]);
    assert.deepEqual(board.lowerMain.slice().sort((a,b)=>a.x1-b.x1)
      .map(c=>c.boardOrder),Array.from({length:15},(_,i)=>i+4));
    assert.deepEqual(board.lowerDetail.slice().sort((a,b)=>a.sectionX-b.sectionX)
      .map(c=>c.boardOrder),Array.from({length:10},(_,i)=>i+19));
    assert.deepEqual(board.upperMain.slice().sort((a,b)=>a.x1-b.x1)
      .map(c=>c.boardOrder),Array.from({length:8},(_,i)=>i+29));
  }
  const firstBoardEvents=plan.events.filter(e=>e.board===1);
  const secondBoardEvents=plan.events.filter(e=>e.board===2);
  assert.equal(firstBoardEvents.filter(e=>e.type==='cut').length,36);
  assert.equal(secondBoardEvents.filter(e=>e.type==='cut').length,36);
  assert.equal(firstBoardEvents.filter(e=>e.type==='cut').at(-1).order,36);
  assert.equal(secondBoardEvents.filter(e=>e.type==='cut')[0].order,1);
  assert.deepEqual([...new Set(plan.events.map(e=>e.board))],[1,2]);
});
