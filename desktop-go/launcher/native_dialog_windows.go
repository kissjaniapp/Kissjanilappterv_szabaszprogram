//go:build windows

package main

import (
 "errors"
 "fmt"
 "os"
 "path/filepath"
 "runtime"
 "syscall"
 "unsafe"
)

// SHBrowseForFolderW natív Windows-mappaválasztó.
// Nincs PowerShell, rejtett konzolablak vagy WinForms tulajdonosablak.
type browseInfoW struct {
 owner uintptr
 root uintptr
 displayName *uint16
 title *uint16
 flags uint32
 callback uintptr
 param uintptr
 image int32
}

func chooseWindowsFolder(initial string)(string,error){
 runtime.LockOSThread()
 defer runtime.UnlockOSThread()
 ole32:=syscall.NewLazyDLL("ole32.dll")
 initSTA:=ole32.NewProc("CoInitializeEx")
 uninit:=ole32.NewProc("CoUninitialize")
 hr,_,_:=initSTA.Call(0,2) // COINIT_APARTMENTTHREADED
 if hr!=0&&hr!=1{return "",fmt.Errorf("A Windows mappaválasztó STA inicializálása nem sikerült: 0x%X",uint32(hr))}
 defer uninit.Call()

 shell:=syscall.NewLazyDLL("shell32.dll")
 user:=syscall.NewLazyDLL("user32.dll")
 title,err:=syscall.UTF16PtrFromString("Gatterka – válaszd ki a gépi mentés célmappáját")
 if err!=nil{return "",err}
 start:=filepath.Clean(initial)
 if st,e:=os.Stat(start);e!=nil||!st.IsDir(){
  start=filepath.VolumeName(start)+string(filepath.Separator)
 }
 startPtr,err:=syscall.UTF16PtrFromString(start)
 if err!=nil{return "",err}
 var display [260]uint16
 callback:=syscall.NewCallback(func(hwnd uintptr,msg uint32,unused uintptr,data uintptr)uintptr{
  if msg==1 { // BFFM_INITIALIZED: az induló könyvtár beállítása
   user.NewProc("SendMessageW").Call(hwnd,0x467,1,data) // BFFM_SETSELECTIONW
  }
  return 0
 })
 owner,_,_:=user.NewProc("GetForegroundWindow").Call()
 info:=browseInfoW{
  owner:owner,
  displayName:&display[0],
  title:title,
  flags:0x1|0x10|0x40, // BIF_RETURNONLYFSDIRS, BIF_EDITBOX, BIF_NEWDIALOGSTYLE
  callback:callback,
  param:uintptr(unsafe.Pointer(startPtr)),
 }
 pidl,_,_:=shell.NewProc("SHBrowseForFolderW").Call(uintptr(unsafe.Pointer(&info)))
 runtime.KeepAlive(startPtr)
 runtime.KeepAlive(callback)
 if pidl==0{return "",nil} // megszakítás
 defer ole32.NewProc("CoTaskMemFree").Call(pidl)
 pathBuf:=make([]uint16,32768)
 ok,_,_:=shell.NewProc("SHGetPathFromIDListW").Call(pidl,uintptr(unsafe.Pointer(&pathBuf[0])))
 if ok==0{return "",errors.New("Nem sikerült a kiválasztott Windows-mappa útvonalát kiolvasni.")}
 folder:=filepath.Clean(syscall.UTF16ToString(pathBuf))
 st,err:=os.Stat(folder)
 if err!=nil||!st.IsDir(){return "",fmt.Errorf("A kiválasztott mappa nem elérhető: %s",folder)}
 return folder,nil
}
