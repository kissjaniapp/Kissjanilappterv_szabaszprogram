package main

import (
 "archive/zip"
 "encoding/json"
 "io"
 "net/http"
 "net/http/httptest"
 "os"
 "path/filepath"
 "strings"
 "testing"
)

func nativeTestBundle() nativeSave {
 return nativeSave{
  CabinetFolder:"2026_10_30_Teszt",
  Files:[]nativeFile{
   {Path:"2026_10_30_Teszt/proba.xMix",Content:"<xMix>\r\n"+
      "\t<Header Descrizione=\"\" Import=\"\" Date=\"30/10/2026\" />\r\n"+
      "\t<Materials><Material Tipologia=\"Freya\" Codice=\"Freya\" Quantita=\"999\" /></Materials>\r\n"+
      "\t<RigheMix>\r\n"+
      "\t\t<RigaMix File=\".\\xPrg\\01.xPrg\" Rep=\"1\" Pacco=\"1\" CambioMateriale=\"0\" />\r\n"+
      "\t\t<RigaMix File=\".\\xPrg\\02.xPrg\" Rep=\"1\" Pacco=\"1\" CambioMateriale=\"0\" />\r\n"+
      "\t</RigheMix>\r\n</xMix>\r\n"},
   {Path:"2026_10_30_Teszt/xPrg/01.xPrg",Content:"<SchemaDoc>01</SchemaDoc>"},
   {Path:"2026_10_30_Teszt/xPrg/02.xPrg",Content:"<SchemaDoc>02</SchemaDoc>"},
  },
 }
}

func TestNativeMachineProjectPersistsAbsolutePaths(t *testing.T){
 root:=t.TempDir()
 req:=nativeTestBundle()
 full,err:=saveMachineFiles(root,req)
 if err!=nil{t.Fatal(err)}
 if full!=filepath.Join(root,"2026_10_30_Teszt"){t.Fatal("Wrong project folder:",full)}
 data,err:=os.ReadFile(filepath.Join(full,"proba.xMix"))
 if err!=nil{t.Fatal(err)}
 mix:=string(data)
 for _,filename:=range []string{"01.xPrg","02.xPrg"}{
  expected:=filepath.Join(full,"xPrg",filename)
  if !strings.Contains(mix,"File=\""+expected+"\""){
   t.Errorf("Missing full machine path %s\n%s",expected,mix)
  }
  if _,err:=os.Stat(expected);err!=nil{t.Fatal(err)}
 }
 if strings.Contains(mix,".\\xPrg\\"){t.Fatal("Relative machine path remains:",mix)}
 if !strings.Contains(mix,"Codice=\"Freya\""){t.Fatal("Material changed")}
}

func TestNativeMachineProjectCollisionRewritesMix(t *testing.T){
 root:=t.TempDir()
 req:=nativeTestBundle()
 first,err:=saveMachineFiles(root,req)
 if err!=nil{t.Fatal(err)}
 second,err:=saveMachineFiles(root,req)
 if err!=nil{t.Fatal(err)}
 if first==second||filepath.Base(second)!="2026_10_30_Teszt_2"{t.Fatal("Collision path not unique",second)}
 data,err:=os.ReadFile(filepath.Join(second,"proba.xMix"))
 if err!=nil{t.Fatal(err)}
 if !strings.Contains(string(data),filepath.Join(second,"xPrg","02.xPrg")){
  t.Fatal("Mix references previous project instead of _2 folder",string(data))
 }
}
func TestNativeRejectsTraversalAndMissingPrograms(t *testing.T){
 req:=nativeTestBundle()
 req.Files[1].Path="2026_10_30_Teszt/../outside.xPrg"
 if _,_,err:=safeNativeProgramFiles(req);err==nil{t.Fatal("Traversal accepted")}
 req=nativeTestBundle()
 req.Files=req.Files[:2]
 if _,_,err:=safeNativeProgramFiles(req);err==nil{t.Fatal("Missing program accepted")}
}
func TestNativeMachineSaveRequiresSessionToken(t *testing.T){
 bridge:=&nativeBridge{token:"secret",selectedDirectory:t.TempDir()}
 data,_:=json.Marshal(nativeTestBundle())
 request:=httptest.NewRequest(http.MethodPost,"/native/save",strings.NewReader(string(data)))
 request.Header.Set("Origin","null")
 request.Header.Set("Content-Type","application/json")
 response:=httptest.NewRecorder()
 bridge.save(response,request)
 if response.Code!=http.StatusForbidden {t.Fatal("Token was not required",response.Code)}
 request=httptest.NewRequest(http.MethodPost,"/native/save",strings.NewReader(string(data)))
 request.Header.Set("Origin","null")
 request.Header.Set("X-Gatterka-Token","secret")
 response=httptest.NewRecorder()
 bridge.save(response,request)
 if response.Code!=http.StatusOK{t.Fatal("Native authorized save failed",response.Body.String())}
}



func TestSaveAsOnlyOneZipWithCorrectMixLinks(t *testing.T){
 root:=t.TempDir()
 zipPath:=filepath.Join(root,"programok.zip")
 result,err:=saveMachineZipAt(zipPath,nativeTestBundle())
 if err!=nil{t.Fatal(err)}
 if result!=zipPath{t.Fatalf("ZIP saved elsewhere: %s",result)}
 entries,err:=os.ReadDir(root)
 if err!=nil{t.Fatal(err)}
 if len(entries)!=1||entries[0].Name()!="programok.zip"{
   t.Fatalf("Only one ZIP file allowed: %v",entries)
 }
 reader,err:=zip.OpenReader(zipPath)
 if err!=nil{t.Fatal(err)}
 defer reader.Close()
 if len(reader.File)!=3{t.Fatalf("Expected 3 files in ZIP: %d",len(reader.File))}
 files:=map[string]string{}
 for _,f:=range reader.File{
   stream,err:=f.Open()
   if err!=nil{t.Fatal(err)}
   data,err:=io.ReadAll(stream)
   _=stream.Close()
   if err!=nil{t.Fatal(err)}
   files[f.Name]=string(data)
 }
 cabinet:="2026_10_30_Teszt"
 mix:=files[cabinet+"/proba.xMix"]
 if mix==""{t.Fatal("Missing xMix")}
 for _,name:=range []string{"01.xPrg","02.xPrg"}{
   expected:=filepath.Join(root,cabinet,"xPrg",name)
   if !strings.Contains(mix,"File=\""+expected+"\""){t.Errorf("Wrong future xPrg path: %s",mix)}
   if files[cabinet+"/xPrg/"+name]==""{t.Errorf("Missing ZIP xPrg: %s",name)}
 }
 if _,err=os.Stat(filepath.Join(root,cabinet));!os.IsNotExist(err){
   t.Fatal("Program incorrectly created an extracted project folder")
 }
}
func TestSaveAsTwoZipsNeverCreateFolders(t *testing.T){
 root:=t.TempDir()
 for _,name:=range []string{"first.zip","second.zip"}{
  if _,err:=saveMachineZipAt(filepath.Join(root,name),nativeTestBundle());err!=nil{t.Fatal(err)}
 }
 files,err:=os.ReadDir(root)
 if err!=nil{t.Fatal(err)}
 if len(files)!=2{t.Fatalf("Expected two ZIP files, got %d",len(files))}
 for _,f:=range files{if f.IsDir(){t.Fatal("Unexpected extracted folder",f.Name())}}
}
func TestSaveAsDoesNotWriteInvalidProject(t *testing.T){
 root:=t.TempDir()
 bad:=nativeTestBundle()
 bad.Files[1].Path=bad.CabinetFolder+"/../outside.xPrg"
 target:=filepath.Join(root,"bad.zip")
 if _,err:=saveMachineZipAt(target,bad);err==nil{t.Fatal("Traversal accepted")}
 if _,err:=os.Stat(target);!os.IsNotExist(err){t.Fatal("Invalid ZIP was written")}
}
func TestWriteZipRequiresSelectedTargetAndSessionToken(t *testing.T){
 root:=t.TempDir()
 bridge:=&nativeBridge{token:"secret"}
 data,_:=json.Marshal(nativeTestBundle())
 send:=func(token string)*httptest.ResponseRecorder{
  req:=httptest.NewRequest(http.MethodPost,"/native/write-zip",strings.NewReader(string(data)))
  req.Header.Set("Origin","null")
  req.Header.Set("X-Gatterka-Token",token)
  res:=httptest.NewRecorder()
  bridge.writeZip(res,req)
  return res
 }
 if r:=send("secret");r.Code!=http.StatusBadRequest{t.Fatal("Saved without selected path")}
 bridge.selectedArchivePath=filepath.Join(root,"secure.zip")
 if r:=send("incorrect");r.Code!=http.StatusForbidden{t.Fatal("Wrong session token accepted")}
 if r:=send("secret");r.Code!=http.StatusOK{t.Fatal("Save failed:",r.Body.String())}
 if r:=send("secret");r.Code!=http.StatusBadRequest{t.Fatal("Target reused")}
 if _,err:=os.Stat(filepath.Join(root,"secure.zip"));err!=nil{t.Fatal(err)}
}
