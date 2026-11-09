'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','app','index.htm'),'utf8');
const begin=source.indexOf("  const partColumnStorageKey='gatterka-parts-column-widths-v1';");
const end=source.indexOf("  function furnitureView(stage='furniture'){",begin);
assert.ok(begin>=0&&end>begin);
const logic=source.slice(begin,end);
function setup(storage=new Map()){
  const listeners={},pointer={},cols=Array.from({length:13},()=>({style:{}}));
  const table={style:{},querySelector(sel){
    const hit=sel.match(/data-part-col-index="(\d+)"/);
    return hit?cols[Number(hit[1])]:null;
  }};
  const context={
    localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
    document:{addEventListener:(name,fn)=>{listeners[name]=fn;},querySelector:()=>table},
    window:{addEventListener:(name,fn)=>{pointer[name]=fn;},
      removeEventListener:(name,fn)=>{if(pointer[name]===fn)delete pointer[name];}},
    console:{warn(){}}
  };
  vm.runInNewContext(logic+'\nthis.readWidths=()=>Array.from(partColumnWidths);this.head=partTableHeadings;this.cols=partTableColgroup;',context);
  return {storage,listeners,pointer,cols,table,context};
}
const grip=i=>({dataset:{partColumnResize:String(i)},closest(){return this;}});
test('Az Alkatrészek táblázat 13 oszlopa külön átméretezhető',()=>{
  const x=setup();
  assert.equal((x.context.head().match(/data-part-column-resize=/g)||[]).length,13);
  assert.equal((x.context.cols().match(/<col data-part-col-index=/g)||[]).length,13);
  assert.match(source,/class="parts-resizable-table"/);
  assert.match(source,/\.parts-resizable-table\{table-layout:fixed/);
});
test('Az IF oszlopszélesség mentődik és újramegnyitva is megmarad',()=>{
  const x=setup();
  assert.equal(x.context.readWidths()[5],215);
  x.listeners.pointerdown({target:grip(5),pointerId:7,clientX:200,button:0,pointerType:'mouse',preventDefault(){}});
  x.pointer.pointermove({pointerId:7,clientX:140});
  assert.equal(x.context.readWidths()[5],155);
  assert.equal(x.cols[5].style.width,'155px');
  x.pointer.pointerup({pointerId:7});
  const saved=JSON.parse(x.storage.get('gatterka-parts-column-widths-v1'));
  assert.equal(saved[5],155);
  assert.equal(setup(x.storage).context.readWidths()[5],155);
});
test('Szálirány és anyag oszlopa billentyűvel is szűkíthető',()=>{
  const x=setup();
  x.listeners.keydown({target:grip(2),key:'ArrowLeft',preventDefault(){}});
  x.listeners.keydown({target:grip(6),key:'ArrowLeft',preventDefault(){}});
  assert.equal(x.context.readWidths()[2],135);
  assert.equal(x.context.readWidths()[6],185);
});
