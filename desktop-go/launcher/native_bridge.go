// A Gatterka Windows futtatókörnyezet helyi mappaválasztója és xMix mentője.
// A véletlenszerű munkamenet-token és a localhost kötés megakadályozza,
// hogy távoli weboldalak hozzáférjenek a felhasználó gépi fájljaihoz.
package main

import (
 "crypto/rand"
 "encoding/base64"
 "encoding/json"
 "errors"
 "fmt"
 "html"
 "net"
 "net/http"
 "os"
 "path/filepath"
 "regexp"
 "strings"
 "sync"
 "time"
)

type nativeBridge struct {
 token string
 mu sync.Mutex
 selectedDirectory string
}
type nativeFile struct {
 Path string `json:"path"`
 Content string `json:"content"`
}
type nativeSave struct {
 CabinetFolder string `json:"cabinetFolder"`
 Files []nativeFile `json:"files"`
}
type nativeChoose struct {
 Initial string `json:"initial"`
}

const nativeRelayHTML = `<!doctype html><html lang="hu"><head><meta charset="utf-8"><title>Gatterka helyi mentés</title></head><body><script>
window.addEventListener('message', async function(event) {
  var message=event.data;
  if(event.source!==window.parent || !message || message.type!=='gatterka-command' ||
     (message.action!=='choose' && message.action!=='save') ||
     typeof message.token!=='string' || typeof message.id!=='string') return;
  try {
    var response=await fetch('/native/'+message.action,{
      method:'POST',
      headers:{'Content-Type':'application/json','X-Gatterka-Token':message.token},
      body:JSON.stringify(message.payload),
      cache:'no-store'
    });
    var data=await response.json();
    window.parent.postMessage({type:'gatterka-result',id:message.id,ok:response.ok,
      value:data,error:response.ok?'':(data.error||'Windows mentési hiba.')},'*');
  }catch(error){
    window.parent.postMessage({type:'gatterka-result',id:message.id,ok:false,
      error:'A helyi Windows-mappamentő nem válaszolt: '+(error.message||error)},'*');
  }
});
</script></body></html>`

const maxNativeBody = 12 << 20
const defaultMachineDirectory = `C:\Gatterka`
var machineFolderName=regexp.MustCompile(`^[A-Za-z0-9_-]{1,90}$`)
var machineXprgName=regexp.MustCompile(`^[A-Za-z0-9_.-]+\.xPrg$`)
var machineXmixName=regexp.MustCompile(`^[A-Za-z0-9_.-]+\.xMix$`)
var machineMixRows=regexp.MustCompile(`<RigaMix[ \t]+File="[^"]+"[^>]*\/>`)
var machineMixFileAttribute=regexp.MustCompile(`File="[^"]+"`)

func machineJSON(w http.ResponseWriter, status int, value interface{}) {
 w.Header().Set("Content-Type","application/json; charset=utf-8")
 w.Header().Set("Cache-Control","no-store")
 w.WriteHeader(status)
 _=json.NewEncoder(w).Encode(value)
}
func machineError(w http.ResponseWriter,status int,err error) {
 machineJSON(w,status,map[string]string{"error":err.Error()})
}
func (bridge *nativeBridge) allow(w http.ResponseWriter,r *http.Request) bool {
 // A fájl-eredetű felület egy localhost-iframe-en keresztül kéri a
 // mentést. Az iframe és ez az API azonos eredetű, a token kötelező.
 w.Header().Set("Cache-Control","no-store")
 if r.Method==http.MethodOptions {w.WriteHeader(http.StatusNoContent);return false}
 if r.Method!=http.MethodPost {machineError(w,405,errors.New("Csak POST engedélyezett."));return false}
 if r.Header.Get("X-Gatterka-Token")!=bridge.token {
   machineError(w,403,errors.New("Érvénytelen Gatterka munkamenet."));return false
 }
 if origin:=r.Header.Get("Origin");origin!=""&&origin!="null"&&origin!="http://"+r.Host {
   machineError(w,403,errors.New("A kérés nem a helyi Gatterka ablakból érkezett."));return false
 }
 return true
}

func startNativeBridge(page string)(int,string,func(),error){
 secret:=make([]byte,32)
 if _,err:=rand.Read(secret);err!=nil{return 0,"",nil,err}
 token:=base64.RawURLEncoding.EncodeToString(secret)
 listener,err:=net.Listen("tcp","127.0.0.1:0")
 if err!=nil{return 0,"",nil,err}
 bridge:=&nativeBridge{token:token}
 router:=http.NewServeMux()
 router.HandleFunc("/native/choose",bridge.choose)
 router.HandleFunc("/native/save",bridge.save)
 router.HandleFunc("/native/pick-save",bridge.pickAndSave)
 // A natív mentés elérhetőségét felső szintű böngészőablakból teszteljük:
 // nincs CORS, iframe vagy fájl-eredetű fetch. Ha nem érkezik vissza
 // ez az üzenet, a felület néhány másodpercen belül hibát jelez.
 router.HandleFunc("/native/ready",func(w http.ResponseWriter,r *http.Request){
  if r.Method!=http.MethodGet{http.Error(w,"Only GET",http.StatusMethodNotAllowed);return}
  w.Header().Set("Content-Type","text/html; charset=utf-8")
  w.Header().Set("Cache-Control","no-store")
  w.Header().Set("X-Content-Type-Options","nosniff")
  w.Header().Set("Content-Security-Policy","default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'")
  _,_=w.Write([]byte(`<!doctype html><html lang="hu"><head><meta charset="utf-8"><title>Gatterka gépi mentés</title></head><body style="font:15px Segoe UI,Arial,sans-serif;padding:25px;color:#17392f;background:#f5f7f4"><h2>Gatterka – gépi mentés</h2><p>A kapcsolat működik. A Windows mappaválasztó megnyitása következik.</p><script>var message={type:'gatterka-ready',id:decodeURIComponent(location.hash.slice(1))};if(window.parent!==window){window.parent.postMessage(message,'*')}else if(window.opener){window.opener.postMessage(message,'*')}</script></body></html>`))
 })
 router.HandleFunc("/native/relay",func(w http.ResponseWriter,r *http.Request){
  if r.Method!=http.MethodGet{http.Error(w,"Method not allowed",http.StatusMethodNotAllowed);return}
  w.Header().Set("Content-Type","text/html; charset=utf-8")
  w.Header().Set("Cache-Control","no-store")
  w.Header().Set("X-Content-Type-Options","nosniff")
  w.Header().Set("Content-Security-Policy","default-src 'none'; script-src 'unsafe-inline'; connect-src 'self'")
  _,_=w.Write([]byte(nativeRelayHTML))
 })
 router.HandleFunc("/",func(w http.ResponseWriter,r *http.Request){
  if (r.URL.Path!="/"&&r.URL.Path!="/index.htm")||r.Method!=http.MethodGet {http.NotFound(w,r);return}
  w.Header().Set("Cache-Control","no-store")
  w.Header().Set("X-Content-Type-Options","nosniff")
  w.Header().Set("Content-Type","text/html; charset=utf-8")
  http.ServeFile(w,r,page)
 })
 server:=&http.Server{Handler:router,ReadHeaderTimeout:10*time.Second}
 go func(){_ = server.Serve(listener)}()
 return listener.Addr().(*net.TCPAddr).Port,token,func(){
  _=server.Close()
  _=listener.Close()
 },nil
}

func (bridge *nativeBridge) choose(w http.ResponseWriter,r *http.Request){
 if !bridge.allow(w,r){return}
 bridge.mu.Lock()
 defer bridge.mu.Unlock()
 r.Body=http.MaxBytesReader(w,r.Body,4096)
 var input nativeChoose
 if err:=json.NewDecoder(r.Body).Decode(&input);err!=nil {
  machineError(w,400,err);return
 }
 initial:=strings.TrimSpace(input.Initial)
 if initial=="" {initial=defaultMachineDirectory}
 // A felhasználó a mappaválasztóban másik meghajtóra is navigálhat.
 // A C:\Gatterka mappa a párbeszédablak megnyitásakor létrejön, ha lehet.
 if filepath.Clean(initial)==filepath.Clean(defaultMachineDirectory) {
  if err:=os.MkdirAll(defaultMachineDirectory,0700);err!=nil {
   // Írásvédett C: gyökér esetén a Windows C: könyvtárában induljon a választó.
   initial=filepath.VolumeName(defaultMachineDirectory)+string(filepath.Separator)
  }
 }
 dir,err:=chooseWindowsFolder(initial)
 if err!=nil {machineError(w,500,err);return}
 if dir==""{machineJSON(w,200,map[string]bool{"cancelled":true});return}
 bridge.selectedDirectory=dir
 machineJSON(w,200,map[string]interface{}{"cancelled":false,"path":dir})
}

func safeNativeProgramFiles(req nativeSave) (string,[]nativeFile,error){
 if !machineFolderName.MatchString(req.CabinetFolder) ||
  len(req.Files)<2 || len(req.Files)>102 {
   return "",nil,errors.New("Érvénytelen gépi projektmappa vagy fájlszám.")
 }
 prefix:=req.CabinetFolder+"/"
 var mix string
 var xml string
 names:=map[string]bool{}
 seenPaths:=map[string]bool{}
 programs:=0
 for _,file:=range req.Files {
  if seenPaths[file.Path]{return "",nil,errors.New("Ismétlődő programfájl.")}
  seenPaths[file.Path]=true
  if !strings.HasPrefix(file.Path,prefix){return "",nil,errors.New("Projektmappán kívüli fájl.")}
  sub:=strings.TrimPrefix(file.Path,prefix)
  if strings.Contains(sub,"..") {return "",nil,errors.New("Nem megengedett fájlnév.")}
  if !strings.Contains(sub,"/")&&machineXmixName.MatchString(sub){
   if mix!=""||!strings.HasPrefix(file.Content,"<xMix>"){
    return "",nil,errors.New("Hiányzó vagy többszörös XML Mix.")
   }
   mix=sub;xml=file.Content
  } else if strings.HasPrefix(sub,"xPrg/"){
   name:=strings.TrimPrefix(sub,"xPrg/")
   if !machineXprgName.MatchString(name)||strings.Contains(name,"/")||
     !strings.HasPrefix(file.Content,"<SchemaDoc>"){
    return "",nil,errors.New("Érvénytelen .xPrg fájl vagy tartalom.")
   }
   names[name]=true
   programs++
  }else{return "",nil,errors.New("Csak a projekt Mix és xPrg alkönyvtár fájljai menthetők.")}
 }
 if mix==""||programs<1{return "",nil,errors.New("Hiányzik a közös Mix vagy valamelyik tábla.")}
 if !strings.Contains(xml,"<RigheMix>")||!strings.Contains(xml,"</xMix>"){
   return "",nil,errors.New("Hiányos XML Mix.")
 }
 rows:=machineMixRows.FindAllString(xml,-1)
 if len(rows)!=programs{return "",nil,errors.New("A Mix sorainak száma eltér a táblaprogramokétól.")}
 referenced:=map[string]bool{}
 for _,row:=range rows {
  attr:=machineMixFileAttribute.FindString(row)
  if attr==""{return "",nil,errors.New("Hiányzó Mix fájlhivatkozás.")}
  raw:=html.UnescapeString(strings.TrimSuffix(strings.TrimPrefix(attr,`File="`),`"`))
  n:=raw
  if j:=strings.LastIndexAny(n,`\/`);j>=0{n=n[j+1:]}
  if !names[n]||referenced[n]{
   return "",nil,errors.New("A Mix olyan .xPrg fájlra hivatkozik, amely nincs a csomagban.")
  }
  referenced[n]=true
 }
 return mix,req.Files,nil
}
func patchNativeMix(xml string,root string,folder string)(string,error){
 result:=machineMixRows.ReplaceAllStringFunc(xml,func(row string) string {
  attr:=machineMixFileAttribute.FindString(row)
  raw:=html.UnescapeString(strings.TrimSuffix(strings.TrimPrefix(attr,`File="`),`"`))
  name:=raw
  if j:=strings.LastIndexAny(name,`\/`);j>=0{name=name[j+1:]}
  absolute:=filepath.Join(root,folder,"xPrg",name)
  return strings.Replace(row,attr,`File="`+xmlEscapeNative(absolute)+`"`,1)
 })
 return result,nil
}
func xmlEscapeNative(path string)string{
 return strings.NewReplacer("&","&amp;","\"","&quot;","<","&lt;",">","&gt;","'","&apos;").Replace(path)
}
func saveMachineFiles(root string, req nativeSave)(string,error){
 _,files,err:=safeNativeProgramFiles(req)
 if err!=nil{return "",err}
 // A kiválasztott szülőmappában külön naponkénti mappa készül.
 // A .xMix teljes elérési útja erre a valós könyvtárra mutat.
 datedRoot:=filepath.Join(root,time.Now().Format("2006-01-02"))
 if err:=os.MkdirAll(datedRoot,0700);err!=nil{return "",err}
 var folder string
 for n:=1;n<=99;n++{
  name:=req.CabinetFolder
  if n>1{name+=fmt.Sprintf("_%d",n)}
  candidate:=filepath.Join(datedRoot,name)
  err=os.Mkdir(candidate,0700)
  if os.IsExist(err){continue}
  if err!=nil{return "",err}
  folder=name
  break
 }
 if folder==""{return "",errors.New("Túl sok azonos nevű gépi projektmappa.")}
 full:=filepath.Join(datedRoot,folder)
 success:=false
 defer func(){if !success{_ = os.RemoveAll(full)}}()
 if err=os.Mkdir(filepath.Join(full,"xPrg"),0700);err!=nil{return "",err}
 for _,file:=range files {
  rel:=strings.TrimPrefix(file.Path,req.CabinetFolder+"/")
  name:=filepath.Base(strings.ReplaceAll(rel,"/",string(filepath.Separator)))
  content:=file.Content
  target:=filepath.Join(full,name)
  if strings.HasPrefix(rel,"xPrg/"){
   target=filepath.Join(full,"xPrg",name)
  } else {
   content,err=patchNativeMix(content,datedRoot,folder)
   if err!=nil{return "",err}
  }
  if err=os.WriteFile(target,[]byte(content),0600);err!=nil{return "",err}
 }
 success=true
 return full,nil
}

 
// A Windows "Mentés másként" ablakában kijelölt .xMix pontos helyére írunk.
// Az xPrg fájlok e mappa alatti külön projektmappába kerülnek, és a Mix
// minden RigaMix File attribútuma a tényleges abszolút útvonalat kapja.
// Meglévő xPrg könyvtárat soha nem írunk felül; ütközéskor új almappa készül.
func saveMachineFilesAtPath(mixPath string,req nativeSave)(string,error){
 _,files,err:=safeNativeProgramFiles(req)
 if err!=nil{return "",err}
 if !filepath.IsAbs(mixPath)||!strings.EqualFold(filepath.Ext(mixPath),".xMix"){
  return "",errors.New("Az XMIX mentési helyének teljes Windows .xMix fájlútvonalnak kell lennie.")
 }
 root:=filepath.Dir(mixPath)
 st,err:=os.Stat(root)
 if err!=nil||!st.IsDir(){return "",fmt.Errorf("A célmappa nem létezik: %s",root)}
 var projectDir,folder string
 for n:=1;n<=99;n++{
  name:=req.CabinetFolder
  if n>1{name+=fmt.Sprintf("_%d",n)}
  candidate:=filepath.Join(root,name)
  if err:=os.Mkdir(candidate,0700);os.IsExist(err){continue
  } else if err!=nil{return "",err}
  projectDir=candidate
  folder=name
  break
 }
 if projectDir==""{return "",errors.New("Túl sok azonos nevű gépi projektmappa.")}
 success:=false
 defer func(){if !success{_ = os.RemoveAll(projectDir)}}()
 if err:=os.Mkdir(filepath.Join(projectDir,"xPrg"),0700);err!=nil{return "",err}
 var xml string
 for _,file:=range files {
  rel:=strings.TrimPrefix(file.Path,req.CabinetFolder+"/")
  if strings.HasPrefix(rel,"xPrg/"){
   target:=filepath.Join(projectDir,"xPrg",filepath.Base(rel))
   if err:=os.WriteFile(target,[]byte(file.Content),0600);err!=nil{return "",err}
  }else{
   xml,err=patchNativeMix(file.Content,root,folder)
   if err!=nil{return "",err}
  }
 }
 if xml==""{return "",errors.New("Nincs XMIX tartalom.")}
 temp,err:=os.CreateTemp(root,".gatterka-mix-*.new")
 if err!=nil{return "",err}
 tempPath:=temp.Name()
 defer os.Remove(tempPath)
 if _,err=temp.Write([]byte(xml));err!=nil{_ = temp.Close();return "",err}
 if err=temp.Close();err!=nil{return "",err}
 // A Windows fájlablaka már megerősíti a meglévő XMIX felülírását;
 // a korábbi fájlt biztonsági másolatba mozgatjuk, amíg a csere nem kész.
 backup:=""
 if existing,statErr:=os.Stat(mixPath);statErr==nil{
  if existing.IsDir(){return "",errors.New("A kiválasztott XMIX név egy könyvtár neve.")}
  candidate,err:=os.CreateTemp(root,".gatterka-old-mix-*.bak")
  if err!=nil{return "",err}
  backup=candidate.Name()
  _=candidate.Close()
  _=os.Remove(backup)
  if err:=os.Rename(mixPath,backup);err!=nil{return "",err}
 } else if !os.IsNotExist(statErr){return "",statErr}
 if err:=os.Rename(tempPath,mixPath);err!=nil{
  if backup!=""{_ = os.Rename(backup,mixPath)}
  return "",err
 }
 if backup!=""{_ = os.Remove(backup)}
 success=true
 return mixPath,nil
}

func (bridge *nativeBridge) save(w http.ResponseWriter,r *http.Request){
 if !bridge.allow(w,r){return}
 bridge.mu.Lock()
 defer bridge.mu.Unlock()
 dir:=bridge.selectedDirectory
 if dir==""{machineError(w,400,errors.New("Először válassz mappát!"));return}
 info,err:=os.Stat(dir)
 if err!=nil||!info.IsDir(){machineError(w,400,errors.New("A kijelölt Windows-mappa már nem érhető el."));return}
 r.Body=http.MaxBytesReader(w,r.Body,maxNativeBody)
 var request nativeSave
 if err=json.NewDecoder(r.Body).Decode(&request);err!=nil{machineError(w,400,err);return}
 full,err:=saveMachineFiles(dir,request)
 if err!=nil{machineError(w,400,err);return}
 machineJSON(w,200,map[string]interface{}{
   "path":full,"cabinetFolder":filepath.Base(full),
   "programs":len(request.Files)-1,
 })
}

 
// Egyetlen böngészős űrlap-POST. Nem igényel file:// -> localhost fetch/CORS-t,
// ezért a natív mentés olyan Edge/Chrome verzión is működik, amely tiltja a cross-origin fetch-et.
// A mentés válasza felső szintű segédablakban jelenik meg, nem rejtett
// iframe-ben. A visszajelzés az indító Gatterka ablakába is átkerül.
func nativeFormResult(w http.ResponseWriter,id string,success bool,data interface{},err error){
 w.Header().Set("Content-Type","text/html; charset=utf-8")
 w.Header().Set("Cache-Control","no-store")
 w.Header().Set("X-Content-Type-Options","nosniff")
 w.Header().Set("Content-Security-Policy","default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'")
 message:=map[string]interface{}{"type":"gatterka-form-result","id":id,"ok":success,"value":data}
 visible:="A gépi fájlok mentése sikerült."
 if err!=nil{
  message["error"]=err.Error()
  visible="A mentés nem sikerült: "+err.Error()
 }
 if success {
  if item,ok:=data.(map[string]interface{});ok&&item["cancelled"]==true{
   visible="A mappaválasztást megszakítottad."
  }
 }
 jsonMessage,_:=json.Marshal(message)
 _,_=fmt.Fprintf(w,`<!doctype html><html lang="hu"><head><meta charset="utf-8"><title>Gatterka – mentési eredmény</title></head><body style="font:15px Segoe UI,Arial,sans-serif;padding:24px;color:#17392f;background:#f5f7f4"><h2>Gatterka</h2><p>%s</p><p>Ablak bezárása után visszatérhetsz a Gatterkához.</p><script>if(window.parent!==window){window.parent.postMessage(%s,'*');}else if(window.opener&&!window.opener.closed){window.opener.postMessage(%s,'*');setTimeout(function(){window.close()},500);}</script></body></html>`,html.EscapeString(visible),jsonMessage,jsonMessage)
}
func (bridge *nativeBridge) pickAndSave(w http.ResponseWriter,r *http.Request){
 if r.Method!=http.MethodPost {
  nativeFormResult(w,"",false,nil,errors.New("Csak POST engedélyezett."));return
 }
 if origin:=r.Header.Get("Origin");origin!=""&&origin!="null"&&origin!="http://"+r.Host {
  nativeFormResult(w,"",false,nil,errors.New("Idegen weboldalról nem lehet gépi mentést indítani."));return
 }
 r.Body=http.MaxBytesReader(w,r.Body,32<<20)
 if err:=r.ParseForm();err!=nil {
  nativeFormResult(w,"",false,nil,fmt.Errorf("Nem olvasható a mentési kérelem: %w",err));return
 }
 id:=r.PostForm.Get("id")
 if r.PostForm.Get("token")!=bridge.token {
  nativeFormResult(w,id,false,nil,errors.New("Érvénytelen Gatterka munkamenet."));return
 }
 var req nativeSave
 if err:=json.Unmarshal([]byte(r.PostForm.Get("request")),&req);err!=nil{
  nativeFormResult(w,id,false,nil,fmt.Errorf("Hibás gépi mentési adatok: %w",err));return
 }
 if _,_,err:=safeNativeProgramFiles(req);err!=nil{
  nativeFormResult(w,id,false,nil,err);return
 }
 bridge.mu.Lock()
 defer bridge.mu.Unlock()
 initial:=filepath.Join(defaultMachineDirectory,time.Now().Format("2006-01-02"))
 if err:=os.MkdirAll(initial,0700);err!=nil{
  initial=filepath.Join(os.Getenv("USERPROFILE"),"Documents")
  if info,statErr:=os.Stat(initial);statErr!=nil||!info.IsDir(){
   initial=filepath.VolumeName(defaultMachineDirectory)+string(filepath.Separator)
  }
 }
 mixName,_,_:=safeNativeProgramFiles(req)
 mixPath,err:=chooseWindowsSaveFile(initial,mixName)
 if err!=nil{nativeFormResult(w,id,false,nil,err);return}
 if mixPath==""{
  nativeFormResult(w,id,true,map[string]interface{}{"cancelled":true},nil);return
 }
 full,err:=saveMachineFilesAtPath(mixPath,req)
 if err!=nil{nativeFormResult(w,id,false,nil,err);return}
 nativeFormResult(w,id,true,map[string]interface{}{
  "cancelled":false,"path":full,"programs":len(req.Files)-1,
 },nil)
}
