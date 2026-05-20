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

const ROOT_FOLDER_ID = '1tXZ30C7zSx5G757Yj26j_yi3Y4ZsRKXp';

const ALLOWED_MIME_TYPES = new Set(['application/pdf']);
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const SHORTCUT_MIME = 'application/vnd.google-apps.shortcut';
const FIELDS = 'files(id,name,mimeType,modifiedTime,webViewLink,webContentLink,shortcutDetails)';

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

// Genvägar i Drive har egen mimeType. Resolva till den faktiska
// måldatans mimeType och ID så att vi behandlar dem som filen de pekar på.
function effectiveMimeType(f) {
  if (f.mimeType === SHORTCUT_MIME && f.shortcutDetails?.targetMimeType) {
    return f.shortcutDetails.targetMimeType;
  }
  return f.mimeType;
}

function effectiveId(f) {
  if (f.mimeType === SHORTCUT_MIME && f.shortcutDetails?.targetId) {
    return f.shortcutDetails.targetId;
  }
  return f.id;
}

function toDoc(f) {
  return {
    id: effectiveId(f),
    name: f.name,
    mimeType: effectiveMimeType(f),
    modifiedTime: f.modifiedTime,
    webViewLink: f.webViewLink,
    webContentLink: f.webContentLink,
  };
}

// Plana PDF:er i en mapp (inte rekursivt). Genvägar till PDF:er
// räknas som PDF:er.
async function listPdfsFlat(folderId) {
  const entries = await listFolder(folderId);
  return entries.filter((f) => ALLOWED_MIME_TYPES.has(effectiveMimeType(f))).map(toDoc);
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

// Mappar namngivna som datum (t.ex. "2026-01-13") representerar
// ett specifikt styrelsemöte med PDF:er, dagordning, bilagor inuti.
function isDateFolderName(name) {
  return /^20\d{2}[-_./]\d{2}[-_./]\d{2}/.test(name.trim());
}

// I en datum-mapp vill vi visa den signerade PDF:en om den finns,
// annars den huvudsakliga styrelseprotokoll-PDF:en. Inte alla bilagor.
function pickProtokollFromDateFolder(pdfs) {
  if (pdfs.length === 0) return [];
  const signed = pdfs.find((f) => /_sign\.pdf$/i.test(f.name));
  if (signed) return [signed];
  const styrelseprotokoll = pdfs.find((f) => /^styrelseprotokoll/i.test(f.name));
  if (styrelseprotokoll) return [styrelseprotokoll];
  // Fallback: visa alla
  return pdfs;
}

async function processYearFolder(yearFolder) {
  const year = yearFolder.name;
  console.log(`  📅 ${year}`);
  const entries = await listFolder(yearFolder.id);

  // Plana PDF:er i år-mappen → dela upp: styrelseprotokoll vs årsstämma (per filnamn)
  // (inkluderar genvägar till PDF)
  const flatPdfs = entries.filter((f) => ALLOWED_MIME_TYPES.has(effectiveMimeType(f)));
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
    if (subPdfs.length === 0) {
      console.log(`     → ${sub.name} (tom enligt API — kontrollera sharing-permissions)`);
      continue;
    }

    // Datum-mappar (t.ex. "2026-01-13") = en mapp per styrelsemöte
    if (isDateFolderName(sub.name)) {
      const filesToAdd = pickProtokollFromDateFolder(subPdfs);
      console.log(`     → ${sub.name} (${filesToAdd.length}/${subPdfs.length} PDF → styrelseprotokoll)`);
      addToGroup('styrelseprotokoll', year, year, filesToAdd);
      continue;
    }

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
const STYRELSE_OUTPUT = resolve(__dirname, '..', 'data', 'styrelse.json');
const INNEHALL_OUTPUT = resolve(__dirname, '..', 'data', 'innehall.json');

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
  const avgiftCol    = findCol('avgift', 'avgiftstyp', 'typ', 'namn', 'beskrivning', 'paket');
  const beloppCol    = findCol('belopp', 'pris', 'kostnad', 'summa', 'medlemspris');
  const noteringCol  = findCol('notering', 'kommentar', 'info', 'anmarkning');
  const kategoriCol  = findCol('kategori', 'sektion', 'grupp');
  const ordinarieCol = findCol('ordinariepris', 'ordinariepriss', 'ordinarie', 'jamforpris', 'fullprice');

  if (avgiftCol === -1 || beloppCol === -1) {
    console.warn('  ⚠️  Kunde inte hitta kolumnerna "Avgift" och "Belopp" i Sheeten.');
    console.warn('     Hittade kolumner:', headers);
    return [];
  }

  return rows.slice(1)
    .map((row) => ({
      avgift:        (row[avgiftCol]    || '').trim(),
      belopp:        (row[beloppCol]    || '').trim(),
      notering:      noteringCol  !== -1 ? (row[noteringCol]  || '').trim() : '',
      kategori:      kategoriCol  !== -1 ? (row[kategoriCol]  || '').trim() : '',
      ordinariePris: ordinarieCol !== -1 ? (row[ordinarieCol] || '').trim() : '',
    }))
    .filter((r) => r.avgift && r.belopp);
}

function parseStyrelseSheet(rows) {
  if (!rows || rows.length === 0) return null;
  const headers = rows[0].map(normalizeHeader);
  const findCol = (...candidates) => {
    for (const c of candidates) {
      const i = headers.indexOf(c);
      if (i !== -1) return i;
    }
    return -1;
  };
  const rollCol   = findCol('roll', 'befattning', 'position', 'typ');
  const namnCol   = findCol('namn', 'name');
  const mandatCol = findCol('mandat', 'period', 'mandattid', 'term', 'mandatperiod');

  if (rollCol === -1 || namnCol === -1) {
    console.warn('  ⚠️  Kunde inte hitta kolumnerna "Roll" och "Namn" i Styrelse-Sheeten.');
    console.warn('     Hittade kolumner:', headers);
    return null;
  }

  const grupperat = {
    ordforande:   [],
    ledamoter:    [],
    suppleanter:  [],
    revisorer:    [],
    valberedning: [],
  };

  for (const row of rows.slice(1)) {
    const roll   = (row[rollCol]   || '').trim();
    const namn   = (row[namnCol]   || '').trim();
    const mandat = mandatCol !== -1 ? (row[mandatCol] || '').trim() : '';
    if (!roll || !namn) continue;

    const rl = roll.toLowerCase();
    const entry = { name: namn, term: mandat };

    if (rl.includes('ordför'))         grupperat.ordforande.push(entry);
    else if (rl.includes('ledamot'))   grupperat.ledamoter.push(entry);
    else if (rl.includes('suppleant')) grupperat.suppleanter.push(entry);
    else if (rl.includes('revisor'))   grupperat.revisorer.push({ name: namn, role: roll, term: mandat });
    else if (rl.includes('valbered'))  grupperat.valberedning.push(entry);
    else console.warn(`  ⚠️  Okänd roll: "${roll}" (rad med ${namn})`);
  }

  return grupperat;
}

async function syncStyrelse(rootEntries) {
  // Leta efter en Google Sheet i rot-mappen med "styrelse" i namnet
  const sheet = rootEntries.find(
    (f) => f.mimeType === SHEET_MIME && /styrelse/i.test(f.name)
  );
  if (!sheet) {
    console.log('  (ingen Styrelse-sheet hittades i rot-mappen)');
    return;
  }
  console.log(`👥  Hittade styrelse-sheet: "${sheet.name}"`);
  try {
    const rows = await fetchSheetValues(sheet.id);
    const parsed = parseStyrelseSheet(rows);
    if (!parsed) return;

    const total = parsed.ordforande.length + parsed.ledamoter.length
      + parsed.suppleanter.length + parsed.revisorer.length + parsed.valberedning.length;
    console.log(`     ${total} personer parsade (${parsed.ordforande.length} ordförande, ${parsed.ledamoter.length} ledamöter, ${parsed.suppleanter.length} suppleanter, ${parsed.revisorer.length} revisorer, ${parsed.valberedning.length} valberedning)`);

    const output = {
      lastUpdated: new Date().toISOString(),
      sourceSheet: sheet.name,
      sourceUrl: `https://docs.google.com/spreadsheets/d/${sheet.id}/edit`,
      ...parsed,
    };
    await mkdir(dirname(STYRELSE_OUTPUT), { recursive: true });
    await writeFile(STYRELSE_OUTPUT, JSON.stringify(output, null, 2) + '\n', 'utf8');
    console.log(`     Skrev ${STYRELSE_OUTPUT}`);
  } catch (err) {
    console.error(`  ❌  Styrelse-sync misslyckades: ${err.message}`);
  }
}

function parseInnehallSheet(rows) {
  if (!rows || rows.length === 0) return {};
  const headers = rows[0].map(normalizeHeader);
  const findCol = (...candidates) => {
    for (const c of candidates) {
      const i = headers.indexOf(c);
      if (i !== -1) return i;
    }
    return -1;
  };
  const nyckelCol = findCol('nyckel', 'key', 'namn', 'id');
  const vardeCol  = findCol('varde', 'value', 'innehall', 'text');

  if (nyckelCol === -1 || vardeCol === -1) {
    console.warn('  ⚠️  Kunde inte hitta "Nyckel" och "Värde" i Innehåll-Sheeten.');
    console.warn('     Hittade kolumner:', headers);
    return {};
  }

  const out = {};
  for (const row of rows.slice(1)) {
    const nyckel = (row[nyckelCol] || '').trim();
    const varde  = (row[vardeCol]  || '').trim();
    if (!nyckel || !varde) continue;
    out[nyckel] = varde;
  }
  return out;
}

async function syncInnehall(rootEntries) {
  const sheet = rootEntries.find(
    (f) => f.mimeType === SHEET_MIME && /innehåll|innehall|övrigt|ovrigt/i.test(f.name)
  );
  if (!sheet) {
    console.log('  (ingen Innehåll-sheet hittades i rot-mappen)');
    return;
  }
  console.log(`📝  Hittade innehåll-sheet: "${sheet.name}"`);
  try {
    const rows = await fetchSheetValues(sheet.id);
    const parsed = parseInnehallSheet(rows);
    const count = Object.keys(parsed).length;
    console.log(`     ${count} nyckel/värde-par parsade`);
    const output = {
      lastUpdated: new Date().toISOString(),
      sourceSheet: sheet.name,
      sourceUrl: `https://docs.google.com/spreadsheets/d/${sheet.id}/edit`,
      values: parsed,
    };
    await mkdir(dirname(INNEHALL_OUTPUT), { recursive: true });
    await writeFile(INNEHALL_OUTPUT, JSON.stringify(output, null, 2) + '\n', 'utf8');
    console.log(`     Skrev ${INNEHALL_OUTPUT}`);
  } catch (err) {
    console.error(`  ❌  Innehåll-sync misslyckades: ${err.message}`);
  }
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
  const rootPdfs    = rootEntries.filter((e) => ALLOWED_MIME_TYPES.has(effectiveMimeType(e))).map(toDoc);

  // Avgifter, styrelse, innehåll synkas från Sheets i rot-mappen
  await syncAvgifter(rootEntries);
  await syncStyrelse(rootEntries);
  await syncInnehall(rootEntries);

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
