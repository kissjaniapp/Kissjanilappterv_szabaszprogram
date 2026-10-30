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
 "os/exec"
 "path/filepath"
 "regexp"
 "strings"
 "sync"
 "syscall"
 "time"
 "unicode/utf16"
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
 w.Header().Set("Access-Control-Allow-Origin","null")
 w.Header().Set("Access-Control-Allow-Methods","POST, OPTIONS")
 w.Header().Set("Access-Control-Allow-Headers","Content-Type, X-Gatterka-Token")
 w.Header().Set("Access-Control-Allow-Private-Network","true")
 w.Header().Set("Vary","Origin")
 if r.Method==http.MethodOptions {w.WriteHeader(http.StatusNoContent);return false}
 if r.Method!=http.MethodPost {machineError(w,405,errors.New("Csak POST engedélyezett."));return false}
 if r.Header.Get("X-Gatterka-Token")!=bridge.token {
   machineError(w,403,errors.New("Érvénytelen Gatterka munkamenet."));return false
 }
 if origin:=r.Header.Get("Origin");origin!=""&&origin!="null" {
   machineError(w,403,errors.New("A kérés nem a helyi Gatterka ablakból érkezett."));return false
 }
 return true
}

func startNativeBridge()(int,string,func(),error){
 secret:=make([]byte,32)
 if _,err:=rand.Read(secret);err!=nil{return 0,"",nil,err}
 token:=base64.RawURLEncoding.EncodeToString(secret)
 listener,err:=net.Listen("tcp","127.0.0.1:0")
 if err!=nil{return 0,"",nil,err}
 bridge:=&nativeBridge{token:token}
 router:=http.NewServeMux()
 router.HandleFunc("/native/choose",bridge.choose)
 router.HandleFunc("/native/save",bridge.save)
 server:=&http.Server{Handler:router,ReadHeaderTimeout:10*time.Second}
 go func(){_ = server.Serve(listener)}()
 return listener.Addr().(*net.TCPAddr).Port,token,func(){
  _=server.Close()
  _=listener.Close()
 },nil
}

// Valódi Windows mappaválasztó: a PowerShell a kiválasztott mappa abszolút
// meghajtóútvonalát adja át a Go alkalmazásnak. Nem csupán a mappa nevét.
func chooseWindowsFolder(initial string)(string,error){
 script:=`$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Windows.Forms
[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false)
$picker=New-Object System.Windows.Forms.FolderBrowserDialog
$picker.Description='Gatterka - valaszd ki a gepi projektfajlok szulomappajat'
$picker.ShowNewFolderButton=$true
$start=$env:GATTERKA_INITIAL_FOLDER
if($start -and [System.IO.Directory]::Exists($start)){$picker.SelectedPath=$start}
$owner=New-Object System.Windows.Forms.Form
$owner.TopMost=$true
$owner.ShowInTaskbar=$false
try {
  $result=$picker.ShowDialog($owner)
  if($result -eq [System.Windows.Forms.DialogResult]::OK){
    [Console]::WriteLine($picker.SelectedPath)
  } else {
    [Console]::WriteLine('GATTERKA_CANCELLED')
  }
} finally {
  $picker.Dispose()
  $owner.Dispose()
}`
 chars:=utf16.Encode([]rune(script))
 bytes:=make([]byte,2*len(chars))
 for i,c:=range chars {bytes[2*i]=byte(c);bytes[2*i+1]=byte(c>>8)}
 cmd:=exec.Command("powershell.exe","-NoProfile","-STA","-EncodedCommand",base64.StdEncoding.EncodeToString(bytes))
 cmd.Env=append(os.Environ(),"GATTERKA_INITIAL_FOLDER="+initial)
 cmd.SysProcAttr=&syscall.SysProcAttr{HideWindow:true}
 output,err:=cmd.CombinedOutput()
 if err!=nil{return "",fmt.Errorf("A Windows mappaválasztó nem indult: %w: %s",err,strings.TrimSpace(string(output)))}
 dir:=strings.TrimSpace(string(output))
 if dir==""||dir=="GATTERKA_CANCELLED"{return "",nil}
 dir=filepath.Clean(dir)
 if !filepath.IsAbs(dir){return "",errors.New("A mappaválasztó nem teljes Windows-útvonalat adott.")}
 st,err:=os.Stat(dir)
 if err!=nil||!st.IsDir(){return "",fmt.Errorf("A kiválasztott mappa nem érhető el: %s",dir)}
 return dir,nil
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
