# LAB – visszakeresett, korábban működő megvalósítás

Forrás: a „Gatterka v6 csev” csevegés és a [26-os PR](https://github.com/kissjaniapp/Kissjanilappterv_szabaszprogram/pull/26) forrása (`refs/pull/26/head`, machine/cnc-xxl.cjs, machine/cnc-auto.cjs és app/index.htm). Nem újonnan kitalált paraméterezés.

Hívás: `LAB X=<mm> Y=<mm> G=2`. Nincs A paraméter.

- Négy furat: X=59 és DX−59, Y=59 és DY−59.
- Pótfenék esetén kizárólag a pótfenék kap LAB furatot; DX=W+1.
- Közémenő fenék pótfenék nélkül: X=59−t és DX−59+t.
- Végigmenő fenék pótfenék nélkül: X=59 és DX−59.
- A fenéken előbb a felső lap megmunkálása, utána FORDIT, majd LAB a fonákon.
- A csak LAB-ot tartalmazó pótfenék rögtön a fonákjával kezd. Közémenő fenéknél a pótfenék két LAPA sora az első oldalra kerül, utána FORDIT és LAB.
- Nincs fenék vagy nincs láb: nincs LAB. Túl kicsi lap esetén nem szabad kívülre eső furatot kiadni.

A szoftverteszt nem helyettesíti a gépi ellenőrzést.
