'use strict';
/**
 * CNC Xilog XXL automata terv: a bútortervező által kiszámolt, tényleges
 * csatlakozási geometriából dolgozik. NINCS átmérő-, furatszám- vagy
 * szerszámpálya-találgatás: az igazolt makrók a gyári furatkiosztást végzik.
 *
 * A bútortervező és a 3MF tényleges lap-él kapcsolatai exportálhatók.
 * Hiányos geometriánál név szerinti hiba, meglévő művelet nem veszhet el.
 * A szabászgép .xPrg/.xMix kódja és sorrendje teljesen független.
 */
(function(root){
  const core=(typeof module!=='undefined'&&module.exports)
    ?require('./cnc-xxl.cjs'):(root&&root.GatterkaCnc);
  const FACES=new Set(['primary','reverse']);
  const VALID_MACROS=new Set(['LAPA','LAPF','ELF2','ELF3','ELF4','ELF5','REF','POLC','XBO','XFALC','LAB']);
  function finite(n){return Number.isFinite(Number(n))?Number(n):NaN;}
  function round(n){return Number(Number(n).toFixed(3));}
  function cleanName(s){
    return String(s||'Alkatresz').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/[^A-Za-z0-9_-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,65)||'Alkatresz';
  }
  function appendFailure(arr,part,msg){arr.push({part:String(part||'Alkatrész'),reason:String(msg)});}
  // A munkalap csak a SZABÁSBÓL marad ki. Az eredeti 3MF-testekből
  // külön CNC-rekordot készítünk, a mentett alkatrészlistát nem bővítjük.
  function threeMfCncFurniture(furniture,allowedIds){
    const parts=[...(furniture?.parts||[])],allowed=new Set((allowedIds||[]).map(String));
    const model=furniture?.threeMfImport,deleted=new Set(furniture?.deletedPartKeys||[]);
    const hidden=new Set(furniture?.scnImport?.hiddenGroupIndices||[]);
    for(const [index,group] of (Array.isArray(model?.groups)?model.groups:[]).entries()){
      const key='3mf-'+(index+1),dims=group.dimensions;
      if(parts.some(p=>p.cabinetDesignKey===key)||deleted.has(key)||
          !Array.isArray(dims)||dims.length!==3||Number(dims[0])<50||Number(dims[1])<50||
          !(Math.abs(Number(dims[2])-38)<.001||/munkalap|worktop/i.test(group.name||''))||
          !Array.isArray(group.indices)||!group.indices.length)continue;
      const indices=group.indices.filter(i=>!hidden.has(i));
      if(!indices.length)continue;
      const part={id:'3mf-cnc-only-'+(index+1),cabinetDesignKey:key,
        name:group.name||'Munkalap',a:String(dims[0]),b:String(dims[1]),
        q:String(indices.length),threeMfThickness:Number(dims[2]),
        threeMfGenerated:true,cncOnly:true};
      parts.push(part);allowed.add(part.id);
    }
    return {furniture:{...furniture,parts},allowedIds:[...allowed]};
  }
  function threeMfRole(name){
    const text=String(name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .toLowerCase().replace(/[_–—-]+/g,' ').replace(/\s+/g,' ').trim();
    if(/(?:^|\b)f\s*(?:oszto|divider)(?:\b|\d)/.test(text))return 'f';
    if(/(?:^|\b)v\s*(?:oszto|divider)(?:\b|\d)/.test(text))return 'v';
    if(/munkalap|worktop/.test(text))return 'worktop';
    if(/oldal|side/.test(text))return 'side';
    if(/hatfal|hatlap|back/.test(text))return 'back';
    if(/teto|(?:^|\b)top(?:\b|\d)/.test(text))return 'top';
    if(/fenek|bottom/.test(text))return 'bottom';
    if(/polc|shelf/.test(text))return 'flat';
    return '';
  }
  /**
   * 3MF szerkezeti csatlakozások: a tényleges lapszél-találkozásból
   * számolt CNC makrókat mindig megőrizzük. A lap-lap érintkezés és
   * a befoglaló téglatestek átfedése önmagában NEM exporttiltás.
   */
  function threeMfContactDrafts(furniture,allowedIds,options={}){
    const cncInput=threeMfCncFurniture(furniture,allowedIds);
    furniture=cncInput.furniture;allowedIds=cncInput.allowedIds;
    const model=furniture?.threeMfImport;
    const data={byPart:new Map(),errors:new Map(),warnings:new Map(),contacts:[]};
    if(!Array.isArray(model?.parts)||!Array.isArray(model?.groups))return data;
    const allowed=new Set((allowedIds||[]).map(String));
    const byKey=new Map((furniture.parts||[]).filter(p=>p.threeMfGenerated&&allowed.has(String(p.id)))
      .map(p=>[String(p.cabinetDesignKey||''),p]));
    const boxes=[],eps=.12,near=(a,b)=>Math.abs(a-b)<=eps;
    const hidden=new Set(furniture?.scnImport?.hiddenGroupIndices||[]);
    // A név szerinti szerkezeti lapok vastagsági tengelyei adják a
    // bútor keretét. Így Y-felfelé exportált modell is használható.
    const vote=(values,fallback)=>values.length?values.sort((a,b)=>
      values.filter(x=>x===b).length-values.filter(x=>x===a).length)[0]:fallback;
    const thicknessAxis=shape=>{
      const size=Array.isArray(shape?.axisBoundsMm)?shape.axisBoundsMm.map(Number):null;
      return Array.isArray(size)&&size.length===3&&size.every(Number.isFinite)?size.indexOf(Math.min(...size)):-1;
    };
    const anchors=model.parts.filter(shape=>thicknessAxis(shape)>=0)
      .map(shape=>({role:threeMfRole(shape.name),axis:thicknessAxis(shape)}));
    const up=vote(anchors.filter(a=>['v','flat','top','bottom','worktop'].includes(a.role)).map(a=>a.axis),2);
    const width=vote(anchors.filter(a=>['f','side'].includes(a.role)&&a.axis!==up).map(a=>a.axis),up===0?1:0);
    const depth=[0,1,2].find(axis=>axis!==up&&axis!==width);
    const verticalColumns=model.parts.filter(shape=>shape?.isRectangular===true&&
      Array.isArray(shape.originMm)&&shape.originMm.length===3&&
      shape.originMm.every(value=>Number.isFinite(Number(value)))&&thicknessAxis(shape)===width);
    const minColumn=verticalColumns.length?Math.min(...verticalColumns.map(b=>b.originMm[width])):0;
    const maxColumn=verticalColumns.length?Math.max(...verticalColumns.map(b=>b.originMm[width])):0;
    const minVertical=verticalColumns.length?Math.min(...verticalColumns.map(b=>b.originMm[up])):0;
    const maxVertical=verticalColumns.length?Math.max(...verticalColumns.map(b=>b.originMm[up]+b.axisBoundsMm[up])):0;
    const error=(id,reason)=>{
      if(!data.errors.has(id))data.errors.set(id,String(reason));
    };
    const warn=(id,reason)=>{
      const messages=data.warnings.get(id)||[];
      if(!messages.includes(String(reason)))messages.push(String(reason));
      data.warnings.set(id,messages);
    };
    for(let gi=0;gi<model.groups.length;gi++){
      const group=model.groups[gi],part=byKey.get('3mf-'+(gi+1));
      if(!part)continue;
      if(!Array.isArray(group.indices)||!group.indices.length){
        error(part.id,'A 3MF csoporthoz nincs eredeti szilárdtest.');continue;
      }
      const indices=group.indices.filter(index=>!hidden.has(index));
      const q=Number(part.q);
      if(!Number.isInteger(q)||q!==(part.cncOnly?indices.length:group.indices.length)){
        error(part.id,'A darabszám eltér az eredeti 3MF testpéldányok számától.');continue;
      }
      for(const index of indices){
        const shape=model.parts[index];
        if(!shape||shape.isRectangular!==true||!Array.isArray(shape.originMm)||
           !Array.isArray(shape.axisBoundsMm)||shape.originMm.length!==3||
           shape.axisBoundsMm.length!==3){
          error(part.id,'Nem hitelesített, nem téglatest alakú vagy régi 3MF geometria.');continue;
        }
        const lo=shape.originMm.map(Number),size=shape.axisBoundsMm.map(Number);
        if(![...lo,...size].every(Number.isFinite)||size.some(v=>v<1||v>10000)){
          error(part.id,'Hibás 3MF világkoordináták vagy lapméret.');continue;
        }
        const hi=lo.map((v,k)=>v+size[k]);
        const axes=[0,1,2].sort((a,b)=>size[b]-size[a]||a-b);
        let [xAxis,yAxis,tAxis]=axes;
        let role=threeMfRole(shape.name)||threeMfRole(part.name);
        // A névtelen Body testek is az importáló rögzített X=szélesség,
        // Y=mélység, Z=magasság keretében szerkezeti lapok. A szerepet
        // és a CNC tengelyeit ilyenkor a fizikai sík és a hely határozza meg.
        if(!role){
          if(tAxis===width)role=maxColumn-minColumn>eps&&
            (near(lo[width],minColumn)||near(lo[width],maxColumn))?'side':'f';
          else if(tAxis===up)role=near(size[tAxis],38)?'worktop':
            verticalColumns.length&&(near(lo[up],maxVertical)||near(hi[up],maxVertical))?'top':
            verticalColumns.length&&(near(hi[up],minVertical)||near(lo[up],minVertical))?'bottom':'v';
          else if(tAxis===depth)role='back';
        }
        if(['f','side'].includes(role)&&tAxis===width){xAxis=up;yAxis=depth;}
        else if(['v','flat','top','bottom','worktop'].includes(role)&&tAxis===up){xAxis=width;yAxis=depth;}
        else if(role==='back'&&tAxis===depth){xAxis=width;yAxis=up;}
        if(size[tAxis]>50){
          error(part.id,'A 3MF testen nem azonosítható a lap vastagsági tengelye.');continue;
        }
        const a=Number(options.actualDimensions?.[part.id]?.a??part.a);
        const b=Number(options.actualDimensions?.[part.id]?.b??part.b);
        const actualZ=Number(options.actualThicknesses?.[part.id]??part.threeMfThickness??size[tAxis]);
        // A 3MF CNC-TESZTTERVET mindig a tényleges 3MF test geometriája
        // határozza meg. A getParts() szabászati alapanyaga lehet más
        // vastagságú (pl. 18 mm a 3MF-ben 36 mm helyett), a szálirány
        // felcserélhető, a képlet átszámolhatja a lapméretet.
        // Ilyenkor a CNC-modellt nem dobhatjuk el: az eredeti 3MF-tervet
        // külön FIGYELMEZTETÉSSEL kimentjük, nem gyártásra hitelesítve.
        const dimMismatch=![a,b].every(Number.isFinite)||
          !(near(a,size[xAxis])&&near(b,size[yAxis])||
            near(a,size[yAxis])&&near(b,size[xAxis]));
        const thickMismatch=!Number.isFinite(actualZ)||!near(actualZ,size[tAxis]);
        if(dimMismatch||thickMismatch){
          const modelDims=round(size[xAxis])+' × '+round(size[yAxis])+' × '+round(size[tAxis]);
          const currentDims=[a,b,actualZ].map(v=>Number.isFinite(v)?round(v):'?').join(' × ');
          warn(part.id,'3MF CNC TESZTTERV az eredeti '+modelDims+
            ' mm modell szerint készül. A jelenlegi alkatrész-/anyagadat '+
            currentDims+' mm; az eltérés nem állítja meg a tervek mentését. '+
            'A gépi megmunkálás előtt az anyagot és a készméretet egyeztesd.');
        }
        const entry={key:'3mf-contact-'+(gi+1)+'-'+index,
          name:String(part.name||shape.name||'3MF test'),dx:Math.round(size[xAxis]*100)/100,
          dy:Math.round(size[yAxis]*100)/100,
          dz:Math.round(size[tAxis]*100)/100,side:'IJ',operations:[],issues:[],
          threeMfDraft:true,contactCount:0};
        const box={part,index,lo,hi,size,xAxis,yAxis,tAxis,entry,
          primaryFace:null,role};
        boxes.push(box);
        if(!data.byPart.has(String(part.id)))data.byPart.set(String(part.id),[]);
        data.byPart.get(String(part.id)).push(entry);
      }
    }
    const fColumns=[...new Set(boxes.filter(b=>b.role==='f').map(b=>round(b.lo[width])))].sort((a,b)=>a-b);
    const sideBoxes=boxes.filter(b=>b.role==='side');
    const leftSide=sideBoxes.length?Math.min(...sideBoxes.map(b=>b.lo[width])):0;
    const rightSide=sideBoxes.length?Math.max(...sideBoxes.map(b=>b.lo[width])):0;
    for(const box of boxes){
      if(box.role==='f')box.entry.side=fColumns.indexOf(round(box.lo[width]))%2===0?'IJ':'LK';
      if(box.role==='side'){
        const name=String(model.parts[box.index].name||box.part.name).toLowerCase();
        box.rightSide=/jobb|right/.test(name)||(!/bal|left/.test(name)&&rightSide>leftSide&&near(box.lo[width],rightSide));
        box.entry.side=box.rightSide?'LK':'IJ';
      }
    }
    const overlap=(a,b,k)=>[Math.max(a.lo[k],b.lo[k]),Math.min(a.hi[k],b.hi[k])];
    // Gépi mm-értékek: a modell 3MF transzformációs pontossága ezredmilliméteres
    // eltéréseket tartalmazhat; a DX/DY és az élfurat ugyanazon 0,01 mm-es
    // precizitással épüljön fel, hogy a kerekített makró ne lógjon túl.
    const coord=(p,k,value)=>{
      const raw=value-p.lo[k];
      const max=k===p.xAxis?p.entry.dx:k===p.yAxis?p.entry.dy:p.entry.dz;
      // A 3MF-ben a felületi síkok ±0,12 mm tűréssel kapcsolódnak.
      // Ennek hatására sem az X/Y kezdőpont, sem az élfurat nem lóghat
      // a kerekített DX/DY CNC-kontúron kívülre.
      if(raw<-.12||raw>max+.12)throw new Error('A szerkezeti találkozás CNC koordinátája kívül esik a lapon.');
      return Math.min(max,Math.max(0,Math.round(raw*100)/100));
    };
    for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
      const a=boxes[i],b=boxes[j];
      // Azonos alkatrészsor több különálló fizikai példánya is
      // találkozhat. A sorazonosító nem jelent azonos testet.
      const intervals=[0,1,2].map(k=>overlap(a,b,k));
      const intersections=intervals.map(([lo,hi])=>hi-lo);
      if(intersections.every(v=>v>eps)){
        // A 3MF szerkezetben lehetnek térben egymáshoz illesztett,
        // a befoglaló téglatestek alapján átfedő elemek. Ilyenkor
        // ebből a párból nem találunk ki furatot, de a többi érvényes
        // csatlakozást ÉS mindkét alkatrész programját megtartjuk.
        continue;
      }
      for(let normal=0;normal<3;normal++){
        if(!near(a.hi[normal],b.lo[normal])&&!near(b.hi[normal],a.lo[normal]))continue;
        const other=[0,1,2].filter(k=>k!==normal);
        if(other.some(k=>intersections[k]<=eps))continue; // csak él-/pontérintés
        let face,edge;
        if(a.tAxis===normal&&b.tAxis!==normal){face=a;edge=b;}
        else if(b.tAxis===normal&&a.tAxis!==normal){face=b;edge=a;}
        else{
          // Lapfelület-lapfelület / két élfelület találkozása nem
          // bizonyított lap-él furatkapcsolat. Nem generálunk
          // hozzá hamis furatot, és más megmunkálást sem blokkolunk.
          continue;
        }
        const thin=edge.tAxis,span=other.find(k=>k!==thin);
        if(span===undefined||Math.abs(intersections[thin]-edge.size[thin])>eps||
           intersections[span]<50){
          // Ez a geometriai pár nem ad érvényes furatszakaszt; a
          // többi csatlakozás CNC programját nem dobjuk el miatta.
          continue;
        }
        const faceSurface=near(edge.hi[normal],face.lo[normal])?'min':'max';
        if(face.primaryFace===null)face.primaryFace=faceSurface;
        let faceSide=face.primaryFace===faceSurface?'primary':'reverse';
        if(face.role==='f'&&normal===width)faceSide=faceSurface==='min'?'primary':'reverse';
        else if(face.role==='side'&&normal===width)
          faceSide=faceSurface===(face.rightSide?'min':'max')?'primary':'reverse';
        else if(['v','flat'].includes(face.role)&&normal===up)
          faceSide=faceSurface==='max'?'primary':'reverse';
        const center=(intervals[thin][0]+intervals[thin][1])/2;
        const from=intervals[span][0],nominalLength=round(intersections[span]);
        const freeFace=face.entry[span===face.xAxis?'dx':'dy']-coord(face,span,from);
        const freeEdge=edge.entry[span===edge.xAxis?'dx':'dy']-coord(edge,span,from);
        const length=Math.max(0,Math.floor((Math.min(nominalLength,freeFace,freeEdge)+1e-6)*100)/100);
        if(length<50)continue;
        let faceOp;
        if(span===face.yAxis)
          faceOp={macro:'LAPA',X:coord(face,face.xAxis,center),
            Y:coord(face,face.yAxis,from),y:length,face:faceSide};
        else if(span===face.xAxis)
          faceOp={macro:'LAPF',X:coord(face,face.xAxis,from),
            Y:coord(face,face.yAxis,center),x:length,face:faceSide};
        else throw new Error('3MF felületi tengelyhiba.');
        // Nem furatot keresünk: az érintkező ÉL saját min/max oldalát
        // a valódi 3D találkozási sík dönti el, nem a másik lap színoldala.
        const contactPlane=near(a.hi[normal],b.lo[normal])?
          (a.hi[normal]+b.lo[normal])/2:(b.hi[normal]+a.lo[normal])/2;
        const edgeAtMin=Math.abs(contactPlane-edge.lo[normal])<=
          Math.abs(contactPlane-edge.hi[normal]);
        let edgeOp;
        if(normal===edge.xAxis&&span===edge.yAxis)
          edgeOp={macro:edgeAtMin?'ELF3':'ELF2',
            Y:coord(edge,edge.yAxis,from),y:length,face:'primary'};
        else if(normal===edge.yAxis&&span===edge.xAxis)
          edgeOp={macro:edgeAtMin?'ELF4':'ELF5',
            X:coord(edge,edge.xAxis,from),x:length,face:'primary'};
        else throw new Error('3MF él tengelyhiba.');
        // Tető/fenék: a bútortervezőben az F végfurataival érintkező
        // lapfelület az első oldal; a két oldallapi él FORDIT után készül.
        if(['top','bottom'].includes(face.role)&&normal===up)faceOp.face='primary';
        if(['top','bottom'].includes(edge.role)&&normal===width&&
            boxes.some(box=>box.role==='f'&&
              (near(box.hi[up],edge.lo[up])||near(box.lo[up],edge.hi[up]))&&
              overlap(box,edge,depth)[1]-overlap(box,edge,depth)[0]>eps&&
              overlap(box,edge,width)[1]-overlap(box,edge,width)[0]>eps))
          edgeOp.face='reverse';
        // Ugyanaz a jobb/belső F-oldali 15–15 mm-es eltolás és
        // excenteres G=2 élfurat, mint a bútortervező fJoint szabálya.
        if(face.role==='f'&&normal===width&&span===depth&&edge.tAxis===up){
          const shifted=faceSurface==='max'||fColumns.indexOf(round(face.lo[width]))>0;
          if(shifted){
            if(length<=30){
              warn(edge.part.id,'Az F-osztó eltolt furatsorához 30 mm-nél nagyobb mélység kell.');
              continue;
            }
            faceOp.Y=round(faceOp.Y+15);faceOp.y=round(length-30);faceOp.shiftedF=true;
            edgeOp.Y=round(edgeOp.Y+15);edgeOp.y=round(length-30);edgeOp.shiftedF=true;
            edgeOp.gOverride=2;
          }
        }
        faceOp.joint='divider';edgeOp.joint='divider';
        face.entry.operations.push(faceOp);
        edge.entry.operations.push(edgeOp);
        face.entry.contactCount++;
        edge.entry.contactCount++;
        data.contacts.push({face:face.entry.key,edge:edge.entry.key,
          faceName:face.entry.name,edgeName:edge.entry.name,
          normal,span,length,faceMacro:faceOp.macro,edgeMacro:edgeOp.macro,
          faceStart:{X:faceOp.X,Y:faceOp.Y},edgeStart:edgeOp.X===undefined?
            {Y:edgeOp.Y}:{X:edgeOp.X},
          faceLength:faceOp.x??faceOp.y,edgeLength:edgeOp.x??edgeOp.y});
      }
    }
    // Ha csak az egyik fizikai lapoldal fúrandó, az az első felrakás.
    // Kétoldali megmunkálásnál a bevált FORDIT továbbra is megmarad.
    for(const box of boxes){
      if(box.entry.operations.length&&box.entry.operations.every(op=>op.face==='reverse'))
        for(const op of box.entry.operations)op.face='primary';
    }
    for(const box of boxes)if(!box.entry.operations.length){
      // Nincs automatikusan felismerhető fúrás: a felhasználó ettől
      // még kapjon szerkeszthető .xxl-t (fejléc és VEGE, furat nélkül).
      // Például a külső előlap lap-lap találkozása nem fúrandó.
      box.entry.noMachining=true;
      warn(box.part.id,'Ehhez a 3MF testhez nem adódott lap-él furat. Az XXL fájl csak fejlécet és VEGE lezárást tartalmaz; nem fog fúrni.');
    }
    return data;
  }
  function jointMode(operation,mode){
    // A teljes bútor összes szerkezeti kötésére ugyanaz a választott mód
    // vonatkozik (a POLC polctartó furat ettől független).
    const settings=typeof mode==='string'?{assemblyJoint:mode}:mode||{};
    return settings.assemblyJoint||settings.carcassJoint||settings.dividerJoint||'excenter';
  }
  function macroLine(operation,mode){
    if(!operation||!VALID_MACROS.has(operation.macro))
      throw new Error('A megadott alkatrésznél nem támogatott CNC makró.');
    if(!core)throw new Error('A CNC makrófordító nem töltődött be.');
    if(operation.macro==='REF'){
      if(operation.DX===undefined)return 'REF';
      const dx=finite(operation.DX);
      const hasBx=operation.BX!==undefined&&operation.BX!==null;
      const bx=hasBx?finite(operation.BX):0;
      if(!Number.isFinite(dx)||dx<=0||!Number.isFinite(bx)||bx<0)
        throw new Error('Hibás REF DX vagy BX érték.');
      return 'REF DX='+round(dx)+(hasBx?' BX='+round(bx):'');
    }
    if(operation.macro==='POLC'){
      const y=finite(operation.Y),q=finite(operation.Q),sp=finite(operation.s);
      if(!Number.isFinite(y)||y<0||!Number.isInteger(q)||q<0||q>12||
          !Number.isFinite(sp)||sp<8||sp>200)
        throw new Error('A POLC Y/Q/s paraméter nem érvényes.');
      // POLC G nem azonos a tiplis/összehúzós LAPA/ELF G-kóddal:
      // a két felhasználói PGM minta kifejezetten G=1# F=1.
      return 'POLC Y='+round(y)+' Q='+q+'# s='+round(sp)+' G=1# F=1';
    }
    if(operation.macro==='LAB'){
      const X=finite(operation.X),Y=finite(operation.Y);
      if(!Number.isFinite(X)||!Number.isFinite(Y)||X<0||Y<0||
          Number(operation.G)!==2)throw new Error('Hibás LAB X/Y/G bútorláb-paraméter.');
      return 'LAB X='+round(X)+' Y='+round(Y)+' G=2';
    }
    if(operation.macro==='XFALC'){
      const q=Number(operation.Q);
      if(!Number.isInteger(q)||q<1||q>4||Number(operation.G)!==2)
        throw new Error('XFALC: Q=1–4 és G=2 kötelező.');
      return 'XFALC Q='+q+'# G=2#';
    }
    if(operation.macro==='XBO'){
      const X=finite(operation.X),Y=finite(operation.Y),z=finite(operation.z),
        V=finite(operation.V),R=finite(operation.R),x=finite(operation.x),
        y=finite(operation.y),D=finite(operation.D),F=finite(operation.F);
      if(![X,Y,z,V,R,x,y,D,F].every(Number.isFinite)||X<0||Y<0||
         z!==13||V!==1||D!==5||F!==1||y!==0||x<8||x>200||
         (!Number.isInteger(R)||R<1||R>10000)||operation.N!=='P')
        throw new Error('Hibás XBO polctartó furatcsoport.');
      return 'XBO X='+round(X)+' Y='+round(Y)+' z=13 V=1 R='+R+
        ' x='+round(x)+' y=0 D=5 N='+ (operation.fullRow?'"P"':'P')+' F=1';
    }
    const joint=jointMode(operation,mode),codes=core.jointCodes(joint);
    // A beküldött F-osztó + polc referenciák G=2 eltolt ELF furata
    // KIZÁRÓLAG excenteres összehúzásnál ismert. G=2 nem általános
    // "másik oldal": más kötésmódnál tilos néma felülírással dolgozni.
    if(operation.shiftedF&&joint!=='excenter')
      throw new Error('Az eltolt F-osztó furatpár csak excenteres (összehúzós) kötésnél hitelesített.');
    let G=operation.macro.startsWith('ELF')?codes.el:codes.lap;
    if(operation.shiftedF&&operation.gOverride!==undefined){
      if(!operation.macro.startsWith('ELF')||operation.gOverride!==2)
        throw new Error('Az F-osztós eltolt G felülírás csak ELF G=2 lehet.');
      G=2;
    }else if(operation.gOverride!==undefined){
      throw new Error('Engedély nélküli CNC furat-G felülírás.');
    }
    let body=operation.macro,fields=['X','Y','A','x','y'];
    for(const field of fields){
      if(field!=='A'&&operation[field]===undefined)continue;
      const v=field==='A'?0:finite(operation[field]);
      if(!Number.isFinite(v)||v<0||v>10000)throw new Error('Hibás '+field+' CNC koordináta.');
      body+=' '+field+'='+round(v);
    }
    return body+' G='+G;
  }
  function cncAdvisoryIssue(reason){
    // Régi projektekből megmaradt minősítési jelzések nem tilthatják
    // a már létező programot; valós méret- és CNC hibák továbbra is tiltanak.
    return /(?:egyedi eltolás\/végpont CNC-csatlakozása ellenőrizendő|kivett darab, CNC-csatlakozás ellenőrizendő|kézi F\/V darabolás, CNC-kötések ellenőrzendők|egyedi lapvég\/eltolás CNC-csatlakozását ellenőrizni kell|Rajzon kivett osztószakasz: a csatlakozó CNC-furatok ellenőrzendők)/i.test(String(reason||''));
  }
  function compileEntry(entry,mode){
    const problems=Array.isArray(entry.issues)?entry.issues.filter(issue=>issue&&!cncAdvisoryIssue(issue)):[];
    if(problems.length)throw new Error(problems.join('; '));
    const dx=finite(entry.dx),dy=finite(entry.dy),dz=finite(entry.dz);
    if(![dx,dy,dz].every(v=>v>0&&v<=10000))
      throw new Error('Érvénytelen DX/DY/DZ szerkezeti méret.');
    if(!Array.isArray(entry.operations))
      throw new Error('Hiányzó CNC-műveletlista.');
    if(entry.operations.length>500)throw new Error('Túl sok megmunkálás (>500).');
    const first=[],other=[];
    for(const op of entry.operations){
      const face=String(op.face||'primary');
      if(!FACES.has(face))throw new Error('Nem meghatározott megmunkálási oldal.');
      const target=face==='primary'?first:other;
      target.push(macroLine(op,mode));
    }
    // A Xilog minta elöl kezdi a megmunkálást, a túloldalt FORDIT-tal kéri.
    if(!first.length&&other.length)throw new Error('Csak hátoldali megmunkálás: nincs igazolt első oldali felrakási sorrend.');
    const lines=other.length?[...first,'FORDIT',...other]:first;
    return core.compileXxl({dx,dy,dz,side:entry.side||'IJ',
      commands:lines.join('\n'),allowEmpty:true});
  }
  /**
   * @param {object} furniture - az aktív bútor; part.cncInstances a designerből
   * @param {string[]} allowedIds - csak getParts() IF-szűrésen átment alkatrészek
   * @param {object} options - {dividerJoint:'tipli'|'excenter'|'csavar'|'hosszuExcenter'}
   */
  function makeAutoPrograms(furniture,allowedIds,options={}){
    if(!core)throw new Error('A CNC makrómodul hiányzik.');
    const cncInput=threeMfCncFurniture(furniture,allowedIds);
    furniture=cncInput.furniture;allowedIds=cncInput.allowedIds;
    const modes={assemblyJoint:String(options.assemblyJoint||options.dividerJoint||'excenter')};
    core.jointCodes(modes.assemblyJoint);
    const allowed=new Set((allowedIds||[]).map(String));
    const result={files:[],blocked:[],skipped:[],warnings:[],total:0};
    const used=new Set();
    const name=cleanName(furniture?.name||'Butor');
    const threeMf=threeMfContactDrafts(furniture,allowedIds,options);
    result.contacts=threeMf.contacts;
    for(const part of furniture?.parts||[]){
      for(const reason of threeMf.warnings.get(part.id)||[])
        appendFailure(result.warnings,part.name,reason);
    }
    for(const part of furniture?.parts||[]){
      if(!allowed.has(String(part.id)))continue;
      if(part.threeMfGenerated&&threeMf.errors.has(part.id)){
        appendFailure(result.blocked,part.name,threeMf.errors.get(part.id));continue;
      }
      const entries=part.threeMfGenerated?threeMf.byPart.get(String(part.id)):part.cncInstances;
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
        // A felhasználó saját gépi ellenőrzése alapján a külön
        // "nem hitelesített" eredetjelző nem zárja ki az exportot.
        // A méreteltérés, ismeretlen makró és hibás koordináta
        // változatlanul a tényleges geometriai ellenőrzésen bukik el.
        for(const warning of entry.warnings||[])
          appendFailure(result.warnings,shown,warning);
        // A kézi méretcsere/képlet átírása után nem szabad a régi furatokat
        // automatikusan a más méretű előgyártmányra kiküldeni.
        const a=finite(part.threeMfGenerated?options.actualDimensions?.[part.id]?.a:part.a),
          b=finite(part.threeMfGenerated?options.actualDimensions?.[part.id]?.b:part.b),z=finite(entry.dz);
        const actualZ=finite(options.actualThicknesses?.[part.id]);
        if(!entry.threeMfDraft&&Number.isFinite(actualZ)&&Math.abs(z-actualZ)>.11){
          appendFailure(result.blocked,shown,'Az anyag vastagsága eltér a bútor szerkezeti tervétől; új CNC-terv szükséges.');
          continue;
        }
        const same=Number.isFinite(a)&&Number.isFinite(b)&&
          Math.abs(a-finite(entry.dx))<=.11&&Math.abs(b-finite(entry.dy))<=.11;
        if(!entry.threeMfDraft&&!same){
          appendFailure(result.blocked,shown,'A szabásméret eltér a szerkezeti CNC-rajztól; előbb frissítsd a bútortervezőben.');
          continue;
        }
        if(finite(part.shelfBevelDegrees)>0.001){
          appendFailure(result.blocked,shown,'Döntött polchoz még nincs hiteles ferde furatmakró, a CNC export biztonságból tiltva.');
          continue;
        }
        if(entry.noCnc===true){
          if(entry.operations?.length||entry.issues?.length){
            appendFailure(result.blocked,shown,'CNC nélkül megjelölt alkatrészhez megmunkálás is tartozik; hibás szerkezeti adatok.');
          }else{
            appendFailure(result.skipped,shown,'Állítható polc: polctartós kivitel, saját kötésfuratot nem igényel.');
          }
          continue;
        }
        try{
          const content=compileEntry(entry,modes);
          const suffix=cleanName(identity);
          const prefix=(name+'_'+cleanName(part.name||entry.name)).slice(0,Math.max(1,155-suffix.length));
          const filename=(entry.threeMfDraft?(furniture?.threeMfImport?.source==='scn'?'SCN_TERV_':'3MF_TERV_'):'')+prefix+'_'+suffix+'.xxl';
          // A gépen kipróbált 3MF programokból nem írunk önkényes
          // NEM_HITELESITETT fejlécet; az eredet továbbra is látszik
          // a fájlnévben és a belső draft metaadatban.
          result.files.push({id:String(part.id)+'::'+identity,part:shown,filename,
            content,draft:entry.threeMfDraft===true,noMachining:entry.noMachining===true,
            commands:(entry.operations||[]).map(op=>macroLine(op,modes)).join('\n'),
            side:entry.side||'IJ'});
        }catch(err){appendFailure(result.blocked,shown,err?.message||'Ismeretlen CNC hiba');}
      }
    }
    return result;
  }
  const api={cleanName,macroLine,compileEntry,threeMfCncFurniture,threeMfContactDrafts,makeAutoPrograms};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.GatterkaCncAuto=api;
})(typeof window!=='undefined'?window:null);
