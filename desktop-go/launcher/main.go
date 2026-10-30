// Gatterka Windows desktop launcher using installed Edge/Chrome engine (offline UI).
package main

import (
    "encoding/json"
    "fmt"
    "net/url"
    "os"
    "os/exec"
    "path/filepath"
    "regexp"
    "strconv"
    "strings"
    "syscall"
    "time"
    "unsafe"
)

var version = "1.0.14"

func message(s string) {
    title, _ := syscall.UTF16PtrFromString("Gatterka " + version)
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


// Letöltések ismert Windows-mappa: a registry helyes akkor is, ha a felhasználó
// áthelyezte a Letöltések mappát (például egy másik meghajtóra).
func downloadsFolder() string {
    home,err:=os.UserHomeDir()
    if err!=nil || home=="" {home=os.Getenv("USERPROFILE")}
    fallback:=filepath.Join(home,"Downloads")
    key:="HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders"
    const folderID="{374DE290-123F-4565-9164-39C4925E467B}"
    cmd:=exec.Command("reg.exe","QUERY",key,"/v",folderID)
    cmd.SysProcAttr=&syscall.SysProcAttr{HideWindow:true}
    out,err:=cmd.Output()
    if err!=nil {return fallback}
    envRef:=regexp.MustCompile(`%([^%]+)%`)
    for _,line:=range strings.Split(string(out),"\n"){
        fields:=strings.Fields(line)
        if len(fields)<3 || !strings.EqualFold(fields[0],folderID) || !strings.HasPrefix(fields[1],"REG_"){continue}
        raw:=strings.Join(fields[2:]," ")
        expanded:=envRef.ReplaceAllStringFunc(raw,func(text string)string{
            val:=os.Getenv(text[1:len(text)-1])
            if val=="" {return text}
            return val
        })
        if filepath.IsAbs(expanded) {return filepath.Clean(expanded)}
    }
    return fallback
}

// A Gatterka dedikált Edge/Chrome profilját használjuk: nem módosítjuk
// a felhasználó normál böngészőjének beállításait, és nem kapcsolunk ki
// Windows biztonsági szolgáltatásokat.
// A Chromium Preferences többi mezőjét érintetlenül hagyjuk.
func configureBrowserDownloads(profile string) error {
    dir:=downloadsFolder()
    if err:=os.MkdirAll(dir,0700);err!=nil{return fmt.Errorf("Letöltések mappa: %w",err)}
    preferences:=filepath.Join(profile,"Default","Preferences")
    if err:=os.MkdirAll(filepath.Dir(preferences),0700);err!=nil{return err}
    existing,err:=os.ReadFile(preferences)
    if err!=nil && !os.IsNotExist(err){return err}
    prefs:=map[string]interface{}{}
    if len(existing)>0 {
        if err=json.Unmarshal(existing,&prefs);err!=nil {
            return fmt.Errorf("Böngészőprofil beállításai nem olvashatók (nem írjuk felül): %w",err)
        }
    }
    section:=func(name string)map[string]interface{}{
        if val,ok:=prefs[name].(map[string]interface{});ok{return val}
        val:=map[string]interface{}{}
        prefs[name]=val
        return val
    }
    download:=section("download")
    download["default_directory"]=dir
    download["prompt_for_download"]=false
    download["directory_upgrade"]=true
    section("savefile")["default_directory"]=dir
    data,err:=json.MarshalIndent(prefs,"","  ")
    if err!=nil{return err}
    return os.WriteFile(preferences,data,0600)
}

func main(){
    exe,err := os.Executable()
    if err != nil { message("Nem található az alkalmazás elérési útja.\n"+err.Error()); return }
    root := filepath.Dir(exe)
    page := filepath.Join(root,"app","index.htm")
    if _,err := os.Stat(page); err != nil {message("Hiányzik az alkalmazás fájlja:\n"+page+"\nTelepítsd újra a Gatterkaet.");return}
    page, _ = filepath.Abs(page)
    // Saját helyi Windows-mappaválasztó és projektmentés: a Chromium
    // file:// környezet önmagában nem tud teljes X:\\... útvonalat lekérni.
    port,token,stopBridge,bridgeErr:=startNativeBridge(page)
    if bridgeErr!=nil {
        message("A gépi programok Windows mappaválasztója nem érhető el:\n"+bridgeErr.Error()+
            "\nA ZIP letöltése ettől még használható.")
    } else {defer stopBridge()}
    appURL:=fileURL(page)
    if bridgeErr==nil {
        // A file://-eredet megőrzése szükséges a korábbi helyi
        // bútorprojektek megtartásához. A mentéshez a helyi API fut.
        appURL+="#gatterka-native="+strconv.Itoa(port)+"."+token
    }
    if path,found:=firstBrowser();found {
        local := os.Getenv("LOCALAPPDATA")
        if local == "" {local = os.TempDir()}
        userDataDir := filepath.Join(local,"Lapterv","BongeszoProfil")
        _ = os.MkdirAll(userDataDir, 0700)
        // A fájlok a Windows saját Letöltések mappájába kerülnek,
        // nem a telepítés mappájába, és nincs Mentés másként kérdés.
        if err:=configureBrowserDownloads(userDataDir);err!=nil {
            message("A Letöltések mappa beállítása sikertelen:\n"+err.Error()+
                "\nEllenőrizd a böngésző mentési beállítását.")
        }
        // A Windows saját maximalizált ablaka, nem F11/kioszk:
        // az ablak jobb felső gombjával normál méretre visszaállítható.
        cmd:=exec.Command(path,"--app="+appURL,"--user-data-dir="+userDataDir,"--no-first-run","--start-maximized")
        if err=cmd.Start();err==nil {
            // Az alkalmazásablak ikonja is Gatterka legyen, ne Edge/Chrome.
            setRunningWindowIcon(cmd.Process.Pid)
            // FONTOS: az Edge/Chrome újrahasznosíthat egy futó
            // böngészőfolyamatot. Ilyenkor a cmd.Wait() AZONNAL visszatér,
            // bár a Gatterka ablaka továbbra is nyitva van. A korábbi kód
            // ekkor leállította a localhost mentőszolgáltatást, ami miatt
            // a Mentés gombra ERR_CONNECTION_REFUSED jelent meg.
            // A processz erőforrásait külön takarítjuk, de a mentőszolgáltatás
            // élettartama a látható Gatterka főablakhoz igazodik.
            go func(){_ = cmd.Wait()}()
            waitForGatterkaWindow(gatterkaMainWindowVisible,500*time.Millisecond,8*time.Hour)
            return
        }
    }
    // Fallback: any registered system browser, retains normal browser UI.
    cmd:=exec.Command("rundll32.exe","url.dll,FileProtocolHandler",fileURL(page))
    if err=cmd.Start();err!=nil {
        message("Nem tudtam elindítani a Gatterkaet.\n"+err.Error()+"\nNyisd meg közvetlenül ezt a fájlt:\n"+page)
    }
    _=fmt.Sprint(strings.TrimSpace(version)) // reserved version marker
}
