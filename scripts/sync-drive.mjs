/**
 * sync-drive.mjs
 *
 * Hämtar fil-listan från Bara Fibers publika rot-mapp i Google Drive och
 * skriver resultatet till data/documents.json.
 *
 *   ROOT-MAPP (publik)
 *   ├── 2024/                          → Styrelseprotokoll 2024 (plana PDF:er)
 *   │   └── Årsstämma/                 → Årsstämma 2024 (egen sektion)
 *   │       └── kallelse.pdf, etc.
 *   ├── 2025/
 *   │   ├── protokoll-jan.pdf          → Styrelseprotokoll 2025
 *   │   └── Årsstämma/                 → Årsstämma 2025
 *   ├── Stadgar/                       → Stadgar (egen sektion)
 *   └── <annat>/                       → Övriga dokument
 *
 * Logik:
 *   - Plana PDF:er i en år-mapp ("2024") → Styrelseprotokoll → [år]
 *   - Undermappar i en år-mapp kategoriseras (Årsstämma, Stadgar, Övrigt)
 *     och hamnar under sin egen sektion grupperade per år
 *   - Toppnivåmappar i rot-mappen kategoriseras likadant
 *   - Endast PDF visas; andra filtyper ignoreras
 *
 * Lägga till nytt år: skapa bara mappen i Drive — ingen kodändring behövs.
 *
 * Kräver miljövariabel GOOGLE_API_KEY (Google Drive API-nyckel).
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, '..', 'data', 'documents.json');

const ROOT_FOLDER_ID = '1sZ0YY0VrI3Db1PMjavwMtj6IELgKdk7l';

const ALLOWED_MIME_TYPES = new Set(['application/pdf']);
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const FIELDS = 'files(id,name,mimeType,modifiedTime,webViewLink,webContentLink)';

const API_KEY = process.env.GOOGLE_API_KEY;
if (!API_KEY) {
  console.error('❌  Saknar miljövariabel GOOGLE_API_KEY');
  console.error('    Sätt den så här:  export GOOGLE_API_KEY="din-nyckel"');
  process.exit(1);
}

// Sektioner — ordningen här bestämmer ordningen på sajten
const SECTION_DEFS = [
  { key: 'styrelseprotokoll', label: 'Styrelseprotokoll', icon: '🗒️' },
  { key: 'arsstamma',         label: 'Årsstämma',         icon: '📋' },
  { key: 'stadgar',           label: 'Stadgar',           icon: '📜' },
  { key: 'ovriga',            label: 'Övriga dokument',   icon: '📎' },
];

function categorizeName(name) {
  const n = name.trim();
  // Matchar både "stämma" (med ä) och "stamma" (utan ä, i äldre filer)
  if (/årsstäm|årsmöt|stämm|stamma/i.test(n))   return 'arsstamma';
  if (/stadg/i.test(n))                          return 'stadgar';
  return 'ovriga';
}

function isYearFolder(name) {
  return /^20\d{2}$/.test(name.trim());
}

function extractYear(name) {
  const m = name.match(/(20\d{2})/);
  return m ? m[1] : null;
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

// Plana PDF:er i en mapp (inte rekursivt)
async function listPdfsFlat(folderId) {
  const entries = await listFolder(folderId);
  return entries.filter((f) => ALLOWED_MIME_TYPES.has(f.mimeType)).map(toDoc);
}

// ---------------------------------------------------------------------------
// Huvudflöde
// ---------------------------------------------------------------------------

// Grupper indexeras per sektion → label, så att vi kan slå ihop t.ex. flera
// olika år-mappar som ger samma "Årsstämma → 2024"
const groupsBySection = {
  styrelseprotokoll: new Map(),
  arsstamma:         new Map(),
  stadgar:           new Map(),
  ovriga:            new Map(),
};

function addToGroup(sectionKey, label, sortKey, files) {
  if (!files || files.length === 0) return;
  const groups = groupsBySection[sectionKey];
  const existing = groups.get(label);
  if (existing) {
    existing.files.push(...files);
  } else {
    groups.set(label, { label, sortKey, files: [...files] });
  }
}

// Filer med "årsstämma"/"årsmöte"/"stämma" i namnet ska hamna under
// Årsstämma-sektionen även om de råkar ligga platt i en år-mapp.
function isArsstammaFilename(filename) {
  return /årsstäm|årsmöt|\bstämma\b|protokoll.*stamma/i.test(filename);
}

async function processYearFolder(yearFolder) {
  const year = yearFolder.name;
  console.log(`  📅 ${year}`);
  const entries = await listFolder(yearFolder.id);

  // Plana PDF:er i år-mappen → dela upp: styrelseprotokoll vs årsstämma (per filnamn)
  const flatPdfs = entries.filter((f) => ALLOWED_MIME_TYPES.has(f.mimeType));
  const styrelseProtokoll = [];
  const arsstammaFiles = [];
  for (const f of flatPdfs) {
    (isArsstammaFilename(f.name) ? arsstammaFiles : styrelseProtokoll).push(toDoc(f));
  }
  if (styrelseProtokoll.length > 0) {
    console.log(`     ${styrelseProtokoll.length} styrelseprotokoll`);
    addToGroup('styrelseprotokoll', year, year, styrelseProtokoll);
  }
  if (arsstammaFiles.length > 0) {
    console.log(`     ${arsstammaFiles.length} årsstämma-fil(er) (per filnamn)`);
    addToGroup('arsstamma', year, year, arsstammaFiles);
  }

  // Undermappar i året
  const subfolders = entries.filter((f) => f.mimeType === FOLDER_MIME);
  for (const sub of subfolders) {
    const subPdfs = await listPdfsFlat(sub.id);
    if (subPdfs.length === 0) continue;

    const cat = categorizeName(sub.name);
    console.log(`     → ${sub.name} (${subPdfs.length} st → ${cat})`);

    if (cat === 'arsstamma') {
      addToGroup('arsstamma', year, year, subPdfs);
    } else if (cat === 'stadgar') {
      addToGroup('stadgar', null, '', subPdfs);
    } else {
      addToGroup('ovriga', `${sub.name} (${year})`, `${year}-${sub.name}`, subPdfs);
    }
  }
}

async function processTopLevelFolder(folder) {
  const cat = categorizeName(folder.name);
  console.log(`  📁 ${folder.name}  →  ${cat}`);
  const pdfs = await listPdfsFlat(folder.id);
  if (pdfs.length === 0) return;

  if (cat === 'arsstamma') {
    const year = extractYear(folder.name) || String(new Date().getFullYear());
    addToGroup('arsstamma', year, year, pdfs);
  } else if (cat === 'stadgar') {
    addToGroup('stadgar', null, '', pdfs);
  } else {
    addToGroup('ovriga', folder.name, folder.name, pdfs);
  }
}

// ---------------------------------------------------------------------------
// Avgifter — synkas separat från en Google Sheet i rot-mappen
// ---------------------------------------------------------------------------

const SHEET_MIME = 'application/vnd.google-apps.spreadsheet';
const AVGIFTER_OUTPUT = resolve(__dirname, '..', 'data', 'avgifter.json');

async function fetchSheetValues(spreadsheetId) {
  // Hämtar alla värden från första bladet (Sheet1 / Blad1).
  // A1-notation utan blad-namn = första bladet.
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1:Z1000?key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sheets API ${res.status}: ${body}`);
  }
  const data = await res.json();
  return data.values || [];
}

function normalizeHeader(h) {
  return (h || '').toLowerCase().trim()
    .replace(/[åä]/g, 'a').replace(/ö/g, 'o')
    .replace(/[^a-z0-9]/g, '');
}

function parseAvgifterSheet(rows) {
  if (!rows || rows.length === 0) return [];
  const headers = rows[0].map(normalizeHeader);
  // Hitta kolumnindex baserat på olika möjliga rubriker
  const findCol = (...candidates) => {
    for (const c of candidates) {
      const i = headers.indexOf(c);
      if (i !== -1) return i;
    }
    return -1;
  };
  const avgiftCol  = findCol('avgift', 'avgiftstyp', 'typ', 'namn', 'beskrivning');
  const beloppCol  = findCol('belopp', 'pris', 'kostnad', 'summa');
  const noteringCol = findCol('notering', 'kommentar', 'info', 'anmarkning');

  if (avgiftCol === -1 || beloppCol === -1) {
    console.warn('  ⚠️  Kunde inte hitta kolumnerna "Avgift" och "Belopp" i Sheeten.');
    console.warn('     Hittade kolumner:', headers);
    return [];
  }

  return rows.slice(1)
    .map((row) => ({
      avgift:  (row[avgiftCol]  || '').trim(),
      belopp:  (row[beloppCol]  || '').trim(),
      notering: noteringCol !== -1 ? (row[noteringCol] || '').trim() : '',
    }))
    .filter((r) => r.avgift && r.belopp);
}

async function syncAvgifter(rootEntries) {
  // Leta efter en Google Sheet i rot-mappen med "avgift" i namnet
  const sheet = rootEntries.find(
    (f) => f.mimeType === SHEET_MIME && /avgift/i.test(f.name)
  );
  if (!sheet) {
    console.log('  (ingen Avgifter-sheet hittades i rot-mappen)');
    return;
  }
  console.log(`💰  Hittade avgifter-sheet: "${sheet.name}"`);
  try {
    const rows = await fetchSheetValues(sheet.id);
    const items = parseAvgifterSheet(rows);
    console.log(`     ${items.length} avgift(er) parsade`);
    const output = {
      lastUpdated: new Date().toISOString(),
      sourceSheet: sheet.name,
      sourceUrl: `https://docs.google.com/spreadsheets/d/${sheet.id}/edit`,
      items,
    };
    await mkdir(dirname(AVGIFTER_OUTPUT), { recursive: true });
    await writeFile(AVGIFTER_OUTPUT, JSON.stringify(output, null, 2) + '\n', 'utf8');
    console.log(`     Skrev ${AVGIFTER_OUTPUT}`);
  } catch (err) {
    console.error(`  ❌  Avgifter-sync misslyckades: ${err.message}`);
  }
}

async function main() {
  console.log(`🔄  Synkar rot-mapp ${ROOT_FOLDER_ID}...`);

  const rootEntries = await listFolder(ROOT_FOLDER_ID);
  const rootFolders = rootEntries.filter((e) => e.mimeType === FOLDER_MIME);
  const rootPdfs    = rootEntries.filter((e) => ALLOWED_MIME_TYPES.has(e.mimeType)).map(toDoc);

  // Avgifter-sync körs parallellt med dokument-sync
  await syncAvgifter(rootEntries);

  // Plana PDF:er direkt i rot-mappen → övriga
  if (rootPdfs.length > 0) {
    addToGroup('ovriga', null, '', rootPdfs);
  }

  for (const folder of rootFolders) {
    try {
      if (isYearFolder(folder.name)) {
        await processYearFolder(folder);
      } else {
        await processTopLevelFolder(folder);
      }
    } catch (err) {
      console.error(`  ❌  Fel på ${folder.name}: ${err.message}`);
    }
  }

  // Bygg slutgiltig struktur
  const sections = SECTION_DEFS
    .map((def) => {
      const groups = Array.from(groupsBySection[def.key].values())
        .sort((a, b) => (b.sortKey || '').localeCompare(a.sortKey || '', 'sv'))
        .map(({ sortKey, ...rest }) => rest);
      return groups.length > 0 ? { ...def, groups } : null;
    })
    .filter(Boolean);

  const result = {
    lastUpdated: new Date().toISOString(),
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
