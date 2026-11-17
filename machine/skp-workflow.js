  // SKP: a teljes dekóder háttérszálon fut; csak a kiválasztott bútor
  // kompakt geometriája kerül a projektbe. A nyers SKP nem mentődik el.
  const skpImportSessions=new Map();
  function skpFinishGeometry(raw){
    if(raw?.source!=='skp'||!Array.isArray(raw.parts)||!raw.parts.length)throw Error('Nincs SKP felületgeometria.');
    const model=JSON.parse(JSON.stringify(raw));
    for(const shape of model.parts){
      const nodes=shape.triangles.map(tri=>({getAttribute:key=>tri[{v1:0,v2:1,v3:2}[key]]}));
      shape.isRectangular=threeMfRectangularSolid(shape.vertices,nodes,shape.axisBoundsMm,shape.originMm);
      shape.isAngledCut=!shape.isRectangular&&!shape.skpHasCurves&&threeMfAngledPanel(shape.vertices,nodes,shape.axisBoundsMm,shape.originMm);
      shape.skpOriginalName=shape.name;
      delete shape.vertices;delete shape.triangles;
    }
    // Általános SketchUp Group# nevek mellett a geometria szerint
    // használható elnevezés; az eredeti név és azonosító külön megmarad.
    const vertical=model.parts.filter(p=>p.isRectangular&&p.axisBoundsMm.indexOf(Math.min(...p.axisBoundsMm))===0);
    const left=vertical.length?Math.min(...vertical.map(p=>p.originMm[0])):0;
    const right=vertical.length?Math.max(...vertical.map(p=>p.originMm[0])):0;
    const bottom=vertical.length?Math.min(...vertical.map(p=>p.originMm[2])):0;
    const top=vertical.length?Math.max(...vertical.map(p=>p.originMm[2]+p.axisBoundsMm[2])):0;
    for(const p of model.parts){
      if(!/^(?:(?:Group|Component|Difference)(?:#?\d+)?|Csoport\s*\d*)$/i.test(p.name))continue;
      const s=p.axisBoundsMm,t=s.indexOf(Math.min(...s)),near=(a,b)=>Math.abs(a-b)<.12;
      let role='Díszítőelem';
      if(p.isRectangular){
        role=t===0?(right>left&&(near(p.originMm[0],left)||near(p.originMm[0],right))?
          (near(p.originMm[0],left)?'Bal oldal':'Jobb oldal'):'F-osztó'):
          t===2?(near(s[2],38)?'Munkalap':near(p.originMm[2]+s[2],bottom)||near(p.originMm[2],bottom)?'Fenék':
            near(p.originMm[2],top)||near(p.originMm[2]+s[2],top)?'Tető':'V-osztó / fix polc'):'Függőleges zárólap';
      }else if(p.skpContour&&p.dimensions[1]>=50&&!p.skpHasCurves)role='Alakos lap';
      else if(p.dimensions[1]<50)role='Szerelvény';
      p.name=role+' '+p.skpOrdinal;
    }
    model.groups=model.parts.map((p,index)=>({name:p.name,dimensions:p.dimensions.slice(),indices:[index],
      isRectangular:p.isRectangular,isAngledCut:p.isAngledCut,skpDefinitionId:p.skpDefinitionId,skpPath:p.skpPath}));
    return model;
  }
  function skpCloseSession(id){const session=skpImportSessions.get(String(id));if(session)session.close();skpImportSessions.delete(String(id));}
  function skpCreateSession(){
    const source=document.getElementById('gatterka-skp-reader')?.textContent;
    if(!source)throw Error('Az SKP-olvasó hiányzik a telepítésből.');
    const dispatcher=`\nlet session;onmessage=({data})=>{try{let value;if(data.action==='open'){session=GatterkaSkp.openSkp(data.buffer);value=session.choices;}
      else if(data.action==='extract')value=GatterkaSkp.extractSkp(session,data.key,{widthAxis:data.widthAxis});
      else throw Error('Ismeretlen SKP kérés.');postMessage({id:data.id,value});}catch(error){postMessage({id:data.id,error:error.message||String(error)});}};`;
    const url=URL.createObjectURL(new Blob([source,dispatcher],{type:'text/javascript'}));
    let worker;try{worker=new Worker(url);}finally{URL.revokeObjectURL(url);}
    let serial=0,closed=false;const pending=new Map();
    worker.onmessage=({data})=>{const p=pending.get(data.id);if(!p)return;pending.delete(data.id);data.error?p.reject(Error(data.error)):p.resolve(data.value);};
    worker.onerror=()=>{for(const p of pending.values())p.reject(Error('Az SKP feldolgozása megszakadt. Próbáld újra megnyitni a fájlt.'));pending.clear();};
    return {request(action,fields={},transfer=[]){if(closed)return Promise.reject(Error('Az SKP munkamenet bezárult.'));return new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});worker.postMessage({id,action,...fields},transfer);});},
      close(){closed=true;worker.terminate();for(const p of pending.values())p.reject(Error('Másik SKP fájl betöltése miatt a kérés megszakadt.'));pending.clear();},selection:0};
  }
  function skpImportControls(f){
    const meta=f?.skpImport;if(!meta)return '';
    const live=skpImportSessions.has(String(f.id));
    const options=(meta.choices||[]).map(c=>'<option value="'+h(c.key)+'" '+(c.key===meta.selectedKey?'selected':'')+'>'+h(c.path.replace(/^Teljes SKP modell \/ /,''))+'</option>').join('');
    return '<div class="top-gap"><strong>SKP: '+h(meta.name)+'</strong>'+
      '<div class="toolbar" style="margin-top:8px"><label style="flex:1">Bútor / csoport<select data-skp-component '+(!live?'disabled':'')+'><option value="">Válassz bútort vagy csoportot…</option>'+options+'</select></label>'+
      '<label>Szélességi tengely<select data-skp-width '+(!live?'disabled':'')+'>'+[['auto','Automatikus'],['0','SKP X'],['1','SKP Y']].map(([v,t])=>'<option value="'+v+'" '+(String(meta.widthAxis??'auto')===v?'selected':'')+'>'+t+'</option>').join('')+'</select></label></div>'+
      '<div class="tiny muted">'+(live?'A kiválasztás cseréli le a jelenlegi rajzot. A két polc/szerkezeti lap közti kötés alapból fix; az anyagot, szálirányt és élzárást az alkatrészlistán állíthatod.':'A kiválasztott bútor geometriája mentve van. Másik csoport választásához töltsd be újra ugyanazt az SKP fájlt.')+'</div>'+
      (f.threeMfImport?.source==='skp'?'<button type="button" class="btn sm top-gap" data-action="skp-contours">Alakos kontúrok mentése (DXF)</button>':'')+'</div>';
  }
  async function skpOpenFile(f,file){
    if(!file.name.toLowerCase().endsWith('.skp')||file.size>75*1024*1024||file.size<64)throw Error('Legfeljebb 75 MB-os SKP fájlt válassz.');
    const buffer=await file.arrayBuffer();skpCloseSession(f.id);
    const session=skpCreateSession();skpImportSessions.set(String(f.id),session);
    try{
      const choices=await session.request('open',{buffer},[buffer]);
      if(skpImportSessions.get(String(f.id))!==session)return;
      f.skpImport={schema:'gatterka-skp-import-v1',name:file.name,choices,selectedKey:'',widthAxis:'auto'};
      save();render();showNotice('SKP beolvasva. Válaszd ki a feldolgozandó bútort vagy csoportot.');
    }catch(error){if(skpImportSessions.get(String(f.id))===session)skpCloseSession(f.id);throw error;}
  }
  async function skpSelectComponent(f,key,widthAxis){
    const session=skpImportSessions.get(String(f?.id));
    if(!session)throw Error('Másik csoporthoz töltsd be újra az SKP fájlt.');
    if(!key)return;
    const request=++session.selection;
    const raw=await session.request('extract',{key,widthAxis:widthAxis==='auto'?null:Number(widthAxis)});
    if(skpImportSessions.get(String(f.id))!==session||request!==session.selection)return;
    const model=skpFinishGeometry(raw),meta=f.skpImport;
    threeMfApplyImport(f,model);f.scnImport=null;f.name=model.designName;
    f.skpImport={...meta,selectedKey:key,widthAxis};
    if(!save())throw Error('A kiválasztott SKP bútor mentése nem sikerült. Válassz kisebb csoportot.');
    render();showNotice('SKP bútor betöltve: '+model.designName+' · '+model.parts.length+' elem. A munkalap CNC-je külön elkészül, szabásba nem kerül.');
  }
  function skpElementsTable(f){
    const model=f?.threeMfImport;if(model?.source!=='skp')return '';
    const rows=model.parts.map(p=>{
      const status=Math.abs(p.dimensions[2]-38)<.001&&p.isRectangular?'Munkalap: CNC, szabás nélkül':
        p.isRectangular&&p.dimensions[1]>=50?'Szabás és CNC':p.isAngledCut?'Alakos előgyártmány; DXF':
        p.skpContour&&p.dimensions[1]>=50&&!p.skpHasCurves?'Alakos kontúr; DXF':'Csak 3D / szerelvény';
      return '<tr><td title="'+h(p.skpPath)+'">'+h(p.name)+'</td><td>'+p.dimensions.map(nfmt).join(' × ')+'</td><td>'+h(status)+'</td></tr>';
    }).join('');
    return '<details class="top-gap"><summary>SKP elemek, munkalapok és szerelvények ('+model.parts.length+')</summary><div class="table-wrap"><table><thead><tr><th>Elem</th><th>Méret (mm)</th><th>Felhasználás</th></tr></thead><tbody>'+rows+'</tbody></table></div></details>';
  }
