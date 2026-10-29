'use strict';
/**
 * Hitelesített, szűk részlet: xMix MANIFEST formátum a kapott minta alapján.
 * A modul nem generál xPrg parancsokat. Meglévő, natív xPrg-kre hivatkozik.
 * Az XML kompatibilitás a gépen csak az eredeti exporttal vethető össze.
 */
function xmlEscape(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
}
function validateFilename(s) {
  if (typeof s !== 'string' || !/^[\w.\-]+\.xPrg$/i.test(s) || s.includes('..')) {
    throw new Error('Csak natív, egyszerű fájlnevű .xPrg hivatkozás adható meg.');
  }
  return s;
}
function nonNegativeInt(n, field) {
  if (!Number.isSafeInteger(n) || n < 0) throw new Error('Hibás ' + field);
  return n;
}
/** Csak eredetileg létező xPrg állományokkal használd. */
function createXMix({ material, programs, date = '' }) {
  if (!material || typeof material.name !== 'string' || !material.name.trim() || typeof material.code !== 'string' || !material.code.trim()) throw new Error('Hiányzik az anyag neve vagy azonosítója.');
  if (!Array.isArray(programs) || !programs.length) throw new Error('xMix nem készíthető natív xPrg fájl nélkül.');
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(date)) throw new Error('Dátum: NN/HH/ÉÉÉÉ formátum kell (például 21/10/2026).');
  const quantity = nonNegativeInt(material.quantity ?? 999, 'anyagmennyiség');
  const rows = programs.map((p) => {
    const file = validateFilename(p.filename);
    const rep=nonNegativeInt(p.repeat ?? 1, 'ismétlés');
    const bundle=nonNegativeInt(p.bundle ?? 1, 'csomag');
    const materialChange=nonNegativeInt(p.materialChange ?? 0, 'anyagváltás');
    return `\t\t<RigaMix File=".\\xPrg\\${xmlEscape(file)}" Rep="${rep}" Pacco="${bundle}" CambioMateriale="${materialChange}" />`;
  });
  return ['<?xml version="1.0" encoding="utf-8"?>', '<xMix>',
    `\t<Header Descrizione="" Import="" Date="${date}" />`,
    '\t<Materials>',
    `\t\t<Material Tipologia="${xmlEscape(material.name)}" Codice="${xmlEscape(material.code)}" Quantita="${quantity}" />`,
    '\t</Materials>', '\t<RigheMix>', ...rows, '\t</RigheMix>', '</xMix>', ''].join('\r\n');
}
/** A valódi parancsszintaxis ismerete nélkül szándékosan tiltott. */
function createXPrg() {
  throw new Error('Nincs hiteles xPrg specifikáció. Kérjük az eredeti, gépen működő xPrg mintákat.');
}
module.exports={createXMix,createXPrg,validateFilename};
