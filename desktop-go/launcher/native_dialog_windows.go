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
 "unicode/utf16"
 "strings"
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


// A hagyományos Windows "Mentés másként" (Explorer) párbeszédablak.
// Nem Edge/Chrome-ablak és nem PowerShell. A kijelölt .xMix fájl
// elérési útját pontosan visszaadja a gépi program mentéséhez.
type openFileNameW struct {
 structSize uint32
 owner uintptr
 instance uintptr
 filter *uint16
 customFilter *uint16
 maxCustomFilter uint32
 filterIndex uint32
 file *uint16
 maxFile uint32
 fileTitle *uint16
 maxFileTitle uint32
 initialDir *uint16
 title *uint16
 flags uint32
 fileOffset uint16
 fileExtension uint16
 defaultExtension *uint16
 customData uintptr
 hook uintptr
 templateName *uint16
 reserved uintptr
 reservedFlags uint32
 flagsEx uint32
}

func chooseWindowsSaveFile(initialDirectory,defaultFileName string)(string,error){
 runtime.LockOSThread()
 defer runtime.UnlockOSThread()
 // A GetSaveFileNameW közös fájldialógus nem igényel COM inicializálást.
 // Így egy háttér HTTP kéréshez kiosztott Windows-szálon is működik.
 fileBuffer:=make([]uint16,8192)
 fileName:=utf16.Encode([]rune(defaultFileName))
 if len(fileName)>=len(fileBuffer)-1{return "",errors.New("Túl hosszú XMIX fájlnév.")}
 copy(fileBuffer,fileName)
 start,err:=syscall.UTF16PtrFromString(initialDirectory)
 if err!=nil{return "",err}
 caption,err:=syscall.UTF16PtrFromString("Gatterka – Mentés másként (XMIX + XPRG)")
 if err!=nil{return "",err}
 extension,err:=syscall.UTF16PtrFromString("xMix")
 if err!=nil{return "",err}
 filter:=utf16.Encode([]rune("Gatterka XMIX (*.xMix)\x00*.xMix\x00Minden fájl (*.*)\x00*.*\x00\x00"))
 hwnd,_,_:=syscall.NewLazyDLL("user32.dll").NewProc("GetForegroundWindow").Call()
 ofn:=openFileNameW{
  owner:hwnd,
  filter:&filter[0],
  filterIndex:1,
  file:&fileBuffer[0],
  maxFile:uint32(len(fileBuffer)),
  initialDir:start,
  title:caption,
  defaultExtension:extension,
  flags:0x00080000|0x00000800|0x00000002|0x00000008|0x00000004,
 }
 ofn.structSize=uint32(unsafe.Sizeof(ofn))
 common:=syscall.NewLazyDLL("comdlg32.dll")
 selected,_,_:=common.NewProc("GetSaveFileNameW").Call(uintptr(unsafe.Pointer(&ofn)))
 runtime.KeepAlive(fileBuffer)
 runtime.KeepAlive(filter)
 runtime.KeepAlive(start)
 runtime.KeepAlive(caption)
 runtime.KeepAlive(extension)
 if selected==0 {
  code,_,_:=common.NewProc("CommDlgExtendedError").Call()
  if code==0{return "",nil} // Mégse gomb
  return "",fmt.Errorf("Windows Mentés másként párbeszédablak hiba: 0x%X",uint32(code))
 }
 full:=filepath.Clean(syscall.UTF16ToString(fileBuffer))
 if !filepath.IsAbs(full){return "",errors.New("A Windows mentési fájlútvonala nem teljes.")}
 if !strings.EqualFold(filepath.Ext(full),".xMix"){
  full+=".xMix"
 }
 parent:=filepath.Dir(full)
 st,err:=os.Stat(parent)
 if err!=nil||!st.IsDir(){return "",fmt.Errorf("A kijelölt mentési mappa nem érhető el: %s",parent)}
 return full,nil
}
