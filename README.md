# barafiber.se

Hemsida för Samfällighetsföreningen Bara Fiber. Statisk HTML/CSS/JS, ingen byggsteg krävs för själva sidan. Dokumentlistan på `Om oss → Dokument` synkas dagligen från föreningens delade Google Drive-mappar via en GitHub Action.

## Struktur

```
.
├── index.html                Hem
├── teknisk-hjalp.html        Support, Wi-Fi, MESH, TV
├── tjanster.html             Internet, telefoni, TV
├── agarbyte.html             Säljare, köpare, mäklare
├── nyanslutning.html         Nyanslutning av fastighet
├── information.html          Avgifter, regler, GDPR
├── om-oss.html               Föreningen, styrelse, dokument
├── personuppgiftspolicy.html GDPR-sida
├── css/styles.css            All styling
├── js/documents.js           Renderar dokumentlistan från JSON
├── data/documents.json       Genereras av sync-scriptet
├── scripts/sync-drive.mjs    Hämtar fil-listor från Drive
├── .github/workflows/sync-drive.yml  Daglig sync via GitHub Actions
├── netlify.toml              Netlify-konfig (cache-headers etc.)
└── img/favicon.svg
```

## Lokal utveckling

Eftersom sidan är ren statisk HTML räcker det med vilken liten HTTP-server som helst:

```bash
npm run serve
# eller
python3 -m http.server 8080
```

Öppna sedan http://localhost:8080.

## Drive-sync — så fungerar det

`scripts/sync-drive.mjs` läser **en enda publik rot-mapp** i Google Drive och
upptäcker automatiskt vad som ligger där. Mapp-ID:t hårdkodat i scriptet:

```
ROOT_FOLDER_ID = '1tXZ30C7zSx5G757Yj26j_yi3Y4ZsRKXp'
```

(byt här om ni flyttar mappen).

### Hur mappstrukturen tolkas

Scriptet kollar varje undermapp i rot-mappen och **kategoriserar baserat på namn**:

| Mappnamn innehåller | Hamnar under | Visas hur |
| --- | --- | --- |
| `2024`, `2025`, `2026` (rena år eller börjar med år) | **Styrelseprotokoll** | Grupperad per år |
| `årsstämma`, `årsmöte`, `stämma` | **Årsstämma** | Egen sektion |
| `stadgar` | **Stadgar** | Egen sektion |
| Annat | **Övriga dokument** | Med mappnamnet som etikett |

**Endast PDF-filer visas** — Excel, Google Docs och annat ignoreras automatiskt
även om de ligger i en synkad mapp.

### Att lägga till nya år / dokument

Skapa bara nya mappar i Drive — t.ex. `2027` för nästa års protokoll, eller
`Årsstämma 2027` för nästa årsstämma. **Inga kodändringar behövs.** Sektionerna
dyker upp på sajten nästa gång synken körs.

### Förutsättningar för att synken ska fungera

**1. Rot-mappen måste vara publikt delad**

Öppna [rot-mappen i Drive](https://drive.google.com/drive/folders/1tXZ30C7zSx5G757Yj26j_yi3Y4ZsRKXp)
→ Dela → Allmän åtkomst → välj **"Alla med länken"** (Visningsbehörighet).

Den här inställningen ärvs automatiskt av alla undermappar.

**2. Skapa en Google Drive API-nyckel** (ca 5 minuter, gratis)

1. Gå till [console.cloud.google.com](https://console.cloud.google.com/).
2. Längst upp — välj projekt → **Nytt projekt** → namn "Bara Fiber" → Skapa.
3. När projektet är valt: gå till **APIs & Services → Library**.
4. Sök "Google Drive API" → klicka in → **Enable**.
5. Gå till **APIs & Services → Credentials** → **Create credentials** → **API key**.
6. Kopiera nyckeln. Klicka **Restrict key** och under **API restrictions** välj
   "Restrict key" → bocka i bara "Google Drive API" → Save. *(rekommenderat för säkerhet)*

**3. Lägg in nyckeln som GitHub Secret**

I [barafiber-repot på GitHub](https://github.com/lineaalba2/barafiber):
- Settings → Secrets and variables → Actions → **New repository secret**.
- Name: `GOOGLE_API_KEY`
- Secret: klistra in nyckeln från steg 2.

Klart. Kör workflow:n manuellt första gången för att verifiera att det funkar:
Actions → "Sync Google Drive documents" → **Run workflow**.

### Köra sync lokalt

```bash
export GOOGLE_API_KEY="din-nyckel-här"
npm run sync
```

Detta uppdaterar `data/documents.json`.

### Köra sync från Actions

GitHub Action `sync-drive.yml` kör automatiskt:

- **Schemalagt:** varje dygn kl 05:00 UTC (07:00 svensk sommartid).
- **Manuellt:** Actions-fliken i GitHub → "Sync Google Drive documents" → "Run workflow".

Workflowen commitar förändringar till `data/documents.json` om något ändrats.

## Deployment

Sajten är en ren statisk hemsida — fungerar på vilken statisk-hosting som helst.
Repot innehåller config för både Vercel (`vercel.json`) och Netlify (`netlify.toml`).
Använd det du har anslutet — den andra filen ignoreras.

### Vercel (nuvarande deployment)

Aktuell deployment: **https://bara-fiber.vercel.app**

- Vercel deployar automatiskt vid varje commit till den anslutna branchen.
- Inga build-kommandon krävs (Output directory: `.` / rot).
- För att lägga till `barafiber.se` som custom domain: Vercel-projektet → Settings → Domains → Add → följ DNS-instruktionerna (peka A-record eller CNAME hos one.com till Vercel).

### Netlify (alternativ)

Om ni byter till Netlify istället:
1. [netlify.com](https://netlify.com) → "Add new site" → "Import from Git" → välj repot.
2. Build settings: tomma. Publish directory: `.`
3. Deploy.

### Migrera bort från one.com:s WebsiteBuilder

- Hemsidan flyttas till Vercel/Netlify. Behåll one.com endast för det ni faktiskt behöver där (t.ex. mejlhantering).
- DNS-pekningen för `barafiber.se` ändras så att webben pekar på den nya hosten istället för one.com.

## Innehåll uppdatering

- **Dokument (protokoll, årsstämmor, stadgar):** ladda upp i Drive precis som idag. Dyker upp på sajten inom 24h.
- **Textinnehåll (avgifter, regler, kontaktuppgifter etc.):** redigera HTML-filen direkt och commit:a.
- **Styrelse:** uppdatera `om-oss.html`. Aktuell information hämtas annars från senaste årsstämmoprotokollet.

## Saker att verifiera innan lansering

Innehållet på de nya sidorna är sammanställt från den befintliga `barafiber.se`. Verifiera särskilt:

- [ ] Kontaktmejladresser i `om-oss.html` (`info@barafiber.se`, `valberedningen@barafiber.se`) — stämmer dessa?
- [ ] Aktuell styrelse — lägg till namn och roller i `om-oss.html` under `#styrelse`.
- [ ] Avgifter i `information.html` — stämmer 1 320 kr fortfarande?
- [ ] Telefonsupportnummer för Ownit/Telenor — om ni vill ha dem listade, lägg till i `teknisk-hjalp.html`.
- [ ] Facebook-länken (`facebook.com/barafiber`) — verifiera URL.

## Färgschema

| Användning | Hex |
| --- | --- |
| Primär (deep navy) | `#0a3d62` |
| Primär mörk | `#052c4a` |
| Accent (fiber teal) | `#00b8a9` |
| Bakgrund alt | `#f7f9fc` |
| Text | `#1a2332` |

## Licens

Innehåll © Samfällighetsföreningen Bara Fiber. Kod fri att modifiera för föreningens räkning.
