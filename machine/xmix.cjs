'use strict';
/**
 * WinCut .xMix a felhasználó által meghatározott, INI-jellegű formátumban.
 * Figyelem: az xPrg fájlokat nem generálja, és a gépi kompatibilitás nincs hitelesítve.
 */
const DIRECTORY='C:\\WinCut\\Prg\\';
function validateFilename(s){
  if(typeof s!=='string'||!/^[A-Za-z0-9_.-]+\.xPrg$/i.test(s)||
      s.includes('..')||s.startsWith('.')) {
    throw new Error('Érvénytelen .xPrg fájlnév (csak egyszerű, biztonságos fájlnév lehet).');
  }
  return s;
}
function createXMix({programs,description=''}) {
  if(!Array.isArray(programs)||!programs.length)
    throw new Error('Legalább egy .xPrg hivatkozás szükséges.');
  if(typeof description!=='string'||/[\r\n[\]=]/.test(description))
    throw new Error('Érvénytelen leírás a .xMix fájlhoz.');
  const rows=programs.map((p,i)=>{
    const filename=validateFilename(typeof p==='string'?p:p?.filename);
    return (i+1)+'='+DIRECTORY+filename;
  });
  return ['[Intestazione]','Descrizione='+description,'',
    '[Righe]','NumeroRighe='+rows.length,...rows,''].join('\r\n');
}
function createXPrg(){
  throw new Error('Nincs hiteles xPrg specifikáció. A kísérleti minták fizikai gépre nem tölthetők.');
}
module.exports={DIRECTORY,createXMix,createXPrg,validateFilename};
