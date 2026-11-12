// Gatterka SCN betöltés a már meglévő SCN Viewer KitchenDraw Bridge sorának
// újrahasznosításával. Nem értelmezzük hamisan a gyártói bináris SCN-t:
// a telepített KitchenDraw SDK2 plugin készít OBJ-t és manifestet.
package main

import (
 "crypto/rand"
 "encoding/hex"
 "encoding/json"
 "errors"
 "io"
 "net/http"
 "os"
 "path/filepath"
 "regexp"
 "strings"
 "time"
)

var scnID=regexp.MustCompile("^[a-f0-9]{32}$")
const scnMaxInput int64=50<<20
const scnMaxObj int64=24<<20
func scnQueue()(string,error){
 root:=os.Getenv("LOCALAPPDATA")
 if root==""{return "",errors.New("Nem található a Windows LOCALAPPDATA mappa.")}
 return filepath.Join(root,"ScnViewerBridge","queue"),nil
}
func bridgeRunning() bool {
 dir,err:=scnQueue();if err!=nil{return false}
 h,err:=os.Stat(filepath.Join(filepath.Dir(dir),"heartbeat"))
 return err==nil&&time.Since(h.ModTime())<15*time.Second
}
func scnPrefix(id string)(string,error){
 if !scnID.MatchString(id){return "",errors.New("Hibás SCN munkamenetazonosító.")}
 dir,err:=scnQueue();if err!=nil{return "",err}
 return filepath.Join(dir,id),nil
}
func scnJobId() (string,error){
 b:=make([]byte,16)
 if _,err:=rand.Read(b);err!=nil{return "",err}
 return hex.EncodeToString(b),nil
}
func (bridge *nativeBridge) scnImport(w http.ResponseWriter,r *http.Request){
 if !bridge.allow(w,r){return}
 if !bridgeRunning(){
  machineError(w,503,errors.New("A KitchenDraw Bridge nem kapcsolódik. Indítsd a KitchenDraw-ot, telepítsd/aktiváld az SCN Viewer SDK2 pluginját, és a szükséges katalógusokat."));return
 }
 if r.ContentLength>scnMaxInput{
  machineError(w,413,errors.New("Az SCN fájl 50 MB-nál nagyobb."));return
 }
 dir,err:=scnQueue();if err!=nil{machineError(w,500,err);return}
 if err=os.MkdirAll(dir,0700);err!=nil{machineError(w,500,err);return}
 id,err:=scnJobId();if err!=nil{machineError(w,500,err);return}
 prefix:=filepath.Join(dir,id)
 file,err:=os.OpenFile(prefix+".scn",os.O_CREATE|os.O_EXCL|os.O_WRONLY,0600)
 if err!=nil{machineError(w,500,err);return}
 n,copyErr:=io.Copy(file,io.LimitReader(r.Body,scnMaxInput+1))
 closeErr:=file.Close()
 if copyErr!=nil||closeErr!=nil||n<16||n>scnMaxInput{
  _=os.Remove(prefix+".scn")
  machineError(w,400,errors.New("Hiányzó, túl nagy vagy sérült SCN bemeneti fájl."));return
 }
 // Csak a teljes .scn másolat után jelzünk a meglévő plugin sorának.
 if err=os.WriteFile(prefix+".pending",[]byte("gatterka"),0600);err!=nil{
  _=os.Remove(prefix+".scn");machineError(w,500,err);return
 }
 machineJSON(w,202,map[string]interface{}{"id":id,"state":"pending"})
}
func (bridge *nativeBridge) scnStatus(w http.ResponseWriter,r *http.Request){
 if !bridge.allow(w,r){return}
 var req struct{ID string `json:"id"`}
 if err:=json.NewDecoder(http.MaxBytesReader(w,r.Body,4096)).Decode(&req);err!=nil{
  machineError(w,400,err);return
 }
 prefix,err:=scnPrefix(req.ID);if err!=nil{machineError(w,400,err);return}
 if raw,err:=os.ReadFile(prefix+".error.txt");err==nil{
  machineJSON(w,200,map[string]string{"state":"error","message":strings.TrimSpace(string(raw))});return
 }
 if _,err:=os.Stat(prefix+".done");err==nil{
  if _,err:=os.Stat(prefix+".obj");err==nil{
   machineJSON(w,200,map[string]string{"state":"done"});return
  }
 }
 if _,err:=os.Stat(prefix+".working");err==nil{
  machineJSON(w,200,map[string]string{"state":"working"});return
 }
 if _,err:=os.Stat(prefix+".pending");err==nil{
  machineJSON(w,200,map[string]string{"state":"pending"});return
 }
 machineError(w,404,errors.New("Az SCN-feldolgozás nem található."))
}
func (bridge *nativeBridge) scnResult(w http.ResponseWriter,r *http.Request){
 if !bridge.allow(w,r){return}
 var req struct{ID string `json:"id"`}
 if err:=json.NewDecoder(http.MaxBytesReader(w,r.Body,4096)).Decode(&req);err!=nil{
  machineError(w,400,err);return
 }
 prefix,err:=scnPrefix(req.ID);if err!=nil{machineError(w,400,err);return}
 if _,err:=os.Stat(prefix+".done");err!=nil{
  machineError(w,409,errors.New("A KitchenDraw még nem exportálta a modellt."));return
 }
 info,err:=os.Stat(prefix+".obj")
 if err!=nil||info.Size()>scnMaxObj||info.Size()==0{
  machineError(w,413,errors.New("A KitchenDraw OBJ hiányzik, üres vagy nagyobb 24 MB-nál. Kisebb jelenetet exportálj."));return
 }
 obj,err:=os.ReadFile(prefix+".obj");if err!=nil{machineError(w,500,err);return}
 var manifest interface{}
 if raw,err:=os.ReadFile(prefix+".manifest.json");err==nil{
  _=json.Unmarshal(raw,&manifest)
 }
 machineJSON(w,200,map[string]interface{}{"obj":string(obj),"manifest":manifest,"state":"done"})
 // A Gatterka csak a KitchenDraw-tól kapott MÁSOLATOKAT törli,
 // a felhasználó eredeti .scn fájlját sohasem.
 for _,ext:=range []string{".scn",".obj",".manifest.json",".done"}{
  _=os.Remove(prefix+ext)
 }
}
