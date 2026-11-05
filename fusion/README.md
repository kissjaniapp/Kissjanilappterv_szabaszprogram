# Gatterka Fusion 360 szilárdtest és paraméter export

1. Nyisd meg a 3D bútort a Fusion 360 Design munkaterületén.
2. A **Utilities → Scripts and Add-Ins** felületen hozz létre egy Python scriptet, és a szkript tartalmába másold be a [GatterkaFusionExport.py](GatterkaFusionExport.py) kódját.
3. Futtasd a scriptet, majd mentsd el a kapott `gatterka_fusion_export.json` fájlt.
4. A Gatterkában a **Bútor paraméterei → Fusion 360 – 3D szilárdtestek → Fusion 3D-adatok importálása (JSON)** gombbal töltsd be a fájlt.

A natív **F3D közvetlen feltöltése nem támogatott**; a JSON-t a Fusion API készíti el.

## Mit hoz át?

- Minden szilárdtest példány: három méret (helyi tengelyekre párhuzamos befoglalódoboz), pozíció, három tengelyirány és elforgatási mátrix.
- Azonos név és azonos méretek szerinti darabszám, a testpéldányok koordinátáinak külön megőrzésével.
- Minden **Fusion felhasználói paraméter**: név, eredeti Fusion-kifejezés, mértékegység, kiértékelt szám vagy szöveg, megjegyzés.
- A hosszúságokat milliméterre, a szögeket fokra alakítja. A Gatterkában a hosszúsági és egység nélküli számparaméterek `[ParaméterNév]` formában használhatók képletekben. Az eredeti Fusion-képlet megmarad referenciának, de a Gatterka jelenleg **a Fusion által kiértékelt pillanatnyi értéket** használja; nem futtatja újra a teljes Fusion képletrendszerét.

A bútor W/H/D külső méretét nem írja felül automatikusan, mert a 3D világkoordináták tengelyei nem feltétlenül egyeznek a bútor méretelnevezéseivel. Egy új export új paraméter-pillanatképet ad.

**CNC korlát:** A test kezdőpontja nem gépi nullpont. A befoglalódoboz nem helyettesíti az ellenőrzött furat-, horony-, kontúr- és szerszámpálya-adatokat. Az új export nem generál CNC-kódot. A méret- és koordinátaimportot valós Fusion-modellel még ellenőrizni kell.
