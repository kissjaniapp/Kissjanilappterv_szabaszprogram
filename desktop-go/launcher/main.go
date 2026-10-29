// Lapterv native Windows launcher, offline HTML application.
package main

import (
    "fmt"
    "net/url"
    "os"
    "os/exec"
    "path/filepath"
    "strings"
    "syscall"
    "unsafe"
)

var version = "0.2.0"

func message(s string) {
    title, _ := syscall.UTF16PtrFromString("Lapterv " + version)
    body, _ := syscall.UTF16PtrFromString(s)
    syscall.NewLazyDLL("user32.dll").NewProc("MessageBoxW").Call(0, uintptr(unsafe.Pointer(body)), uintptr(unsafe.Pointer(title)), 0x40)
}

func fileURL(p string) string {
    // file:///C:/... -- Windows drive paths require the leading slash.
    return (&url.URL{Scheme:"file", Path:"/" + filepath.ToSlash(p)}).String()
}

func firstBrowser() (string, bool) {
    paths := []string{}
    for _, key := range []string{"ProgramFiles(x86)", "ProgramFiles", "ProgramW6432", "LOCALAPPDATA"} {
        base := os.Getenv(key)
        if base == "" { continue }
        paths=append(paths,
            filepath.Join(base,"Microsoft","Edge","Application","msedge.exe"),
            filepath.Join(base,"Google","Chrome","Application","chrome.exe"),
        )
    }
    for _, p := range paths { if st,e := os.Stat(p); e == nil && !st.IsDir() {return p,true} }
    return "",false
}

func main(){
    exe,err := os.Executable()
    if err != nil { message("Nem található az alkalmazás elérési útja.\n"+err.Error()); return }
    root := filepath.Dir(exe)
    page := filepath.Join(root,"app","index.htm")
    if _,err := os.Stat(page); err != nil {message("Hiányzik az alkalmazás fájlja:\n"+page+"\nTelepítsd újra a Laptervet.");return}
    page, _ = filepath.Abs(page)
    if path,found:=firstBrowser();found {
        local := os.Getenv("LOCALAPPDATA")
        if local == "" {local = os.TempDir()}
        userDataDir := filepath.Join(local,"Lapterv","BongeszoProfil")
        _ = os.MkdirAll(userDataDir, 0700)
        cmd:=exec.Command(path,"--app="+fileURL(page),"--user-data-dir="+userDataDir,"--no-first-run","--window-size=1440,900")
        if err=cmd.Start();err==nil {return}
    }
    // Fallback: any registered system browser, retains normal browser UI.
    cmd:=exec.Command("rundll32.exe","url.dll,FileProtocolHandler",fileURL(page))
    if err=cmd.Start();err!=nil {
        message("Nem tudtam elindítani a Laptervet.\n"+err.Error()+"\nNyisd meg közvetlenül ezt a fájlt:\n"+page)
    }
    _=fmt.Sprint(strings.TrimSpace(version)) // reserved version marker
}
