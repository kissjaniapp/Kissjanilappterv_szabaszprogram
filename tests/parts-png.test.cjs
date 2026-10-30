'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
const a=html.indexOf('function buildPartsPngPages(');
const b=html.indexOf('\n  async function saveFileToDisk(',a);
assert.ok(a>=0&&b>a,'PNG alkatrészlista generáló nem található');

function mockDocument(){
  const canvases=[];
  return {
    canvases,
    createElement(tag){
      assert.equal(tag,'canvas');
      const text=[];
      const ctx={
        fillRect(){},
        fillText(str,x,y){text.push({str:String(str),x,y});},
        measureText(str){return {width:String(str).length*13}}
      };
      const canvas={width:0,height:0,text,getContext(type){assert.equal(type,'2d');return ctx;}};
      canvases.push(canvas);return canvas;
    }
  };
}
const render=vm.runInNewContext('('+html.slice(a,b).trim()+')');
function part(i){
  return {skipped:false,error:null,qty:2,
    part:{name:'Oldallap '+i,edgeSides:{x1:true,y2:true}},
    furniture:{materialColor:'Feya',destination:'Kiskunfélegyháza'},
    originalA:910,originalB:600,edge:'1-1',edgeThickness:2,mill:true,millDepth:1
  };
}
test('PNG fejlécében az anyag és gyártási célhely; sorban készméret és élzárás',()=>{
  const doc=mockDocument(),pages=render({errors:[],rows:[part(1)]},doc);
  assert.equal(pages.length,1);
  assert.equal(pages[0].width,1600);
  const text=pages[0].text.map(x=>x.str).join('\n');
  for(const expected of ['ALKATRÉSZLISTA','Feya','Kiskunfélegyháza',
    'Oldallap 1','910 × 600','1-1 · 2 mm · 1 mm előmarás','Összesen: 2 db'])
    assert.ok(text.includes(expected),'Nem jelenik meg: '+expected);
});
test('többoldalas PNG: nem vágja le a 100 sornál hosszabb alkatrészlistát',()=>{
  const doc=mockDocument(),rows=Array.from({length:240},(_,i)=>part(i+1));
  const pages=render({errors:[],rows},doc);
  assert.equal(pages.length,3);
  assert.equal(pages[0].height,350+100*70+100);
  assert.equal(pages[2].height,350+40*70+100);
  assert.ok(pages[2].text.some(x=>x.str.includes('Oldallap 240')));
  assert.ok(pages[2].text.some(x=>x.str==='3 / 3. oldal'));
});
test('hibás vagy üres alkatrészlistából nem ment félkész képet',()=>{
  const doc=mockDocument();
  assert.throws(()=>render({errors:['Hibás hossz'],rows:[part(1)]},doc),/Hibás hossz/);
  assert.throws(()=>render({errors:[],rows:[]},doc),/Nincs exportálható alkatrész/);
});

test('az X1/X2/Y1/Y2 élhely-jelölések nem szerepelnek a PNG szövegeiben',()=>{
 const doc=mockDocument();
 const rows=[part(1),part(2)];
 rows[0].part.edgeSides={x1:true,x2:true,y1:true,y2:true};
 render({errors:[],rows},doc);
 const text=doc.canvases.flatMap(c=>c.text.map(x=>x.str));
 for(const marker of ['X1','X2','Y1','Y2']){
  assert.ok(!text.some(s=>new RegExp('^'+marker+'(?:,|$)').test(s)),
    'A PNG-ben tiltott kód szerepel: '+marker);
 }
 assert.ok(text.includes('1-1 · 2 mm · 1 mm előmarás'));
});
