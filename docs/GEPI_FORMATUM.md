# Gépi formátum – megállapított és ismeretlen részek

## Eredeti, csatolt .xMix

A csatolt `.xMix` fájl `<Header>`, `<Materials>`, `<RigheMix>` szerkezetű XML.

A `RigaMix` hivatkozás például:

```xml
<RigaMix File=".\xPrg\2026_10_21__08_35_16_1.xPrg" Rep="1" Pacco="1" CambioMateriale="0" />
```

Vagyis a `.xMix` **másik fájlra hivatkozik**. Nem találtunk magában a mintában fűrészpozíciókat vagy gépi csíkvágási utasításokat. A `machine/xmix.cjs` ezt a manifestet tudja sorosítani, ha már rendelkezésre állnak valódi, helyes `.xPrg` fájlok. A `File` attribútumhoz egyező mappa-struktúra is szükséges (`xPrg/`).

## Az F0/F1/F2/F3 „proba” mintáról

A `fixtures/proba` egy további, ettől eltérő szöveges szabástervfájl. Az `F3` csík- és darabszámkódjai részlegesen visszafejthetők; de nem bizonyított, hogy ezek az `.xPrg` bináris/szöveges formátumával megegyeznek. A `fixtures/proba_dekoder.py` elemzési segédlet.

## Jelenlegi Lapterv „Gépi előkészítés ZIP”

A felületen az export: `manifest.json`, `tabla_NN_ellenorzo_vagasok.json`, `OLVASSEL.txt`.

Az adatok tartalmazzák a tábla méretét, fűrészrést, szélezést, alkatrészlistát, a gépi csíkok és visszaadások eseményláncát. **Még nem gépfüggetlen, teljesen ellenőrzött szabásprogram** – a geometria és a vezérlő parancsainak koordinátái közti kapcsolatot tesztelni kell.

## A natív gépi programhoz tisztázandó

1. A pontos `.xPrg` szintaxis, fájlverzió és esetleges kódolás, ellenőrzőösszeg.
2. Ütközők és fűrészpozíciók koordinátarendszere, élezővágás és fűrészrés elszámolása.
3. A csíkok visszaadása és a kész alkatrészek kitolása gépi műveletként.
4. Rögzítési, minimális megfogási és szálirányos forgatási szabályok.
5. Táblánkénti programszámozás és a `Rep`, `Pacco`, `CambioMateriale` tényleges jelentése.
6. A vezérlés fogadja-e a legyártott manifest XML változatát, és milyen `.xPrg` mellékleteket vár el.

Az export éles engedélyezése csak ezen ellenőrzések után történhet meg.
