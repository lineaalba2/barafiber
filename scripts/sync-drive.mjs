/**
 * sync-drive.mjs
 *
 * Hämtar fil-listor från Bara Fibers tre delade Google Drive-mappar
 * (styrelsemöten, årsmöten, stadgar) och skriver resultatet till
 * data/documents.json så att hemsidan kan rendera dem statiskt.
 *
 * Mapparna måste vara delade som "Anyone with the link" så att API-nyckeln
 * (vid Drive API) eller service-account-tokenen får läsa dem.
 *
 * Körs via GitHub Action en gång om dygnet (se .github/workflows/sync-drive.yml).
 *
 * Kräver miljövariabel:
 *   GOOGLE_API_KEY  – en Google Drive API-nyckel (Cloud Console → Credentials)
 *
 * Mapp-ID:n definieras nedan i FOLDERS-objektet och kan ändras vid behov.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = resolve(__dirname, '..', 'data', 'documents.json');

const FOLDERS = {
  styrelsemoten: {
    id: '1pq8waIbTCp8DGmXCiOlCQjgygof7pbyq',
    nested: true, // har undermappar per år
  },
  arsmoten: {
    id: '1Ui1LI3jZXGYHdzFZRNIZ_zsvNeptIjz0',
    nested: true,
  },
  stadgar: {
    id: '1_dF2UwerSVCUpS8jC97LPM_YRoxbrJ-e',
    nested: false, // platt mapp
  },
};

const API_KEY = process.env.GOOGLE_API_KEY;
if (!API_KEY) {
  console.error('❌  Saknar miljövariabel GOOGLE_API_KEY');
  process.exit(1);
}

const FIELDS = 'files(id,name,mimeType,modifiedTime,webViewLink,webContentLink)';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

async function listFolder(folderId) {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${encodeURIComponent(FIELDS)}&pageSize=1000&orderBy=name&key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Drive API ${res.status}: ${body}`);
  }
  const data = await res.json();
  return data.files || [];
}

function extractYear(name) {
  const match = name.match(/(20\d{2}|19\d{2})/);
  return match ? match[1] : 'Övrigt';
}

async function syncNested(folderId) {
  const entries = await listFolder(folderId);
  const yearFolders = entries.filter((e) => e.mimeType === FOLDER_MIME);
  const looseFiles = entries.filter((e) => e.mimeType !== FOLDER_MIME);

  const byYear = {};

  for (const yearFolder of yearFolders) {
    const year = extractYear(yearFolder.name) || yearFolder.name;
    const files = await listFolder(yearFolder.id);
    const docs = files
      .filter((f) => f.mimeType !== FOLDER_MIME)
      .map(toDoc);
    if (docs.length > 0) {
      byYear[year] = (byYear[year] || []).concat(docs);
    }
  }

  for (const f of looseFiles) {
    const year = extractYear(f.name);
    byYear[year] = byYear[year] || [];
    byYear[year].push(toDoc(f));
  }

  return byYear;
}

async function syncFlat(folderId) {
  const files = await listFolder(folderId);
  return files
    .filter((f) => f.mimeType !== FOLDER_MIME)
    .map(toDoc);
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

async function main() {
  console.log('🔄  Synkar Google Drive-mappar...');

  const result = {
    lastUpdated: new Date().toISOString(),
  };

  for (const [key, cfg] of Object.entries(FOLDERS)) {
    console.log(`  → ${key} (${cfg.id})`);
    try {
      result[key] = cfg.nested
        ? await syncNested(cfg.id)
        : await syncFlat(cfg.id);
      const count = countDocs(result[key]);
      console.log(`     ${count} dokument`);
    } catch (err) {
      console.error(`  ❌  Misslyckades med ${key}:`, err.message);
      result[key] = cfg.nested ? {} : [];
    }
  }

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(result, null, 2) + '\n', 'utf8');
  console.log(`✅  Skrev ${OUTPUT_PATH}`);
}

function countDocs(node) {
  if (Array.isArray(node)) return node.length;
  return Object.values(node).reduce((sum, arr) => sum + (arr?.length || 0), 0);
}

main().catch((err) => {
  console.error('💥  Sync misslyckades:', err);
  process.exit(1);
});
