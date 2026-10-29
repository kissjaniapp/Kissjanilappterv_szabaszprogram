package main
import (
    "fmt"
    "os"
    "os/exec"
    "path/filepath"
    "strings"
    "syscall"
    "unsafe"
)
func mb(s string,flags uintptr) uintptr {
    t,_:=syscall.UTF16PtrFromString("Lapterv eltávolítás")
    p,_:=syscall.UTF16PtrFromString(s)
    r,_,_:=syscall.NewLazyDLL("user32.dll").NewProc("MessageBoxW").Call(0,uintptr(unsafe.Pointer(p)),uintptr(unsafe.Pointer(t)),flags)
    return r
}
func psquote(s string)string{return "'"+strings.ReplaceAll(s,"'","''")+"'"}
func main(){
    if mb("Eltávolítod a Lapterv programot?\n\nA mentett projektadatok és böngészőprofil megmaradnak.",0x24)!=6 {return}
    exe,err:=os.Executable();if err!=nil {mb(err.Error(),0x10);return}
    root:=filepath.Dir(exe)
    if !strings.EqualFold(filepath.Base(root),"Lapterv") {mb("A telepítési mappa nem Lapterv, az eltávolítás megszakadt.",0x10);return}
    // Includes OneDrive redirected Desktop and localized Start menu paths.
    shortcuts := `$desktop=[Environment]::GetFolderPath('DesktopDirectory'); `+
      `$menu=[Environment]::GetFolderPath('Programs'); `+
      `foreach($d in @($desktop,$menu)){if($d){Remove-Item -LiteralPath (Join-Path $d 'Lapterv.lnk') -Force -ErrorAction SilentlyContinue}}`
    _=exec.Command("powershell.exe","-NoProfile","-NonInteractive","-Command",shortcuts).Run()
    _=exec.Command("reg.exe","DELETE",`HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\Lapterv`,"/f").Run()
    script:=fmt.Sprintf("Start-Sleep -Seconds 3; Remove-Item -LiteralPath %s -Recurse -Force -ErrorAction SilentlyContinue",psquote(root))
    cmd:=exec.Command("powershell.exe","-NoProfile","-NonInteractive","-WindowStyle","Hidden","-Command",script)
    cmd.SysProcAttr=&syscall.SysProcAttr{HideWindow:true}
    if err=cmd.Start();err!=nil {mb("A könyvtár automatikus törlése nem indult: "+err.Error()+"\nTöröld kézzel: "+root,0x30)}
}
