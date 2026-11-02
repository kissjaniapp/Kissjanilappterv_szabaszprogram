// A helyi mentő (127.0.0.1) élettartama. Az Edge/Chrome indítója gyakran azonnal
// kilép, ha ugyanazt a böngészőprofilt már egy háttérben futó folyamat tartja
// (az ablakot ilyenkor az a régi folyamat nyitja meg). Ilyenkor a launcher
// leállt volna, vele a mentő is, és a "Mentés másként" "Failed to fetch"
// hibával elbukott. Ezért a launcher addig él, amíg az oldal jelez (ping).
package main

import (
 "sync/atomic"
 "time"
)

type bridgeActivity struct{ last atomic.Int64 }

// nativeActivity: a legutóbbi hitelesített kérés ideje (az indításkor is beállítjuk).
var nativeActivity = newBridgeActivity()

func newBridgeActivity() *bridgeActivity {
 a := &bridgeActivity{}
 a.touch()
 return a
}

func (a *bridgeActivity) touch() { a.last.Store(time.Now().UnixNano()) }

func (a *bridgeActivity) idleFor() time.Duration {
 return time.Since(time.Unix(0, a.last.Load()))
}

// waitIdle addig blokkol, amíg `idle` ideig nem érkezik hitelesített kérés.
func (a *bridgeActivity) waitIdle(idle, poll time.Duration) {
 for a.idleFor() < idle {
  time.Sleep(poll)
 }
}
