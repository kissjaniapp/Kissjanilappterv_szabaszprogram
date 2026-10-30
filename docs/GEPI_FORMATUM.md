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

## Gép által elfogadott xPrg minta szerinti fejléc (2026-10-30)

Mind az eredeti SCM `09_01_51_1(1).xPrg` mintában, mind a
felhasználó által WinCutban megnyitott `GATTERKA_PROBA_01_REGI_FEJLEC.xPrg`
próbában az első `P` értéke a `Header Lunghezza` méretével egyezett.
A 2800 × 2070 mm-es táblán a próbánál `P=2070`,
`Lunghezza=2070`, `Larghezza=2800`.

Az előző Gatterka olyan maradéktáblát is exportált, ahol a
`Lunghezza=753`, de a `P=1983` volt. A javított export a
beadási irány alapján adja meg a gépi fejléc két méretét; nem
változtatja meg emiatt a képernyőn megjelenő rajz tájolását.

Az alapértelmezett fejléc-leírás most a gép által elfogadott
próbák szerinti anyagkód, amelyet a `Material Codice` is tartalmaz.
Az **Anyagszín / dekor** opció az előzőleg kért
`Header Descrizione=anyag színe` formátumot biztosítja,
a közös XML xMix `Materials` adataitól függetlenül.

Az xPrg vágási parancsok és a `SpessoreLama` értéke nem
változott; a tényleges gépi validálás továbbra is szükséges.


## A Gatterka 2026-10-30-i gépi és felületi változtatásai

A valós gépen lefutott egytáblás próbát követően a rajzot a függőleges tengelyére tükrözzük, a tényleges xPrg vágássor módosítása nélkül. A Gatterka bútoradatlapján található anyagszín jelenik meg az xPrg Header Descrizione és Material Codice mezőiben, valamint az XML xMix Materials Tipologia és Codice mezőiben. Az új gépi mentési panelen nem szerkeszthető külön sem az anyagkód, sem a fejlécleírás.

A felhasználó a rendszer könyvtárválasztójával kiválaszt egy mappát, amelybe a program YYYY_MM_DD_Celhely nevű alkönyvtárat készít. Ebben a .xMix és az xPrg alkönyvtárban az összes .xPrg file szerepel. A közös .xMix relatív .\\xPrg\\ hivatkozásai nem függnek a külső meghajtó betűjelétől. Meglévő projektnév esetén nem írunk felül fájlokat. Nem támogatott böngészőben ZIP letöltéssel történik a mentés.

Az oldalak külön: bútoradatok, alkatrészek, anyagkészlet, szabásterv. A lábléc Kiss János készítői és tulajdonosi megjelölését tartalmazza.


## 2026-10-30 – WinCut xMix teljes gépi fájlútvonal (X:)

A géphez tartozó XML-es `.xMix` korábban minden `RigaMix File` attribútumban
csak `.\\xPrg\\fajl.xPrg` relatív hivatkozást tartalmazott.
Most a **Szabásterv** oldalon projektbe menthető
**„Gépi gyökérmappa – teljes Windows-útvonal”** mező szerepel.
Ennek alapértéke az ismert gépi könyvtár:
`X:\\JANI\\szabas_programmal\\Legujabb_mentessel`.

A **Mappa kiválasztása és mentés** gombbal pontosan ezt a
**gyökérmappát** kell kiválasztani. A beágyazott Chromium mappaválasztója
a fájlrendszerhez való írási jogosultságot és a mappa nevét adja, de a
teljes Windows-meghajtóutat **nem** teszi közzé a webalkalmazásnak; ezért
a fenti mezőt egyszer kézzel kell beállítani, ha a tényleges mentési hely eltér.
A Gatterka a kiválasztott mappa nevének egyezését ellenőrzi a megadott
Windows-útvonal utolsó elemével, de nem tudja a teljes fizikai útvonalat
függetlenül bizonyítani.

A program a gyökérmappán belül `YYYY_MM_DD_Hova_keszul`
például `2026_10_30_Teszt` alkönyvtárat készít, a közös Mix és
`xPrg` almappa változatlan mappaszerkezetével. A `RigaMix` ezentúl
például:

```xml
<RigaMix File="X:\JANI\szabas_programmal\Legujabb_mentessel\2026_10_30_Teszt\xPrg\2026_10_30_Eles_vagas_Maradek_tabla_tabla_01.xPrg" Rep="1" Pacco="1" CambioMateriale="0" />
```

Ha már létezik egy ugyanilyen nevű projektmappa, a mentés
`_2`, `_3`... végű új mappát hoz létre, és a Mixben is pontosan
ezt a tényleges alkönyvtárat hivatkozza.

A **ZIP letöltése** is teljes X: meghajtós Mix útvonalat ír, ezért
a kibontott projektmappát **a megadott gépi gyökérmappába** kell másolni;
más helyre kibontva a gép nem fogja megtalálni az xPrg-ket.
Az .xPrg fájlok vágási parancsait, anyagait és fejléceit ez a javítás nem módosítja.
