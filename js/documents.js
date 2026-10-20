/**
 * Renders documents from data/documents.json into the #documents container.
 *
 * Förväntar sig följande struktur (genereras av scripts/sync-drive.mjs):
 * {
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
 * Senaste året visas utfällt; övriga år ligger bakom knappen "Äldre år".
 */

(async function () {
  const container = document.getElementById('documents');
  if (!container) return;

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

  sections.forEach((section, sectionIdx) => {
    const sectionEl = document.createElement('div');
    sectionEl.className = 'doc-category';

    const heading = document.createElement('h3');
    heading.innerHTML = `<span>${section.icon || '📁'}</span> ${section.label}`;
    sectionEl.appendChild(heading);

    const groups = (section.groups || []).filter((g) => g.files && g.files.length > 0);

    // Äldre årgrupper göms bakom en knapp. Med tio år per sektion blir
    // sidan annars onödigt lång och man måste scrolla förbi alla årsrubriker
    // för att nå nästa sektion.
    const older = document.createElement('div');
    older.className = 'doc-older';
    older.id = `doc-older-${section.key || sectionIdx}`;
    older.hidden = true;

    groups.forEach((group, idx) => {
      if (!group.label) {
        sectionEl.appendChild(renderFileList(group.files));
        return;
      }
      // Senaste året visas och är utfällt, resten hamnar bakom knappen.
      const details = renderYearGroup(group, idx === 0);
      (idx === 0 ? sectionEl : older).appendChild(details);
    });

    const hiddenCount = older.childElementCount;
    if (hiddenCount > 0) {
      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'doc-older-toggle';
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-controls', older.id);

      const syncLabel = () => {
        const expanded = toggle.getAttribute('aria-expanded') === 'true';
        toggle.textContent = expanded
          ? 'Dölj äldre år'
          : `Äldre år (${hiddenCount})`;
      };
      syncLabel();

      toggle.addEventListener('click', () => {
        const expanded = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', String(!expanded));
        older.hidden = expanded;
        syncLabel();
      });

      sectionEl.appendChild(toggle);
      sectionEl.appendChild(older);
    }

    container.appendChild(sectionEl);
  });

  // Bygger en fällbar årsgrupp (<details>) för ett år.
  function renderYearGroup(group, open) {
    const details = document.createElement('details');
    details.className = 'doc-year';
    details.open = Boolean(open);

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
    return details;
  }

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
        // Strip filändelser för renare visning. Dokument som exporterats
        // från Word får ofta dubbel ändelse ("...2024.docx.pdf"), så vi
        // plockar bort både .pdf och ett eventuellt .docx/.doc/.odt bakom.
        name.textContent = f.name
          .replace(/\.pdf$/i, '')
          .replace(/\.(docx?|odt)$/i, '');
        info.appendChild(name);

        // Datum visas inte längre under filnamn — redundant eftersom filerna
        // grupperas per år (rubriken) och filnamnet ofta innehåller datumet.

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
