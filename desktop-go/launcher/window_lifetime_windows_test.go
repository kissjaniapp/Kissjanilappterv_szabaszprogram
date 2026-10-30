//go:build windows

package main

import (
 "testing"
 "fmt"
 "net/http"
 "os"
 "path/filepath"
 "sync/atomic"
 "time"
)

// Reprodukció: a böngésző indítófolyamata azonnal megszűnhet,
// miközben a Gatterka saját ablakát a régi Edge folyamat jeleníti meg.
// A natív bridge-nek az alkalmazásablak bezárásáig élnie kell.
func TestSaveBridgeWaitsForVisibleGatterkaAppWindow(t *testing.T) {
 calls:=0
 start:=time.Now()
 waitForGatterkaWindow(func() bool {
  calls++
  return calls<=8
 },2*time.Millisecond,100*time.Millisecond,12*time.Millisecond)
 if calls<9 {t.Fatalf("Exited before app window closed: %d",calls)}
 if time.Since(start)<20*time.Millisecond{
  t.Fatal("Bridge stopped immediately even though the Gatterka window was visible")
 }
}

func TestSaveBridgeStartupGraceDoesNotImmediatelyExit(t *testing.T) {
 start:=time.Now()
 waitForGatterkaWindow(func() bool{return false},2*time.Millisecond,45*time.Millisecond,10*time.Millisecond)
 if time.Since(start)<40*time.Millisecond {
  t.Fatal("Bridge stopped immediately instead of keeping native service alive during startup")
 }
}

func TestNativeBridgeSurvivesExitedEdgeStarter(t *testing.T){
 page:=filepath.Join(t.TempDir(),"index.htm")
 if err:=os.WriteFile(page,[]byte("<!doctype html><title>Gatterka</title>"),0600);err!=nil{t.Fatal(err)}
 port,_,stop,err:=startNativeBridge(page)
 if err!=nil{t.Fatal(err)}
 defer stop()
 var windowVisible atomic.Bool
 windowVisible.Store(true)
 done:=make(chan struct{})
 go func(){
  waitForGatterkaWindow(windowVisible.Load,2*time.Millisecond,100*time.Millisecond,12*time.Millisecond)
  close(done)
 }()
 // A Chrome/Edge rövid életű indítófolyamata itt már "kilépett".
 browserStarterExited:=make(chan struct{})
 close(browserStarterExited)
 <-browserStarterExited
 time.Sleep(30*time.Millisecond)
 select{
  case <-done:t.Fatal("The native server lifetime ended with the browser starter process")
  default:
 }
 response,err:=http.Get(fmt.Sprintf("http://127.0.0.1:%d/native/ready",port))
 if err!=nil{t.Fatalf("Native service stopped while the app window is open: %v",err)}
 _=response.Body.Close()
 if response.StatusCode!=http.StatusOK{
  t.Fatalf("Native save service returned %d",response.StatusCode)
 }
 // A Gatterka valódi ablakának bezárása ezután szabályosan leállíthatja.
 windowVisible.Store(false)
 select{
  case <-done:
  case <-time.After(2*time.Second):t.Fatal("Launcher did not stop after the Gatterka window closed")
 }
}
