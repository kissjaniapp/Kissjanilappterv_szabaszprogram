package main

import (
 "fmt"
 "os"
 "path/filepath"
 "strings"
 "testing"
)

func nativeMixTestRequest() nativeMixSave {
 return nativeMixSave{
  Mix: "<xMix>\r\n" +
   "\t<Header Descrizione=\"\" Import=\"\" Date=\"02/11/2026\" />\r\n" +
   "\t<Materials><Material Tipologia=\"Freya\" Codice=\"Freya\" Quantita=\"999\" /></Materials>\r\n" +
   "\t<RigheMix>\r\n" +
   "\t\t<RigaMix File=\".\\xPrg\\01.xPrg\" Rep=\"1\" Pacco=\"1\" CambioMateriale=\"0\" />\r\n" +
   "\t\t<RigaMix File=\".\\xPrg\\02.xPrg\" Rep=\"1\" Pacco=\"1\" CambioMateriale=\"0\" />\r\n" +
   "\t</RigheMix>\r\n</xMix>\r\n",
  Programs: []nativeProgram{
   {Name: "01.xPrg", Content: "<SchemaDoc>01</SchemaDoc>"},
   {Name: "02.xPrg", Content: "<SchemaDoc>02</SchemaDoc>"},
  },
 }
}

func readFile(t *testing.T, path string) string {
 t.Helper()
 data, err := os.ReadFile(path)
 if err != nil {
  t.Fatal(err)
 }
 return string(data)
}

func TestSaveMixAndProgramsWritesFilesToChosenFolder(t *testing.T) {
 root := t.TempDir()
 mixPath := filepath.Join(root, "Konyha.xMix")
 saved, err := saveMixAndPrograms(mixPath, nativeMixTestRequest())
 if err != nil {
  t.Fatal(err)
 }
 if saved.MixPath != mixPath || saved.Folder != root || len(saved.Programs) != 2 {
  t.Fatalf("Unexpected result: %+v", saved)
 }
 mix := readFile(t, mixPath)
 for _, name := range []string{"01.xPrg", "02.xPrg"} {
  expected := filepath.Join(root, name)
  if !strings.Contains(mix, "File=\""+expected+"\"") {
   t.Errorf("A Mix nem a mentett xPrg teljes útvonalát tartalmazza: %s\n%s", expected, mix)
  }
  if readFile(t, expected) != "<SchemaDoc>"+strings.TrimSuffix(name, ".xPrg")+"</SchemaDoc>" {
   t.Errorf("Hibás xPrg tartalom: %s", name)
  }
 }
 if strings.Contains(mix, ".\\xPrg\\") {
  t.Fatal("Relatív útvonal maradt az xMix-ben:", mix)
 }
 if !strings.Contains(mix, "Codice=\"Freya\"") || !strings.Contains(mix, "CambioMateriale=\"0\"") {
  t.Fatal("Az xMix egyéb tartalma megváltozott")
 }
 entries, _ := os.ReadDir(root)
 if len(entries) != 3 {
  t.Fatalf("Pontosan 3 fájl várható (1 xMix + 2 xPrg), nincs ideiglenes maradék: %v", entries)
 }
}

func TestExistingXprgIsNeverOverwrittenAndMixFollowsNewNames(t *testing.T) {
 root := t.TempDir()
 mixPath := filepath.Join(root, "projekt.xMix")
 if _, err := saveMixAndPrograms(mixPath, nativeMixTestRequest()); err != nil {
  t.Fatal(err)
 }
 if err := os.WriteFile(filepath.Join(root, "01.xPrg"), []byte("<SchemaDoc>kezi modositas</SchemaDoc>"), 0600); err != nil {
  t.Fatal(err)
 }
 // A felhasználó a Windows ablakban jóváhagyta az xMix felülírását.
 if _, err := saveMixAndPrograms(mixPath, nativeMixTestRequest()); err != nil {
  t.Fatal(err)
 }
 if readFile(t, filepath.Join(root, "01.xPrg")) != "<SchemaDoc>kezi modositas</SchemaDoc>" {
  t.Fatal("A meglévő xPrg felülíródott")
 }
 mix := readFile(t, mixPath)
 for _, name := range []string{"01_2.xPrg", "02_2.xPrg"} {
  if _, err := os.Stat(filepath.Join(root, name)); err != nil {
   t.Fatal(err)
  }
  if !strings.Contains(mix, "File=\""+filepath.Join(root, name)+"\"") {
   t.Errorf("Az xMix nem az új %s fájlra mutat:\n%s", name, mix)
  }
 }
}

func TestInvalidRequestsWriteNothing(t *testing.T) {
 root := t.TempDir()
 mixPath := filepath.Join(root, "bad.xMix")
 traversal := nativeMixTestRequest()
 traversal.Programs[0].Name = "../kint.xPrg"
 unknown := nativeMixTestRequest()
 unknown.Mix = strings.Replace(unknown.Mix, "02.xPrg", "nincs.xPrg", 1)
 count := nativeMixTestRequest()
 count.Programs = count.Programs[:1]
 notXml := nativeMixTestRequest()
 notXml.Programs[1].Content = "rossz"
 for label, request := range map[string]nativeMixSave{
  "traversal": traversal, "ismeretlen hivatkozás": unknown, "darabszám": count, "tartalom": notXml,
 } {
  if _, err := saveMixAndPrograms(mixPath, request); err == nil {
   t.Errorf("Hibás kérés elfogadva: %s", label)
  }
 }
 if entries, _ := os.ReadDir(root); len(entries) != 0 {
  t.Fatalf("Hibás kérés után fájl maradt: %v", entries)
 }
}

func TestTargetMustBeAbsoluteXmixInExistingFolder(t *testing.T) {
 root := t.TempDir()
 for _, target := range []string{
  "relativ.xMix",
  filepath.Join(root, "projekt.zip"),
  filepath.Join(root, "nincs_ilyen_mappa", "projekt.xMix"),
 } {
  if _, err := saveMixAndPrograms(target, nativeMixTestRequest()); err == nil {
   t.Errorf("Érvénytelen cél elfogadva: %s", target)
  }
 }
 if entries, _ := os.ReadDir(root); len(entries) != 0 {
  t.Fatalf("Érvénytelen cél után fájl maradt: %v", entries)
 }
}

func TestFailedMixWriteRemovesNewXprgFiles(t *testing.T) {
 root := t.TempDir()
 // Az xMix cél egy mappa: az átnevezés sikertelen, a már kiírt xPrg fájlokat vissza kell vonni.
 mixPath := filepath.Join(root, "foglalt.xMix")
 if err := os.Mkdir(mixPath, 0700); err != nil {
  t.Fatal(err)
 }
 if _, err := saveMixAndPrograms(mixPath, nativeMixTestRequest()); err == nil {
  t.Fatal("A mappa nevére mentés sikeresnek látszott")
 }
 entries, _ := os.ReadDir(root)
 if len(entries) != 1 || entries[0].Name() != "foglalt.xMix" {
  t.Fatalf("Hiba után árva xPrg/ideiglenes fájl maradt: %v", entries)
 }
}

func TestLargeCollectorSavesMoreThanOneHundredMachinePrograms(t *testing.T) {
 root := t.TempDir()
 req := nativeMixSave{}
 var mix strings.Builder
 mix.WriteString("<xMix>\r\n<RigheMix>\r\n")
 const boards = 135
 for i := 1; i <= boards; i++ {
  name := fmt.Sprintf("tabla_%03d.xPrg", i)
  req.Programs = append(req.Programs, nativeProgram{
   Name: name, Content: fmt.Sprintf("<SchemaDoc>tabla %d</SchemaDoc>", i),
  })
  fmt.Fprintf(&mix, "<RigaMix File=\".\\\\xPrg\\\\%s\" Rep=\"1\" />\r\n", name)
 }
 mix.WriteString("</RigheMix>\r\n</xMix>\r\n")
 req.Mix = mix.String()
 target := filepath.Join(root, "Sok_butor.xMix")
 saved, err := saveMixAndPrograms(target, req)
 if err != nil { t.Fatal(err) }
 if len(saved.Programs) != boards { t.Fatalf("Csak %d / %d program került mentésre", len(saved.Programs), boards) }
 xml := readFile(t, target)
 for _, program := range saved.Programs {
  if _, err := os.Stat(program); err != nil { t.Fatal(err) }
  if !strings.Contains(xml, xmlEscapeNative(program)) { t.Fatalf("Az xMix nem hivatkozza: %s", program) }
 }
}
