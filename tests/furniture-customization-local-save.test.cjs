'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../app/index.htm'),'utf8');
const from=html.indexOf('  function save(){');
const to=html.indexOf('  function freshProject(){',from);
assert.ok(from>0&&to>from,'A testreszabás belső mentője nem található');
const code=html.slice(from,to);
const sample=()=>({
  id:'f1',name:'Konyhaszekrény',destination:'Konyha',
  w:900,ht:1200,d:550,t:18,
  customParameters:[{id:'rule1',name:'szokli',value:'1',parts:[]}],
  parts:[{id:'p1',name:'Szokli elöl',a:'W-2*T',b:'150',q:'1',
    ifCondition:'szokli=1'}]
});
function setup(mode='editor',options={}){
  const furniture=sample(),state={furnitures:[furniture],active:'parts'};
  const library=[{id:'project1',data:{furnitures:[]},updatedAt:0}];
  const storage=new Map(),fields=[];
  const ctx={
    state,library,libraryKey:'lapterv-library-v1',
    seriesKey:'gatterka-szeriatar-v1',seriesCatalog:[],
    editingSeriesId:'template1',projectScreen:mode,currentProjectId:'project1',
    document:{querySelectorAll:()=>fields},
    localStorage:{
      setItem:(key,val)=>{
        if(options.storageFailure)throw Error('Storage unavailable');
        storage.set(key,val);
      },getItem:key=>storage.get(key)||null
    },getFurniture:()=>furniture,uuid:()=> 'new-template-id',
    console:{warn:()=>{}}
  };
  const actions=vm.runInNewContext('(function(){'+code+
    ';return {save,captureVisibleFurnitureEdits,saveFurnitureCustomization,getSeriesCatalog:()=>seriesCatalog};})()',ctx);
  return {actions,state,furniture,library,storage,fields};
}
const field=(scope,id,key,value)=>({tagName:'INPUT',value,dataset:{scope,id,key}});
test('A Bútor adatai és Alkatrészek oldalon minden változás automatikusan mentődik',()=>{
  assert.doesNotMatch(html,/data-action="save-furniture-customization"/);
  assert.doesNotMatch(html,/data-furniture-save-status/);
  assert.match(html,/document\.addEventListener\('input',autoSaveFurnitureEdits\)/);
  assert.match(html,/document\.addEventListener\('change',autoSaveFurnitureEdits\)/);
});
test('A legutóbb beírt IF, paraméter és alkatrész adatai azonnal menthetők',()=>{
  const x=setup();
  x.fields.push(field('part','p1','ifCondition','szokli=1-2-3'));
  x.fields.push(field('part','p1','a','W-2*T-10'));
  x.fields.push(field('part','p1','name','Front szokli'));
  x.fields.push(field('custom-param','rule1','name','szokli'));
  x.fields.push(field('custom-param','rule1','value','3'));
  x.fields.push(field('furniture','f1','destination','Nappali'));
  const result=x.actions.saveFurnitureCustomization();
  assert.equal(result.ok,true);
  assert.match(result.message,/elmentve a programban/);
  const project=JSON.parse(x.storage.get('lapterv-library-v1'));
  const saved=project[0].data.furnitures[0];
  assert.equal(saved.parts[0].ifCondition,'szokli=1-2-3');
  assert.equal(saved.parts[0].a,'W-2*T-10');
  assert.equal(saved.parts[0].name,'Front szokli');
  assert.equal(saved.customParameters[0].value,'3');
  assert.equal(saved.destination,'Nappali');
  const legacy=JSON.parse(x.storage.get('lapterv-project-v2'));
  assert.equal(legacy.furnitures[0].parts[0].ifCondition,'szokli=1-2-3');
});
test('IF feltétel megmarad akkor is, ha az oldal újrarajzolódik',()=>{
  const mark=html.match(/<details class="part-if-panel"[\s\S]{0,1000}?<summary title="IF – megmunkálási feltétel">IF<\/summary>/);
  assert.ok(mark,'Az IF panelnek a mentett kifejezéstől függően nyitottnak kell lennie');
  assert.match(mark[0],/String\(part.ifCondition\|\|''\)\.trim\(\)\?'open':''/);
  assert.match(html,/value="\$\{h\(part.ifCondition\|\|''\)\}"/);
  assert.match(html,/if\(key==='ifCondition'\)save\(\);/);
});
test('A szériában a testreszabás helyben elmentődik, nem hagyja el a szerkesztőt',()=>{
  const x=setup('series-edit');
  x.fields.push(field('part','p1','ifCondition','szokli=1-2-3'));
  const first=x.actions.saveFurnitureCustomization();
  assert.equal(first.ok,true);
  assert.equal(first.message.includes('széria'),true);
  const saved=JSON.parse(x.storage.get('gatterka-szeriatar-v1'));
  assert.equal(saved.length,1);
  assert.equal(saved[0].id,'template1');
  assert.equal(saved[0].furniture.parts[0].ifCondition,'szokli=1-2-3');
  x.furniture.parts[0].ifCondition='szokli=2';
  x.fields[0].value='szokli=2';
  x.actions.saveFurnitureCustomization();
  const second=JSON.parse(x.storage.get('gatterka-szeriatar-v1'));
  assert.equal(second.length,1);
  assert.equal(second[0].furniture.parts[0].ifCondition,'szokli=2');
  assert.equal(x.storage.has('lapterv-library-v1'),false);
});
test('Ha a helyi tárhely nem írható, a program nem állíthatja hogy mentett',()=>{
  const x=setup('editor',{storageFailure:true});
  assert.equal(x.actions.saveFurnitureCustomization().ok,false);
  assert.equal(x.storage.size,0);
  const y=setup('series-edit',{storageFailure:true});
  assert.equal(y.actions.saveFurnitureCustomization().ok,false);
  assert.equal(y.storage.size,0);
});
test('Az IF új kifejezése nem indít xMix/xPrg gépi exportot',()=>{
  assert.doesNotMatch(code,/saveXprgToSelectedFolder|buildOfflineXprgProject|downloadXprgProject/);
  assert.match(html,/queueMicrotask\(\(\)=>/);
  assert.match(html,/captureVisibleFurnitureEdits\(\)/);
  assert.match(html,/el\.dispatchEvent\(new Event\('input',\{bubbles:true\}\)\)/);
});
