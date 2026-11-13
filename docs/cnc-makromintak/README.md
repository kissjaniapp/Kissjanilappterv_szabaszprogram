# Tulajdonosi CNC makróminták

A korábbi csevegésből és működő forrásból visszakeresett [LAB lábfurat-szabály](LAB.md) szintén kötelező referencia.

A 2026-11-13-án átadott `KOMPONENSEK.zip` eredeti, változatlan példányát és kibontott tartalmát ez a mappa őrzi. A `.pgm` fájlok bináris Xilog programok, nem egyszerű szövegfájlok. A mellettük található `.pgm.txt` kivonatok kereshető segédletek; a teljes eredeti program az elsődleges forrás.

Új CNC-fejlesztés előtt a megfelelő mintát és a `GATTERKA_AKTUALIS_SZABALYOK.txt` aktuális szabályait együtt kell áttekinteni. A minták tárolása önmagában nem jelenti valamennyi makró automatikus exportjának megvalósítását vagy gépi ellenőrzését. Új paramétert nem szabad találgatással hozzáadni.

## Tartalom

- `ELFURAT.pgm`, `ELFURAT_LOGIKA.pgm`: élfurat és kötési logika.
- `LAPA.pgm`, `LAPF.pgm`: lapfuratok.
- `FALC.pgm`: falcolás. A mintában a pontos makrónév **XFALC**, a hívás: `XFALC Q=1# G=2# T=103`.
- `PANT_FURAT.pgm`, `PANT_TALP.pgm`, `PANT_TALP_3TALP.pgm`: pánt és pánttalp.
- `POLC_FURAT.pgm` és `eredeti/POLCTARTO_LOGIKAHOZ.zip`: polctartó minták.

A FALC minta megjegyzése szerint Q=1 kifutó, Q=2 nem kifutó, Q=3 bal oldalt nem kifutó, Q=4 jobb oldalt nem kifutó falc. G=2 balról jobbra (ezt használjuk), G=3 jobbról balra. T=103 a rögzített falcolószerszám.

A `manifest.json` az eredeti PGM-ek méretét és SHA256 ellenőrzőösszegét tartalmazza. A kereshető kivonatok és a manifest újra előállíthatók: `node tools/catalog-cnc-samples.cjs`. Az eredeti ZIP és PGM fájlokat ne írjuk át; új mintát külön fájlként kell megőrizni.
