// A Gatterka Windows futtatókörnyezet helyi mappaválasztója és xMix mentője.
// A véletlenszerű munkamenet-token és a localhost kötés megakadályozza,
// hogy távoli weboldalak hozzáférjenek a felhasználó gépi fájljaihoz.
package main

import (
 "archive/zip"
 "io"
 "crypto/rand"
 "encoding/base64"
 "encoding/json"
 "errors"
 "fmt"
 "html"
 "runtime"
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
 "unsafe"
)

type nativeBridge struct {
 token string
 mu sync.Mutex
 selectedDirectory string
 selectedMixPath string
 selectedCncZipPath string
 lastDirectory string
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
 nativeActivity.touch()
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
 router.HandleFunc("/native/ping",bridge.ping)
 router.HandleFunc("/native/choose",bridge.choose)
 router.HandleFunc("/native/save",bridge.save)
 router.HandleFunc("/native/choose-save-as",bridge.chooseSaveAs)
 router.HandleFunc("/native/write-files",bridge.writeFiles)
 router.HandleFunc("/native/choose-cnc-save-as",bridge.chooseCncSaveAs)
 router.HandleFunc("/native/write-cnc-zip",bridge.writeCncZip)
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
$picker.AutoUpgradeEnabled=$true
$start=$env:GATTERKA_INITIAL_FOLDER
if($start -and [System.IO.Directory]::Exists($start)){$picker.SelectedPath=$start}
$owner=New-Object System.Windows.Forms.Form
$owner.TopMost=$true
$owner.ShowInTaskbar=$false
$owner.Opacity=0
$owner.Width=1
$owner.Height=1
$owner.StartPosition=[System.Windows.Forms.FormStartPosition]::CenterScreen
try {
  $owner.Show()
  $owner.Activate()
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
 if initial=="" {initial=bridge.selectedDirectory}
 dir,err:=chooseWindowsFolder(initial)
 if err!=nil {machineError(w,500,err);return}
 if dir==""{machineJSON(w,200,map[string]bool{"cancelled":true});return}
 bridge.selectedDirectory=dir
 machineJSON(w,200,map[string]interface{}{"cancelled":false,"path":dir})
}

func safeNativeProgramFiles(req nativeSave) (string,[]nativeFile,error){
 if !machineFolderName.MatchString(req.CabinetFolder) ||
  len(req.Files)<2 {
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
 var folder string
 for n:=1;;n++{
  name:=req.CabinetFolder
  if n>1{name+=fmt.Sprintf("_%d",n)}
  candidate:=filepath.Join(root,name)
  err=os.Mkdir(candidate,0700)
  if os.IsExist(err){continue}
  if err!=nil{return "",err}
  folder=name
  break
 }
  full:=filepath.Join(root,folder)
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
   content,err=patchNativeMix(content,root,folder)
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
 // A gépi csomag méretét a program- és táblaszám nem korlátozza.
 // A JSON adatot a választott mentési művelet kezeli.
 var request nativeSave
 if err=json.NewDecoder(r.Body).Decode(&request);err!=nil{machineError(w,400,err);return}
 full,err:=saveMachineFiles(dir,request)
 if err!=nil{machineError(w,400,err);return}
 machineJSON(w,200,map[string]interface{}{
   "path":full,"cabinetFolder":filepath.Base(full),
   "programs":len(request.Files)-1,
 })
}


// A felhasználó a valódi Windows "Mentés másként" ablakban választja ki a mappát
// és a közös .xMix fájl nevét. A Go ezután ugyanebbe a mappába menti a .xMix-et
// és az összes táblánkénti .xPrg fájlt; a .xMix az .xPrg fájlok teljes útvonalát tartalmazza.
// Natív Win32 Mentés másként párbeszédablak közvetlenül a Go indítóból.
// Nem használ rejtett PowerShell-ablakot, és a Gatterka ablakát teszi tulajdonossá.
type windowsSaveFileName struct {
 StructureSize uint32
 Owner uintptr
 Instance uintptr
 Filter uintptr
 CustomFilter uintptr
 MaxCustomFilter uint32
 FilterIndex uint32
 File uintptr
 MaxFile uint32
 FileTitle uintptr
 MaxFileTitle uint32
 InitialDir uintptr
 Title uintptr
 Flags uint32
 FileOffset uint16
 FileExtension uint16
 DefaultExt uintptr
 CustomData uintptr
 Hook uintptr
 TemplateName uintptr
 Reserved uintptr
 ReservedDword uint32
 FlagsEx uint32
}
func chooseWindowsSaveXmix(defaultName string,initialDir string)(string,error){
  runtime.LockOSThread()
  defer runtime.UnlockOSThread()
  // A közös Windows Mentés másként ablak követi a Gatterka előtérben lévő ablakát.
  const ofnOverwritePrompt=0x00000002
  const ofnHideReadOnly=0x00000004
  const ofnNoChangeDir=0x00000008
  const ofnPathMustExist=0x00000800
  const ofnExplorer=0x00080000
  const ofnEnableSizing=0x00800000
  file:=make([]uint16,32768)
  name:=utf16.Encode([]rune(defaultName))
  if len(name)+1>=len(file){return "",errors.New("Túl hosszú xMix fájlnév.")}
  copy(file,name)
  filter:=utf16.Encode([]rune("xMix fájlok (*.xMix)\x00*.xMix\x00"))
  filter=append(filter,0)
  title,_:=syscall.UTF16PtrFromString("Gatterka – Mentés másként (xMix + xPrg)")
  extension,_:=syscall.UTF16PtrFromString("xMix")
  var initial *uint16
  if initialDir!=""{
    if st,err:=os.Stat(initialDir);err==nil&&st.IsDir(){
      initial,_=syscall.UTF16PtrFromString(initialDir)
    }
  }
  user32:=syscall.NewLazyDLL("user32.dll")
  foreground:=user32.NewProc("GetForegroundWindow")
  hwnd,_,_:=foreground.Call()
  if hwnd==0{return "",errors.New("Nincs előtérben aktív Windows-ablak a Mentés másként megnyitásához.")}
  params:=windowsSaveFileName{
   Owner:hwnd,
   Filter:uintptr(unsafe.Pointer(&filter[0])),
   FilterIndex:1,
   File:uintptr(unsafe.Pointer(&file[0])),
   MaxFile:uint32(len(file)),
   InitialDir:uintptr(unsafe.Pointer(initial)),
   Title:uintptr(unsafe.Pointer(title)),
   DefaultExt:uintptr(unsafe.Pointer(extension)),
   Flags:ofnOverwritePrompt|ofnHideReadOnly|ofnNoChangeDir|ofnPathMustExist|ofnExplorer|ofnEnableSizing,
  }
  params.StructureSize=uint32(unsafe.Sizeof(params))
  dialog:=syscall.NewLazyDLL("comdlg32.dll").NewProc("GetSaveFileNameW")
  success,_,_:=dialog.Call(uintptr(unsafe.Pointer(&params)))
  runtime.KeepAlive(file)
  runtime.KeepAlive(filter)
  runtime.KeepAlive(title)
  runtime.KeepAlive(extension)
  runtime.KeepAlive(initial)
  if success==0{
    extended,_,_:=syscall.NewLazyDLL("comdlg32.dll").NewProc("CommDlgExtendedError").Call()
    if extended==0{return "",nil} // A felhasználó megszakította az ablakot.
    return "",fmt.Errorf("A Windows Mentés másként ablak nem nyitható meg (kód: 0x%X).",extended)
  }
  chosen:=filepath.Clean(syscall.UTF16ToString(file))
  if !filepath.IsAbs(chosen) || !strings.EqualFold(filepath.Ext(chosen),".xMix"){
    return "",errors.New("A Mentés másként ablakból nem teljes .xMix fájlútvonal érkezett.")
  }
  info,err:=os.Stat(filepath.Dir(chosen))
  if err!=nil||!info.IsDir(){return "",errors.New("A kiválasztott célmappa nem érhető el.")}
  return chosen,nil
}

func chooseWindowsSaveCncZip(defaultName string,initialDir string)(string,error){
  runtime.LockOSThread()
  defer runtime.UnlockOSThread()
  // A közös Windows Mentés másként ablak követi a Gatterka előtérben lévő ablakát.
  const ofnOverwritePrompt=0x00000002
  const ofnHideReadOnly=0x00000004
  const ofnNoChangeDir=0x00000008
  const ofnPathMustExist=0x00000800
  const ofnExplorer=0x00080000
  const ofnEnableSizing=0x00800000
  file:=make([]uint16,32768)
  name:=utf16.Encode([]rune(defaultName))
  if len(name)+1>=len(file){return "",errors.New("Túl hosszú ZIP fájlnév.")}
  copy(file,name)
  filter:=utf16.Encode([]rune("ZIP fájlok (*.zip)\x00*.zip\x00"))
  filter=append(filter,0)
  title,_:=syscall.UTF16PtrFromString("Gatterka – CNC programok mentése (.zip)")
  extension,_:=syscall.UTF16PtrFromString("zip")
  var initial *uint16
  if initialDir!=""{
    if st,err:=os.Stat(initialDir);err==nil&&st.IsDir(){
      initial,_=syscall.UTF16PtrFromString(initialDir)
    }
  }
  user32:=syscall.NewLazyDLL("user32.dll")
  foreground:=user32.NewProc("GetForegroundWindow")
  hwnd,_,_:=foreground.Call()
  if hwnd==0{return "",errors.New("Nincs előtérben aktív Windows-ablak a Mentés másként megnyitásához.")}
  params:=windowsSaveFileName{
   Owner:hwnd,
   Filter:uintptr(unsafe.Pointer(&filter[0])),
   FilterIndex:1,
   File:uintptr(unsafe.Pointer(&file[0])),
   MaxFile:uint32(len(file)),
   InitialDir:uintptr(unsafe.Pointer(initial)),
   Title:uintptr(unsafe.Pointer(title)),
   DefaultExt:uintptr(unsafe.Pointer(extension)),
   Flags:ofnOverwritePrompt|ofnHideReadOnly|ofnNoChangeDir|ofnPathMustExist|ofnExplorer|ofnEnableSizing,
  }
  params.StructureSize=uint32(unsafe.Sizeof(params))
  dialog:=syscall.NewLazyDLL("comdlg32.dll").NewProc("GetSaveFileNameW")
  success,_,_:=dialog.Call(uintptr(unsafe.Pointer(&params)))
  runtime.KeepAlive(file)
  runtime.KeepAlive(filter)
  runtime.KeepAlive(title)
  runtime.KeepAlive(extension)
  runtime.KeepAlive(initial)
  if success==0{
    extended,_,_:=syscall.NewLazyDLL("comdlg32.dll").NewProc("CommDlgExtendedError").Call()
    if extended==0{return "",nil} // A felhasználó megszakította az ablakot.
    return "",fmt.Errorf("A Windows Mentés másként ablak nem nyitható meg (kód: 0x%X).",extended)
  }
  chosen:=filepath.Clean(syscall.UTF16ToString(file))
  if !filepath.IsAbs(chosen) || !strings.EqualFold(filepath.Ext(chosen),".zip"){
    return "",errors.New("A Mentés másként ablakból nem teljes .zip fájlútvonal érkezett.")
  }
  info,err:=os.Stat(filepath.Dir(chosen))
  if err!=nil||!info.IsDir(){return "",errors.New("A kiválasztott célmappa nem érhető el.")}
  return chosen,nil
}


// A CNC ZIP mentés független az xMix/xPrg mentés útvonalától.
type nativeCncSave struct {
 Programs []nativeProgram `json:"programs"`
}
var cncProgramName=regexp.MustCompile(`^[A-Za-z0-9_.-]+\\.xxl$`)
func validateCncZip(req nativeCncSave) error {
 if len(req.Programs)==0{return errors.New("Nincs menthető CNC XXL program.")}
 names:=map[string]bool{}
 for _,p:=range req.Programs{
  name:=p.Name
  if len(name)>190||!cncProgramName.MatchString(name)||strings.HasPrefix(name,".")||strings.Contains(name,"..")||strings.ContainsAny(name,`/\\`){
    return errors.New("Érvénytelen CNC .xxl fájlnév.")
  }
  lowered:=strings.ToLower(name)
  if names[lowered]{return errors.New("Azonos nevű CNC programot nem lehet kétszer menteni.")}
  names[lowered]=true
  if !strings.HasPrefix(p.Content,"H DX=")||!strings.HasSuffix(p.Content,"VEGE\\r\\n"){
    return errors.New("Érvénytelen Xilog XXL tartalom: "+name)
  }
 }
 return nil
}
func saveCncZipFiles(target string,req nativeCncSave)(string,error){
 if err:=validateCncZip(req);err!=nil{return "",err}
 dir:=filepath.Dir(target)
 if !strings.EqualFold(filepath.Ext(target),".zip")||!filepath.IsAbs(target){
   return "",errors.New("CNC mentéshez teljes .zip útvonal szükséges.")
 }
 if st,err:=os.Stat(dir);err!=nil||!st.IsDir(){return "",errors.New("A CNC célmappája nem elérhető.")}
 // A meglévő ZIP csomagot nem írjuk felül automatikusan, egyedi sorszámot kap.
 path:=target
 for n:=2;;n++{
   _,err:=os.Stat(path)
   if os.IsNotExist(err){break}
   if err!=nil{return "",err}
   path=strings.TrimSuffix(target,filepath.Ext(target))+fmt.Sprintf("_%d.zip",n)
 }
 temp,err:=os.CreateTemp(dir,".gatterka-cnc-*.tmp")
 if err!=nil{return "",err}
 tempPath:=temp.Name()
 defer os.Remove(tempPath)
 writer:=zip.NewWriter(temp)
 for _,p:=range req.Programs{
   w,e:=writer.Create(p.Name)
   if e!=nil{_ =writer.Close();_ =temp.Close();return "",e}
   if _,e=io.Copy(w,strings.NewReader(p.Content));e!=nil{
     _ =writer.Close();_ =temp.Close();return "",e
   }
 }
 if err=writer.Close();err!=nil{_ =temp.Close();return "",err}
 if err=temp.Close();err!=nil{return "",err}
 if err=os.Rename(tempPath,path);err!=nil{return "",err}
 return path,nil
}
func (bridge *nativeBridge) chooseCncSaveAs(w http.ResponseWriter,r *http.Request){
 if !bridge.allow(w,r){return}
 bridge.mu.Lock()
 defer bridge.mu.Unlock()
 bridge.selectedCncZipPath=""
 r.Body=http.MaxBytesReader(w,r.Body,4096)
 var input struct{DefaultName string `json:"defaultName"`}
 if err:=json.NewDecoder(r.Body).Decode(&input);err!=nil{machineError(w,400,err);return}
 name:=strings.TrimSpace(input.DefaultName)
 if name==""||len(name)>195||strings.ContainsAny(name,`/\\<>:"|?*`)||
    !strings.EqualFold(filepath.Ext(name),".zip")||strings.Contains(name,".."){
   name="Gatterka_CNC_XXL.zip"
 }
 chosen,err:=chooseWindowsSaveCncZip(name,bridge.lastDirectory)
 if err!=nil{machineError(w,500,err);return}
 if chosen==""{machineJSON(w,200,map[string]bool{"cancelled":true});return}
 bridge.selectedCncZipPath=chosen
 machineJSON(w,200,map[string]interface{}{"cancelled":false,"zipPath":chosen})
}
func (bridge *nativeBridge) writeCncZip(w http.ResponseWriter,r *http.Request){
 if !bridge.allow(w,r){return}
 bridge.mu.Lock()
 defer bridge.mu.Unlock()
 target:=bridge.selectedCncZipPath
 bridge.selectedCncZipPath=""
 if target==""{machineError(w,400,errors.New("Először válassz mappát a CNC Mentés másként ablakában."));return}
 r.Body=http.MaxBytesReader(w,r.Body,256<<20)
 var req nativeCncSave
 if err:=json.NewDecoder(r.Body).Decode(&req);err!=nil{machineError(w,400,err);return}
 saved,err:=saveCncZipFiles(target,req)
 if err!=nil{machineError(w,500,err);return}
 bridge.lastDirectory=filepath.Dir(saved)
 machineJSON(w,200,map[string]interface{}{"path":saved,"folder":bridge.lastDirectory,"programs":len(req.Programs)})
}

func (bridge *nativeBridge) chooseSaveAs(w http.ResponseWriter,r *http.Request){
 if !bridge.allow(w,r){return}
 bridge.mu.Lock()
 defer bridge.mu.Unlock()
 bridge.selectedMixPath=""
 r.Body=http.MaxBytesReader(w,r.Body,4096)
 var input struct{DefaultName string `json:"defaultName"`}
 if err:=json.NewDecoder(r.Body).Decode(&input);err!=nil{machineError(w,400,err);return}
 defaultName:=strings.TrimSpace(input.DefaultName)
 if !machineXmixName.MatchString(defaultName){defaultName="Gatterka_projekt.xMix"}
 path,err:=chooseWindowsSaveXmix(defaultName,bridge.lastDirectory)
 if err!=nil{machineError(w,500,err);return}
 if path==""{machineJSON(w,200,map[string]bool{"cancelled":true});return}
 bridge.selectedMixPath=path
 machineJSON(w,200,map[string]interface{}{"cancelled":false,"mixPath":path})
}
func (bridge *nativeBridge) writeFiles(w http.ResponseWriter,r *http.Request){
 if !bridge.allow(w,r){return}
 bridge.mu.Lock()
 defer bridge.mu.Unlock()
 path:=bridge.selectedMixPath
 bridge.selectedMixPath=""
 if path==""{machineError(w,400,errors.New("Először válassz mappát és fájlnevet a Mentés másként ablakban."));return}
 // A gépi csomag méretét a program- és táblaszám nem korlátozza.
 // A JSON adatot a választott mentési művelet kezeli.
 var request nativeMixSave
 if err:=json.NewDecoder(r.Body).Decode(&request);err!=nil{machineError(w,400,err);return}
 saved,err:=saveMixAndPrograms(path,request)
 if err!=nil{machineError(w,500,err);return}
 bridge.lastDirectory=saved.Folder
 machineJSON(w,200,saved)
}

// ping: az oldal rendszeresen jelez, hogy a launcher ne álljon le (lásd bridge_keepalive.go).
func (bridge *nativeBridge) ping(w http.ResponseWriter,r *http.Request){
 if !bridge.allow(w,r){return}
 machineJSON(w,200,map[string]bool{"ok":true})
}
