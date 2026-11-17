'use strict';
// Native browser smoke test for the installed, single-file HTML and Blob worker.
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const assert=require('node:assert/strict');const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(fs.readFileSync(path.join(root,'app/index.htm')));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;try{
  const launch={headless:true};
  if(process.env.GATTERKA_BROWSER_PATH)launch.executablePath=process.env.GATTERKA_BROWSER_PATH;
  else if(process.platform==='win32')launch.channel='msedge';
  browser=await chromium.launch(launch);const page=await browser.newPage({viewport:{width:1440,height:1100}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.locator('[data-action="create-project"]').click();
  await page.locator('[data-action="choose-workflow-mode"][data-mode="parts"]').click();
  const input=page.locator('#gatterka-3mf-file');await input.setInputFiles(path.join(root,'fixtures/skp-nested-cabinet.skp'));
  await page.waitForFunction(()=>document.querySelectorAll('[data-skp-component] option').length>1,null,{timeout:30000});
  const key=await page.locator('[data-skp-component] option').evaluateAll(options=>options.find(o=>o.textContent.includes('Próbaszekrény'))?.value);assert.ok(key);
  await page.locator('[data-skp-component]').selectOption(key);
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('lapterv-project-v2'))?.furnitures?.some(f=>f.threeMfImport?.source==='skp'),null,{timeout:30000});
  const result=await page.evaluate(()=>{const state=JSON.parse(localStorage.getItem('lapterv-project-v2'));const f=state.furnitures.find(f=>f.id===state.selectedFurniture);const cnc=window.gatterkaBuildAutoCnc();return {parts:f.threeMfImport.parts.length,h:f.ht,w:f.w,d:f.d,cutParts:f.parts.length,files:cnc.files,contacts:cnc.contacts,blocked:cnc.blocked};});
  assert.deepEqual([result.w,result.d,result.h],[1000,400,938]);assert.equal(result.parts,3);assert.equal(result.cutParts,2);
  assert.equal(result.files.length,3,JSON.stringify(result.blocked));assert.equal(result.contacts.length,2);
  assert.ok(result.files.find(f=>f.content.includes('DZ=38')&&f.commands.includes('LAPA')));
  await page.screenshot({path:path.join(root,'skp-browser-smoke.png'),fullPage:false});
  await page.reload();await page.locator('[data-action="open-saved-project"]').first().click();
  const saved=await page.evaluate(()=>window.gatterkaBuildAutoCnc());assert.equal(saved.files.length,3);
  assert.equal(await page.locator('[data-skp-component]').isDisabled(),true);
  assert.deepEqual(errors,[]);console.log('SKP native browser smoke: worker, component selection, 3D, cutting list, CNC and reload passed.');
 }finally{await browser?.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});
