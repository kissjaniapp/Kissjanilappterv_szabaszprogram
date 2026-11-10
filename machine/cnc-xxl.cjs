'use strict';
/**
 * Gatterka CNC / Xilog XXL: ellenőrzött, explicit makrók exportja.
 * Nem automatikus furatkiosztó és nem helyettesíti az SCM gépi szimulációját.
 * A szabászati .xPrg/.xMix kódjától teljesen független.
 */
(function(root){
  const JOINT_G=Object.freeze({
    tipli:Object.freeze({lap:0,el:0}),
    excenter:Object.freeze({lap:1,el:1}),
    hosszuExcenter:Object.freeze({lap:1,el:2}),
    csavar:Object.freeze({lap:2,el:0})
  });
  const MACROS=new Set(['LAPA','LAPF','ELF2','ELF3','ELF5']);
  function number(value,name,allowZero){
    const n=Number(value);
    if(value==null||String(value).trim()===''||!Number.isFinite(n)||n<0||(!allowZero&&n===0)||n>10000)
      throw new Error('Érvénytelen '+name+' méret.');
    return n;
  }
  function fmt(value){
    const n=number(value,'numerikus',true);
    return Number(n.toFixed(3)).toString();
  }
  function centerline(start,thickness){
    return Number((number(start,'kezdőpont',true)+number(thickness,'anyagvastagság')/2).toFixed(3));
  }
  function mirroredX(width,x){
    const w=number(width,'szélesség'),p=number(x,'X',true);
    if(p>w)throw new Error('A tükrözött X a munkadarabon kívülre kerül.');
    return Number((w-p).toFixed(3));
  }
  function jointCodes(type){
    if(!Object.prototype.hasOwnProperty.call(JOINT_G,type))throw new Error('Ismeretlen kötésmód.');
    return {...JOINT_G[type]};
  }
  function parseMacro(line,dx,dy){
    const bits=line.trim().split(/\s+/);
    const macro=bits.shift().toUpperCase();
    if(!MACROS.has(macro))throw new Error('Nem támogatott CNC makró: '+macro);
    const fields={};
    for(const part of bits){
      const match=/^([XYxyAG])=(-?(?:\d+\.?\d*|\.\d+))$/.exec(part);
      if(!match||Object.prototype.hasOwnProperty.call(fields,match?.[1]))
        throw new Error('Érvénytelen vagy ismételt CNC makróparaméter: '+part);
      fields[match[1]]=number(match[2],match[1],true);
    }
    if(!Object.prototype.hasOwnProperty.call(fields,'A')||fields.A!==0)
      throw new Error('Az A forgásszög csak 0 lehet a jelenleg ellenőrzött mintákban.');
    if(!Object.prototype.hasOwnProperty.call(fields,'G')||
       !Number.isInteger(fields.G)||fields.G<0||fields.G>2)
      throw new Error('A CNC G paraméter csak 0, 1 vagy 2 lehet.');
    if(macro==='LAPA'&&(!('X'in fields)||!('Y'in fields)||!('y'in fields)||'x'in fields))
      throw new Error('LAPA: X, Y, A, y és G szükséges.');
    if(macro==='LAPF'&&(!('X'in fields)||!('Y'in fields)||!('x'in fields)||'y'in fields))
      throw new Error('LAPF: X, Y, A, x és G szükséges.');
    if(macro.startsWith('ELF')&&!('x'in fields)&&!('y'in fields))
      throw new Error('Élfurathoz x vagy y hossz szükséges.');
    if('X'in fields&&fields.X>dx || 'Y'in fields&&fields.Y>dy ||
       'x'in fields&&fields.x>dx || 'y'in fields&&fields.y>dy ||
       'X'in fields&&'x'in fields&&fields.X+fields.x>dx ||
       'Y'in fields&&'y'in fields&&fields.Y+fields.y>dy)
      throw new Error('A CNC makró mérete kilóg az alkatrészből.');
    const order=['X','Y','A','x','y','G'];
    return macro+' '+order.filter(key=>key in fields).map(key=>key+'='+fmt(fields[key])).join(' ');
  }

  // A csatolt Xilog3 .pgm referenciákból ellenőrzött formátum:
  // REF DX=491 BX=0; POLC Y=50 Q=0# s=32 G=1# F=1; REF (visszaállítás).
  function parseShelfMacro(line,dx,dy,state){
    const name=line.split(/\s+/)[0];
    if(name==='REF'){
      if(line==='REF'){
        if(!state.active)throw new Error('REF visszaállítás aktív szakasz nélkül.');
        state.active=false;
        return 'REF';
      }
      if(state.active)throw new Error('Az előző REF szakaszt előbb le kell zárni.');
      const fields={};
      for(const part of line.split(/\s+/).slice(1)){
        const m=/^(DX|BX)=((?:\d+\.?\d*|\.\d+))$/.exec(part);
        if(!m||Object.prototype.hasOwnProperty.call(fields,m[1]))
          throw new Error('Érvénytelen REF paraméter: '+part);
        fields[m[1]]=number(m[2],m[1],true);
      }
      if(!(fields.DX>0)||!(fields.BX>=0)||fields.BX+fields.DX>dx+.001)
        throw new Error('A REF szakasz kezdőpontja/hossza kilóg az oldallapból.');
      state.active=true;state.dx=fields.DX;state.bx=fields.BX;
      return 'REF DX='+fmt(fields.DX)+' BX='+fmt(fields.BX);
    }
    if(name==='POLC'){
      if(!state.active)throw new Error('POLC csak előzetes REF szakaszon belül használható.');
      const fields={};
      for(const part of line.split(/\s+/).slice(1)){
        const m=/^(Y|Q|s|G|F)=((?:\d+\.?\d*|\.\d+))#?$/.exec(part);
        if(!m||Object.prototype.hasOwnProperty.call(fields,m[1]))
          throw new Error('Érvénytelen POLC paraméter: '+part);
        fields[m[1]]=number(m[2],m[1],true);
      }
      if(!('Y'in fields)||fields.Y>dy||!Number.isInteger(fields.Q)||
          fields.Q<0||fields.Q>12||!Number.isFinite(fields.s)||
          fields.s<8||fields.s>200||fields.G!==1||fields.F!==1)
        throw new Error('Érvénytelen POLC Y/Q/s/G/F; a minták G=1 F=1 értéket használnak.');
      return 'POLC Y='+fmt(fields.Y)+' Q='+fmt(fields.Q)+'# s='+fmt(fields.s)+
        ' G=1# F=1';
    }
    throw new Error('Ismeretlen REF/POLC makró.');
  }
  function compileXxl(spec){
    if(!spec||typeof spec!=='object')throw new Error('Hiányzó CNC programadatok.');
    const dx=number(spec.dx,'DX'),dy=number(spec.dy,'DY'),dz=number(spec.dz,'DZ');
    const side=String(spec.side||'IJ').replace(/^-/, '').toUpperCase();
    if(side!=='IJ'&&side!=='LK')throw new Error('Csak IJ vagy LK referencia választható.');
    const text=String(spec.commands??'').replace(/\r/g,'');
    if(text.length>50000)throw new Error('Túl hosszú CNC makrólista.');
    const lines=text.split('\n').map(s=>s.trim()).filter(s=>s&&s!==';');
    if(!lines.length||lines.length>500)throw new Error('Adj meg 1–500 ellenőrzött CNC makrósort.');
    const out=['H DX='+fmt(dx)+' DY='+fmt(dy)+' DZ='+fmt(dz)+' -'+side+
      ' C=0 T=196608 R=100 *MM /"DEF" BX=0 BY=0 BZ=0 V=1'];
    let macrocnt=0,flips=0,justFlipped=false;
    const shelfRef={active:false,dx:0,bx:0};
    for(let i=0;i<lines.length;i++){
      if(lines[i]==='FORDIT'){
        if(shelfRef.active)throw new Error('A REF szakaszt FORDIT előtt le kell zárni.');
        if(!macrocnt||justFlipped||i===lines.length-1)
          throw new Error('A FORDIT csak két megmunkálási csoport között állhat.');
        if(++flips>1)throw new Error('A többfordításos CNC program még nincs hitelesítve.');
        out.push(';','VEGE','XMSG Q=1 N="FORDIT"',';');
        justFlipped=true;
      }else if(lines[i]==='REF'||lines[i].startsWith('REF ')||lines[i].startsWith('POLC ')){
        const line=parseShelfMacro(lines[i],dx,dy,shelfRef);
        out.push(line);
        if(lines[i].startsWith('POLC '))macrocnt++;
        justFlipped=false;
      }else{
        if(shelfRef.active)throw new Error('A REF szakaszba csak POLC-makró írható.');
        out.push(parseMacro(lines[i],dx,dy));
        macrocnt++;
        justFlipped=false;
      }
    }
    if(shelfRef.active)throw new Error('A REF szakaszból hiányzik a záró REF.');
    if(!macrocnt)throw new Error('Hiányzik a megmunkálási makró.');
    out.push(';','VEGE');
    return out.join('\r\n')+'\r\n';
  }
  const api={JOINT_G,jointCodes,centerline,mirroredX,parseMacro,compileXxl};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.GatterkaCnc=api;
})(typeof window!=='undefined'?window:null);
