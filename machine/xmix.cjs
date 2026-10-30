'use strict';
/**
 * WinCut INI xMix: a működő felhasználói minta a C:\WinCut\Prg\ mappára
 * hivatkozik, és minden sor végén ,1,0 szerepel.
 * A generált .xPrg fájlok gépi kompatibilitása nem hitelesített;
 * a működő mintában .012 kiterjesztésű programokra mutatnak a sorok.
 */
const DIRECTORY='C:\\WinCut\\Prg\\';
function validateFolder(folder){
  if(typeof folder!=='string'||!/^[A-Za-z0-9_-]{1,70}$/.test(folder))
    throw new Error('Érvénytelen bútormappa. Csak betű, szám, aláhúzás vagy kötőjel megengedett.');
  return folder;
}
function validateFilename(s){
  if(typeof s!=='string'||!/^[A-Za-z0-9_.-]+\.xPrg$/i.test(s)||
      s.includes('..')||s.startsWith('.'))
    throw new Error('Érvénytelen .xPrg fájlnév.');
  return s;
}
function createXMix({programs,folder,description=''}) {
  const cabinet=validateFolder(folder);
  if(!Array.isArray(programs)||!programs.length)
    throw new Error('Legalább egy .xPrg hivatkozás szükséges.');
  if(typeof description!=='string'||/[\r\n[\]=]/.test(description))
    throw new Error('Érvénytelen leírás a .xMix fájlhoz.');
  const rows=programs.map((p,i)=>{
    const filename=validateFilename(typeof p==='string'?p:p?.filename);
    return (i+1)+'='+DIRECTORY+filename+',1,0';
  });
  return ['[Intestazione]','Descrizione='+description,'',
    '[Righe]','NumeroRighe='+rows.length,...rows,''].join('\r\n');
}
function createXPrg(){
  throw new Error('Nincs hiteles xPrg specifikáció. A kísérleti minták fizikai gépre nem tölthetők.');
}
module.exports={DIRECTORY,validateFolder,validateFilename,createXMix,createXPrg};
