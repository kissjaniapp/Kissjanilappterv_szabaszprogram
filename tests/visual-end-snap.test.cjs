const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=JSON.parse(fs.readFileSync('app/index.htm','utf8').match(/const GATTERKA_CABINET_INLINE_HTML=("(?:\\.|[^"\\])*");/s)[1]);
const ctx={};vm.createContext(ctx);vm.runInContext(html.slice(html.indexOf('function visualSnapEnd('),html.indexOf('function visualSnapBoards(')),ctx);
test('F lapvég az érintkező vízszintes lap közeli és túlsó élére pattan',()=>{
 const p={key:'f',x1:100,x2:118},b=[{key:'v',x1:0,x2:200,z1:300,z2:318}];
 assert.equal(ctx.visualSnapEnd(p,'f',297,b,6),300);
 assert.equal(ctx.visualSnapEnd(p,'f',321,b,6),318);
 assert.equal(ctx.visualSnapEnd(p,'f',340,b,6),340);
});
test('V lapvég az F mindkét élére illeszkedik; távoli laphoz nem tapad',()=>{
 const p={key:'v',z1:300,z2:318},b=[{key:'f',x1:100,x2:118,z1:0,z2:500}];
 assert.equal(ctx.visualSnapEnd(p,'h',97,b,6),100);
 assert.equal(ctx.visualSnapEnd(p,'h',121,b,6),118);
 assert.equal(ctx.visualSnapEnd({...p,z1:600,z2:618},'h',97,b,6),97);
});
