# Gatterka 1.3.0 – KitchenDraw SCN rajzos munkamód

## A .scn fájl megnyitásának feltétele
Az SCN egy KitchenDraw-függő, saját bináris formátum. A Gatterka az SCN Viewer
(`kissjaniapp/scn_viewer`) már létező **KitchenDrawBridge** pluginját használja,
amely a futó KitchenDraw alatt, a helyben telepített `KD.SDK2.dll` és a
szükséges katalógusok használatával készít OBJ-geometriát és manifestet.

**A Gatterka telepítője nem tartalmazza a KitchenDraw-t vagy a KD.SDK2.dll-t,
és az SDK2 plugin automatikus telepítése sem történik meg.**
A plugin beállítása az SCN Viewer README-jében: 
https://github.com/kissjaniapp/scn_viewer

Az SCN Viewer és a Gatterka ugyanazt a
`%LOCALAPPDATA%\ScnViewerBridge\queue` munkasort használja. A Gatterka saját
munkamenettokennel védett, csak 127.0.0.1 címen elérhető Windows bridge-en
átmásolja az SCN-t, várja az OBJ-eredményt, majd a felhasználó Gatterka
projektjében menti a csökkentett 3D-geometriát. Az eredeti SCN nem változik.

Ha nem érhető el a KitchenDraw plugin, a Gatterka **OBJ export betöltése**
gombjával korábban kimentett OBJ közvetlenül is megnyitható. A méretarány
alapértelmezése 1 OBJ egység = 1 mm; ezt ellenőrizni kell.

## Szekrények, alkatrészek, törlés
- Az OBJ objektumait név szerint listázza és az elöl-/oldal-/3D nézetben megjeleníti.
- **Objektum törlése / Visszaállítás**: a helyi Gatterka projektben kapcsolja
  ki/be az objektumot a 3D-nézetben, az alkatrészlistában, a szabásban és a CNC-ben.
- Csak bizonyított, tengelypárhuzamos, téglatest alakú, 50×50 mm-nél nem
  kisebb és **KitchenDraw alkatrész-metaadattal egyértelműen összerendelt**
  OBJ-hálók kapnak automatikusan szabászati jóváhagyást.
- A többi négyszögletes lap **Szabás/CNC engedélyezése** gombbal, saját
  ellenőrzés után kapcsolható be. A hiányos, íves vagy tisztázatlan mesh
  nem válik gépi alkatrésszé automatikusan.
- Az OBJ-ben egyértelműen jelölt szekrényneveket átveszi. Az objektumlista
  szekrénynév mezőjével a hiányzó kapcsolatok kézzel javíthatók; a
  **Szekrényenként szétválasztás** a bútorokat külön Gatterka rekordokba
  helyezi, melyeket a közös szabász- és CNC rendszer kezel.

## CNC
A Gatterka az SCN-ből származó, bizonyított téglatestek érintkező lapjain
a meglévő 3MF kötéslogikával készít `SCN_TERV_*.xxl` makrójavaslatokat.
**Ezek a fájlok nem hitelesített gyártási CNC-programok.**
A kiinduló SCN/OBJ nem tartalmaz feltétlenül furatokat; Xilog előnézet,
a makró, szerszámozás, felrakási oldal és gépi szárazpróba kötelező.

A CNC az egyetlen natív Windows **Mentés másként** gombot használja.
A szabász `.xMix` / `.xPrg` vágási sorrendjéhez nem nyúltunk.

## Ismert korlát
A telepített KitchenDraw + a helyi katalógusok nélkül az SCN teljes 3D
geometriája nem állítható helyre. Az SCN Viewer SDK2 pluginjának tényleges
futtatását és a felhasználó mintafájljának teljes exportját automatikus
GitHub Actions környezetben nem lehet érdemben tesztelni.
A Gatterka ezért az OBJ és a manifest helyes átadását, valamint a
részben hiányos metaadatot és az ismeretlen alkatrész-hozzárendelést is kezeli,
de nem találgat szekrényeket.
