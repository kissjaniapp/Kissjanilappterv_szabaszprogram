package main

import (
 "encoding/json"
 "net/http"
 "net/http/httptest"
 "os"
 "path/filepath"
 "strings"
 "testing"
)

func sampleCncRequest() nativeCncSave{
 code:=func(x int)string{
  return "H DX="+string(rune('0'+x))+"00 DY=450 DZ=18 -IJ C=0 T=196608 R=100 *MM /\"DEF\" BX=0 BY=0 BZ=0 V=1\r\nLAPA X=50 Y=0 A=0 y=400 G=1\r\n;\r\nVEGE\r\n"
 }
 return nativeCncSave{Programs:[]nativeProgram{
  {Name:"Buto_Bal_oldal_side-left.xxl",Content:code(6)},
  {Name:"Buto_Jobb_oldal_side-right.xxl",Content:code(7)},
 }}
}
func TestSaveCncXxlNativeSaveAsWritesRealSeparateFiles(t *testing.T){
 root:=t.TempDir()
 req:=sampleCncRequest()
 chosen:=filepath.Join(root,"Felhasznalo_Altal_Valasztott.xxl")
 saved,err:=saveCncAndPrograms(chosen,req)
 if err!=nil{t.Fatal(err)}
 if saved.FirstPath!=chosen||saved.Folder!=root||len(saved.Programs)!=2{
  t.Fatalf("Rossz mentett útvonalak: %+v",saved)
 }
 for i,path:=range saved.Programs{
  bytes,err:=os.ReadFile(path)
  if err!=nil{t.Fatal(err)}
  if string(bytes)!=req.Programs[i].Content{t.Fatalf("Eltérő XXL-fájl: %s",path)}
 }
 if saved.Partial||saved.ReportPath!=""{t.Fatal("Teljes készlet nem jelölhető részlegesnek.")}
}
func TestSaveCncPartialKeepsMissingReportAndAvoidsOverwrites(t *testing.T){
 root:=t.TempDir()
 req:=sampleCncRequest()
 req.Report="GATTERKA – RESZLEGES\nKimaradt F-osztó: ismeretlen furat\n"
 chosen:=filepath.Join(root,req.Programs[1].Name)
 if err:=os.WriteFile(filepath.Join(root,req.Programs[0].Name),[]byte("korabbi program"),0600);err!=nil{t.Fatal(err)}
 saved,err:=saveCncAndPrograms(chosen,req)
 if err!=nil{t.Fatal(err)}
 if !saved.Partial||saved.ReportPath==""{t.Fatal("A hiánylista nem készült el.")}
 if len(saved.Programs)!=2||saved.Programs[0]!=chosen||saved.Programs[1]==chosen{
  t.Fatalf("Fájlnévütközés: %+v",saved)
 }
 report,err:=os.ReadFile(saved.ReportPath)
 if err!=nil||string(report)!=req.Report{t.Fatalf("Nem olvasható kihagyási jelentés: %v",err)}
 original,err:=os.ReadFile(filepath.Join(root,req.Programs[0].Name))
 if err!=nil||string(original)!="korabbi program"{t.Fatal("Korábbi CNC-fájl felülíródott.")}
 for i,path:=range saved.Programs {
  data,err:=os.ReadFile(path)
  if err!=nil||string(data)!=req.Programs[i].Content{t.Fatalf("Hibás program: %v",err)}
 }
}
func TestSaveCncRejectsUnverifiedSyntaxAndTraversal(t *testing.T){
 root:=t.TempDir()
 for _,bad:=range []nativeCncSave{
  {Programs:[]nativeProgram{{Name:"../../rossz.xxl",Content:sampleCncRequest().Programs[0].Content}}},
  {Programs:[]nativeProgram{{Name:"x.xxl",Content:"Nem XXL program"}}},
  {Programs:[]nativeProgram{{Name:"x.xxl",Content:sampleCncRequest().Programs[0].Content},{Name:"X.xxl",Content:sampleCncRequest().Programs[0].Content}}},
  {Programs:[]nativeProgram{{Name:"x.xxl",Content:sampleCncRequest().Programs[0].Content}},Report:"Jelentés fejléc nélkül"},
 }{
  if _,err:=saveCncAndPrograms(filepath.Join(root,"teszt.xxl"),bad);err==nil{
   t.Fatal("Hibás XXL mentést engedélyezett.")
  }
 }
 if _,err:=saveCncAndPrograms(filepath.Join(root,"hibas.zip"),sampleCncRequest());err==nil{
  t.Fatal("ZIP vagy nem XXL fájl választása nem lehet CNC programmentés.")
 }
 entries,err:=os.ReadDir(root)
 if err!=nil||len(entries)!=0{t.Fatal("Hibás adatok fájlokat hoztak létre.")}
}
func TestCncNativeWriteRequiresSelectedSaveAsAndSession(t *testing.T){
 root:=t.TempDir()
 req:=sampleCncRequest()
 encoded,err:=json.Marshal(req)
 if err!=nil{t.Fatal(err)}
 call:=func(bridge *nativeBridge,token string)*httptest.ResponseRecorder{
  request:=httptest.NewRequest(http.MethodPost,"/native/write-cnc-files",strings.NewReader(string(encoded)))
  request.Header.Set("Origin","null")
  request.Header.Set("Content-Type","application/json")
  request.Header.Set("X-Gatterka-Token",token)
  recorder:=httptest.NewRecorder()
  bridge.writeCncFiles(recorder,request)
  return recorder
 }
 bridge:=&nativeBridge{token:"secret",selectedCncPath:filepath.Join(root,"gatterka.xxl")}
 if response:=call(bridge,"rossz");response.Code!=http.StatusForbidden{
  t.Fatalf("Nem tiltja a hibás munkamenetet: %d",response.Code)
 }
 if response:=call(bridge,"secret");response.Code!=http.StatusOK{
  t.Fatalf("Nem menti a fájlokat: %d %s",response.Code,response.Body.String())
 }
 if response:=call(bridge,"secret");response.Code!=http.StatusBadRequest{
  t.Fatalf("A Windows-ablak nélküli újabb mentést engedélyezte: %d",response.Code)
 }
 if bridge.lastDirectory!=root{t.Fatal("Nem őrizte meg az utolsó mentési mappát.")}
}
