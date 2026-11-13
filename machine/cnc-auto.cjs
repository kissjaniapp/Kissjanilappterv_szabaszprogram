'use strict';
/**
 * CNC Xilog XXL automata terv: a bútortervező által kiszámolt, tényleges
 * csatlakozási geometriából dolgozik. NINCS átmérő-, furatszám- vagy
 * szerszámpálya-találgatás: az igazolt makrók a gyári furatkiosztást végzik.
 *
 * Bútortervezős és 3MF/SCN koordináta-alapú kapcsolatokból exportálunk.
 * A sikeres generálás nem igazolja a gépi ellenőrzést.
 * A szabászgép .xPrg/.xMix kódja és sorrendje teljesen független.
 */
(function(root){
  const core=(typeof module!=='undefined'&&module.exports)
    ?require('./cnc-xxl.cjs'):(root&&root.GatterkaCnc);
  const FACES=new Set(['primary','reverse']);
  const VALID_MACROS=new Set(['LAPA','LAPF','ELF2','ELF3','ELF4','ELF5','REF','POLC','XBO','LAB']);
  function finite(n){return Number.isFinite(Number(n))?Number(n):NaN;}
  function round(n){return Number(Number(n).toFixed(3));}
  function cleanName(s){
    return String(s||'Alkatresz').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/[^A-Za-z0-9_-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,65)||'Alkatresz';
  }
  function appendFailure(arr,part,msg){arr.push({part:String(part||'Alkatrész'),reason:String(msg)});}
  const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const unit=a=>{const l=Math.hypot(...a);return l>1e-8?a.map(v=>v/l):null;};
  const positive=a=>{const k=[0,1,2].sort((i,j)=>Math.abs(a[j])-Math.abs(a[i]))[0];return a[k]<0?a.map(v=>-v):a;};
  const identity=[[1,0,0],[0,1,0],[0,0,1]];
  // Saját, derékszögű alkatrész-koordináták: Z a nagy lapra merőleges,
  // X/Y az egyenes, rá merőleges oldalfelületekhez igazodik.
  function localPanelFrame(triangles){
    if(!Array.isArray(triangles)||!triangles.length)return null;
    const faces=[],points=[];
    for(const t of triangles){
      if(!Array.isArray(t)||t.length!==9||!t.every(Number.isFinite))return null;
      const p=[t.slice(0,3),t.slice(3,6),t.slice(6,9)];points.push(...p);
      const n=cross(p[1].map((v,i)=>v-p[0][i]),p[2].map((v,i)=>v-p[0][i]));
      const area=Math.hypot(...n)/2;if(area<1e-7)continue;
      const normal=positive(unit(n)),plane=dot(normal,p[0]);
      let f=faces.find(f=>dot(f.normal,normal)>1-1e-8&&Math.abs(f.plane-plane)<.025);
      if(!f){f={normal,plane,area:0};faces.push(f);}f.area+=area;
    }
    const project=axis=>{const v=points.map(p=>dot(p,axis));return [Math.min(...v),Math.max(...v)];};
    const choices=[];
    for(const f of faces){
      const z=f.normal,zRange=project(z),thickness=zRange[1]-zRange[0];
      if(thickness<1||thickness>50)continue;
      if(!faces.some(g=>g!==f&&dot(g.normal,z)>1-1e-8&&Math.abs(g.plane-f.plane)>thickness-.05))continue;
      if(Math.min(Math.abs(f.plane-zRange[0]),Math.abs(f.plane-zRange[1]))>.025)continue;
      for(const side of faces){
        if(Math.abs(dot(side.normal,z))>1e-5)continue;
        const normalComponent=dot(side.normal,z);
        let x=positive(unit(side.normal.map((v,k)=>v-normalComponent*z[k]))),y=unit(cross(z,x));
        let xr=project(x),yr=project(y);
        if(xr[1]-xr[0]<yr[1]-yr[0]){x=positive(y);y=unit(cross(z,x));xr=project(x);yr=project(y);}
        const size=[xr[1]-xr[0],yr[1]-yr[0],thickness];
        if(size[1]<50)continue;
        choices.push({axes:[x,y,z],lo:[xr[0],yr[0],zRange[0]],size,
          score:size[0]*size[1],area:f.area});
      }
    }
    choices.sort((a,b)=>b.area-a.area||a.score-b.score);
    const best=choices[0];if(!best)return null;
    const origin=[0,1,2].map(k=>best.axes.reduce((s,a,i)=>s+a[k]*best.lo[i],0));
    return {origin,axes:best.axes,dimensions:best.size.map(round)};
  }
  function worldPoint(box,p){return [0,1,2].map(k=>box.frame.origin[k]+box.frame.axes.reduce((s,a,i)=>s+a[k]*p[i],0));}
  function alignPair(first,second){
    if(!first.localFrame&&!second.localFrame)return [first,second];
    const axes=(first.localFrame?first:second).frame.axes;
    const aligned=[];
    for(const box of [first,second]){
      const mapping=box.frame.axes.map(a=>axes.map(b=>dot(a,b)));
      if(mapping.some(row=>Math.max(...row.map(Math.abs))<1-1e-6))return null;
      const axisMap=mapping.map(row=>row.findIndex(v=>Math.abs(v)>1-1e-6));
      const signs=[1,1,1];axisMap.forEach((k,i)=>{signs[k]=Math.sign(mapping[i][k]);});
      const corners=[];
      for(let mask=0;mask<8;mask++){
        const p=worldPoint(box,box.lo.map((v,i)=>mask&(1<<i)?box.hi[i]:v));
        corners.push(axes.map(a=>dot(p,a)));
      }
      const lo=[0,1,2].map(k=>Math.min(...corners.map(p=>p[k]))),
        hi=[0,1,2].map(k=>Math.max(...corners.map(p=>p[k])));
      aligned.push({...box,lo,hi,size:hi.map((v,k)=>v-lo[k]),
        xAxis:axisMap[box.xAxis],yAxis:axisMap[box.yAxis],tAxis:axisMap[box.tAxis],signs,
        triangles:box.triangles.map(t=>[0,3,6].flatMap(i=>{
          const p=worldPoint(box,t.slice(i,i+3));return axes.map(a=>dot(p,a));
        }))});
    }
    return aligned;
  }
  // Csak a kapcsolódó felületet vetítjük, nem az egész test alakját tiltjuk.
  // A ferde felület nem kerül a tengelypárhuzamos sík háromszögei közé.
  function contactSpans(box,normal,plane,thin,span,width,range){
    if(box.rectangular)return [range];
    const triangles=box.triangles.filter(t=>[0,3,6].every(i=>Math.abs(t[i+normal]-plane)<=.12))
      .map(t=>[0,3,6].map(i=>[t[i+thin],t[i+span]]));
    const cuts=[...range];
    for(const tri of triangles)for(let i=0;i<3;i++){
      const a=tri[i],b=tri[(i+1)%3];
      cuts.push(a[1]);
      for(const x of width)if(Math.abs(b[0]-a[0])>1e-9){
        const u=(x-a[0])/(b[0]-a[0]);
        if(u>0&&u<1)cuts.push(a[1]+u*(b[1]-a[1]));
      }
    }
    const sorted=[...new Set(cuts.filter(y=>y>=range[0]&&y<=range[1]))].sort((a,b)=>a-b);
    function clip(poly,axis,bound,sign){
      const out=[];
      for(let i=0;i<poly.length;i++){
        const a=poly[i],b=poly[(i+1)%poly.length];
        const insideA=sign*(a[axis]-bound)>=-1e-9,insideB=sign*(b[axis]-bound)>=-1e-9;
        if(insideA)out.push(a);
        if(insideA!==insideB){
          const u=(bound-a[axis])/(b[axis]-a[axis]);
          out.push(a.map((v,k)=>v+u*(b[k]-v)));
        }
      }
      return out;
    }
    const result=[];
    for(let i=1;i<sorted.length;i++){
      const lo=sorted[i-1],hi=sorted[i],expected=(width[1]-width[0])*(hi-lo);
      if(expected<=1e-8)continue;
      let area=0;
      for(let poly of triangles){
        poly=clip(poly,0,width[0],1);poly=clip(poly,0,width[1],-1);
        poly=clip(poly,1,lo,1);poly=clip(poly,1,hi,-1);
        area+=Math.abs(poly.reduce((sum,a,j)=>{
          const b=poly[(j+1)%poly.length];return sum+a[0]*b[1]-b[0]*a[1];
        },0))/2;
      }
      if(Math.abs(area-expected)>Math.max(.001,expected*1e-6))continue;
      const last=result[result.length-1];
      if(last&&Math.abs(last[1]-lo)<1e-7)last[1]=hi;else result.push([lo,hi]);
    }
    return result;
  }
  /**
   * 3MF szerkezeti érintkezések: tengelypárhuzamos lapszél és lapfelület
   * illeszkedéséből, ferde lapnál csak a valóban fedett egyenes szakaszon.
   * Nincs 3MF furatadat: a makrókat a kapcsolatok koordinátái adják.
   * A generálás és a gépi ellenőrzés állapotát külön jelezzük.
   */
  function threeMfContactDrafts(furniture,allowedIds,options={}){
    const model=furniture?.threeMfImport;
    const data={byPart:new Map(),errors:new Map(),warnings:new Map(),contacts:[]};
    if(!Array.isArray(model?.parts)||!Array.isArray(model?.groups))return data;
    const allowed=new Set((allowedIds||[]).map(String));
    const byKey=new Map((furniture.parts||[]).filter(p=>p.threeMfGenerated&&allowed.has(String(p.id)))
      .map(p=>[String(p.cabinetDesignKey||''),p]));
    const boxes=[],eps=.12,near=(a,b)=>Math.abs(a-b)<=eps;
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
      const q=Number(part.q);
      if(!Number.isInteger(q)||q!==group.indices.length){
        error(part.id,'A darabszám eltér az eredeti 3MF testpéldányok számától.');continue;
      }
      for(const index of group.indices){
        const shape=model.parts[index];
        if(!shape||!Array.isArray(shape.originMm)||
           !Array.isArray(shape.axisBoundsMm)||shape.originMm.length!==3||
           shape.axisBoundsMm.length!==3){
          error(part.id,'Hiányoznak az eredeti 3MF felületkoordináták; importáld újra a modellt.');continue;
        }
        const triangles=(shape.cncTriangles||shape.previewTriangles||[]).filter(t=>
          Array.isArray(t)&&t.length===9&&t.every(Number.isFinite));
        if(shape.isRectangular!==true&&!triangles.length){
          error(part.id,'Hiányoznak az eredeti 3MF felületadatok; importáld újra a modellt.');continue;
        }
        const frame=shape.cncFrame||(shape.isRectangular!==true&&shape.isAngledCut!==true?localPanelFrame(triangles):null);
        const localFrame=!!frame;
        const localTriangles=localFrame?triangles.map(t=>[0,3,6].flatMap(i=>{
          const p=t.slice(i,i+3).map((v,k)=>v-frame.origin[k]);return frame.axes.map(a=>dot(p,a));
        })):triangles;
        const lo=localFrame?[0,0,0]:shape.originMm.map(Number),
          size=localFrame?frame.dimensions:shape.axisBoundsMm.map(Number);
        if(![...lo,...size].every(Number.isFinite)||size.some(v=>v<1||v>10000)){
          error(part.id,'Hibás 3MF világkoordináták vagy lapméret.');continue;
        }
        const hi=lo.map((v,k)=>v+size[k]);
        const axes=[0,1,2].sort((a,b)=>size[b]-size[a]||a-b);
        const [xAxis,yAxis,tAxis]=axes;
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
          threeMfDraft:true,contactCount:0,cncFrame:frame||undefined};
        const box={part,index,lo,hi,size,xAxis,yAxis,tAxis,entry,triangles:localTriangles,localFrame,
          frame:frame||{origin:[0,0,0],axes:identity},signs:[1,1,1],
          rectangular:shape.isRectangular===true,
          primaryFace:null};
        // A külső előlap egyetlen szomszédjára sem kérünk kötésfuratot.
        box.noCnc=/kulso.*elolap/.test(cleanName(part.name||shape.name).toLowerCase());
        boxes.push(box);
        if(!data.byPart.has(String(part.id)))data.byPart.set(String(part.id),[]);
        data.byPart.get(String(part.id)).push(entry);
      }
    }
    const overlap=(a,b,k)=>[Math.max(a.lo[k],b.lo[k]),Math.min(a.hi[k],b.hi[k])];
    // Gépi mm-értékek: a modell 3MF transzformációs pontossága ezredmilliméteres
    // eltéréseket tartalmazhat; a DX/DY és az élfurat ugyanazon 0,01 mm-es
    // precizitással épüljön fel, hogy a kerekített makró ne lógjon túl.
    const coord=(p,k,value)=>{
      const raw=p.signs[k]>0?value-p.lo[k]:p.hi[k]-value;
      const max=k===p.xAxis?p.entry.dx:k===p.yAxis?p.entry.dy:p.entry.dz;
      // A 3MF-ben a felületi síkok ±0,12 mm tűréssel kapcsolódnak.
      // Ennek hatására sem az X/Y kezdőpont, sem az élfurat nem lóghat
      // a kerekített DX/DY CNC-kontúron kívülre.
      if(raw<-.12||raw>max+.12)throw new Error('A szerkezeti találkozás CNC koordinátája kívül esik a lapon.');
      return Math.min(max,Math.max(0,Math.round(raw*100)/100));
    };
    for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
      const pair=alignPair(boxes[i],boxes[j]);if(!pair)continue;
      const [a,b]=pair;
      if(a.noCnc||b.noCnc)continue;
      if(a.part.id===b.part.id)continue;
      const intervals=[0,1,2].map(k=>overlap(a,b,k));
      const intersections=intervals.map(([lo,hi])=>hi-lo);
      for(let normal=0;normal<3;normal++){
        if(!near(a.hi[normal],b.lo[normal])&&!near(b.hi[normal],a.lo[normal]))continue;
        const other=[0,1,2].filter(k=>k!==normal);
        if(other.some(k=>intersections[k]<=eps))continue; // csak él-/pontérintés
        if(a.tAxis===normal&&b.tAxis===normal)continue; // nagy lapfelület: egyik oldal sem fúrandó
        let face,edge;
        if(a.tAxis===normal&&b.tAxis!==normal){face=a;edge=b;}
        else if(b.tAxis===normal&&a.tAxis!==normal){face=b;edge=a;}
        else{
          continue;
        }
        const thin=edge.tAxis,span=other.find(k=>k!==thin);
        if(span===undefined||Math.abs(intersections[thin]-edge.size[thin])>eps||
           intersections[span]<50){
          continue;
        }
        const planeA=near(a.hi[normal],b.lo[normal])?a.hi[normal]:a.lo[normal];
        const planeB=near(a.hi[normal],b.lo[normal])?b.lo[normal]:b.hi[normal];
        const rangesA=contactSpans(a,normal,planeA,thin,span,intervals[thin],intervals[span]);
        const rangesB=contactSpans(b,normal,planeB,thin,span,intervals[thin],intervals[span]);
        for(const ra of rangesA)for(const rb of rangesB){
        const fromSpan=Math.max(ra[0],rb[0]),toSpan=Math.min(ra[1],rb[1]);
        if(toSpan-fromSpan<50)continue;
        const faceSurface=(near(edge.hi[normal],face.lo[normal])===(face.signs[normal]>0))?'min':'max';
        if(face.entry.primaryFace===undefined)face.entry.primaryFace=faceSurface;
        const faceSide=face.entry.primaryFace===faceSurface?'primary':'reverse';
        const center=(intervals[thin][0]+intervals[thin][1])/2;
        const from=fromSpan,nominalLength=round(toSpan-fromSpan);
        const faceFrom=face.signs[span]>0?from:toSpan,edgeFrom=edge.signs[span]>0?from:toSpan;
        const freeFace=face.entry[span===face.xAxis?'dx':'dy']-coord(face,span,faceFrom);
        const freeEdge=edge.entry[span===edge.xAxis?'dx':'dy']-coord(edge,span,edgeFrom);
        const length=Math.max(0,Math.floor((Math.min(nominalLength,freeFace,freeEdge)+1e-6)*100)/100);
        if(length<50){error(face.part.id,'A 3MF kötésfurat hossza a lap szélén kívülre esik.');continue;}
        let faceOp;
        if(span===face.yAxis)
          faceOp={macro:'LAPA',X:coord(face,face.xAxis,center),
            Y:coord(face,face.yAxis,faceFrom),y:length,face:faceSide};
        else if(span===face.xAxis)
          faceOp={macro:'LAPF',X:coord(face,face.xAxis,faceFrom),
            Y:coord(face,face.yAxis,center),x:length,face:faceSide};
        else throw new Error('3MF felületi tengelyhiba.');
        // Nem furatot keresünk: az érintkező ÉL saját min/max oldalát
        // a valódi 3D találkozási sík dönti el, nem a másik lap színoldala.
        const contactPlane=near(a.hi[normal],b.lo[normal])?
          (a.hi[normal]+b.lo[normal])/2:(b.hi[normal]+a.lo[normal])/2;
        const edgeAtMin=(Math.abs(contactPlane-edge.lo[normal])<=
          Math.abs(contactPlane-edge.hi[normal]))===(edge.signs[normal]>0);
        let edgeOp;
        if(normal===edge.xAxis&&span===edge.yAxis)
          edgeOp={macro:edgeAtMin?'ELF3':'ELF2',
            Y:coord(edge,edge.yAxis,edgeFrom),y:length,face:'primary'};
        else if(normal===edge.yAxis&&span===edge.xAxis)
          edgeOp={macro:edgeAtMin?'ELF4':'ELF5',
            X:coord(edge,edge.xAxis,edgeFrom),x:length,face:'primary'};
        else throw new Error('3MF él tengelyhiba.');
        faceOp.joint='divider';edgeOp.joint='divider';
        face.entry.operations.push(faceOp);
        edge.entry.operations.push(edgeOp);
        face.entry.contactCount++;
        edge.entry.contactCount++;
        data.contacts.push({face:face.entry.key,edge:edge.entry.key,
          faceName:face.entry.name,edgeName:edge.entry.name,
          coordinateSystem:a.localFrame||b.localFrame?'part':'world',
          normal,span,length,faceMacro:faceOp.macro,edgeMacro:edgeOp.macro,
          faceStart:{X:faceOp.X,Y:faceOp.Y},edgeStart:edgeOp.X===undefined?
            {Y:edgeOp.Y}:{X:edgeOp.X},
          faceLength:faceOp.x??faceOp.y,edgeLength:edgeOp.x??edgeOp.y});
        }
      }
    }
    for(const box of boxes)if(!box.entry.operations.length){
      box.entry.noCnc=true;
      box.entry.noCncReason=box.noCnc?'Külső előlap: CNC-fúrás nélkül.':
        'Nincs fúrandó lapélkapcsolat; lapfelületi érintkezéshez nem készül furat.';
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
    if(operation.macro==='LAB'){
      const x=finite(operation.X),y=finite(operation.Y);
      if(!(x>0&&y>0&&x<=10000&&y<=10000))throw new Error('Érvénytelen LAB X/Y.');
      return 'LAB X='+round(x)+' Y='+round(y)+' G=2';
    }
    if(operation.macro==='REF'){
      if(operation.DX===undefined)return 'REF';
      const dx=finite(operation.DX),bx=finite(operation.BX);
      if(!Number.isFinite(dx)||dx<=0||!Number.isFinite(bx)||bx<0)
        throw new Error('Hibás REF DX vagy BX érték.');
      return 'REF DX='+round(dx)+' BX='+round(bx);
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
    if(operation.macro==='XBO'){
      const X=finite(operation.X),Y=finite(operation.Y),z=finite(operation.z),
        V=finite(operation.V),R=finite(operation.R),x=finite(operation.x),
        y=finite(operation.y),D=finite(operation.D),F=finite(operation.F);
      if(![X,Y,z,V,R,x,y,D,F].every(Number.isFinite)||X<0||Y<0||
         z!==13||V!==1||D!==5||F!==1||y!==0||x<8||x>200||
         !Number.isInteger(R)||R<1||R>99||operation.N!=='P')
        throw new Error('Hibás XBO polctartó furatcsoport.');
      return 'XBO X='+round(X)+' Y='+round(Y)+' z=13 V=1 R='+R+
        ' x='+round(x)+' y=0 D=5 N=P F=1';
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
  function connectionAdvisory(message){
    return /^(?:Szerkezeti kapcsolat CNC-furatai ellenőrzendők\.|.+: (?:kivett darab, CNC-csatlakozás ellenőrizendő\.|az egyedi lapvég\/eltolás CNC-csatlakozását ellenőrizni kell\.|önálló F\/V rekeszszakaszok, CNC-kötések ellenőrzendők\.|egyedi eltolás\/végpont CNC-csatlakozása ellenőrizendő\.))$/.test(String(message));
  }
  function compileEntry(entry,mode){
    const problems=Array.isArray(entry.issues)?entry.issues.filter(x=>x&&!connectionAdvisory(x)):[];
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
        if(part.dxfUnverified||part.dxfGenerated||
           (part.threeMfGenerated&&!entry.threeMfDraft)){
          appendFailure(result.blocked,shown,'Nem hiteles 3MF/DXF alkatrész nem kaphat automatikus szerkezeti furatprogramot.');
          continue;
        }
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
            appendFailure(result.skipped,shown,entry.noCncReason||'Állítható polc: polctartós kivitel, saját kötésfuratot nem igényel.');
          }
          continue;
        }
        try{
          const content=compileEntry(entry,modes);
          for(const warning of (entry.issues||[]).filter(connectionAdvisory))
            appendFailure(result.warnings,shown,warning);
          const suffix=cleanName(identity);
          const prefix=(name+'_'+cleanName(part.name||entry.name)).slice(0,Math.max(1,155-suffix.length));
          const filename=(entry.threeMfDraft?(furniture?.threeMfImport?.source==='scn'?'SCN_TERV_':'3MF_TERV_'):'')+prefix+'_'+suffix+'.xxl';
          result.files.push({id:String(part.id)+'::'+identity,part:shown,filename,
            content,draft:entry.threeMfDraft===true,
            commands:(entry.operations||[]).map(op=>macroLine(op,modes)).join('\n'),
            side:entry.side||'IJ'});
        }catch(err){appendFailure(result.blocked,shown,err?.message||'Ismeretlen CNC hiba');}
      }
    }
    return result;
  }
  const api={cleanName,macroLine,compileEntry,localPanelFrame,threeMfContactDrafts,makeAutoPrograms};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.GatterkaCncAuto=api;
})(typeof window!=='undefined'?window:null);
