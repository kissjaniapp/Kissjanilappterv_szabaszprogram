# Gépi formátumok – Gatterka / WinCut (2026-10-30)

## Melyik formátumot használjuk?

A felhasználó gépéről érkezett **működő XML-es .xMix** minta:

```xml
<xMix>
  <Header Descrizione="" Import="" Date="30/10/2026" />
  <Materials>
    <Material Tipologia="Onixszürke" Codice="U960" Quantita="999" />
  </Materials>
  <RigheMix>
    <RigaMix File=".\xPrg\2026_10_30__09_06_34_1.xPrg" Rep="1" Pacco="1" CambioMateriale="0" />
  </RigheMix>
</xMix>
```

Ez projekt-összesítő: **több .xPrg programot** tud sorban hivatkozni. Az xMix
nem tárolja az alkatrészvágások teljes parancssorát, az a kapcsolt xPrg-kben van.

Korábban a program INI-jellegű xMix-et állított elő a
`[Intestazione] / [Righe] / NumeroRighe` szerkezettel. Egy másik, gépen
működő minta ilyen xMix-ből **.012** programra mutatott, ami nem bizonyítja
az INI formátum megfelelőségét az itt vizsgált XML-es xPrg projektekhez.
A Gatterka exportja ezért az előbbi XML struktúrát követi.

## Beállítható xPrg könyvtár

A Nesting terv exportpaneljén a **XPrg fájlok helye az XMix-ben** mező
projektfüggő, mentett beállítás. Alapérték: .\xPrg\.
A `RigaMix File` attribútum pontosan ezt a mappát és az xPrg fájlnevét tartalmazza.

- .\xPrg\ → ZIP-ben: Konyha/projekt.xMix és Konyha/xPrg/tabla_01.xPrg.
- .\Gep\Programok\ → ZIP-ben: Konyha/Gep/Programok/tabla_01.xPrg.
- C:\WinCut\Prg\ vagy hálózati UNC → az XML a gépi teljes
  útvonalra hivatkozik. A ZIP a táblaprogramokat biztonságosan xPrg/ alá
  csomagolja, a felhasználónak viszont **külön át kell másolnia őket** a hivatkozott
  helyre; a Gatterka nem módosít külső gépmappát.

A projekt dátuma, anyagkódja, anyagszíne és az xPrg fájlok száma az XML-ben
is szerepelnek. Az `Materials` listában egyedi táblánkénti anyagszínek
jelennek meg, a gépi kód pedig a felületen megadott érték.

## Mit NEM jelent az XML-es xMix?

A Gatterka által generált xPrg-ben a vágások továbbra is `P`, `RY`, `Y`,
`RX`, `X`, `U`, `F` utasítások. A próbafájl a gépen importálható volt,
de egy **valós, többparancsos** Gatterka-programot az XML-es xMix megnyitásakor
a következő ellenőrzési hibával utasított el:

```text
%%ValidateKO%%: 1,1,1,Err. 6:
%%SpessoreLamaNonValido%%
1 P 1983.000 1
```


A hiba a fűrészlapvastagságra utal, de a pontos kiváltó feltétel
nincs bizonyítva: nem feltétlenül a beírt 5 mm érték a hibás. Az
xMix-export felépítésének javítása **nem helyettesíti** az xPrg
vágási utasításainak és a gépen beállított fűrészlap/adatbázis
összefüggésének ellenőrzését.

A Gatterka **nem változtatja meg találomra** a kezdő `P` parancsot,
a `SpessoreLama` méretét, a vágások számát és sorrendjét.
Éles gépi végrehajtás előtt külön próba, a tényleges anyagtörzs-kód és
gépi paraméterek ellenőrzése szükséges. A kísérleti xPrg export
nem tekinthető hitelesített gyártási programnak.
