// Lapterv per-user offline Windows installer (desktop release).
// It installs only under LOCALAPPDATA, does not require administrator rights,
// and doesn't upload any data. Bundled Lapterv.exe launches the local HTML UI.
package main

import (
 "embed"
 "errors"
 "fmt"
 "os"
 "os/exec"
 "path/filepath"
 "strings"
 "syscall"
 "unsafe"
 "time"
)

//go:embed assets/Lapterv.exe assets/Lapterv_Eltavolitas.exe assets/index.htm
var payload embed.FS

const version = "1.0.6"

func message(body string, typ uintptr) uintptr {
 t, _ := syscall.UTF16PtrFromString("Lapterv " + version + " – Windows telepítő")
 s, _ := syscall.UTF16PtrFromString(body)
 r, _, _ := syscall.NewLazyDLL("user32.dll").NewProc("MessageBoxW").Call(0, uintptr(unsafe.Pointer(s)), uintptr(unsafe.Pointer(t)), typ)
 return r
}

func quotePS(s string) string {return "'" + strings.ReplaceAll(s,"'","''") + "'"}

func writeOne(dir, rel, dest string) error {
 data,e := payload.ReadFile(rel)
 if e!=nil {return e}
 target:=filepath.Join(dir,dest)
 if err:=os.MkdirAll(filepath.Dir(target),0700);err!=nil{return err}
 // Atomic replacement on Windows is not guaranteed when app is running.
 // The user should close an existing Lapterv session before updating.
 tmp:=target+".new"
 if err:=os.WriteFile(tmp,data,0600);err!=nil{return err}
 if err:=os.Rename(tmp,target);err!=nil {
   _ = os.Remove(target)
   if err2:=os.Rename(tmp,target);err2!=nil {return err2}
 }
 return nil
}

func shortcuts(target string)error {
 // Create normal Windows .lnk shortcuts, including OneDrive-redirected Desktop.
 ps:=`$s=New-Object -ComObject WScript.Shell; `+
   `$desktop=[Environment]::GetFolderPath('DesktopDirectory'); `+
   `$menu=[Environment]::GetFolderPath('Programs'); `+
   `$exe=`+quotePS(target)+`; `+
   `foreach($d in @($desktop,$menu)) { if($d) { `+
   `$link=$s.CreateShortcut((Join-Path $d 'Lapterv.lnk')); `+
   `$link.TargetPath=$exe; $link.WorkingDirectory=(Split-Path -Parent $exe); `+
   `$link.Description='Lapterv – szabásztervező'; $link.Save() } }`
 cmd:=exec.Command("powershell.exe","-NoProfile","-NonInteractive","-Command",ps)
 cmd.SysProcAttr=&syscall.SysProcAttr{HideWindow:true}
 if out,err:=cmd.CombinedOutput();err!=nil{return fmt.Errorf("%w: %s",err,string(out))}
 return nil
}

func reg(name, value string) error {
 k:=`HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\Lapterv`
 c:=exec.Command("reg.exe","ADD",k,"/v",name,"/t","REG_SZ","/d",value,"/f")
 c.SysProcAttr=&syscall.SysProcAttr{HideWindow:true}
 if out,err:=c.CombinedOutput();err!=nil {return fmt.Errorf("registry %s: %w: %s",name,err,string(out))}
 return nil
}

// A korabban telepitett Lapterv csak a sajat, elvart Windows-mappaban keresheto.
func installedVersion() string {
 cmd:=exec.Command("reg.exe","QUERY","HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Lapterv","/v","DisplayVersion")
 cmd.SysProcAttr=&syscall.SysProcAttr{HideWindow:true}
 out,err:=cmd.Output();if err!=nil{return ""}
 for _,line:=range strings.Split(string(out),"\n"){
  i:=strings.Index(strings.ToUpper(line),"REG_SZ")
  if i>=0&&strings.EqualFold(strings.TrimSpace(line[:i]),"DisplayVersion"){
   return strings.TrimSpace(line[i+len("REG_SZ"):])
  }
 }
 return ""
}
func previousInstalled(root string)(bool,error){
 // Korabbi frissites utan ne engedjuk idegen mappa torleset.
 info,err:=os.Stat(root)
 if os.IsNotExist(err){return false,nil}
 if err!=nil{return false,err}
 if !info.IsDir(){return false,fmt.Errorf("A cel nem mappa: %s",root)}
 if _,err=os.Stat(filepath.Join(root,"Lapterv.exe"));err!=nil{
  return false,fmt.Errorf("A mappaban nincs Lapterv.exe, nem toroljuk: %s",root)
 }
 return true,nil
}
// A futó program es a Lapterv sajat bongeszoprofiljanak folyamatai bezarulnak.
// Az egyeb Edge/Chrome ablakokat a telepito nem allitja le.
func stopLapterv(root,local string)error{
 exe:=filepath.Join(root,"Lapterv.exe")
 profile:=filepath.Join(local,"Lapterv","BongeszoProfil")
 ps:="$ErrorActionPreference='Stop'; $exe="+quotePS(exe)+
  "; $profile="+quotePS(profile)+
  "; Get-CimInstance Win32_Process | Where-Object { "+
  "($_.ExecutablePath -and $_.ExecutablePath -ieq $exe) -or "+
  "(($_.Name -ieq 'msedge.exe' -or $_.Name -ieq 'chrome.exe') -and "+
  "$_.CommandLine -and $_.CommandLine.IndexOf($profile,[System.StringComparison]::OrdinalIgnoreCase) -ge 0) "+
  "} | ForEach-Object {Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop}"
 cmd:=exec.Command("powershell.exe","-NoProfile","-NonInteractive","-Command",ps)
 cmd.SysProcAttr=&syscall.SysProcAttr{HideWindow:true}
 if out,err:=cmd.CombinedOutput();err!=nil{return fmt.Errorf("Az elozo Lapterv ablak nem zarhato le: %w: %s",err,string(out))}
 time.Sleep(300*time.Millisecond)
 return nil
}
func retryRename(from,to string)error{
 var err error
 for attempt:=0;attempt<12;attempt++{
  if err=os.Rename(from,to);err==nil{return nil}
  time.Sleep(250*time.Millisecond)
 }
 return err
}
func configure(root string)error{
 target:=filepath.Join(root,"Lapterv.exe")
 if e:=shortcuts(target);e!=nil{return fmt.Errorf("A parancsikonok nem keszultek el: %w",e)}
 registry:=[]struct{k,v string}{
  {"DisplayName","Lapterv"},{"DisplayVersion",version},{"Publisher","Lapterv"},
  {"InstallLocation",root},{"DisplayIcon",target},
  {"UninstallString","\""+filepath.Join(root,"Lapterv_Eltavolitas.exe")+"\""},
 }
 for _,p:=range registry{if e:=reg(p.k,p.v);e!=nil{return e}}
 return nil
}
// ELSO lepesben az uj csomag egy kulon mappaba kerul.
// Az elozo kiadast a sajat mappajabol elmozditjuk, az uj atveszi a helyet.
// Ha nem sikerul, az eredeti exe/app mappa visszaallithato.
func install(root,local string)(bool,error){
 stage:=root+".__frissites"
 backup:=root+".__regi"
 if _,err:=os.Stat(root);os.IsNotExist(err){
  if _,backupErr:=os.Stat(backup);backupErr==nil{
   if err=retryRename(backup,root);err!=nil{return false,fmt.Errorf("Korabbi megszakadt frissites helyreallitasa: %w",err)}
  }
 }
 if _,err:=os.Stat(backup);err==nil{return false,fmt.Errorf("Regebbi frissites biztonsagi mentese talalhato: %s",backup)}
 upgrading,err:=previousInstalled(root)
 if err!=nil{return false,err}
 if err=os.RemoveAll(stage);err!=nil{return upgrading,err}
 if err=os.MkdirAll(stage,0700);err!=nil{return upgrading,err}
 defer os.RemoveAll(stage)
 for _,spec:=range []struct{source,dest string}{
  {"assets/Lapterv.exe","Lapterv.exe"},
  {"assets/Lapterv_Eltavolitas.exe","Lapterv_Eltavolitas.exe"},
  {"assets/index.htm",filepath.Join("app","index.htm")},
 }{
  if err=writeOne(stage,spec.source,spec.dest);err!=nil{return upgrading,fmt.Errorf("%s: %w",spec.dest,err)}
 }
 if upgrading{
  if err=stopLapterv(root,local);err!=nil{return true,err}
  if err=retryRename(root,backup);err!=nil{return true,fmt.Errorf("A regi programfajlok eltavolitasa nem sikerult: %w",err)}
 }
 if err=retryRename(stage,root);err!=nil{
  if upgrading{_ = retryRename(backup,root)}
  return upgrading,fmt.Errorf("Az uj program telepitese nem sikerult: %w",err)
 }
 if err=configure(root);err!=nil{
  _=os.RemoveAll(root)
  if upgrading{_ = retryRename(backup,root)}
  return upgrading,err
 }
 if upgrading{
  if err=os.RemoveAll(backup);err!=nil{
   message("A frissites sikeres, de a regi program biztonsagi mentese nem torolheto:\n"+backup,0x30)
  }
 }
 return upgrading,nil
}

func main(){
 local:=os.Getenv("LOCALAPPDATA")
 if local==""{message("A LOCALAPPDATA mappa nem erheto el.",0x10);return}
 root:=filepath.Join(local,"Programs","Lapterv")
 if strings.Contains(root,"\x00"){message("Ervenytelen telepitesi utvonal.",0x10);return}
 updating,err:=previousInstalled(root)
 if err!=nil{message("Biztonsagi ellenorzes sikertelen:\n"+err.Error(),0x10);return}
 prompt:="Telepitem a Lapterv "+version+" Windows-alkalmazast?"
 if updating{
  old:=installedVersion();if old==""{old="korabbi verzio"}
  prompt="Lapterv frissites: "+old+" -> "+version+
   "\n\nA telepito automatikusan bezarja a futo Lapterv ablakot, lecsereli a regi programfajlokat es feltelepiti az ujakat."
 }
 prompt+="\n\nTelepitesi hely:\n"+root+
  "\n\nA MENTETT BUTOROK ES A HELYI PROJEKTEK MEGMARADNAK."+
  "\nAz xPrg tovabbra is csak offline ellenorzo minta."
 if message(prompt,0x24)!=6{return}
 upgraded,err:=install(root,local)
 if err!=nil{
  var pe *os.PathError
  if errors.As(err,&pe){
   message("A programfrissites Windows-fajlmuveleti hibaval leallt:\n"+err.Error()+
    "\nA mentett butorok megmaradtak.",0x10)
  }else{
   message("A telepites vagy frissites sikertelen:\n"+err.Error()+
    "\nA mentett butorok megmaradtak.",0x10)
  }
  return
 }
 done:="A Lapterv telepitve!"
 if upgraded{done="A regi Lapterv automatikusan frissitve "+version+" verziora!"}
 if message(done+"\n\nA mentett butorok megmaradtak.\nMegnyitod most?",0x24)==6{
  if err=exec.Command(filepath.Join(root,"Lapterv.exe")).Start();err!=nil{
   message("Nem sikerult elinditani:\n"+err.Error(),0x10)
  }
 }
}
