# Gatterka 1.0.9 – Windowsos szabásztervező

Ez a **működő Gatterka program** hivatalos forráskódja:
https://github.com/kissjaniapp/Kissjanilappterv_szabaszprogram

## Windows alkalmazás és telepítő

A program Windows 10/11-re készül, saját `Gatterka.exe` indítóval és
`Gatterka_Telepito_1.0.9_x64.exe` telepítővel. Offline fut. A teljes
bútor- és nestingfelület **helyi HTML/JavaScript alapú**, amelyet a
telepített **Microsoft Edge vagy Chrome böngészőmotorja külön alkalmazásablakban**
nyit meg. Ez teljes funkcionalitású Windowsos asztali csomagolás,
**nem natív Windows Forms átírás**. Nem szükséges hozzá internetkapcsolat.

Az automatikus telepítő a GitHub **Actions** oldalon, a
`Gatterka - Windows telepito automatikus epites` folyamatból tölthető le,
a `Gatterka-Windows-Telepito-1.0.9` nevű **Artifacts** csomagban.
Az egyedi program-, telepítő- és eltávolítóikon a gyökérben található `Gatterka.ico` fájlból készül. Mindhárom EXE beágyazott ikonját a GitHub Actions külön ellenőrzi.
A futó Edge/Chrome alapú alkalmazásablak fejlécikonját a Windows indító állítja be, a beágyazott HTML pedig a Gatterka ikonját használja faviconként. A Windows feladatütemező/tálca megjelenése a böngészőmotor és a helyi Windows-beállítások függvénye lehet.

## Indítás, helyi mentés és korábbi bútorok

**Induláskor mindig a Bútorválasztó nyílik meg.**
A régi projektek közül a kívánt bútort a listából kell megnyitni,
vagy az **Új bútor létrehozása** gombbal lehet új projektet létrehozni.
Az előző projekt nem nyílik meg automatikusan.

A program az adatokat a helyi, Windowsos böngészőprofil tárhelyén őrzi.
A profil könyvtára a korábbi mentések megőrzéséhez változatlanul `%LOCALAPPDATA%\Lapterv\BongeszoProfil`.
A böngészőmotor ezen belül tartja a `localStorage` adatokat:
`lapterv-library-v1` (projektlista), és a korábbi
`lapterv-project-v2` (régi mentés/migrációs kompatibilitás).

A Gatterka telepítő alapértelmezett mappája új telepítésnél
`%LOCALAPPDATA%\Programs\Gatterka`.
Ha a korábbi Lapterv már telepítve van, a biztonságos helybeni frissítés
megtartja a meglévő `%LOCALAPPDATA%\Programs\Lapterv` mappát, viszont az
új program, telepítő, eltávolító, Windows-parancsikon és a telepített
alkalmazás neve már **Gatterka**. A régi asztali és Start menü parancsikont
és a Lapterv eltávolítási bejegyzését sikeres átállás után törli.
A frissítő a futó programot bezárja, az új fájlokat előre elkészíti,
átnevezi a régieket biztonsági másolatnak, majd sikertelen fájlcsere
esetén visszaállítja az eredetit. A helyi mentéseket nem törli.

Az eltávolító a böngészőprofilt **szándékosan nem törli**,
így a régi projektek újratelepítés után is megmaradnak.
A kezdeti átállás a régi projektek másolatát automatikusan a listába helyezi,
**nem törli a régi mentést**. A programból a projektlistában az
adott projekt kifejezetten törölhető.

## Használat

- Új bútor / tárolt bútor kiválasztása
- Bútor és alkatrészek: kész X, kész Y, darabszám, élzárás és technológiai beállítások
- Anyagkészlet / maradék táblák
- Gépi csíkos nesting és táblánként 1-től kezdődő vágásszámozás
- **PNG** szabásrajz és A4 matrica
- **Alkatrészlista PNG** – a bútor adatlapjáról és a nesting képernyőről menthető. Felül az anyag neve és a gyártási hely, alatta az alkatrészek megnevezése, készmérete, darabszáma és pontos élzárása; nagy listáknál 100 soronként új PNG-oldalt készít.
- **.xMix + táblánként .xPrg** – egyetlen ellenőrző ZIP, benne a teljes projekt
  és a `.xMix` minden táblára mutató WinCut elérési útjával.

### Az X: meghajtó xMix fájlformátuma

Az új, felhasználó által megadott `.xMix` a korábbi XML-gyűjtő helyett
**INI formátumú**, rögzített abszolút elérési úttal:

```ini
[Intestazione]
Descrizione=

[Righe]
NumeroRighe=2
1=X:\JANI\szabas_programmal\Konyha_szekreny\2026_10_29_Konyha_Feya_tabla_01.xPrg
2=X:\JANI\szabas_programmal\Konyha_szekreny\2026_10_29_Konyha_Feya_tabla_02.xPrg
```

A dátum mindig a készítés napja; a név a szekrény- és táblanévből képződik,
egyedi táblasorszámmal. A `NumeroRighe` érték a tényleges táblaszám.
A ZIP-en belül a **`Konyha_szekreny/` mappában együtt található** a `.xMix`
és az összes táblánkénti `.xPrg` fájl. A Mix mindig a
`X:\JANI\szabas_programmal\<bútor_neve>\` mappára hivatkozik. A bútor nevét a
program Windowsban érvényes mappanévre alakítja (például
`Konyha szekrény` → `Konyha_szekreny`). A ZIP e mappa teljes tartalmát
kapcsolja egyetlen projektcsomaggá; több táblánál a `NumeroRighe` is nő.
A ZIP **nem telepít és nem másol fájlt automatikusan a gépre**.

A megadott `.xMix` szövegszerkezetet és WinCut fájlelérési utat
már ellenőrizni tudjuk; ettől a `.xPrg` programok működése még nem bizonyított.


Az `.xPrg` **nem hitelesített, csak fájlmegtekintésre és offline
szimulátorhoz készült**. A `P/RY/Y/RX/X/F` parancsok értelmezése,
a tényleges gépi sorrend és a többréteges vágás nem bizonyított.
A táblák `.xPrg` fájljai most közvetlenül a `<SchemaDoc>` gyökérrel
kezdődnek (XML-deklaráció és komment nélkül), majd `<Header>`, `<Material>`
és `<Pattern>` elemek következnek. A vágások `T`, `Dim`, `Rip`, `ID`
attribútumokat kapnak, a sorszám 0-ról indul. A példában szereplő
`BLAP003` anyagkód a mentéskor megadható; nem szabad más anyaghoz
változtatás nélkül használni. Kisebb keresztmetszetű alkatrészhez az
`X`, `U`, `F` mintát is kiírja a program, de az `U` valós fizikai
vágási értelmezését és gépi sorrendjét még külön kell ellenőrizni.
99-nél több parancsot egy xPrg-be nem ír a program, mert a gépi
folytatás `_REP` formátuma még nincs hitelesítve. Fizikai gépre
ellenőrzés nélkül ne töltsd.

## GitHub build

A `.github/workflows/lapterv-windows.yml` automatizmus minden
`main` ágra mentés után fut: Node.js ellenőrzés → Go fordítás →
Windows telepítő és hordozható ZIP → Artifacts.

A gépi export kísérleti része **nem változtatja meg a szabászgép
vezérlőjét**, és nem igazolja, hogy a kimeneti XML parancsokat a gép
elfogadja. A gép saját offline előnézete / importja szükséges.

### A szabásprogramok letöltése és az .xMix gépi hivatkozása

A Gatterka **nem ír az X: meghajtóra**. A gépi szabásfájlok egyetlen
`<bútor neve>_XPRG_XMIX_OFFLINE.zip` csomagban, szabványos
**böngészős letöltésként** készülnek. A böngésző alapértelmezett
célja a **Letöltések** mappa; ha a felhasználó a böngészőben a
„Mentési hely megkérdezése” beállítást használja, a böngésző maga kérdezhet rá.

A ZIP-en belül egy közös `<bútor neve>/` mappában együtt található
az egyetlen `.xMix` és az összes, táblánként külön `.xPrg` fájl.
A géphez megadott útvonal:

`X:\JANI\szabas_programmal\<bútor neve>\`

**kizárólag az `.xMix` fájl sorainak szövegében szerepel**, és
az adott `.xPrg` fájlnevekre mutat. A ZIP nem telepít, nem másol
és nem töröl fájlt ezen az X: meghajtón. A felhasználó később maga
helyezheti el a közös bútormappát a megfelelő helyre, miután a
gépi programok biztonságát offline ellenőrizte.

Az `.xPrg` minták továbbra sem hitelesített gépi vezérlőprogramok;
fizikai vágás előtt a vezérlő saját, megfelelő szimulációja és
szakmai ellenőrzés szükséges.

## 2026-10-30 – teljes átvágásos sorrend ellenőrzése

- A gépi csíkos és anyagtakarékos mód is készít táblánkénti ellenőrző vágássorrendet (szélezés → összes csík → visszaadott csíkok keresztvágása).
- A vágási sorrendnél a fűrészpozíció a teljes tábla / csík eredeti nullpontjára vonatkozik; a sorrend a gépi visszafelé haladást követi, nem a rajzi balról jobbra rendezettséget.
- Alapbeállítás: 5 mm fűrészrés és 12 mm szélezés. A korábban mentett projektek egyedi beállításait nem írja felül.
- Az anyagtakarékos tervből is kérhető az eredeti formátummintát követő, táblánkénti `.xPrg` + `.xMix` offline ZIP.
- Az `.xPrg` valódi vezérlőn való végrehajtása **nem hitelesített**: a P/RY/Y/RX/X/U/F parancsok gépspecifikus értelmezése, az U és a kötegelt vágás külön offline gépi tesztet igényel. A sikeres GitHub-teszt nem helyettesíti a vezérlő ellenőrzését.

## Gatterka névváltás (2026-10-30)

A Windows EXE, telepítő, eltávolító, Start menü/asztali ikon és felület
elnevezése Gatterka. A korábbi `lapterv-library-v1` és
`lapterv-project-v2` adatkulcsok **szándékosan változatlanok**,
mert átnevezésük a mentett bútorok látszólagos eltűnését okozná.
Az alkalmazás ugyanazt a régi böngészőprofilt használja.
A GitHub-tárhely URL-je és a belső workflow-fájl neve változatlan.

## 2026-10-30 – Gatterka egyszerűsített nyomtatás és felület

- Az alkatrészlista PNG-jén az élzárás összefoglalója megmarad, de az X1/X2/Y1/Y2 élhelyjelölések nem jelennek meg. Az élzárás működése változatlan.
- A Nesting oldalon a számozott vágási sorrend részletes táblázata nem jelenik meg; a háttérszámítás és a gépi fájlexport tovább működik.
- Az xMix fájl kötelező fejléce változatlan: `[Intestazione]`, `Descrizione=`, üres sor, `[Righe]`, `NumeroRighe=N`; a két táblát tartalmazó projektnél `NumeroRighe=2`.

## 2026-10-30 – a működő WinCut xMix-minta összehasonlítása

A felhasználó képernyőképén a **működő INI xMix** a következő formátumú:

```ini
[Intestazione]
Descrizione=

[Righe]
NumeroRighe=2
1=C:\WinCut\Prg\2025_10_31__12_02_46_1.012,1,0
2=C:\WinCut\Prg\2025_10_31__12_02_46_2.012,1,0
```

A Gatterka az ellenőrző **INI xMix sorhivatkozásait** ennek megfelelően
`C:\WinCut\Prg\<programneve>.xPrg,1,0` alakban adja ki. A programlistában
a darabszámot továbbra is a valós táblaszám alapján tölti ki.
A ZIP fájljait **nem telepíti automatikusan** a gép `C:` meghajtójára.

**Fontos kompatibilitási hiány:** a működő képen a WinCut `.012`
fájlokra hivatkozik, a Gatterka pedig csak XML `.xPrg` mintákat állít elő.
A `.012` fájl pontos belső formátuma ismeretlen. Pusztán az átnevezés
nem alakítja át az XML-t érvényes `.012` programmá. A hibakereséshez egy
eredeti, működő `.012` fájl és a hozzá tartozó páros `.xMix`
szükséges; addig a gépi import / végrehajtás **nem igazolt**.
