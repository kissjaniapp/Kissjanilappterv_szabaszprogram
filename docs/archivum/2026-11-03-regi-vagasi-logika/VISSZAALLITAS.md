# Gatterka – korábbi vágási logika archívuma

**Dátum:** 2026-11-03

**Teljes visszaállítási GitHub-ág:** `archive/legacy-cutting-logic-before-20261103`

**Rögzített eredeti commit:** `9c616ba1a37eba977554fd02eaebff70f11cbc3c`

Ez az ág a felülre igazító és 90°-os új szabást megelőző, teljes
munkaképes forrásfát tartalmazza. Érintetlenül megtartandó.

A mappában az eredeti
`GATTERKA_FIX_FEJLESZTESI_SZABALYOK_EREDETI.txt` és
`locked-machine-invariants_EREDETI.txt` fájl is megvan.

A tulajdonos kifejezett engedélyével a 2026-11-03-as új rendszerben
megváltozhatott a kisebb/maradék tábla első vágási távolsága és a
90°-kal visszaforgatott csík első méretre vágása, a nagytábla előző
sorrendje változatlan.

**Visszaállítás:** a GitHubon az archív ágból indíts célzott PR-t
a main ág irányába, csak a visszaállítandó vágási és rajzi kódokat,
szabályokat, és teszteket visszahozva. A main későbbi, más
funkcióira vonatkozó javításokat NE írd felül. Visszaállítás után
újra futtasd a teszteket és ellenőrizd a teljes xMix/xPrg mentést.

**Biztonság:** A meglévő SCM WinCut/xPrg formátummal a dinamikus
RY/RX első vágási pozíciókat valódi próbaszabással ellenőrizni kell.
