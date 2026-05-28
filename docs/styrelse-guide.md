# Guide för styrelsen — så uppdaterar du barafiber.se

## Allmänt om kalkylarken

Det finns fyra olika Google-kalkylark i Bara Fibers publika Drive: **Avgifter**, **Innehåll**, **Styrelse** och **Driftinfo**. Dessa är tänkta att uppdateras efterhand som information förändras. När du justerar något i ett ark reflekteras det automatiskt på hemsidan inom 4 timmar, men det går även att trigga igång direkt på GitHub under **Actions → Run workflow**.

## Viktigt — ändra aldrig kolumn-rubrikerna

Om du ändrar kolumn-rubrikerna i arken slutar synken förstå datan. Dessa rubriker måste vara exakt som angivet:

| Ark | Kolumn-rubriker (rad 1) |
|---|---|
| Avgifter | Avgift, Belopp, Notering, Kategori, Ordinarie pris |
| Innehåll | Nyckel, Värde |
| Styrelse | Roll, Namn, Mandat |
| Driftinfo | Nyckel, Värde |

---

## Driftinfo — så hanterar du driftinformation

Driftinfo-arket styr om en gul varnings-banner visas högst upp på förstasidan. Arket har tre rader, alla med en Nyckel-cell i kolumn A och en Värde-cell i kolumn B:

| Nyckel | Värde |
|---|---|
| rubrik | T.ex. "Större fel i nätet" |
| text | Brödtext med detaljer |
| uppdaterad | T.ex. "28 maj kl 17:01" |

### När det inte finns någon driftstörning (normalläget)

Lämna **`rubrik`-cellen tom** (B2). Ingen banner visas på sajten.

| A | B |
|---|---|
| Nyckel | Värde |
| rubrik | *(tom)* |
| text | *(tom)* |
| uppdaterad | *(tom)* |

### När det är driftstörning

Fyll i alla tre cellerna (rubrik, text, uppdaterad). Bannern dyker upp på sajten inom 4 timmar — eller direkt om du triggar workflow:n manuellt på GitHub. Uppdatera `text` och `uppdaterad` löpande under störningens gång.

| A | B |
|---|---|
| Nyckel | Värde |
| rubrik | Större fel i nätet |
| text | Vi har tyvärr ett större fel i vårt nät. En fiberkabel är avgrävd. Reparation pågår, prognos är att det ska vara åtgärdat i morgon, fredag 29 maj. |
| uppdaterad | 28 maj kl 17:01 |

### När felet är åtgärdat

Töm **`rubrik`-cellen**. Det räcker att tömma den — bannern försvinner automatiskt. Du kan lämna `text` och `uppdaterad` orörda eller tömma dem också för ordning och reda.

**Tips:** skriv ett naturligt klockslag i `uppdaterad` (t.ex. "28 maj kl 17:01"), så vet medlemmar exakt hur färsk informationen är.

---

## Att kopiera den här guiden till Google Docs

Använd **klistra in utan formatering**:
- **Mac:** Cmd + Shift + V
- **PC:** Ctrl + Shift + V

Då blir innehållet ren text utan svart bakgrund eller andra konstiga stilar. Formatera fetstil och rubriker själv i Docs efter behov.

Alternativt, om du redan klistrat in vanligt: markera all text med konstig formatering och välj **Format → Rensa formatering** (Cmd+\ på Mac, Ctrl+\ på PC).
