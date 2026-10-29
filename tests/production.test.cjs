'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
const begin=html.indexOf('function buildProductionSequence(bins){');
const end=html.indexOf('\n  function computeNesting(){',begin);
assert.ok(begin>=0&&end>begin,'Hiányzik a gépi gyártási sorrend számolója');
const schedule=vm.runInNewContext('('+html.slice(begin,end).trim()+')');
function board(material='Feya',length=700){
  const cut=(stage,axis,index,dim)=>({stage,axis,stripIndex:index,offset:dim,pieceSize:dim,
    length:2070,kerf:5,partSide:'end',kind:'part'});
  return {
    a:2800,b:2070,thickness:18,trim:10,name:'anyag',
    machine:{feed:'x',crossSize:2780,strips:[{index:1,width:400,
      section:{id:'S2'},items:[{along:length,breadth:400,turned:false,
        item:{materialColor:material}}]}]},
    cuts:[cut('head-trim','x',0,10),cut('strip','x',1,400),cut('cross','y',1,length)],
    placements:[{finishCutIndex:2,completionStep:3}]
  };
}
test('a számozás minden új táblán 1-től indul és az egyes táblák menetei nem keverednek',()=>{
  const bins=[board(),board()];
  const out=schedule(bins);
  assert.equal(out.boards.length,2);
  assert.deepEqual(out.boards.map(x=>x.cutCount),[3,3]);
  assert.equal(out.totalCuts,6);
  assert.equal(out.pairedGroups,0);
  for(const boardIndex of [0,1]){
    const boardNumber=boardIndex+1;
    assert.deepEqual(bins[boardIndex].cuts.map(c=>c.boardOrder),[1,2,3]);
    const events=out.events.filter(e=>e.board===boardNumber);
    assert.equal(events[0].phase,'savozas');
    assert.equal(events[1].phase,'savozas');
    assert.equal(events[2].type,'refeed');
    assert.equal(events[3].phase,'hosszvagas');
    assert.equal(events[3].order,3);
    assert.equal(bins[boardIndex].placements[0].completionStep,3);
  }
  assert.ok(out.events.findIndex(e=>e.board===2)>
    out.events.map(e=>e.board).lastIndexOf(1));
  assert.equal(out.machineExecutable,false);
});
test('eltérő méretű csíkok nem kerülnek egymásra',()=>{
  const out=schedule([board('Feya',700),board('Feya',690)]);
  assert.equal(out.pairedGroups,0);
  assert.equal(out.events.filter(e=>e.type==='refeed').length,2);
});
test('eltérő anyagú csíkok nem kerülnek egymásra',()=>{
  const out=schedule([board('Feya'),board('Tölgy')]);
  assert.equal(out.pairedGroups,0);
});
test('a gépi XML próba csak offline szimulátorhoz érhető el',()=>{
  assert.match(html,/function downloadMachineSimulation\(/);
  assert.match(html,/XPRG_XMIX_CSAK_OFFLINE/);
  assert.match(html,/NEM hitelesített/);
  assert.match(html,/Pacco="1"/);
});
