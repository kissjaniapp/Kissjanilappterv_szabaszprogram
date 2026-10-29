// Lapterv per-user offline Windows installer (first trial release).
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
)

//go:embed assets/Lapterv.exe assets/Lapterv_Eltavolitas.exe assets/index.htm
var payload embed.FS

const version = "0.2.0"

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

func install(root string)error {
 for _,spec:=range []struct{source,dest string}{
  {"assets/Lapterv.exe","Lapterv.exe"},
  {"assets/Lapterv_Eltavolitas.exe","Lapterv_Eltavolitas.exe"},
  {"assets/index.htm",filepath.Join("app","index.htm")},
 } {
  if e:=writeOne(root,spec.source,spec.dest);e!=nil{return fmt.Errorf("%s: %w",spec.dest,e)}
 }
 target:=filepath.Join(root,"Lapterv.exe")
 if e:=shortcuts(target);e!=nil{return fmt.Errorf("a program települt, de a parancsikonok nem készültek el: %w",e)}
 registry:=[]struct{k,v string}{
  {"DisplayName","Lapterv"},{"DisplayVersion",version},
  {"Publisher","Lapterv – saját próbaverzió"},
  {"InstallLocation",root},
  {"DisplayIcon",target},
  {"UninstallString",`"`+filepath.Join(root,"Lapterv_Eltavolitas.exe")+`"`},
 }
 for _,p:=range registry {if e:=reg(p.k,p.v);e!=nil{return e}}
 return nil
}

func main(){
 local:=os.Getenv("LOCALAPPDATA")
 if local==""{ message("A LOCALAPPDATA mappa nem érhető el. A telepítés nem indítható.",0x10);return }
 root:=filepath.Join(local,"Programs","Lapterv")
 if strings.Contains(root,"\x00") {message("Érvénytelen telepítési útvonal.",0x10);return}
 prompt:="Telepítem a Lapterv első Windowsos próbaverzióját?\n\n"+
  "Telepítési hely:\n"+root+"\n\n"+
  "A program telepített Microsoft Edge vagy Google Chrome segítségével fut, internet nélkül.\n"+
  "Nem tartalmaz hitelesített .xPrg gépi exportot."
 if message(prompt,0x24)!=6{return}
 if e:=install(root);e!=nil {
  var pe *os.PathError
  if errors.As(e,&pe) { message("Telepítési fájlhiba:\n"+e.Error()+"\n\nZárd be a futó Lapterv ablakokat, és próbáld újra.",0x10) } else {message("Telepítési hiba:\n"+e.Error()+"\n\nFuttatható fájl:\n"+filepath.Join(root,"Lapterv.exe"),0x30)}
  return
 }
 if message("A Lapterv telepítve!\n\nAz asztalon és a Start menüben találod.\n\nMegnyitod most?",0x24)==6 {
  if err:=exec.Command(filepath.Join(root,"Lapterv.exe")).Start();err!=nil { message("Nem sikerült elindítani:\n"+err.Error(),0x10) }
 }
}
