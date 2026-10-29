# Lapterv – natív Windows próbaverzió 0.4.0

**Ez valódi natív Windows Forms alkalmazás**, nem Edge/Chrome által megnyitott weboldal.

A régi, böngészős Lapterv nem tűnik el, viszont annak sok részletfunkcióját (például Excel, matricák, teljes nesting) **még nem helyettesíti ez az első natív alapverzió**. A 0.4.0 verzióban natív felület, alkatrészek, egyszerű guillotine sávozás, grafikus táblanézet, projektmentés, műveleti sorrend, XPrg/XMix kísérleti export található.

## GitHub feltöltés – EGYSZER, egyetlen mappával

A `NATIV_LAPTERV_V04` mappát (az egész mappát) egyszerre húzd a `kissjaniapp/Lapterv-Windows` GitHub repository **Code → Add file → Upload files** területére. A `.github/workflows/lapterv-native.yml` GitHub workflow már a repositoryban lesz, ezért ezt nem kell külön feltöltened.

Az **Actions → Lapterv NATIV Windows 0.4** folyamatot keresd. Az `Artifacts` résznél jelenik meg a sikeres fordítás után a `Lapterv_Nativ_0.4.0` csomag, benne a `Lapterv_Telepito_0.4.0_x64.exe` és a `Lapterv.exe` fájlokkal.

## Windows helyi fordítás

Windows 10/11, .NET SDK 8, Go 1.23 kell a fordításhoz. (Futtatáskor a program önálló, .NET telepítés nem kell.)

```powershell
cd NATIV_LAPTERV_V04
dotnet run --project tests/Lapterv.SmokeTests.csproj
dotnet publish NativeApp/LaptervNative.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o dist
New-Item -ItemType Directory -Force installer/assets | Out-Null
Copy-Item dist/Lapterv.exe installer/assets/Lapterv.exe
go build -C installer -trimpath -ldflags="-s -w -H=windowsgui" -o assets/Lapterv_Eltavolitas.exe ./uninstall
go build -C installer -trimpath -ldflags="-s -w -H=windowsgui" -o ../dist/Lapterv_Telepito_0.4.0_x64.exe .
```

## KÍSÉRLETI XPrg export – fontos!

A generáló XML struktúrája a felhasználó által átadott 2021-es `.xPrg` programok `SchemaDoc / Header / Material / Pattern / Cut` mintáját követi. A `P`, `RY`, `Y`, `RX`, `X`, `F` utasításokat írja; nem generál `U`, `V`, `RU`, `RV` vagy többrétegű gépi utasítást. Az `.xMix` a létrehozott `.xPrg` fájlokra mutat. **A fájlok gépvezérlő általi elfogadása, a fizikai vágási sorrend és a fűrészprogram biztonsága NINCS igazolva.**

**Mielőtt bármilyen mozgást végezne a gép:** először gyártói vezérlőszoftverben offline import/szimuláció; ellenőrizd az origót, tengelyirányokat, szélezést, vágásrést, ütközőket, teríték elrendezését, a lapvastagságot és a tényleges műveleti sorrendet. A maradék anyag önmagában nem véd személyi sérüléstől vagy gépkártól. Ne használd éles gyártásban vagy felügyelet nélkül.

Az „azonos csíkokat 2 rétegben” **csak párosítási javaslatként** mutatjuk. A kísérleti `.xPrg` fájlban `NumFogliPacco=1` és `Rip=1`, amíg nincs igazolt rétegezési szemantika és ismert gépi vastagsági korlát.

## Mi készül el az export során?

- `nev.xMix` – teszt-mix lista
- `xPrg/nev_1.xPrg`, `xPrg/nev_2.xPrg` stb. – táblánként generált tesztprogram
- `nev_OLVASD_EL.txt` – gépi ellenőrzési figyelmeztetés

Az optimalizáló konzervatív, nem ipari szintű nesting; a csíkok előbb teljes táblán keletkeznek, és a UI műveleti listája ezután jelzi a hosszvágásokat. Az XPrg XML-ben a Y csíkok és X szegmensek hierarchikusan egymás alatt vannak, ez nem bizonyítja a gép vezérlőjének fizikai sorrendjét.

## Mintafájl offline szimulátorhoz

A `pelda_CSAK_OFFLINE_SZIMULATOR` alkönyvtárban van egy 1 táblás, 2 darabos **szemléltető** `.xMix` + `.xPrg` csomag, amelynek XML szerkezetét teszteltük. Az adatokat **nem szabad a fűrészgépen közvetlenül végrehajtani**; kizárólag a gép vezérlésének offline import / szimuláció ellenőrzésére szolgál. A `BLAP003` anyagkód a kapott régi mintából származik, nem biztos, hogy a tényleges anyagkódod.
