/**
 * Renders documents from data/documents.json into the #documents container.
 *
 * Förväntar sig följande struktur (genereras av scripts/sync-drive.mjs):
 * {
 *   "lastUpdated": "2026-05-19T...",
 *   "sourceFolder": "https://drive.google.com/...",
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

  // Header: senast uppdaterad + länk till Drive
  if (data.lastUpdated || data.sourceFolder) {
    const info = document.createElement('p');
    info.className = 'text-muted';
    info.style.fontSize = '0.875rem';
    info.style.marginBottom = '1.5rem';
    const parts = [];
    if (data.lastUpdated) {
      parts.push(`Senast uppdaterad från Google Drive: <strong>${formatDate(data.lastUpdated)}</strong>`);
    }
    if (data.sourceFolder) {
      parts.push(`<a href="${data.sourceFolder}" target="_blank" rel="noopener">Öppna mappen i Drive ↗</a>`);
    }
    info.innerHTML = parts.join(' &nbsp;·&nbsp; ');
    container.appendChild(info);
  }

  const sections = Array.isArray(data.sections) ? data.sections : [];

  if (sections.length === 0) {
    container.insertAdjacentHTML('beforeend', `
      <div class="doc-empty">
        <strong>Inga dokument hittades.</strong><br>
        <span class="text-muted">
          Dokumentlistan synkas dagligen från föreningens Google Drive.
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

    section.groups.forEach((group) => {
      if (!group.files || group.files.length === 0) return;

      if (group.label) {
        const yearWrap = document.createElement('div');
        yearWrap.className = 'doc-year';
        const yearLabel = document.createElement('div');
        yearLabel.className = 'doc-year-label';
        yearLabel.textContent = group.label;
        yearWrap.appendChild(yearLabel);
        yearWrap.appendChild(renderFileList(group.files));
        sectionEl.appendChild(yearWrap);
      } else {
        sectionEl.appendChild(renderFileList(group.files));
      }
    });

    container.appendChild(sectionEl);
  });

  function renderFileList(files) {
    const ul = document.createElement('ul');
    ul.className = 'doc-list';
    files
      .slice()
      .sort((a, b) => (b.modifiedTime || '').localeCompare(a.modifiedTime || ''))
      .forEach((f) => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.className = 'doc-item';
        a.href = f.webViewLink || `https://drive.google.com/file/d/${f.id}/view`;
        a.target = '_blank';
        a.rel = 'noopener';

        const icon = document.createElement('span');
        icon.className = 'doc-icon';
        icon.textContent = '📄';

        const info = document.createElement('span');
        info.className = 'doc-info';
        const name = document.createElement('span');
        name.className = 'doc-name';
        // Strip .pdf-ändelse för renare visning
        name.textContent = f.name.replace(/\.pdf$/i, '');
        info.appendChild(name);

        if (f.modifiedTime) {
          const meta = document.createElement('span');
          meta.className = 'doc-meta';
          meta.textContent = formatDate(f.modifiedTime);
          info.appendChild(meta);
        }

        const arrow = document.createElement('span');
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
