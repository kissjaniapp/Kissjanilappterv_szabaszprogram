const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('app/index.htm','utf8');
const html=JSON.parse(source.match(/const GATTERKA_CABINET_INLINE_HTML=("(?:\\.|[^"\\])*");/s)[1]);
test('F/V váltás és visszaváltás ugyanabban a rekeszben őrzi a kivett és eltolt szakaszt',()=>{
 const ctx={document:{querySelector:()=>({checked:false})}};vm.createContext(ctx);
 vm.runInContext('let visualPieceEdits={"f-divider-1-section-1":{shift:25}},visualCuts={"f-divider-1":{sections:true}},visualRemoved={"f-divider-1-section-2":true,"v-divider-1-section-1":true},visualSelected=null,visualDragging=null;'+html.slice(html.indexOf('function visualChangeThrough('),html.indexOf('function visualCoords(')),ctx);
 vm.runInContext('visualChangeThrough({dividerThrough:"f"},"v")',ctx);
 assert.equal(vm.runInContext('visualPieceEdits["f-divider-1-section-2"].shift',ctx),25);
 assert.equal(vm.runInContext('visualRemoved["f-divider-1-section-3"]',ctx),true);
 assert.equal(vm.runInContext('visualRemoved["v-divider-1-section-0"]',ctx),true);
 vm.runInContext('visualChangeThrough({dividerThrough:"v"},"f")',ctx);
 assert.equal(vm.runInContext('visualPieceEdits["f-divider-1-section-1"].shift',ctx),25);
 assert.equal(vm.runInContext('visualRemoved["f-divider-1-section-2"]',ctx),true);
 assert.equal(vm.runInContext('visualRemoved["v-divider-1-section-1"]',ctx),true);
});
