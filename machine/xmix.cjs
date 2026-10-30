'use strict';
/**
 * A Gatterka által exportált xMix XML a valódi WinCut mintával egyezik:
 * <xMix><Header/><Materials><Material/></Materials>
 * <RigheMix><RigaMix File=".\xPrg\..." ... /></RigheMix></xMix>.
 * A Windows-útvonal csak hivatkozás: önmagában nem másolja a fájlt a gépre.
 */
const DIRECTORY='.\\xPrg\\';
const xml=t=>String(t??'').replace(/[&<>"']/g,
  c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));

function validateFolder(folder){
  if(typeof folder!=='string'||!/^[A-Za-z0-9_-]{1,70}$/.test(folder))
    throw new Error('Érvénytelen bútormappa.');
  return folder;
}
function validateFilename(s){
  if(typeof s!=='string'||!/^[A-Za-z0-9_.-]+\.xPrg$/i.test(s)||
      s.includes('..')||s.startsWith('.'))
    throw new Error('Érvénytelen .xPrg fájlnév.');
  return s;
}
function normalizeXprgDirectory(input=DIRECTORY){
  const raw=String(input??DIRECTORY).trim().replace(/\//g,'\\');
  if(!raw||raw.length>260||/[\x00-\x1f<>"|?*]/.test(raw))
    throw new Error('Hibás XPrg mappaútvonal.');
  const relative=raw.startsWith('.\\'),drive=/^[A-Za-z]:\\/.test(raw);
  const unc=/^\\\\[^\\]+\\[^\\]+(?:\\|$)/.test(raw);
  if(!relative&&!drive&&!unc)
    throw new Error('Relatív (.\\) vagy teljes Windows XPrg mappaútvonal kell.');
  const pieces=raw.split('\\').filter(Boolean);
  const segments=relative?pieces.slice(1):drive?pieces.slice(1):pieces.slice(2);
  if(segments.some(segment=>segment==='.'||segment==='..'||segment.endsWith(' ')||
      segment.endsWith('.')||segment.includes(':')||/[^\S ]/.test(segment)))
    throw new Error('Érvénytelen XPrg mappanév.');
  if(segments.some(segment=>/\.xprg$/i.test(segment)))
    throw new Error('Mappát adj meg, ne .xPrg fájlt.');
  const directory=relative?'.\\'+(segments.length?segments.join('\\')+'\\':''):
    drive?pieces[0]+'\\'+(segments.length?segments.join('\\')+'\\':''):
    '\\\\'+pieces.slice(0,2).join('\\')+'\\'+(segments.length?segments.join('\\')+'\\':'');
  return {directory,relative,archiveSubdir:relative?segments.join('/'):'xPrg'};
}
function createXMix({programs,folder,date,materialCode='BLAP003',materials=[''],
                    description='',xprgDirectory=DIRECTORY}){
  validateFolder(folder);
  if(!Array.isArray(programs)||!programs.length)
    throw new Error('Legalább egy .xPrg hivatkozás szükséges.');
  if(!/^\d{2}\/\d{2}\/\d{4}$/.test(String(date)))
    throw new Error('Hibás xMix dátum.');
  // materialCode: régebbi hívásokhoz megtartott, figyelmen kívül hagyott paraméter.
  // A gépi kódot az adott anyagszínből képezzük, mint a Gatterka felületén.
  const location=normalizeXprgDirectory(xprgDirectory);
  const names=programs.map(p=>validateFilename(typeof p==='string'?p:p?.filename));
  const colors=[...new Set(materials.map(t=>String(t??'').trim()))];
  if(!colors.length)colors.push('');
  return '<xMix>\r\n'+
    '\t<Header Descrizione="'+xml(description)+'" Import="" Date="'+xml(date)+'" />\r\n'+
    '\t<Materials>\r\n'+
    colors.map(color=>'\t\t<Material Tipologia="'+xml(color)+
      '" Codice="'+xml(color)+'" Quantita="999" />').join('\r\n')+
    '\r\n\t</Materials>\r\n'+
    '\t<RigheMix>\r\n'+
    names.map(name=>'\t\t<RigaMix File="'+xml(location.directory+name)+
      '" Rep="1" Pacco="1" CambioMateriale="0" />').join('\r\n')+
    '\r\n\t</RigheMix>\r\n</xMix>\r\n';
}
function createXPrg(){
  throw new Error('Nincs hiteles xPrg specifikáció. Fizikai gépre csak ellenőrzés után tölthető.');
}
module.exports={DIRECTORY,validateFolder,validateFilename,normalizeXprgDirectory,createXMix,createXPrg};
