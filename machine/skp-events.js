  document.addEventListener('change',async e=>{
    if(!e.target.matches?.('[data-skp-component], [data-skp-width]'))return;
    const f=getFurniture();if(!f?.skpImport)return;
    const key=document.querySelector('[data-skp-component]')?.value;
    const width=document.querySelector('[data-skp-width]')?.value||'auto';
    try{showNotice('SKP bútor geometriájának kinyerése…');await skpSelectComponent(f,key,width);}catch(error){showNotice('SKP import: '+error.message);}
  });
  document.addEventListener('click',e=>{
    if(!e.target.closest?.('[data-action="skp-contours"]'))return;
    const f=getFurniture(),model=f?.threeMfImport;if(model?.source!=='skp')return;
    const files=model.parts.filter(p=>!p.isRectangular&&p.skpContour&&p.dimensions[1]>=50&&!p.skpHasCurves)
      .map(p=>[String(p.skpOrdinal).padStart(2,'0')+'_'+fileName(p.name)+'.dxf',window.GatterkaSkp.contourDxf(p)]);
    if(!files.length){showNotice('A kiválasztott SKP csoportban nincs külön exportálható alakos kontúr.');return;}
    downloadBlob(xlsxZip(files,'application/zip'),fileName(model.designName)+'_alakos_konturok.zip');
  });
