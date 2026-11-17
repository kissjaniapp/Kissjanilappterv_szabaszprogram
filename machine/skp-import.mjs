/** Offline SKP geometry import. OpenSKP 1.5.0 (MIT), earcut 3.1.0 (ISC). */
import {parseSkp} from 'openskp';
import earcut from 'earcut';
const mm=25.4,round=x=>Math.round(x*10000)/10000;
const ident=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const clean=s=>String(s||'').replace(/[\u0000-\u001f]/g,'').trim().slice(0,160);
function matrix(values){
 if(!Array.isArray(values)||values.length!==13||values.some(x=>!Number.isFinite(x)))throw Error('Hibás SKP transzformáció.');
 const s=values[12];return [values[0]*s,values[1]*s,values[2]*s,values[9]*s,
  values[3]*s,values[4]*s,values[5]*s,values[10]*s,values[6]*s,values[7]*s,values[8]*s,values[11]*s,0,0,0,1];
}
function mul(a,b){return Array.from({length:16},(_,i)=>{const row=Math.floor(i/4),col=i%4;return a[row*4]*b[col]+a[row*4+1]*b[col+4]+a[row*4+2]*b[col+8]+a[row*4+3]*b[col+12];});}
function point(m,v){return [0,1,2].map(k=>m[k*4]*v[0]+m[k*4+1]*v[1]+m[k*4+2]*v[2]+m[k*4+3]);}
export function sessionFromModel(model){
 if(!model?.root||!(model.definitions instanceof Map))throw Error('Az SKP nem adott vissza komponensfát.');
 const nodes=new Map(),choices=[];
 function walk(d,T,key,path,depth,seen,inheritedMaterial){
  if(depth>64||seen.has(d.id))throw Error('Körkörös vagy túl mély SKP komponensfa.');
  if(nodes.size>=30000)throw Error('Túl sok külön SKP komponens. Válassz kisebb rajzot.');
  const node={definition:d,T,key,path,inheritedMaterial};nodes.set(key,node);
  if(d.instances.length||depth===1&&d.faces.length)choices.push({key,name:path.at(-1),path:path.join(' / '),depth,definitionId:d.id});
  const trail=new Set([...seen,d.id]);
  for(let i=0;i<d.instances.length;i++){
   const ins=d.instances[i],child=model.definitions.get(ins.refIdx);
   if(!child||ins.hidden)continue;
   walk(child,mul(T,matrix(ins.matrix)),key+'/'+i,[...path,clean(ins.name||child.name)||'Csoport '+(i+1)],depth+1,trail,ins.materialId??inheritedMaterial);
  }
 }
 walk(model.root,ident(),'root',['Teljes SKP modell'],0,new Set(),null);
 if(choices.length===1&&!model.root.faces.length)throw Error('Az SKP nem tartalmaz elhelyezett bútort vagy csoportot.');
 return {model,nodes,choices};
}
export function openSkp(buffer){
 if(!buffer||!Number.isFinite(buffer.byteLength)||buffer.byteLength<64||buffer.byteLength>75*1024*1024)
  throw Error('Legfeljebb 75 MB-os, érvényes SKP fájlt válassz.');
 return sessionFromModel(parseSkp(buffer));
}
function triangulate(d,vertices){
 const edges=new Map(d.edges.map(e=>[e.id,e])),polygons=[],triangles=[];
 for(const face of d.faces){
  const loops=face.loops.map(loop=>loop.map(c=>{
   const e=edges.get(c.edgeId);if(!e)throw Error('Hiányzó SKP lapszél.');
   return c.orientation===1?e.v1Id:e.v2Id;
  }));
  if(!loops.length||loops[0].length<3)continue;
  const outer=loops[0].map(id=>vertices.get(id));
  if(outer.some(p=>!p))throw Error('Hiányzó SKP csúcs.');
  // Newell normal supports concave polygons; holes remain holes in earcut.
  const normal=[0,0,0];for(let i=0;i<outer.length;i++){const p=outer[i],q=outer[(i+1)%outer.length];normal[0]+=(p[1]-q[1])*(p[2]+q[2]);normal[1]+=(p[2]-q[2])*(p[0]+q[0]);normal[2]+=(p[0]-q[0])*(p[1]+q[1]);}
  if(Math.hypot(...normal)<1e-8)continue;
  const drop=normal.map(Math.abs).indexOf(Math.max(...normal.map(Math.abs))),axes=[0,1,2].filter(k=>k!==drop);
  const ids=loops.flat(),holes=[];let offset=loops[0].length;for(const loop of loops.slice(1)){holes.push(offset);offset+=loop.length;}
  const coords=ids.flatMap(id=>{const p=vertices.get(id);if(!p)throw Error('Hiányzó SKP csúcs.');return axes.map(k=>p[k]);});
  const indices=earcut(coords,holes,2);
  for(let i=0;i<indices.length;i+=3)triangles.push(indices.slice(i,i+3).map(j=>ids[j]));
  polygons.push({points:outer,holes:loops.length-1,materialId:face.materialId});
 }
 return {polygons,triangles};
}
export function extractSkp(session,key,options={}){
 const selected=session.nodes.get(key);if(!selected)throw Error('Nincs ilyen SKP csoport.');
 const T=selected.T,basis=[0,1,2].map(c=>[T[c],T[c+4],T[c+8]]),norm=basis.map(v=>Math.hypot(...v));
 if(norm.some(x=>x<1e-8))throw Error('Nulla méretarányú SKP komponens.');
 const unit=basis.map((v,i)=>v.map(x=>x/norm[i]));
 for(let a=0;a<3;a++)for(let b=a+1;b<3;b++)if(Math.abs(unit[a].reduce((n,x,i)=>n+x*unit[b][i],0))>1e-6)
  throw Error('Nyírt SKP csoport: válassz a fán belül egy önálló bútort.');
 const raw=[],warnings=[];
 function walk(d,M,path,material,seen){
  if(seen.has(d.id)||seen.size>64)throw Error('Körkörös SKP hivatkozás.');
  if(raw.length>=2000)throw Error('A csoport több mint 2000 testet tartalmaz. Válassz kisebb bútort.');
  if(d.faces.length&&d.vertices.length){
   const vertices=new Map(d.vertices.map(v=>{const p=point(M,[v.x,v.y,v.z]).map((x,i)=>x-T[i*4+3]);return [v.id,unit.map(u=>u.reduce((sum,x,i)=>sum+x*p[i],0)*mm)];}));
   const mesh=triangulate(d,vertices);
   if(mesh.triangles.length){
    const ids=[...vertices.keys()],lookup=new Map(ids.map((id,i)=>[id,i]));
    const matIds=[...new Set(mesh.polygons.map(p=>p.materialId??material).filter(id=>id!=null))];
    raw.push({id:'skp-'+raw.length,name:clean(path.at(-1)),skpDefinitionId:d.id,skpPath:path.join(' / '),
     skpHasCurves:!!d.arcs?.size||d.edges.some(e=>e.curveId!=null),vertices:[...vertices.values()],triangles:mesh.triangles.map(t=>t.map(id=>lookup.get(id))),polygons:mesh.polygons,
     skpMaterials:matIds.map(id=>clean(session.model.materialsById?.get(id)?.name)).filter(Boolean)});
   }
  }
  const next=new Set([...seen,d.id]);
  for(let i=0;i<d.instances.length;i++){
   const ins=d.instances[i],child=session.model.definitions.get(ins.refIdx);
   if(child&&!ins.hidden)walk(child,mul(M,matrix(ins.matrix)),[...path,clean(ins.name||child.name)||'Csoport '+(i+1)],ins.materialId??material,next);
  }
 }
 walk(selected.definition,T,selected.path,selected.inheritedMaterial,new Set());
 if(!raw.length)throw Error('A kiválasztott csoportban nincs felületgeometria.');
 const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
 for(const r of raw)for(const p of r.vertices)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],p[k]);hi[k]=Math.max(hi[k],p[k]);}
 const widthAxis=options.widthAxis===0||options.widthAxis===1?options.widthAxis:hi[1]-lo[1]>hi[0]-lo[0]?1:0;
 const order=widthAxis===1?[1,0,2]:[0,1,2],mapped=p=>order.map(k=>p[k]-lo[k]);
 const parts=raw.map((r,index)=>{
  const vertices=r.vertices.map(mapped),min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(const p of vertices)for(let k=0;k<3;k++){min[k]=Math.min(min[k],p[k]);max[k]=Math.max(max[k],p[k]);}
  const ext=max.map((x,i)=>x-min[i]);
  if(ext.some(x=>!Number.isFinite(x)||x<.01||x>10000))throw Error('Érvénytelen lapméret: '+r.name+'. Válassz egy önálló bútort.');
  const thin=ext.indexOf(Math.min(...ext)),axes=[0,1,2].filter(k=>k!==thin);
  const cap=r.polygons.map(poly=>({points:poly.points.map(mapped),holes:poly.holes})).filter(poly=>!poly.holes&&poly.points.every(p=>Math.abs(p[thin]-min[thin])<.025));
  const contour=cap.length===1&&cap[0].points.length<=128?{axes,points:cap[0].points.map(p=>axes.map(k=>round(p[k]-min[k])))}:null;
  const stride=Math.max(1,Math.ceil(r.triangles.length/450));
  const previewTriangles=r.triangles.filter((_,i)=>i%stride===0).slice(0,450).map(t=>t.flatMap(id=>vertices[id].map(round)));
  return {id:r.id,name:r.name,dimensions:ext.slice().sort((a,b)=>b-a).map(round),originMm:min.map(round),axisBoundsMm:ext.map(round),
   previewTriangles,skpHasCurves:r.skpHasCurves,skpDefinitionId:r.skpDefinitionId,skpPath:r.skpPath,skpMaterials:r.skpMaterials,skpOrdinal:index+1,
   vertices,triangles:r.triangles,skpContour:contour};
 });
 return {schema:'gatterka-3mf-v1',source:'skp',designName:selected.path.at(-1),skpComponentKey:key,skpWidthAxis:widthAxis,parts,warnings};
}
export function contourDxf(shape){
 const pts=shape?.skpContour?.points;if(!Array.isArray(pts)||pts.length<3)throw Error('Ehhez az elemhez nincs zárt síkbeli körvonal.');
 const pairs=[[0,'SECTION'],[2,'HEADER'],[9,'$INSUNITS'],[70,4],[0,'ENDSEC'],[0,'SECTION'],[2,'ENTITIES'],[0,'LWPOLYLINE'],[100,'AcDbEntity'],[8,'KONTUR'],[100,'AcDbPolyline'],[90,pts.length],[70,1]];
 for(const p of pts){if(!Array.isArray(p)||p.length!==2||p.some(x=>!Number.isFinite(x)))throw Error('Hibás körvonalpont.');pairs.push([10,round(p[0])],[20,round(p[1])]);}
 pairs.push([0,'ENDSEC'],[0,'EOF']);return pairs.flat().join('\r\n')+'\r\n';
}
