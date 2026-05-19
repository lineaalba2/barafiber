/**
 * sync-drive.mjs
 *
 * Hämtar fil-listan från Bara Fibers publika rot-mapp i Google Drive och
 * skriver resultatet till data/documents.json. Hemsidan renderar listan
 * statiskt — så här fungerar synken:
 *
 *   ROOT-MAPP (publik)
 *   ├── 2024/                      → Styrelseprotokoll → år 2024
 *   ├── 2025/                      → Styrelseprotokoll → år 2025
 *   ├── Årsstämma 2026/            → Årsstämma (egen sektion)
 *   ├── Stadgar/                   → Stadgar (egen sektion)
 *   └── <annat namn>/              → Övriga dokument
 *
 * Endast PDF-filer visas på hemsidan. Andra filtyper (Excel, Google Docs etc.)
 * ignoreras automatiskt.
 *
 * Lägger du till en ny mapp i Drive (t.ex. "2027") behövs ingen kodändring —
 * sektionen dyker upp på sajten nästa gång synken körs.
 *
 * Kräver miljövariabel:
 *   GOOGLE_API_KEY  – Google Drive API-nyckel
 *
 * Körs lokalt med:
 *   GOOGLE_API_KEY=xxx npm run sync
 *
 * Körs automatiskt varje dygn via .github/workflows/sync-drive.yml
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, '..', 'data', 'documents.json');

// Rot-mappen i Google Drive (publik). Byt här om mappen flyttas.
const ROOT_FOLDER_ID = '1sZ0YY0VrI3Db1PMjavwMtj6IELgKdk7l';

// Filtyper som visas på hemsidan
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
]);

const FOLDER_MIME = 'application/vnd.google-apps.folder';
const FIELDS = 'files(id,name,mimeType,modifiedTime,webViewLink,webContentLink)';

const API_KEY = process.env.GOOGLE_API_KEY;
if (!API_KEY) {
  console.error('❌  Saknar miljövariabel GOOGLE_API_KEY');
  console.error('    Sätt den så här:  export GOOGLE_API_KEY="din-nyckel"');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Sektions-definitioner (ordning + ikoner) — namn-detektion bestämmer mappning
// ---------------------------------------------------------------------------

const SECTIONS = [
  { key: 'styrelseprotokoll', label: 'Styrelseprotokoll', icon: '🗒️' },
  { key: 'arsstamma',         label: 'Årsstämma',          icon: '📋' },
  { key: 'stadgar',           label: 'Stadgar',            icon: '📜' },
  { key: 'ovriga',            label: 'Övriga dokument',    icon: '📎' },
];

function categorize(folderName) {
  const name = folderName.trim();
  // Årsstämma/årsmöte (kolla detta FÖRST eftersom namnet ofta innehåller ett år)
  if (/årsstäm|årsmöt|\bstämm/i.test(name)) return 'arsstamma';
  if (/stadg/i.test(name))                  return 'stadgar';
  // Rena år-mappar (t.ex. "2024", "2025")
  if (/^20\d{2}$/.test(name))               return 'styrelseprotokoll';
  // Mappar som börjar med ett år (t.ex. "2024 – protokoll")
  if (/^20\d{2}\b/.test(name))              return 'styrelseprotokoll';
  return 'ovriga';
}

function extractYear(name) {
  const match = name.match(/(20\d{2})/);
  return match ? match[1] : null;
}

// ---------------------------------------------------------------------------
// Drive API
// ---------------------------------------------------------------------------

async function listFolder(folderId) {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
  const url = `https://www.googleapis.com/drive/v3/files`
    + `?q=${q}`
    + `&fields=${encodeURIComponent(FIELDS)}`
    + `&pageSize=1000`
    + `&orderBy=name`
    + `&key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Drive API ${res.status}: ${body}`);
  }
  const data = await res.json();
  return data.files || [];
}

function toDoc(f) {
  return {
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    modifiedTime: f.modifiedTime,
    webViewLink: f.webViewLink,
    webContentLink: f.webContentLink,
  };
}

async function listPdfsRecursive(folderId) {
  // Letar PDF:er på första nivån + en nivå ner (om mappen råkar ha undermappar)
  const entries = await listFolder(folderId);
  const pdfs = entries
    .filter((f) => ALLOWED_MIME_TYPES.has(f.mimeType))
    .map(toDoc);
  const subfolders = entries.filter((f) => f.mimeType === FOLDER_MIME);
  for (const sub of subfolders) {
    const nested = await listFolder(sub.id);
    for (const f of nested) {
      if (ALLOWED_MIME_TYPES.has(f.mimeType)) pdfs.push(toDoc(f));
    }
  }
  return pdfs;
}

// ---------------------------------------------------------------------------
// Huvudflöde
// ---------------------------------------------------------------------------

async function main() {
  console.log(`🔄  Synkar rot-mapp ${ROOT_FOLDER_ID}...`);

  const rootEntries = await listFolder(ROOT_FOLDER_ID);
  const rootFolders = rootEntries.filter((e) => e.mimeType === FOLDER_MIME);
  const rootFiles   = rootEntries.filter((e) => ALLOWED_MIME_TYPES.has(e.mimeType));

  // Bygg sektions-trädet
  const sectionMap = Object.fromEntries(
    SECTIONS.map((s) => [s.key, { ...s, groups: [] }])
  );

  // Lösa PDF:er som ligger direkt i rot-mappen → läggs i "Övriga"
  if (rootFiles.length > 0) {
    sectionMap.ovriga.groups.push({
      label: null,
      files: rootFiles.map(toDoc),
    });
  }

  // Varje undermapp i rotnivån → en grupp i sin sektion
  for (const folder of rootFolders) {
    const sectionKey = categorize(folder.name);
    const section = sectionMap[sectionKey];

    console.log(`  → ${folder.name}  (→ ${section.label})`);

    let pdfs;
    try {
      pdfs = await listPdfsRecursive(folder.id);
    } catch (err) {
      console.error(`     ❌  Misslyckades: ${err.message}`);
      continue;
    }

    if (pdfs.length === 0) {
      console.log(`     (inga PDF:er)`);
      continue;
    }

    const year = extractYear(folder.name);
    section.groups.push({
      // För styrelseprotokoll använder vi året som etikett, annars hela mappnamnet
      label: sectionKey === 'styrelseprotokoll' && year ? year : folder.name,
      sortKey: year || folder.name,
      files: pdfs,
    });
    console.log(`     ${pdfs.length} PDF${pdfs.length === 1 ? '' : ':er'}`);
  }

  // Sortera grupper inom varje sektion (nyast överst)
  for (const section of Object.values(sectionMap)) {
    section.groups.sort((a, b) => {
      const aKey = a.sortKey || '';
      const bKey = b.sortKey || '';
      return bKey.localeCompare(aKey, 'sv');
    });
    section.groups.forEach((g) => delete g.sortKey);
  }

  // Filtrera bort tomma sektioner
  const sections = SECTIONS
    .map((s) => sectionMap[s.key])
    .filter((s) => s.groups.length > 0);

  const result = {
    lastUpdated: new Date().toISOString(),
    sourceFolder: `https://drive.google.com/drive/folders/${ROOT_FOLDER_ID}`,
    sections,
  };

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(result, null, 2) + '\n', 'utf8');

  const totalFiles = sections.reduce(
    (sum, s) => sum + s.groups.reduce((g, gr) => g + gr.files.length, 0), 0
  );
  console.log(`✅  ${totalFiles} dokument i ${sections.length} sektion${sections.length === 1 ? '' : 'er'}`);
  console.log(`    Skrev ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error('💥  Sync misslyckades:', err);
  process.exit(1);
});
