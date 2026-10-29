# Lapterv 1.0.3 – Windowsos szabásztervező

Ez a **működő Lapterv program** hivatalos forráskódja:
https://github.com/kissjaniapp/Kissjanilappterv_szabaszprogram

## Windows alkalmazás és telepítő

A program Windows 10/11-re készül, saját `Lapterv.exe` indítóval és
`Lapterv_Telepito_1.0.3_x64.exe` telepítővel. Offline fut. A teljes
bútor- és nestingfelület **helyi HTML/JavaScript alapú**, amelyet a
telepített **Microsoft Edge vagy Chrome böngészőmotorja külön alkalmazásablakban**
nyit meg. Ez teljes funkcionalitású Windowsos asztali csomagolás,
**nem natív Windows Forms átírás**. Nem szükséges hozzá internetkapcsolat.

Az automatikus telepítő a GitHub **Actions** oldalon, a
`Lapterv - Windows telepito automatikus epites` folyamatból tölthető le,
a `Lapterv-Windows-Telepito-1.0.3` nevű **Artifacts** csomagban.
Az egyedi program-, telepítő- és eltávolítóikon a gyökérben található `Lapterv.ico` fájlból készül. Mindhárom EXE beágyazott ikonját a GitHub Actions külön ellenőrzi.

## Indítás, helyi mentés és korábbi bútorok

**Induláskor mindig a Bútorválasztó nyílik meg.**
A régi projektek közül a kívánt bútort a listából kell megnyitni,
vagy az **Új bútor létrehozása** gombbal lehet új projektet létrehozni.
Az előző projekt nem nyílik meg automatikusan.

A program az adatokat a helyi, Windowsos böngészőprofil tárhelyén őrzi.
A profil könyvtára: `%LOCALAPPDATA%\Lapterv\BongeszoProfil`.
A böngészőmotor ezen belül tartja a `localStorage` adatokat:
`lapterv-library-v1` (projektlista), és a korábbi
`lapterv-project-v2` (régi mentés/migrációs kompatibilitás).

A telepítő programfájljai a
`%LOCALAPPDATA%\Programs\Lapterv` mappában vannak.
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
- **Excel (.xlsx)** – felül anyag és hová készül, alatta alkatrész neve, készméretek,
  darabszám és élzárás
- **.xMix + táblánként .xPrg** – egyetlen ellenőrző ZIP, benne a teljes projekt
  és a `.xMix` minden táblára mutató WinCut elérési útjával.

### A WinCut xMix fájlformátum

Az új, felhasználó által megadott `.xMix` a korábbi XML-gyűjtő helyett
**INI formátumú**, rögzített abszolút elérési úttal:

```ini
[Intestazione]
Descrizione=

[Righe]
NumeroRighe=2
1=C:\WinCut\Prg\Konyha_szekreny\2026_10_29_Konyha_Feya_tabla_01.xPrg
2=C:\WinCut\Prg\Konyha_szekreny\2026_10_29_Konyha_Feya_tabla_02.xPrg
```

A dátum mindig a készítés napja; a név a szekrény- és táblanévből képződik,
egyedi táblasorszámmal. A `NumeroRighe` érték a tényleges táblaszám.
A ZIP-en belül a **`Konyha_szekreny/` mappában együtt található** a `.xMix`
és az összes táblánkénti `.xPrg` fájl. A Mix mindig a
`C:\WinCut\Prg\<bútor_neve>\` mappára hivatkozik. A bútor nevét a
program Windowsban érvényes mappanévre alakítja (például
`Konyha szekrény` → `Konyha_szekreny`). A ZIP e mappa teljes tartalmát
kapcsolja egyetlen projektcsomaggá; több táblánál a `NumeroRighe` is nő.
A ZIP **nem telepít és nem másol fájlt automatikusan a gépre**.

A megadott `.xMix` szövegszerkezetet és WinCut fájlelérési utat
már ellenőrizni tudjuk; ettől a `.xPrg` programok működése még nem bizonyított.


Az `.xPrg` **nem hitelesített, csak fájlmegtekintésre és offline
szimulátorhoz készült**. A `P/RY/Y/RX/X/F` parancsok értelmezése,
a tényleges gépi sorrend és a többréteges vágás nem bizonyított.
Összetett `U/V` alábontásnál a program szándékosan nem ad ki
hiányos vagy kitalált utasításokat. Fizikai gépre ne töltsd.

## GitHub build

A `.github/workflows/lapterv-windows.yml` automatizmus minden
`main` ágra mentés után fut: Node.js ellenőrzés → Go fordítás →
Windows telepítő és hordozható ZIP → Artifacts.

A gépi export kísérleti része **nem változtatja meg a szabászgép
vezérlőjét**, és nem igazolja, hogy a kimeneti XML parancsokat a gép
elfogadja. A gép saját offline előnézete / importja szükséges.
