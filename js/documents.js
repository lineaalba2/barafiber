/**
 * Renders documents from data/documents.json into the #documents container.
 *
 * Förväntar sig följande struktur (genereras av scripts/sync-drive.mjs):
 * {
 *   "lastUpdated": "2026-05-19T...",
 *   "sections": [
 *     {
 *       "key": "styrelseprotokoll",
 *       "label": "Styrelseprotokoll",
 *       "icon": "🗒️",
 *       "groups": [
 *         { "label": "2025", "files": [...] },
 *         { "label": "2024", "files": [...] }
 *       ]
 *     }
 *   ]
 * }
 *
 * Varje grupp (år) renderas som en <details>-sektion som kan fällas ut/ihop.
 * Senaste året är öppet som default.
 */

(async function () {
  const container = document.getElementById('documents');
  if (!container) return;

  const formatDate = (iso) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('sv-SE', {
        year: 'numeric', month: 'short', day: 'numeric',
      });
    } catch {
      return '';
    }
  };

  let data;
  try {
    const res = await fetch('data/documents.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    data = await res.json();
  } catch (err) {
    container.innerHTML = `
      <div class="doc-error">
        <strong>Kunde inte ladda dokumentlistan.</strong><br>
        <span class="text-muted">Försök igen senare eller besök föreningens Google Drive direkt.</span>
      </div>`;
    console.error('Failed to load documents.json:', err);
    return;
  }

  container.innerHTML = '';

  if (data.lastUpdated) {
    const info = document.createElement('p');
    info.className = 'text-muted';
    info.style.fontSize = '0.875rem';
    info.style.marginBottom = '1.5rem';
    info.innerHTML = `Senast uppdaterad: <strong>${formatDate(data.lastUpdated)}</strong>`;
    container.appendChild(info);
  }

  const sections = Array.isArray(data.sections) ? data.sections : [];

  if (sections.length === 0) {
    container.insertAdjacentHTML('beforeend', `
      <div class="doc-empty">
        <strong>Inga dokument hittades.</strong><br>
        <span class="text-muted">
          Dokumentlistan synkas regelbundet från föreningens Google Drive.
          Saknas en mapp eller fil? Kontrollera att den ligger i rätt mapp och är PDF-format.
        </span>
      </div>`);
    return;
  }

  sections.forEach((section) => {
    const sectionEl = document.createElement('div');
    sectionEl.className = 'doc-category';

    const heading = document.createElement('h3');
    heading.innerHTML = `<span>${section.icon || '📁'}</span> ${section.label}`;
    sectionEl.appendChild(heading);

    section.groups.forEach((group, idx) => {
      if (!group.files || group.files.length === 0) return;

      if (group.label) {
        // Fällbar år-grupp
        const details = document.createElement('details');
        details.className = 'doc-year';
        if (idx === 0) details.open = true; // senaste året öppet som default

        const summary = document.createElement('summary');
        summary.className = 'doc-year-summary';

        const left = document.createElement('span');
        left.className = 'doc-year-label';
        left.textContent = group.label;

        const count = document.createElement('span');
        count.className = 'doc-year-count';
        count.textContent = `${group.files.length} dokument`;

        summary.appendChild(left);
        summary.appendChild(count);
        details.appendChild(summary);
        details.appendChild(renderFileList(group.files));
        sectionEl.appendChild(details);
      } else {
        sectionEl.appendChild(renderFileList(group.files));
      }
    });

    container.appendChild(sectionEl);
  });

  // Hämtar datum YYYY-MM-DD ur filnamn för stabil sortering
  function dateKey(name) {
    const m = name.match(/(20\d{2})[-_ .]?(\d{2})[-_ .]?(\d{2})/);
    return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
  }

  function renderFileList(files) {
    const ul = document.createElement('ul');
    ul.className = 'doc-list';
    files
      .slice()
      .sort((a, b) => {
        // Sortera i åldersordning (äldst först) baserat på datum i filnamnet,
        // fallback till modifiedTime om filnamnet saknar datum.
        const ka = dateKey(a.name) || a.modifiedTime || '';
        const kb = dateKey(b.name) || b.modifiedTime || '';
        return ka.localeCompare(kb);
      })
      .forEach((f) => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.className = 'doc-item';
        a.href = f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`;
        a.target = '_blank';
        a.rel = 'noopener';

        // Använd <div> istället för <span> så att flex-layouten alltid funkar
        const icon = document.createElement('div');
        icon.className = 'doc-icon';
        icon.textContent = '📄';

        const info = document.createElement('div');
        info.className = 'doc-info';
        const name = document.createElement('div');
        name.className = 'doc-name';
        // Strip .pdf-ändelse för renare visning
        name.textContent = f.name.replace(/\.pdf$/i, '');
        info.appendChild(name);

        if (f.modifiedTime) {
          const meta = document.createElement('div');
          meta.className = 'doc-meta';
          meta.textContent = formatDate(f.modifiedTime);
          info.appendChild(meta);
        }

        const arrow = document.createElement('div');
        arrow.className = 'doc-arrow';
        arrow.textContent = '↗';

        a.appendChild(icon);
        a.appendChild(info);
        a.appendChild(arrow);
        li.appendChild(a);
        ul.appendChild(li);
      });
    return ul;
  }
})();
