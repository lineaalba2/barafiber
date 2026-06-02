# Guide — Uppdatera barafiber.se

Hemsidan barafiber.se ligger på Vercel och koden lagras i ett publikt GitHub-repo. Hela sajten uppdateras automatiskt från föreningens publika Google Drive — du behöver inte röra någon kod för det dagliga arbetet.

## 1. Protokoll och årsstämmor

Lägg alltid alla signerade styrelseprotokoll och protokoll från årsstämmor i korrekt mapp i Bara Fibers publika Drive. De synkas automatiskt till hemsidan inom 4 timmar.

**Viktigt:**

- Filerna måste vara i **PDF-format** (Word-dokument och Google Docs ignoreras).
- Om en mapp inte syns på hemsidan: kontrollera att den är delad som **"Alla med länken"** (högerklicka mappen → Dela). Undermappar ärver inte alltid sharing automatiskt.

## 2. Kalkylarken (Sheets)

Det finns fyra Google-kalkylark i Bara Fibers publika Drive: **Avgifter**, **Innehåll**, **Styrelse** och **Driftinfo**. Dessa uppdateras efterhand som information förändras. När du justerar något i ett ark reflekteras det automatiskt på hemsidan inom 4 timmar. Du kan också trigga synken direkt på GitHub under **Actions → Run workflow**.

**Viktigt — ändra aldrig kolumn-rubrikerna, då slutar synken förstå datan:**

- Avgifter: `Avgift, Belopp, Notering, Kategori, Ordinarie pris`
- Innehåll: `Nyckel, Värde`
- Styrelse: `Roll, Namn, Mandat`
- Driftinfo: `Nyckel, Värde`

## 3. Driftinfo — driftstörningar på sajten

Driftinfo-arket styr om en gul varnings-banner visas högst upp på förstasidan. Arket har fyra rader, alla med en Nyckel-cell i kolumn A och en Värde-cell i kolumn B:

| Nyckel | Värde |
|---|---|
| rubrik | T.ex. "Större fel i nätet" |
| text | Brödtext med detaljer |
| uppdaterad | T.ex. "28 maj kl 17:01" |
| synlig_till | (Valfritt) Datum i format YYYY-MM-DD när bannern automatiskt försvinner |

### Normalläget (ingen driftstörning)

Lämna `rubrik`-cellen tom. Ingen banner visas på sajten.

### Vid driftstörning

Fyll i `rubrik`, `text` och `uppdaterad`. Bannern dyker upp på sajten inom 4 timmar — eller direkt om du triggar workflow:n manuellt på GitHub. Uppdatera `text` och `uppdaterad` löpande under störningens gång.

### Auto-borttagning efter X dagar

Sätt `synlig_till` till ett datum (YYYY-MM-DD). Bannern är synlig hela det datum du anger och döljs dagen efter.

Exempel: postar du en banner fredag och vill att den ska synas i 72 timmar — sätt `synlig_till` till måndagens datum.

### När felet är åtgärdat

Töm `rubrik`-cellen. Bannern försvinner automatiskt. Du kan lämna övriga celler orörda eller tömma dem för ordning och reda.

**Tips:** skriv ett naturligt klockslag i `uppdaterad` (t.ex. "28 maj kl 17:01"), så vet medlemmar exakt hur färsk informationen är.

## 4. Återgång till gamla sajten (one.com WebsiteBuilder)

Om det skulle behövas kan du återställa den gamla sajten genom DNS-ändringar hos one.com. Mejlen påverkas inte — endast webbtrafiken.

1. Logga in på one.com → **DNS-administration** → **DNS-post**-fliken.
2. Ta bort de två Vercel-recordsen:
   - `A barafiber.se → 76.76.21.21` (klicka pilen → Ta bort)
   - `CNAME www.barafiber.se → cname.vercel-dns.com` (klicka pilen → Ta bort)
3. Aktivera one.com:s standardinställningar igen (under "Standardinställningar för DNS"):
   - Slå PÅ toggle för `A barafiber.se`
   - Slå PÅ toggle för `A www.barafiber.se`
   - AAAA-toggles kan stå avstängda
4. Vänta 5–30 minuter för DNS-propagering.

---

## Att kopiera den här guiden till Google Docs

Använd **klistra in utan formatering**:

- **Mac:** Cmd + Shift + V
- **PC:** Ctrl + Shift + V

Då blir innehållet ren text utan svart bakgrund eller andra konstiga stilar. Formatera fetstil och rubriker själv i Docs efter behov.
