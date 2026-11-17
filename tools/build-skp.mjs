import {build} from 'esbuild';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const result=await build({entryPoints:[path.join(root,'machine/skp-import.mjs')],bundle:true,write:false,
 platform:'browser',format:'iife',globalName:'GatterkaSkp',target:'es2022',minify:true,charset:'ascii',legalComments:'eof'});
const bundle=result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
const file=path.join(root,'app/index.htm');let html=(await readFile(file,'utf8')).replace(/\r\n/g,'\n');
for(const [name,key] of [['skp-workflow.js','WORKFLOW'],['skp-events.js','EVENTS']]){
 const content=(await readFile(path.join(root,'machine',name),'utf8')).replace(/\r\n/g,'\n');
 const regex=new RegExp('  /\\* GATTERKA_SKP_'+key+'_START \\*/[\\s\\S]*?  /\\* GATTERKA_SKP_'+key+'_END \\*/\\n');
 if(!regex.test(html))throw Error('Hiányzó SKP blokk: '+key);
 html=html.replace(regex,()=> '  /* GATTERKA_SKP_'+key+'_START */\n'+content+'  /* GATTERKA_SKP_'+key+'_END */\n');
}
let notices='OpenSKP 1.5.0, earcut 3.1.0, fflate, flatbuffers — offline SKP reader\n';
for(const file of ['OpenSKP-MIT.txt','earcut-ISC.txt','fflate-MIT.txt','flatbuffers-Apache-2.0.txt'])notices+='\n'+file+'\n'+(await readFile(path.join(root,'docs/licenses',file),'utf8')).replace(/\r\n/g,'\n');
const licenseTag='<script id="gatterka-skp-licenses" type="text/plain">\n'+notices.replace(/<\/script/gi,'<\\/script')+'\n</script>';
if(html.includes('<script id="gatterka-skp-licenses"'))html=html.replace(/<script id="gatterka-skp-licenses"[\s\S]*?<\/script>/,()=>licenseTag);
else html=html.replace('</body>',()=>licenseTag+'\n</body>');
const script='<script id="gatterka-skp-reader">\n'+bundle.trim()+'\n</script>';
if(html.includes('<script id="gatterka-skp-reader">'))html=html.replace(/<script id="gatterka-skp-reader">[\s\S]*?<\/script>/,()=>script);
else html=html.replace('</body>',()=>script+'\n</body>');
await writeFile(file,html);console.log('Offline SKP-olvasó beépítve: '+Buffer.byteLength(bundle)+' bájt.');
