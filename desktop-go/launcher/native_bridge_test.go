package main

import (
 "encoding/json"
 "errors"
 "fmt"
 "net/http"
 "net/url"
 "net/http/httptest"
 "os"
 "path/filepath"
 "strings"
 "testing"
 "time"
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
 if full!=filepath.Join(root,time.Now().Format("2006-01-02"),"2026_10_30_Teszt"){t.Fatal("Wrong project folder:",full)}
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

func TestNativeAppAndSaveShareSameLocalOrigin(t *testing.T){
 page:=filepath.Join(t.TempDir(),"index.htm")
 if err:=os.WriteFile(page,[]byte("<!doctype html><title>Gatterka</title>"),0600);err!=nil{t.Fatal(err)}
 port,token,stop,err:=startNativeBridge(page)
 if err!=nil{t.Fatal(err)}
 defer stop()
 origin:=fmt.Sprintf("http://127.0.0.1:%d",port)
 readyResp,err:=http.Get(origin+"/native/ready")
 if err!=nil{t.Fatal(err)}
 _=readyResp.Body.Close()
 if readyResp.StatusCode!=http.StatusOK{t.Fatalf("Native save ready page not served: %d",readyResp.StatusCode)}
 relayResp,err:=http.Get(origin+"/native/relay")
 if err!=nil{t.Fatal(err)}
 _=relayResp.Body.Close()
 if relayResp.StatusCode!=http.StatusOK{t.Fatalf("Relay not served: %d",relayResp.StatusCode)}
 resp,err:=http.Get(origin+"/")
 if err!=nil{t.Fatal(err)}
 _=resp.Body.Close()
 if resp.StatusCode!=http.StatusOK{t.Fatalf("UI not served on native origin: %d",resp.StatusCode)}
 req,err:=http.NewRequest(http.MethodPost,origin+"/native/save",strings.NewReader("{}"))
 if err!=nil{t.Fatal(err)}
 req.Header.Set("Origin",origin)
 req.Header.Set("X-Gatterka-Token",token)
 resp,err=http.DefaultClient.Do(req)
 if err!=nil{t.Fatal(err)}
 _=resp.Body.Close()
 if resp.StatusCode!=http.StatusBadRequest{t.Fatalf("same-origin native request rejected: %d",resp.StatusCode)}
 req,err=http.NewRequest(http.MethodPost,origin+"/native/save",strings.NewReader("{}"))
 if err!=nil{t.Fatal(err)}
 req.Header.Set("Origin","https://external.example")
 req.Header.Set("X-Gatterka-Token",token)
 resp,err=http.DefaultClient.Do(req)
 if err!=nil{t.Fatal(err)}
 _=resp.Body.Close()
 if resp.StatusCode!=http.StatusForbidden{t.Fatalf("external origin accepted: %d",resp.StatusCode)}
}

func TestNativeFormSaveRejectsUnknownTokenWithoutOpeningDialog(t *testing.T){
 bridge:=&nativeBridge{token:"valid-token"}
 form:=url.Values{}
 form.Set("id","case-1")
 form.Set("token","wrong-token")
 payload,_:=json.Marshal(nativeTestBundle())
 form.Set("request",string(payload))
 req:=httptest.NewRequest(http.MethodPost,"/native/pick-save",strings.NewReader(form.Encode()))
 req.Header.Set("Content-Type","application/x-www-form-urlencoded")
 req.Header.Set("Origin","null")
 response:=httptest.NewRecorder()
 bridge.pickAndSave(response,req)
 text:=response.Body.String()
 if !strings.Contains(text,"gatterka-form-result")||
    !strings.Contains(text,"case-1")||
    !strings.Contains(text,"false"){
   t.Fatalf("Missing authenticated form error: %s",text)
 }
}
func TestNativeFormSaveBlocksExternalOrigin(t *testing.T){
 bridge:=&nativeBridge{token:"valid-token"}
 form:=url.Values{"id":{"case-2"},"token":{"valid-token"}}
 req:=httptest.NewRequest(http.MethodPost,"/native/pick-save",strings.NewReader(form.Encode()))
 req.Header.Set("Content-Type","application/x-www-form-urlencoded")
 req.Header.Set("Origin","https://evil.example")
 response:=httptest.NewRecorder()
 bridge.pickAndSave(response,req)
 if !strings.Contains(response.Body.String(),"Idegen weboldalról"){
  t.Fatalf("Foreign origin not rejected: %s",response.Body.String())
 }
}

func TestNativePopupResultSignalsOpenerAndDoesNotRequireHiddenIframe(t *testing.T){
 w:=httptest.NewRecorder()
 nativeFormResult(w,"dialog-42",false,nil,errors.New("Nem válaszol a mappaválasztó"))
 page:=w.Body.String()
 if !strings.Contains(page,"window.opener.postMessage"){
  t.Fatal("Native result does not report to visible helper window")
 }
 if !strings.Contains(page,"dialog-42")||!strings.Contains(page,"Nem válaszol a mappaválasztó"){
  t.Fatal("Native error is not visible in popup",page)
 }
}

func TestWindowsSaveAsWritesSelectedXMIXAndAbsoluteXPRGs(t *testing.T){
 root:=t.TempDir()
 mixPath:=filepath.Join(root,"Sajat_gyartas.xMix")
 first,err:=saveMachineFilesAtPath(mixPath,nativeTestBundle())
 if err!=nil{t.Fatal(err)}
 if first!=mixPath{t.Fatal("XMIX not saved at selected file path:",first)}
 mixBytes,err:=os.ReadFile(mixPath)
 if err!=nil{t.Fatal(err)}
 mix:=string(mixBytes)
 for _,name:=range []string{"01.xPrg","02.xPrg"}{
  program:=filepath.Join(root,"2026_10_30_Teszt","xPrg",name)
  if _,err:=os.Stat(program);err!=nil{t.Fatalf("Missing XPRG %s: %v",program,err)}
  if !strings.Contains(mix,`File="`+program+`"`){
    t.Fatalf("XMIX does not point to actual program: %s\n%s",program,mix)
  }
 }
}
func TestWindowsSaveAsProtectsExistingXPRGDirectory(t *testing.T){
 root:=t.TempDir()
 mixPath:=filepath.Join(root,"Projekt.xMix")
 _,err:=saveMachineFilesAtPath(mixPath,nativeTestBundle())
 if err!=nil{t.Fatal(err)}
 oldProgram:=filepath.Join(root,"2026_10_30_Teszt","xPrg","01.xPrg")
 if err:=os.WriteFile(oldProgram,[]byte("OLD"),0600);err!=nil{t.Fatal(err)}
 _,err=saveMachineFilesAtPath(mixPath,nativeTestBundle())
 if err!=nil{t.Fatal(err)}
 existing,err:=os.ReadFile(oldProgram)
 if err!=nil||string(existing)!="OLD"{t.Fatal("Existing XPRG overwritten!")}
 xml,err:=os.ReadFile(mixPath)
 if err!=nil{t.Fatal(err)}
 newFolder:=filepath.Join(root,"2026_10_30_Teszt_2","xPrg","01.xPrg")
 if !strings.Contains(string(xml),newFolder){
  t.Fatal("XMIX has wrong second save path:",string(xml))
 }
}
func TestWindowsSaveAsRejectsInvalidFileExtension(t *testing.T){
 _,err:=saveMachineFilesAtPath(filepath.Join(t.TempDir(),"wrong.txt"),nativeTestBundle())
 if err==nil{t.Fatal("Invalid XMIX file extension accepted")}
}

func TestSaveAsIframeResponseIsNotBlockedByFrameAncestors(t *testing.T){
 w:=httptest.NewRecorder()
 nativeFormResult(w,"win-dialog",true,map[string]interface{}{"path":"test.xMix"},nil)
 policy:=w.Header().Get("Content-Security-Policy")
 if strings.Contains(policy,"frame-ancestors 'none'"){
  t.Fatal("Browser would block hidden native Save As result frame")
 }
 if !strings.Contains(w.Body.String(),"window.parent.postMessage"){
  t.Fatal("Native Save As iframe cannot report the result")
 }
 page:=filepath.Join(t.TempDir(),"index.htm")
 if err:=os.WriteFile(page,[]byte("<html></html>"),0600);err!=nil{t.Fatal(err)}
 port,_,stop,err:=startNativeBridge(page)
 if err!=nil{t.Fatal(err)}
 defer stop()
 resp,err:=http.Get(fmt.Sprintf("http://127.0.0.1:%d/native/ready",port))
 if err!=nil{t.Fatal(err)}
 _=resp.Body.Close()
 if strings.Contains(resp.Header.Get("Content-Security-Policy"),"frame-ancestors 'none'"){
  t.Fatal("Browser would block native Save As ready frame")
 }
}
