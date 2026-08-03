/**
 * check-links.mjs
 *
 * Kontrollerar att alla externa länkar på sajten faktiskt går att nå för
 * en besökare som inte är inloggad någonstans.
 *
 * Bakgrunden: sommaren 2026 låg formulärlänkarna för nyanslutning och
 * e-faktura nere i flera veckor utan att någon märkte det. De pekade på
 * Google Forms redigerings-URL:er, som svarar 401 för utomstående. För
 * besökaren såg det bara ut som att ingenting hände när de klickade.
 *
 * Skriptet skiljer på två sorters fel:
 *
 *   HÅRDA FEL (401, 403, 404, 410) -> jobbet misslyckas
 *     Länken är fel eller kräver behörighet. Det är precis det som hände
 *     med formulären. Måste åtgärdas.
 *
 *   MJUKA FEL (429, 5xx, timeout) -> varning, jobbet går igenom
 *     Oftast botskydd eller tillfälliga störningar hos mottagaren.
 *     Att låta dem fälla bygget skulle ge falsklarm och göra att man
 *     slutar bry sig om kontrollen.
 *
 * Körs veckovis via .github/workflows/check-links.yml, och kan köras
 * lokalt med:  node scripts/check-links.mjs
 */

import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const HARD_FAIL = new Set([401, 403, 404, 410]);
const TIMEOUT_MS = 15000;

// Vanlig webbläsar-UA. Utan den svarar flera sajter 403 på ren nyfikenhet.
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0 Safari/537.36';

async function collectHtmlFiles() {
  const entries = await readdir(ROOT, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.html'))
    .map((e) => join(ROOT, e.name));
}

async function collectLinks() {
  const files = await collectHtmlFiles();
  // Map<url, Set<filnamn>> så vi kan peka ut var en trasig länk sitter
  const links = new Map();

  for (const file of files) {
    let html = await readFile(file, 'utf8');

    // preconnect/dns-prefetch pekar på domänroten som prestandatips och är
    // inget besökaren kan klicka på. Bara domännamnet svarar ofta 404, så de
    // skulle ge falsklarm varje körning.
    html = html.replace(/<link[^>]*rel="(?:preconnect|dns-prefetch)"[^>]*>/gi, '');

    const matches = html.matchAll(/href="(https?:\/\/[^"]+)"/g);
    for (const [, url] of matches) {
      if (!links.has(url)) links.set(url, new Set());
      links.get(url).add(file.replace(ROOT + '/', ''));
    }
  }
  return links;
}

async function checkUrl(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    // GET i stället för HEAD — en del servrar (Google bland dem) svarar
    // annorlunda eller inte alls på HEAD.
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT },
    });
    return { status: res.status };
  } catch (err) {
    return { status: null, error: err.name === 'AbortError' ? 'timeout' : err.message };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const links = await collectLinks();
  console.log(`🔗  Kontrollerar ${links.size} externa länkar...\n`);

  const hardFailures = [];
  const softFailures = [];

  for (const [url, files] of links) {
    const { status, error } = await checkUrl(url);
    const where = [...files].join(', ');

    if (status && status < 400) {
      console.log(`  ✅  ${status}  ${url}`);
    } else if (status && HARD_FAIL.has(status)) {
      console.log(`  ❌  ${status}  ${url}  (${where})`);
      hardFailures.push({ url, status, where });
    } else {
      const label = status ?? error;
      console.log(`  ⚠️   ${label}  ${url}  (${where})`);
      softFailures.push({ url, status: label, where });
    }
  }

  console.log('');

  if (softFailures.length > 0) {
    console.log(`⚠️   ${softFailures.length} länk(ar) svarade inte, men felen ser tillfälliga ut:`);
    for (const f of softFailures) console.log(`     ${f.status}  ${f.url}`);
    console.log('     Kontrollera manuellt om samma länk varnar flera veckor i rad.\n');
  }

  if (hardFailures.length > 0) {
    console.error(`❌  ${hardFailures.length} länk(ar) är trasiga för besökare:\n`);
    for (const f of hardFailures) {
      console.error(`     ${f.status}  ${f.url}`);
      console.error(`           finns på: ${f.where}\n`);
    }
    console.error('Besökare som klickar på dessa möts av en behörighetsvägg eller ett 404.');
    console.error('Gäller det ett Google-formulär: använd den publicerade svarslänken');
    console.error('(Skicka -> länkfliken), den innehåller /d/e/ och fungerar för alla.');
    process.exit(1);
  }

  console.log('✅  Alla länkar går att nå.');
}

main().catch((err) => {
  console.error('💥  Länkkontrollen kraschade:', err);
  process.exit(1);
});
