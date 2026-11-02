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


func TestSaveAsZipIncludesAllFilesAndWorkingMixPaths(t *testing.T){
 root:=t.TempDir()
 zipPath:=filepath.Join(root,"projekt mentése.zip")
 folder,err:=saveMachineZipAt(zipPath,nativeTestBundle())
 if err!=nil{t.Fatal(err)}
 r,err:=zip.OpenReader(zipPath)
 if err!=nil{t.Fatal(err)}
 defer r.Close()
 if len(r.File)!=3{t.Fatalf("ZIP expected 3 files, got %d",len(r.File))}
 got:=map[string]string{}
 for _,f:=range r.File{
   stream,err:=f.Open()
   if err!=nil{t.Fatal(err)}
   data,err:=io.ReadAll(stream)
   _=stream.Close()
   if err!=nil{t.Fatal(err)}
   got[f.Name]=string(data)
 }
 mixPath:=filepath.Base(folder)+"/proba.xMix"
 mix:=got[mixPath]
 if mix==""{t.Fatal("No xMix inside ZIP",got)}
 for _,name:=range []string{"01.xPrg","02.xPrg"}{
   path:=filepath.Join(folder,"xPrg",name)
   if _,err:=os.Stat(path);err!=nil{t.Fatal("Real xPrg file missing:",path)}
   if !strings.Contains(mix,`File="`+path+`"`){t.Fatal("ZIP xMix did not reference actual xPrg:",mix)}
   if got[filepath.Base(folder)+"/xPrg/"+name]==""{t.Fatal("Missing ZIP xPrg:",name)}
 }
 if strings.Contains(mix,`.\\xPrg\\`){t.Fatal("ZIP contains misleading relative xPrg paths")}
}

func TestSaveAsZipCollisionRewritesBothMixFiles(t *testing.T){
 root:=t.TempDir()
 z1:=filepath.Join(root,"elso.zip")
 z2:=filepath.Join(root,"masodik.zip")
 _,err:=saveMachineZipAt(z1,nativeTestBundle())
 if err!=nil{t.Fatal(err)}
 project,err:=saveMachineZipAt(z2,nativeTestBundle())
 if err!=nil{t.Fatal(err)}
 if filepath.Base(project)!="2026_10_30_Teszt_2"{t.Fatal("Collision folder not unique:",project)}
 data,err:=os.ReadFile(filepath.Join(project,"proba.xMix"))
 if err!=nil{t.Fatal(err)}
 if !strings.Contains(string(data),filepath.Join(project,"xPrg","02.xPrg")){
   t.Fatal("Incorrect collision Mix absolute link")
 }
}

func TestSaveAsDoesNotWriteInvalidProject(t *testing.T){
 root:=t.TempDir()
 bad:=nativeTestBundle()
 bad.Files[1].Path=bad.CabinetFolder+"/../outside.xPrg"
 zipPath:=filepath.Join(root,"bad.zip")
 if _,err:=saveMachineZipAt(zipPath,bad);err==nil{t.Fatal("Traversal accepted")}
 if _,err:=os.Stat(zipPath);!os.IsNotExist(err){t.Fatal("Invalid ZIP was written")}
}
