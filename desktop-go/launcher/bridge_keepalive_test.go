package main

import (
 "testing"
 "time"
)

func TestWaitIdleReturnsOnlyAfterRequestsStop(t *testing.T) {
 a := newBridgeActivity()
 done := make(chan struct{})
 go func() { a.waitIdle(150*time.Millisecond, 10*time.Millisecond); close(done) }()
 for i := 0; i < 8; i++ { // folyamatos ping: nem szabad kilépni
  time.Sleep(50 * time.Millisecond)
  a.touch()
  select {
  case <-done:
   t.Fatal("A mentő idő előtt leállt, miközben az oldal pingelt")
  default:
  }
 }
 select {
 case <-done:
 case <-time.After(2 * time.Second):
  t.Fatal("A mentő nem állt le, miután a ping megszűnt")
 }
}
