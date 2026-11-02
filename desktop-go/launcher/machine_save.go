// Gatterka – gépi programok közvetlen mentése a "Mentés másként" ablakban
// kiválasztott mappába. Ez a fájl szándékosan nem használ Windows-specifikus
// hívást, így a logika Linuxon is tesztelhető.
//
// Eredmény a kiválasztott mappában:
//   <választott név>.xMix            – a közös projektfájl
//   <tabla>_01.xPrg, <tabla>_02.xPrg – táblánként egy program, ugyanabban a mappában
//
// Az xMix minden RigaMix File="..." sora a ténylegesen elmentett .xPrg fájl
// teljes (abszolút) elérési útját tartalmazza.
package main

import (
 "errors"
 "fmt"
 "html"
 "os"
 "path/filepath"
 "strings"
)

type nativeProgram struct {
 Name    string `json:"name"`
 Content string `json:"content"`
}

// nativeMixSave a böngészőből érkező kérés: a kész xMix szöveg és a táblaprogramok.
// Az xMix sorainak elérési útját a Go írja át a tényleges mentési helyre.
type nativeMixSave struct {
 Mix      string          `json:"mix"`
 Programs []nativeProgram `json:"programs"`
}

// savedMachineFiles a sikeres mentés igazolása.
type savedMachineFiles struct {
 MixPath  string   `json:"mixPath"`
 Folder   string   `json:"folder"`
 Programs []string `json:"programs"`
}

const maxMachinePrograms = 100

func mixFileBase(raw string) string {
 if j := strings.LastIndexAny(raw, `\/`); j >= 0 {
  return raw[j+1:]
 }
 return raw
}

// validateMixSave ellenőrzi, hogy az xMix pontosan a csomag xPrg fájljaira hivatkozik.
func validateMixSave(req nativeMixSave) error {
 if len(req.Programs) < 1 || len(req.Programs) > maxMachinePrograms {
  return errors.New("Érvénytelen xPrg fájlszám.")
 }
 if !strings.HasPrefix(req.Mix, "<xMix>") ||
  !strings.Contains(req.Mix, "<RigheMix>") || !strings.Contains(req.Mix, "</xMix>") {
  return errors.New("Hiányos vagy hibás XML xMix.")
 }
 names := map[string]bool{}
 for _, program := range req.Programs {
  if !machineXprgName.MatchString(program.Name) ||
   strings.Contains(program.Name, "..") || strings.HasPrefix(program.Name, ".") {
   return errors.New("Érvénytelen .xPrg fájlnév.")
  }
  if names[strings.ToLower(program.Name)] {
   return errors.New("Ismétlődő .xPrg fájlnév.")
  }
  if !strings.HasPrefix(program.Content, "<SchemaDoc>") {
   return errors.New("Érvénytelen .xPrg tartalom.")
  }
  names[strings.ToLower(program.Name)] = true
 }
 rows := machineMixRows.FindAllString(req.Mix, -1)
 if len(rows) != len(req.Programs) {
  return errors.New("Az xMix sorainak száma eltér az xPrg fájlok számától.")
 }
 referenced := map[string]bool{}
 for _, row := range rows {
  attribute := machineMixFileAttribute.FindString(row)
  if attribute == "" {
   return errors.New("Hiányzó xMix fájlhivatkozás.")
  }
  raw := html.UnescapeString(strings.TrimSuffix(strings.TrimPrefix(attribute, `File="`), `"`))
  base := strings.ToLower(mixFileBase(raw))
  if !names[base] || referenced[base] {
   return errors.New("Az xMix olyan .xPrg fájlra hivatkozik, amely nincs a mentendő fájlok között.")
  }
  referenced[base] = true
 }
 return nil
}

// patchMixWithSavedPaths minden RigaMix File értéket a ténylegesen elmentett,
// teljes xPrg útvonalra cseréli (a fájlnév alapján párosítva).
func patchMixWithSavedPaths(mix string, savedPaths map[string]string) (string, error) {
 var failure error
 patched := machineMixRows.ReplaceAllStringFunc(mix, func(row string) string {
  attribute := machineMixFileAttribute.FindString(row)
  raw := html.UnescapeString(strings.TrimSuffix(strings.TrimPrefix(attribute, `File="`), `"`))
  full, ok := savedPaths[strings.ToLower(mixFileBase(raw))]
  if !ok {
   failure = errors.New("Az xMix egyik sorához nem készült xPrg fájl.")
   return row
  }
  return strings.Replace(row, attribute, `File="`+xmlEscapeNative(full)+`"`, 1)
 })
 return patched, failure
}

// createExclusive úgy hoz létre új fájlt, hogy meglévőt soha nem ír felül:
// ha a név foglalt, _2, _3 ... végződést kap. Visszaadja a végleges útvonalat.
func createExclusive(dir, name, content string) (string, error) {
 extension := filepath.Ext(name)
 stem := strings.TrimSuffix(name, extension)
 for n := 1; n <= 999; n++ {
  candidate := name
  if n > 1 {
   candidate = fmt.Sprintf("%s_%d%s", stem, n, extension)
  }
  target := filepath.Join(dir, candidate)
  file, err := os.OpenFile(target, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0600)
  if os.IsExist(err) {
   continue
  }
  if err != nil {
   return "", err
  }
  _, writeErr := file.WriteString(content)
  closeErr := file.Close()
  if writeErr != nil || closeErr != nil {
   _ = os.Remove(target)
   if writeErr != nil {
    return "", writeErr
   }
   return "", closeErr
  }
  return target, nil
 }
 return "", errors.New("Túl sok azonos nevű .xPrg fájl a mappában.")
}

// saveMixAndPrograms a felhasználó által a Mentés másként ablakban megadott
// .xMix helyére menti a közös projektfájlt, mellé (ugyanabba a mappába) pedig
// az összes táblánkénti .xPrg fájlt. A .xMix cseréjét a Windows ablak már
// jóváhagyta; az .xPrg fájlokat soha nem írjuk felül (inkább új sorszámot kapnak).
func saveMixAndPrograms(mixPath string, req nativeMixSave) (savedMachineFiles, error) {
 var result savedMachineFiles
 if err := validateMixSave(req); err != nil {
  return result, err
 }
 if !filepath.IsAbs(mixPath) || !strings.EqualFold(filepath.Ext(mixPath), ".xMix") {
  return result, errors.New("A célfájlnak teljes Windows-útvonalú .xMix fájlnak kell lennie.")
 }
 dir := filepath.Dir(mixPath)
 if info, err := os.Stat(dir); err != nil || !info.IsDir() {
  return result, errors.New("A kiválasztott célmappa nem érhető el.")
 }
 if info, err := os.Stat(mixPath); err == nil && info.IsDir() {
  return result, errors.New("A megadott .xMix név egy meglévő mappa neve.")
 }

 created := []string{}
 success := false
 defer func() {
  if !success {
   for _, path := range created {
    _ = os.Remove(path)
   }
  }
 }()

 savedPaths := map[string]string{}
 for _, program := range req.Programs {
  target, err := createExclusive(dir, program.Name, program.Content)
  if err != nil {
   return result, fmt.Errorf("Az .xPrg mentése nem sikerült (%s): %w", program.Name, err)
  }
  created = append(created, target)
  savedPaths[strings.ToLower(program.Name)] = target
  result.Programs = append(result.Programs, target)
 }

 mix, err := patchMixWithSavedPaths(req.Mix, savedPaths)
 if err != nil {
  return result, err
 }
 // Az .xMix ideiglenes fájlba készül, majd egyben cseréli a célt: hiba esetén
 // a korábbi (jóváhagyottan felülírt) xMix sem marad félig megírva.
 temporary, err := os.CreateTemp(dir, ".gatterka-*.xMix.tmp")
 if err != nil {
  return result, fmt.Errorf("Az .xMix nem írható a kiválasztott mappába: %w", err)
 }
 temporaryName := temporary.Name()
 defer func() { _ = os.Remove(temporaryName) }()
 if _, err = temporary.WriteString(mix); err != nil {
  _ = temporary.Close()
  return result, err
 }
 if err = temporary.Sync(); err != nil {
  _ = temporary.Close()
  return result, err
 }
 if err = temporary.Close(); err != nil {
  return result, err
 }
 if err = os.Rename(temporaryName, mixPath); err != nil {
  return result, fmt.Errorf("Az .xMix mentése nem sikerült: %w", err)
 }
 success = true
 result.MixPath = mixPath
 result.Folder = dir
 return result, nil
}
