# Gatterka 1.0.11 – Windowsos szabásztervező

Ez a **működő Gatterka program** hivatalos forráskódja:
https://github.com/kissjaniapp/Kissjanilappterv_szabaszprogram

### Aktuális tudnivalók – 1.0.11

A Windowsos Gatterka natív mappaválasztójával közvetlenül menti az xPrg/xMix projektet: a kiválasztott célmappában dátumos projektmappát és xPrg almappát hoz létre, az xMix a tényleges Windows-útvonalat tartalmazza. A célmappa elérési útja a felületen **csak kijelzés**, nem szerkeszthető. Az Alkatrészek oldalon egyetlen „Anyagkészlet →” gomb van. A ZIP továbbra is választható alternatíva.

**Telepítő:** a Gatterka 1.0.11 kiadása **digitális tanúsítvány nélkül** épül. Nincs Azure-titok, aláírási szolgáltatás vagy külön beállítás. A Windows SmartScreen a telepítő futtatásakor az ismeretlen kiadóra figyelmeztethet; ez normális aláíratlan EXE esetén.


## Windows alkalmazás és telepítő

A program Windows 10/11-re készül, saját `Gatterka.exe` indítóval és
`Gatterka_Telepito_1.0.11_x64.exe` telepítővel. Offline fut. A teljes
bútor- és nestingfelület **helyi HTML/JavaScript alapú**, amelyet a
telepített **Microsoft Edge vagy Chrome böngészőmotorja külön alkalmazásablakban**
nyit meg. Ez teljes funkcionalitású Windowsos asztali csomagolás,
**nem natív Windows Forms átírás**. Nem szükséges hozzá internetkapcsolat.

Az automatikus telepítő a GitHub **Actions** oldalon, a
`Gatterka - Windows telepito automatikus epites` folyamatból tölthető le,
a `Gatterka-Windows-Telepito-1.0.11` nevű **Artifacts** csomagban.
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

## 2026-10-30 – állandó .xPrg-fejlécméretek

Az eredeti SCM-minta alapján az .xPrg `<Header>` mindig az alaplap saját
X/Y tengelyeihez kötött méreteket használja: `Lunghezza = bin.b` (Y),
`Larghezza = bin.a` (X). A `feed='x'` vagy `feed='y'` gépállás
**nem cseréli fel a két fejlécmezőt**. A `<Cut T="P">` kezdőparancs
változatlanul a kiválasztott beadási irány szerinti méretet használja.
A WinCut-kompatibilitás ettől még gépi tesztet igényel.

## 2026-10-30 – rajzi tájolású xPrg-fejléc és közvetlen ZIP-letöltés

- Az .xPrg `Lunghezza` értéke **pontosan a szabásrajz tetején vízszintesen látható** táblaoldal. A `Larghezza` pedig a **bal oldali függőleges** táblaoldal. Normál, X gépállásnál: `Lunghezza = a`, `Larghezza = b`; Y gépállásban, amikor a rajz elfordul: `Lunghezza = b`, `Larghezza = a`. A `P` vágási parancs beadásirányfüggő számítása változatlan.
- Az alkatrészlistában a korábbi `Szál kötelező` minden előfordulása `Szálirány kötelező` feliratra változott.
- A Gatterka `XPrg + XMix letöltése (ZIP)` gomb megnyomása már **nem** jelenít meg két felugró párbeszédablakot: az anyagkód előre, a letöltőgomb mellett szerkeszthető; a letöltéshez külön megerősítés nem kell.
- A korábbi mentésekben hiányzó anyagkód alapértelmezése a **példaként használt BLAP003**, amit a tényleges gépi anyagtörzsnek megfelelően ellenőrizni kell. A megadott anyagkód a projekttel mentődik.
- A böngésző normál ZIP-letöltése indul (alapesetben Letöltések); a mentési helyről szóló böngészőbeállításra az alkalmazás nem tud garanciát adni. A gépi .012/.xPrg kompatibilitás továbbra sincs hitelesítve.

## 2026-10-30 – tisztított Nesting exportfelület

A Nesting képernyőről eltávolítottuk a ZIP-letöltés melletti hosszú
WinCut/hivatkozás tájékoztató szöveget, az „offline ellenőrző minta”
figyelmeztető sort és a képernyő alatti „Fontos: a kiosztás heurisztikus…”
kiemelt figyelmeztetődobozt. A gépi anyagkód szerkesztőmező, az XPrg + XMix
ZIP-letöltőgomb, a szabásrajz és az alkatrészlista PNG export megmaradt.
A változás **csak a képernyő szövegeit és elrendezését érinti**;
a gyártási kompatibilitás ellenőrzése továbbra is szükséges.

## 2026-10-30 – élő alkatrész-képletek és automatikus Nesting

- A bútoralkatrész X/Y méreténél a képletet kis, halvány, de **közvetlenül szerkeszthető** sorban, alatta a **nagy méretű kiszámolt szabásméretet** mutatja a felület. A szabásméret az élzárás és előmarás levonása utáni szám, ugyanaz, amit a program a nestinghez használ. Puszta szám beírásakor hagyományos, egy soros méretmező marad.
- Gépeléskor a képlet eredménye, darabszám-összesítő és nettó alkatrészterület azonnal frissül, teljes oldal-újrarajzolás nélkül; a kurzor a képletben marad. A korábbi projektek képletei változatlan szövegként maradnak mentve.
- A hosszú, költséges gépi nesting számítás rövid gépelési szünet után frissül, illetve a mező változtatásakor automatikusan újraszámolódik, amennyiben már létezett terv. A Nesting lap megnyitásakor a terv automatikusan kiszámolódik, külön „Újraszámolás” vagy „Nesting indítása” gomb nélkül.

## 2026-10-30 – Megjelenés beállítások, Letöltések, Windows-bezárás

- A Gatterka felső sávján, a **Bútorválasztó** mellett a **⚙ Beállítások**
  ikon az indításkor megjelenő bútorválasztón is elérhető. A megjelenés
  világos vagy sötét előbeállítást kaphat. A felhasználó egyénileg
  állíthatja a **szövegszínt, a gombok színét és a háttérszínt**.
  A színek azonnal érvényesülnek, és **gatterka-theme-v1** kulcson,
  a bútorprojektek mentésétől függetlenül maradnak meg. A korábbi projektek
  és képletek változatlanok.

- **Egységes letöltés:** a PNG, SVG, JSON, CSV és ZIP exportok a böngésző
  közvetlen letöltését használják. Az alkatrészlista PNG már nem nyit
  `showSaveFilePicker` Mentés másként ablakot. Ha több oldalas a lista,
  **egyetlen ZIP** tartalmazza az összes PNG-t (a matricákhoz hasonlóan).
  A Gatterka által indított Edge/Chrome saját, meglévő böngészőprofiljában
  a **Windows beállított Letöltések mappája** lesz a cél: a launcher a
  Felhasználói Shell-mappák registry-bejegyzését olvassa, különben
  `%USERPROFILE%\Downloads` mappát használ. Csak a Gatterka dedikált
  profiljának letöltési preferenciáit módosítja.
  **Korlát:** külső böngészővel való tartalék indítás, böngészőházirend,
  külső kiegészítő vagy Windows-letöltési korlátozás esetén a külső program
  saját beállításai elsőbbséget élvezhetnek.

- A Gatterka EXE, telepítő és eltávolító saját `RT_MANIFEST` Windows
  kompatibilitási erőforrást kap (`asInvoker`, Windows 10/11).
  A launcher **nem lép ki rögtön a böngésző megnyitásakor**: megvárja a
  saját Edge/Chrome folyamatát. Ez a Windows Program Compatibility Assistant
  esetleges „Megfelelően futott a program?” jelzésének okát kezeli anélkül,
  hogy az operációs rendszer hibavédelmét vagy a szolgáltatását letiltanánk.
  A jelzés teljes megszűnését az érintett számítógépen kell ellenőrizni.

## 2026-10-30 – xPrg anyagszín a fejléc Descrizione mezőjében

A Gatterka minden táblához a kihelyezett alkatrészeken beállított **Anyag színe / dekorja** mezőt írja az XML `<Header Descrizione="...">` attribútumába. Például `Feya`, `Freya`, `Fehér tölgy`. A gépi anyagtörzskód változatlanul a `<Material Tipologia="" Codice="BLAP003" />` mezőbe kerül (vagy a felületen megadott kód). A tábla tájolása, méretei, a teljes `<Pattern>` és a WinCut `.xMix` szerkezete nem változik. Az XML speciális karaktereit escape-eli. Ha egyetlen tábla több különböző, nem üres anyagszínű alkatrészt tartalmaz, a program nem exportál félrevezető fejlécet, hanem jelzi a problémát. Hiányzó anyagszín esetén üres `Descrizione` készül, nem a `BLAP003` anyagkód.

Ez a módosítás az anyagleírás kijelzésének kipróbálására szolgál; éles vágás előtt az adott vezérlőn külön ellenőrizendő.

## 2026-10-30 – XML-es WinCut xMix és szabadon beállítható xPrg-mappa

A Nesting export a felhasználó gépéről származó működő XML-es xMix
szerkezetet írja, nem az INI-jellegű korábbi xMix-et.
A közös projekt minden táblához külön xPrg-t kap, és az összes táblát
a RigheMix / RigaMix elemek kapcsolják össze.

A Nesting exportpanelen az **XPrg fájlok helye az XMix-ben** mező
projektbe mentődik. Alapértelmezése a relatív xPrg almappa.
A ZIP ezzel egyező mappaszerkezetet tartalmaz. Teljes meghajtóútvonal
vagy hálózati UNC útvonal is megadható; a fájlokat ekkor külön kell
a gép megfelelő könyvtárába másolni.

A Mix tartalmaz dátumot, Materials listát a bútorok anyagszínével és
gépi anyagkódjával, valamint a táblákra mutató fájlhivatkozásokat.
A biztonságos XML-karakterkezelés és Windows-mappaellenőrzés bekerült.

**A gépi xPrg vágási parancsok, a P mérete és a fűrészlapvastagság
nem változnak.** A korábban észlelt SpessoreLamaNonValido hiba okát
külön kell tisztázni: a generált xPrg fizikai gépi végrehajtása nincs
hitelesítve. Részletes leírás: docs/GEPI_FORMATUM.md.

## 2026-10-30 – gép által elfogadott próbakód szerinti xPrg fejléc

Az xPrg export alapértelmezett „**Próba szerint · anyagkód**” üzemmódjában
a működő `GATTERKA_PROBA_01_REGI_FEJLEC.xPrg` és az eredeti SCM
`09_01_51_1(1).xPrg` mintát követjük:

- A `Header Lunghezza` és az első `Cut T="P" Dim` ugyanazt a gépi
  beadási oldalméretet tartalmazza. Az a korábbi hiba, amikor például
  `Lunghezza=753`, de `P=1983` volt, így nem ismétlődhet meg.
- A `Header Larghezza` a másik gépi táblaoldal.
- `Header Descrizione` alapból a gépi anyagkód (például `BLAP003`);
  a korábban kért anyagszín választható a **„XPrg fejléc leírása”**
  beállítás **„Anyagszín / dekor”** lehetőségével. A közös XML xMix
  `Materials Tipologia` mezője továbbra is a bútor anyagszínét tartalmazza.
- A rajz képernyőn látható tájolása **nem módosul**. A két külön
  tájolást a gépi fejléc és a grafikus szabásrajz más célja indokolja.
- Az xPrg `SchemaDoc/Header/Material/Pattern/Cut` szerkezete,
  `P/RY/Y/RX/X/U/F` vágásai, fűrészrésmérete és a tényleges
  alkatrészek **nem kerülnek leegyszerűsítésre vagy elhagyásra**.
  A 2800 × 2070 × 18, 5 mm-es fűrészrésű, 12 mm szélezésű,
  964 × 200-as példánál a generált fájl szó szerint megfelel a
  felhasználó gépe által elfogadott 01-es próba xPrg-nek.

A próbaminta sikeres megnyitása **nem hitelesíti** az általános,
sokvágásos programok fizikai végrehajtását. Különösen a korábbi
`SpessoreLamaNonValido` gépi hiba újbóli felmerülését ellenőrizni
kell. A legfrissebb XML-es xMix és a beállítható xPrg mappa
változatlan.


## 2026-10-30 – Gatterka: gépi tükörnézet, négy képernyő, közvetlen projektmappa-mentés

- A szabásrajz **a függőleges középvonalára tükrözve** jelenik meg (a WinCut képernyőjével összhangban); a PNG és az SVG is ezt a nézetet exportálja. A belső alkatrészkoordináták és az .xPrg `P/RY/Y/RX/X/U/F` utasítások változatlanok.
- A fejlécben a program neve **Gatterka**, nagy kezdőbetűvel és könnyebb betűvastagsággal. A láblécben szerepel: **„A programot készítette: Kiss János · A program Kiss János tulajdona.”**
- Négy különálló munkaképernyő: **01 Bútor adatai → 02 Alkatrészek → 03 Anyagkészlet → 04 Szabásterv**. A bútorlap már nem tartalmazza az alkatrész-táblázatot, azt az „Alkatrészek megadása” gomb nyitja meg önálló oldalon.
- A Bútor adatai képernyő **Anyag színe / dekorja** mezője határozza meg a gépi anyagkódot és az `xPrg Header Descrizione` értékét, továbbá a közös XML xMix `Materials Tipologia` és `Codice` értékeit. Az exportpanelen a gépi anyagkód és a fejlécmód kézi állítását megszüntettük; régi projektek örökölt mezői az exportot nem befolyásolják.
- Új **„Hely kiválasztása és mentés”** gomb a Szabásterv oldalon. A Chromium natív `showDirectoryPicker({mode:'readwrite'})` ablakával választott mappában automatikusan létrehozza a **YYYY_MM_DD_Hova_keszul** könyvtárat. Ezen belül **egy közös XML .xMix és az xPrg almappa** található az összes táblaprogrammal; a Mix hivatkozásai **.\\xPrg\\** relatív útvonalra mutatnak. Ha a projektmappa már létezik, sorszámozott új mappát hoz létre; korábbi mentést nem ír felül.
- A különálló **ZIP letöltése** gomb továbbra is használható, különösen akkor, ha a böngésző nem támogatja a natív mappaválasztót. A fájlstruktúrája megegyezik a mappába mentett változattal.
- **Gépi megkötés:** az anyagszínnek meg kell egyeznie a WinCut anyagtörzsében elvárt azonosítóval. A gépen már sikeresen lefutott egyszerű próba nem garantálja az összes bonyolult vágás és eltérő anyagkódok kompatibilitását; először offline/szoftveres ellenőrzést kell végezni.

## 2026-10-30 – az alapértelmezett anyagszín javítása

A korábbi „Feya” elírás helyes alakja **Freya**. Minden új bútor és új projekt Freya anyagszínnel indul. A helyi mentésekben kizárólag a pontosan „Feya” értékű anyagszínt javítjuk automatikusan „Freya” értékre, a többi felhasználói anyagszín változatlan marad. A bútorválasztó mentett projektjei szintén frissülnek, és a gépi xPrg/xMix exportban az adott bútor javított anyagszíne jelenik meg.


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


## 2026-10-30 – valódi Windows mappaválasztás és maximalizált Gatterka

A korábbi HTML5 showDirectoryPicker a beágyazott böngésző számára csak mappa-engedélyt
és mappanevet adott, a teljes Windows meghajtóutat nem. Ezért a gépi gyökérmappa
mező nem frissült, a Mix nem mindig a tényleges mappára mutatott, és a mentés
hibásan leállhatott.

**Új Windows Gatterka.exe változat:** a telepített program saját, a
127.0.0.1 loopback címen elérhető, munkamenet-tokenhez kötött helyi mentőn
keresztül **valódi Windows mappaválasztót** nyit (PowerShell / Windows Forms).
A kiválasztott mappa teljes útja automatikusan bekerül a
**Gépi gyökérmappa – teljes Windows-útvonal** mezőbe, és mentődik a
projektben és a felhasználó gépiútvonal-beállításában. A mező kézzel is
szerkeszthető, és már gépelés közben elmenti az értéket.

Az EXE maga hozza létre a dátum + célhely névre képzett projektmappát,
azon belül a közös XML .xMix fájlt és az xPrg mappát. Az .xMix RigaMix File
hivatkozásait **közvetlenül a ténylegesen létrehozott Windows mappára** írja,
nem egy vélelmezett X: meghajtóra. Azonos nevű mentéskor a ténylegesen
képzett _2, _3 stb. mappanevet is átvezeti a Mix sorain. Érvénytelen
fájlneveket, útvonalbejárást és hivatkozáshiányt visszautasít; az .xPrg
vágási tartalma érintetlen.

A **ZIP letöltése** a kézzel beállított X: gyökérmappa szerinti teljes
útvonalat használja; kézi kibontáskor ezt a gyökérmappát kell használni.
A külön megnyitott index.htm (Windows EXE nélkül) nem fér hozzá a natív
mappaválasztóhoz; ott a ZIP letöltés működik.

A Windows indító **maximalizált, de normál visszaállítható ablakot**
nyit (`--start-maximized` és SW_MAXIMIZE). A cím- és bezárógomb
megmarad. Nem F11-es teljes képernyő és nem kioszk mód.

A módosítás automatikus Windows/JavaScript tesztjei a mentési útvonalakra
és projekt-ütközésekre vonatkoznak. A tényleges gépi vezérlőn történő
vágást továbbra is külön ellenőrizni kell.


## 1.0.11 – közvetlen mentés, tanúsítvány nélküli Windows-kiadás

A Gatterka.exe indítóból megnyitott **📁 Mappa kiválasztása és mentés** gomb a Windows natív mappaválasztóját használja. A jóváhagyáskor a Go segédszolgáltatás azonnal menti a fájlokat a kiválasztott gyökérkönyvtár alatt létrehozott dátumos projektmappába, azon belül külön xPrg mappába. A közös xMix mindegyik táblához abszolút, a valós mentési útvonallal egyező hivatkozást kap. A felületen látható célmappa immár csak olvasható; nem kézzel megadható. Ez megőrzi az xMix-projektfájlok jelenlegi, a gép által már kipróbált szerkezetét. A ZIP továbbra is választható.

### Telepítő tanúsítvány nélkül

A `.github/workflows/lapterv-windows.yml` minden `main` ágra történő feltöltéskor elindítja a teszteket és lefordítja a `Gatterka_Telepito_1.0.11_x64.exe` telepítőt, a `Gatterka_Portable_1.0.11.zip` hordozható csomagot és az ellenőrző `SHA256.txt` állományt. A fordításhoz **nem szükséges tanúsítvány, kiadói kulcs, Azure-fiók vagy aláírás**. A program offline működik és megőrzi a korábbi helyi bútoradatokat.

**Windows-figyelmeztetés:** az aláíratlan telepítő ismeretlen kiadóként jelenhet meg a Windows biztonsági kérdéseiben. Ez nem helyettesíti a tényleges vírusellenőrzést, de nem akadálya annak, hogy a program működő, kész Windows-alkalmazás legyen.

**Megjegyzés:** a korábbi fejlesztési napló egyes szakaszai történeti információk. Az 1.0.11-es működésben a célmappa útvonala *csak olvasható*, és a mentést a Windowsos Gatterka saját mappaválasztója indítja.
