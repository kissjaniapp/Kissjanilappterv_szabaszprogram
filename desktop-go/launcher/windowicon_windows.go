package main

// A Gatterka.exe saját, beágyazott Windows-ikonját az Edge/Chrome
// --app ablakára is beállítjuk. A böngésző külön folyamat, az EXE
// erőforrásikonja ettől önmagában még nem kerül az ablak fejlécére.
import (
    "syscall"
    "time"
    "unsafe"
)

func setRunningWindowIcon(browserPID int) {
    if browserPID <= 0 { return }
    user32 := syscall.NewLazyDLL("user32.dll")
    kernel := syscall.NewLazyDLL("kernel32.dll")
    loadImage := user32.NewProc("LoadImageW")
    sendMessage := user32.NewProc("SendMessageW")
    getPid := user32.NewProc("GetWindowThreadProcessId")
    isVisible := user32.NewProc("IsWindowVisible")
    enumWindows := user32.NewProc("EnumWindows")
    setClassLongPtr := user32.NewProc("SetClassLongPtrW")
    module,_,_ := kernel.NewProc("GetModuleHandleW").Call(0)
    if module==0 {return}
    const imageIcon=1
    const lrDefaultSize=0x40
    const wmSetIcon=0x80
    icon,_,_ := loadImage.Call(module,1,imageIcon,0,0,lrDefaultSize)
    if icon==0 {return}
    small,_,_ := loadImage.Call(module,1,imageIcon,32,32,0)
    if small==0 {small=icon}
    // Böngészőprofilunk különálló, ezért csak a frissen indított folyamat
    // saját, látható ablakait érintjük.
    found:=false
    cb:=syscall.NewCallback(func(hwnd, param uintptr) uintptr {
        var windowPID uint32
        getPid.Call(hwnd,uintptr(unsafe.Pointer(&windowPID)))
        if int(windowPID)!=browserPID {return 1}
        v,_,_:=isVisible.Call(hwnd)
        if v==0 {return 1}
        sendMessage.Call(hwnd,wmSetIcon,0,small)
        sendMessage.Call(hwnd,wmSetIcon,1,icon)
        // A Windows alkalmazásikonját az osztályhoz is beállítjuk.
        // -14 = GCLP_HICON, -34 = GCLP_HICONSM
        setClassLongPtr.Call(hwnd,^uintptr(13),icon)
        setClassLongPtr.Call(hwnd,^uintptr(33),small)
        found=true
        return 1
    })
    for attempt:=0;attempt<48;attempt++{
        found=false
        enumWindows.Call(cb,0)
        if found {return}
        time.Sleep(250*time.Millisecond)
    }
}
