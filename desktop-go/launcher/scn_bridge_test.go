package main

import (
 "bytes"
 "encoding/json"
 "net/http"
 "net/http/httptest"
 "os"
 "path/filepath"
 "strings"
 "testing"
 "time"
)

func scnRequest(method,path,token string,body []byte)*http.Request{
 r:=httptest.NewRequest(method,path,bytes.NewReader(body))
 r.Header.Set("Origin","null")
 r.Header.Set("X-Gatterka-Token",token)
 return r
}
func TestKitchenDrawScnBridgeQueueAndResult(t *testing.T){
 dir:=t.TempDir()
 t.Setenv("LOCALAPPDATA",dir)
 queue:=filepath.Join(dir,"ScnViewerBridge","queue")
 if err:=os.MkdirAll(queue,0700);err!=nil{t.Fatal(err)}
 if err:=os.WriteFile(filepath.Join(dir,"ScnViewerBridge","heartbeat"),[]byte(time.Now().UTC().String()),0600);err!=nil{t.Fatal(err)}
 bridge:=&nativeBridge{token:"test-secret"}
 r:=scnRequest(http.MethodPost,"/native/scn/import","test-secret",bytes.Repeat([]byte("SCNTEST"),20))
 w:=httptest.NewRecorder()
 bridge.scnImport(w,r)
 if w.Code!=202{t.Fatalf("SCN bridge import failed: %d %s",w.Code,w.Body.String())}
 var info struct{ID string `json:"id"`}
 if err:=json.Unmarshal(w.Body.Bytes(),&info);err!=nil{t.Fatal(err)}
 prefix:=filepath.Join(queue,info.ID)
 if _,err:=os.Stat(prefix+".pending");err!=nil{t.Fatal("Missing KitchenDraw plugin queue trigger:",err)}
 if _,err:=os.Stat(prefix+".scn");err!=nil{t.Fatal("Missing input scene:",err)}
 in,_:=json.Marshal(map[string]string{"id":info.ID})
 w=httptest.NewRecorder()
 bridge.scnStatus(w,scnRequest(http.MethodPost,"/native/scn/status","test-secret",in))
 if !strings.Contains(w.Body.String(),"\"pending\""){t.Fatal("Pending state:",w.Body.String())}
 content:="o Bútor 1/Oldal\nv 0 0 0\nv 600 0 0\nv 0 400 0\nf 1 2 3\n"
 if err:=os.WriteFile(prefix+".obj",[]byte(content),0600);err!=nil{t.Fatal(err)}
 if err:=os.WriteFile(prefix+".manifest.json",[]byte(`{"sceneName":"Konténer","objects":[{"name":"Oldal"}]}`),0600);err!=nil{t.Fatal(err)}
 if err:=os.WriteFile(prefix+".done",[]byte("ok"),0600);err!=nil{t.Fatal(err)}
 w=httptest.NewRecorder()
 bridge.scnStatus(w,scnRequest(http.MethodPost,"/native/scn/status","test-secret",in))
 if !strings.Contains(w.Body.String(),"\"done\""){t.Fatal("Done state:",w.Body.String())}
 w=httptest.NewRecorder()
 bridge.scnResult(w,scnRequest(http.MethodPost,"/native/scn/result","test-secret",in))
 if w.Code!=200||!strings.Contains(w.Body.String(),"Bútor 1/Oldal"){
  t.Fatalf("KitchenDraw export unavailable: %d %s",w.Code,w.Body.String())
 }
 if _,err:=os.Stat(prefix+".scn");!os.IsNotExist(err){t.Fatal("Input scene copy left behind",err)}
 if _,err:=os.Stat(prefix+".obj");!os.IsNotExist(err){t.Fatal("OBJ copy left behind",err)}
}
func TestKitchenDrawScnBridgeCannotAccessFilesystemByJobId(t *testing.T){
 t.Setenv("LOCALAPPDATA",t.TempDir())
 bridge:=&nativeBridge{token:"test-secret"}
 for _,id:=range []string{"../secret","a/../b","ABC",strings.Repeat("a",100)}{
  in,_:=json.Marshal(map[string]string{"id":id})
  w:=httptest.NewRecorder()
  bridge.scnResult(w,scnRequest(http.MethodPost,"/native/scn/result","test-secret",in))
  if w.Code!=400{t.Fatalf("Invalid job ID accepted: %q: %d",id,w.Code)}
 }
 req:=scnRequest(http.MethodPost,"/native/scn/import","WRONG",bytes.Repeat([]byte("X"),20))
 w:=httptest.NewRecorder()
 bridge.scnImport(w,req)
 if w.Code!=403{t.Fatal("Wrong token accepted",w.Code)}
}
func TestKitchenDrawScnBridgeRequiresActualRunningSDKPlugin(t *testing.T){
 t.Setenv("LOCALAPPDATA",t.TempDir())
 bridge:=&nativeBridge{token:"test-secret"}
 w:=httptest.NewRecorder()
 bridge.scnImport(w,scnRequest(http.MethodPost,"/native/scn/import","test-secret",bytes.Repeat([]byte("A"),24)))
 if w.Code!=503||!strings.Contains(w.Body.String(),"KitchenDraw Bridge"){
  t.Fatalf("Expected explicit SDK2 plugin requirement: %d %s",w.Code,w.Body.String())
 }
}
