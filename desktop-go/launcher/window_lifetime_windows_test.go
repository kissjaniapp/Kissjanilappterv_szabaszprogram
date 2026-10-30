//go:build windows

package main

import (
 "testing"
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
