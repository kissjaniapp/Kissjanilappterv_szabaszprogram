'use strict';
/**
 * CNC Xilog XXL automata terv: a bútortervező által kiszámolt, tényleges
 * csatlakozási geometriából dolgozik. NINCS átmérő-, furatszám- vagy
 * szerszámpálya-találgatás: az igazolt makrók a gyári furatkiosztást végzik.
 *
 * Csak bútortervezős, hiteles szerkezeti kapcsolatokból exportálunk.
 * Más vagy hiányos geometriánál név szerinti hiba (nem félkész .xxl fájl).
 * A szabászgép .xPrg/.xMix kódja és sorrendje teljesen független.
 */
(function(root){
  const core=(typeof module!=='undefined'&&module.exports)
    ?require('./cnc-xxl.cjs'):(root&&root.GatterkaCnc);
  const FACES=new Set(['primary','reverse']);
  const VALID_MACROS=new Set(['LAPA','LAPF','ELF2','ELF3','ELF5']);
  function finite(n){return Number.isFinite(Number(n))?Number(n):NaN;}
  function round(n){return Number(Number(n).toFixed(3));}
  function cleanName(s){
    return String(s||'Alkatresz').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/[^A-Za-z0-9_-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,65)||'Alkatresz';
  }
  function appendFailure(arr,part,msg){arr.push({part:String(part||'Alkatrész'),reason:String(msg)});}
  function macroLine(operation,mode){
    if(!operation||!VALID_MACROS.has(operation.macro))
      throw new Error('A megadott alkatrésznél nem támogatott CNC makró.');
    if(!core)throw new Error('A CNC makrófordító nem töltődött be.');
    const joint=operation.joint==='fixed'?'tipli':mode;
    const codes=core.jointCodes(joint);
    const G=operation.macro.startsWith('ELF')?codes.el:codes.lap;
    let body=operation.macro,fields=['X','Y','A','x','y'];
    for(const field of fields){
      if(field!=='A'&&operation[field]===undefined)continue;
      const v=field==='A'?0:finite(operation[field]);
      if(!Number.isFinite(v)||v<0||v>10000)throw new Error('Hibás '+field+' CNC koordináta.');
      body+=' '+field+'='+round(v);
    }
    return body+' G='+G;
  }
  function compileEntry(entry,mode){
    const problems=Array.isArray(entry.issues)?entry.issues.filter(Boolean):[];
    if(problems.length)throw new Error(problems.join('; '));
    const dx=finite(entry.dx),dy=finite(entry.dy),dz=finite(entry.dz);
    if(![dx,dy,dz].every(v=>v>0&&v<=10000))
      throw new Error('Nincs hiteles DX/DY/DZ szerkezeti méret.');
    if(!Array.isArray(entry.operations)||!entry.operations.length)
      throw new Error('Ehhez az alkatrészhez nincs hiteles megmunkálási makró.');
    if(entry.operations.length>500)throw new Error('Túl sok megmunkálás (>500).');
    const first=[],other=[];
    for(const op of entry.operations){
      const face=String(op.face||'primary');
      if(!FACES.has(face))throw new Error('Nem meghatározott megmunkálási oldal.');
      (face==='primary'?first:other).push(macroLine(op,mode));
    }
    // A Xilog minta elöl kezdi a megmunkálást, a túloldalt FORDIT-tal kéri.
    if(!first.length&&other.length)throw new Error('Csak hátoldali megmunkálás: nincs igazolt első oldali felrakási sorrend.');
    const lines=other.length?[...first,'FORDIT',...other]:first;
    return core.compileXxl({dx,dy,dz,side:entry.side||'IJ',commands:lines.join('\n')});
  }
  /**
   * @param {object} furniture - az aktív bútor; part.cncInstances a designerből
   * @param {string[]} allowedIds - csak getParts() IF-szűrésen átment alkatrészek
   * @param {object} options - {dividerJoint:'tipli'|'excenter'|'csavar'|'hosszuExcenter'}
   */
  function makeAutoPrograms(furniture,allowedIds,options={}){
    if(!core)throw new Error('A CNC makrómodul hiányzik.');
    const mode=String(options.dividerJoint||'excenter');
    core.jointCodes(mode);
    const allowed=new Set((allowedIds||[]).map(String));
    const result={files:[],blocked:[],skipped:[],total:0};
    const used=new Set();
    const name=cleanName(furniture?.name||'Butor');
    for(const part of furniture?.parts||[]){
      if(!allowed.has(String(part.id)))continue;
      const entries=part.cncInstances;
      if(!Array.isArray(entries)||!entries.length){
        if(part.cabinetDesignKey==='back-rabbet'||part.cabinetDesignKey==='back-full'){
          appendFailure(result.skipped,part.name,'Hátfal: nincs egyeztetett CNC megmunkálás.');
        }else appendFailure(result.blocked,part.name,'Nincs a bútortervezőből származó szerkezeti CNC-geometria. Nyisd meg a bútortervezőt és mentsd a bútort.');
        continue;
      }
      for(let i=0;i<entries.length;i++){
        const entry=entries[i],identity=String(entry.key||part.cabinetDesignKey||part.id);
        const shown=(part.name||entry.name||identity)+' / '+identity;
        result.total++;
        if(used.has(identity)){
          appendFailure(result.blocked,shown,'Azonos CNC alkatrészazonosító kétszer szerepel.');
          continue;
        }
        used.add(identity);
        if(part.dxfUnverified||part.threeMfGenerated||part.dxfGenerated){
          appendFailure(result.blocked,shown,'Nem hiteles 3MF/DXF alkatrész nem kaphat automatikus szerkezeti furatprogramot.');
          continue;
        }
        // A kézi méretcsere/képlet átírása után nem szabad a régi furatokat
        // automatikusan a más méretű előgyártmányra kiküldeni.
        const a=finite(part.a),b=finite(part.b),z=finite(entry.dz);
        const actualZ=finite(options.actualThicknesses?.[part.id]);
        if(Number.isFinite(actualZ)&&Math.abs(z-actualZ)>.11){
          appendFailure(result.blocked,shown,'Az anyag vastagsága eltér a bútor szerkezeti tervétől; új CNC-terv szükséges.');
          continue;
        }
        const same=Number.isFinite(a)&&Number.isFinite(b)&&
          Math.abs(a-finite(entry.dx))<=.11&&Math.abs(b-finite(entry.dy))<=.11;
        if(!same){
          appendFailure(result.blocked,shown,'A szabásméret eltér a szerkezeti CNC-rajztól; előbb frissítsd a bútortervezőben.');
          continue;
        }
        if(finite(part.shelfBevelDegrees)>0.001){
          appendFailure(result.blocked,shown,'Döntött polchoz még nincs hiteles ferde furatmakró, a CNC export biztonságból tiltva.');
          continue;
        }
        try{
          const content=compileEntry(entry,mode);
          const suffix=cleanName(identity);
          const filename=(name+'_'+cleanName(part.name||entry.name)+'_'+suffix+'.xxl').slice(0,160);
          result.files.push({id:String(part.id)+'::'+identity,part:shown,filename,content,
            commands:(entry.operations||[]).map(op=>macroLine(op,mode)).join('\n'),
            side:entry.side||'IJ'});
        }catch(err){appendFailure(result.blocked,shown,err?.message||'Ismeretlen CNC hiba');}
      }
    }
    return result;
  }
  const api={cleanName,macroLine,compileEntry,makeAutoPrograms};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.GatterkaCncAuto=api;
})(typeof window!=='undefined'?window:null);
