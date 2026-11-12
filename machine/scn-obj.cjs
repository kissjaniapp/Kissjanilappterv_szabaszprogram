'use strict';
/**
 * KitchenDraw SDK2 OBJ -> Gatterka 3D jelenet, alkatrész és szekrényadatok.
 * Az SCN-t a KitchenDraw nyitja meg; a Gatterka NEM találgatja a zárt
 * bináris SCN geometriáját. Csak a tényleges OBJ háromszögek és az SDK
 * objektumjegyzék adják az eredményt.
 */
(function(root){
 function fail(message){throw new Error(message)}
 const nround=n=>Math.round(n*1000)/1000;
 const safeName=s=>String(s||'').replace(/[\u0000-\u001f]/g,'').trim().slice(0,100);
 function cabinetHint(name){
   const s=safeName(name);
   // Kizárólag explicit OBJ elnevezési hierarchia alapján csoportosítunk.
   const m=/^(?:(?:Bútor|Butor|Cabinet|Szekrény|Szekreny)\s*[-_#]?\s*\d+)[\\/|:]+/i.exec(s);
   return m?s.slice(0,m[0].length).replace(/[\\/|:]+$/,'').trim():'';
 }
 function solidBox(vertices,faces,lo,hi){
   const dims=hi.map((v,i)=>v-lo[i]),eps=.025;
   if(faces.length<12||dims.some(v=>v<=0))return false;
   const thin=dims.indexOf(Math.min(...dims));
   if(dims[thin]>50||dims.some((v,i)=>i!==thin&&v<50))return false;
   // Nem elegendő a befoglaló téglatest! A háromszögek ténylegesen
   // lefedjék mind a hat síkot, és ne legyen belső/ferde/hiányos felület.
   const planes=Array(6).fill(0);
   for(const tri of faces){
     const points=tri.map(i=>vertices[i]);
     if(points.some(v=>!v))return false;
     let plane=-1;
     for(let a=0;a<3;a++)for(let side=0;side<2;side++){
       const target=side?hi[a]:lo[a];
       if(points.every(p=>Math.abs(p[a]-target)<eps)){plane=a*2+side;break;}
     }
     if(plane<0)return false;
     const a=points[0],b=points[1],c=points[2],u=b.map((v,k)=>v-a[k]),v=c.map((x,k)=>x-a[k]);
     const area=Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])/2;
     if(!Number.isFinite(area)||area<.0001)return false;
     planes[plane]+=area;
   }
   return planes.every((area,i)=>{
     const axis=Math.floor(i/2),expected=dims.filter((_,k)=>k!==axis).reduce((a,b)=>a*b,1);
     return Math.abs(area-expected)<Math.max(.1,expected*.005);
   });
 }
 function parseObj(text,manifest,options={}){
   if(typeof text!=='string'||!text.length)fail('A KitchenDraw nem adott vissza OBJ geometriát.');
   if(text.length>24*1024*1024)fail('A KitchenDraw OBJ 24 MB-nál nagyobb.');
   const scale=Number(options.mmPerUnit??1);
   if(!Number.isFinite(scale)||scale<=0||scale>1000)fail('Az SCN OBJ méretaránya érvénytelen.');
   const source=text.split(/\r?\n/),vertices=[],groups=[],warnings=[];
   let group={name:'Ismeretlen objektum',faces:[],source:'obj'};
   const openGroup=name=>{
     if(group.faces.length)groups.push(group);
     group={name:safeName(name)||'Ismeretlen objektum',faces:[],source:'obj'};
   };
   for(const line of source){
     const trim=line.trim();
     if(trim.startsWith('v ')){
       const v=trim.slice(2).trim().split(/\s+/).slice(0,3).map(Number);
       if(v.length!==3||v.some(x=>!Number.isFinite(x)||Math.abs(x*scale)>100000))
         fail('Hibás SCN-OBJ csúcskoordináta.');
       vertices.push(v.map(x=>x*scale));
       if(vertices.length>1000000)fail('A SCN túl sok csúcspontot tartalmaz.');
     }else if(trim.startsWith('o ')){
       openGroup(trim.slice(2));
     }else if(trim.startsWith('g ')){
       // Az OBJ g/o csoportok nem feltétlenül bútorok: a pontos
       // kapcsolat hiányában csak a csoportnevüket használjuk.
       openGroup(trim.slice(2));
     }else if(trim.startsWith('f ')){
       const tokens=trim.slice(2).trim().split(/\s+/);
       if(tokens.length<3||tokens.length>32)fail('Érvénytelen OBJ lap.');
       const ids=tokens.map(token=>{
         const n=Number(token.split('/')[0]);
         const id=n<0?vertices.length+n:n-1;
         if(!Number.isInteger(n)||n===0||id<0||id>=vertices.length)fail('Az SCN-OBJ érvénytelen csúcsra hivatkozik.');
         return id;
       });
       for(let i=1;i+1<ids.length;i++)group.faces.push([ids[0],ids[i],ids[i+1]]);
       if(group.faces.length>200000)fail('Egy SCN objektum túl sok háromszöget tartalmaz.');
     }
   }
   if(group.faces.length)groups.push(group);
   if(!groups.length)fail('Az SCN OBJ nem tartalmaz háromszögeket.');
   if(groups.length>600)fail('Az SCN OBJ túl sok külön objektumot tartalmaz (600+).');
   const objects=Array.isArray(manifest?.objects)?manifest.objects:[];
   const modelParts=[],modelGroups=[],cabinetNames=new Set(),usedNames=new Set();
   for(const [index,g] of groups.entries()){
     const used=[...new Set(g.faces.flat())],remap=new Map(used.map((id,i)=>[id,i]));
     const points=used.map(i=>vertices[i]);
     const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
     for(const v of points)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],v[k]);hi[k]=Math.max(hi[k],v[k]);}
     const sizes=hi.map((n,k)=>n-lo[k]);
     if(sizes.some(v=>!Number.isFinite(v)||v<.1||v>10000)){
       warnings.push(g.name+': a geometria túl kicsi, nagy vagy érvénytelen.');continue;
     }
     const tris=g.faces.map(tri=>tri.map(i=>remap.get(i)));
     const isRectangular=solidBox(points,tris,lo,hi);
     const clean=safeName(g.name);
     const candidates=objects.filter(x=>safeName(x.name)===clean||safeName(x.reference)===clean);
     // Az SDK metadata objektumai nincsenek az OBJ hálókkal közös
     // azonosítóval összekapcsolva: többszörös találat nem igazolás.
     const candidate=candidates.length===1?candidates[0]:null;
     const dims=[...sizes].sort((a,b)=>b-a).map(nround);
     const metaDims=candidate?[candidate.widthMm,candidate.depthMm,candidate.heightMm].map(Number).sort((a,b)=>b-a):[];
     const matched=metaDims.length===3&&metaDims.every((n,i)=>Math.abs(n-dims[i])<=Math.max(1,dims[i]*.01));
     const verifiedPart=candidate?.isPart===true&&matched&&isRectangular;
     const cabinet=cabinetHint(clean)||safeName(candidate?.cabinetName);
     if(cabinet)cabinetNames.add(cabinet);
     const stride=Math.max(1,Math.ceil(tris.length/450));
     const previewTriangles=[];
     for(let i=0;i<tris.length;i+=stride){
       previewTriangles.push(tris[i].flatMap(id=>points[id].map(nround)));
       if(previewTriangles.length>=450)break;
     }
     const number=modelParts.length;
     modelParts.push({id:'scn-'+index,name:clean||('SCN objektum '+(index+1)),dimensions:dims,
       originMm:lo.map(nround),axisBoundsMm:sizes.map(nround),
       previewTriangles,isRectangular,isAngledCut:false,scnCabinet:cabinet,
       scnPartVerified:verifiedPart,scnNeedsReview:!verifiedPart,
       scnMetadataMatched:!!matched,
       scnOriginalObjGroup:index});
     modelGroups.push({name:clean||('SCN objektum '+(index+1)),dimensions:dims,
       indices:[number],isRectangular,isAngledCut:false,scnCabinet:cabinet,
       scnPartVerified:verifiedPart,scnNeedsReview:!verifiedPart});
     if(!isRectangular)warnings.push(clean+': nem bizonyított téglatest, csak 3D nézet; nincs automatikus szabás/CNC.');
     else if(!verifiedPart)warnings.push(clean+': OBJ és KitchenDraw alkatrész-metaadat nem azonosítható biztosan; a szabáshoz kézi jóváhagyás kell.');
   }
   if(!modelParts.length)fail('Nincs használható OBJ-objektum a KitchenDraw jelenetben.');
   return {schema:'gatterka-3mf-v1',source:'scn',designName:safeName(manifest?.sceneName||options.filename||'SCN modell'),
     parts:modelParts,groups:modelGroups,scnCabinets:[...cabinetNames],
     warnings: warnings.slice(0,100)};
 }
 const api={parseObj,solidBox,cabinetHint};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 if(root)root.GatterkaScn=api;
})(typeof window!=='undefined'?window:null);
