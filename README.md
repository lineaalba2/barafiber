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

`scripts/sync-drive.mjs` läser tre delade Drive-mappar:

| Kategori | Mapp-ID | Format |
| --- | --- | --- |
| Styrelsemöten | `1pq8waIbTCp8DGmXCiOlCQjgygof7pbyq` | Undermappar per år |
| Årsmöten | `1Ui1LI3jZXGYHdzFZRNIZ_zsvNeptIjz0` | Undermappar per år |
| Stadgar | `1_dF2UwerSVCUpS8jC97LPM_YRoxbrJ-e` | Platt mapp |

Resultatet skrivs till `data/documents.json`, och `js/documents.js` renderar listan på `om-oss.html`.

### Förutsättningar för att synken ska fungera

1. **Mapparna måste vara delade som "Anyone with the link can view"** — annars får API-nyckeln inget se. Öppna varje mapp i Drive → Dela → Allmän åtkomst → "Alla med länken" (visningsbehörighet).
2. **En Google Cloud API-nyckel** för Drive API:
   - Gå till [console.cloud.google.com](https://console.cloud.google.com/).
   - Skapa ett projekt (t.ex. "Bara Fiber").
   - Aktivera **Google Drive API** (APIs & Services → Library → sök "Drive").
   - Skapa en API-nyckel (APIs & Services → Credentials → Create credentials → API key).
   - Begränsa nyckeln till enbart Drive API (rekommenderat) under "API restrictions".
3. **Lägg in nyckeln som GitHub Secret** i barafiber-repot:
   - Settings → Secrets and variables → Actions → New repository secret.
   - Name: `GOOGLE_API_KEY`. Value: nyckeln från Google Cloud.

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

## Deployment till Netlify

1. Skapa ett konto på [netlify.com](https://netlify.com) (gratis).
2. "Add new site" → "Import from Git" → välj `lineaalba2/barafiber`-repot.
3. Build settings: lämna tomma (det finns ingen build). Publish directory: `.` (rot).
4. Deploy.
5. Lägg till domänen `barafiber.se`:
   - Site settings → Domain management → Add custom domain → `barafiber.se`.
   - Följ instruktionerna för DNS — antingen ändra namnservers hos one.com till Netlify, eller behåll one.com som DNS-leverantör och peka A/CNAME-record till Netlify.

### Migrera bort från one.com:s WebsiteBuilder

- Hemsidan flyttas till Netlify. Behåll one.com endast för det du faktiskt behöver där (t.ex. mejlhantering).
- DNS-pekningen för `barafiber.se` ändras så att webben pekar på Netlify istället för one.com.

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
