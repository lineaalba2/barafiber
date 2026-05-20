/**
 * Renders avgifter from data/avgifter.json into elements with id:
 *  - #avgifter-table         → vanlig avgiftstabell (alla utom TV-paket)
 *  - #tv-paket-table         → TV-paket som jämförelsetabell
 *  - eller med data-kategori="X" → endast rader med den kategorin
 *
 * Datan synkas automatiskt från Google Sheet:en "Avgifter" i Drive.
 */

(async function () {
  const generalEl = document.getElementById('avgifter-table');
  const tvPaketEl = document.getElementById('tv-paket-table');
  if (!generalEl && !tvPaketEl) return;

  let data;
  try {
    const res = await fetch('data/avgifter.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    data = await res.json();
  } catch (err) {
    showError(generalEl);
    showError(tvPaketEl);
    console.error('Failed to load avgifter.json:', err);
    return;
  }

  const items = Array.isArray(data.items) ? data.items : [];

  if (generalEl) {
    const exclude = (generalEl.dataset.exclude || 'TV-paket').toLowerCase();
    const filtered = items.filter(
      (i) => (i.kategori || '').toLowerCase() !== exclude
    );
    renderStandardTable(generalEl, filtered);
  }

  if (tvPaketEl) {
    const filtered = items.filter(
      (i) => (i.kategori || '').toLowerCase() === 'tv-paket'
    );
    renderTvPaketTable(tvPaketEl, filtered);
  }

  // -------------------------------------------------------------------------

  function renderStandardTable(el, rows) {
    if (rows.length === 0) {
      el.innerHTML = `<p class="text-muted">Avgifter laddas in från Google Sheet inom kort.</p>`;
      return;
    }
    const hasNotering = rows.some((r) => r.notering);
    el.innerHTML = `
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Avgift</th>
              <th>Belopp</th>
              ${hasNotering ? '<th>Notering</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${rows.map((r) => `
              <tr>
                <td><strong>${esc(r.avgift)}</strong></td>
                <td>${esc(r.belopp)}</td>
                ${hasNotering ? `<td class="text-muted" style="font-size:0.9375rem;">${esc(r.notering)}</td>` : ''}
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function renderTvPaketTable(el, rows) {
    if (rows.length === 0) {
      el.innerHTML = `<p class="text-muted">TV-paketinformation laddas in inom kort.</p>`;
      return;
    }
    const hasOrdinarie = rows.some((r) => r.ordinariePris);
    el.innerHTML = `
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Paket</th>
              <th>Medlemspris</th>
              ${hasOrdinarie ? '<th>Ordinarie pris</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${rows.map((r) => `
              <tr>
                <td><strong>${esc(r.avgift)}</strong></td>
                <td>${esc(r.belopp)}</td>
                ${hasOrdinarie ? `<td class="text-muted">${esc(r.ordinariePris)}</td>` : ''}
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function showError(el) {
    if (!el) return;
    el.innerHTML = `
      <div class="notice warning">
        <strong>Kunde inte ladda avgifter.</strong> Kontrollera att Avgifter-Sheeten finns i Drive.
      </div>`;
  }

  // Normalisera belopp till konsekvent format:
  //  - "1 290 kr" → "1290 kr"  (ta bort tusen-separator-mellanslag mellan siffror)
  //  - "60kr"     → "60 kr"    (lägg till mellanslag före 'kr')
  //  - "60 kr"    → "60 kr"    (oförändrad)
  // Whitespace-klassen täcker vanligt mellanslag, non-breaking space och
  // thin space (allt som Sheets kan auto-formatera in).
  function normalizeAmount(s) {
    return String(s || '')
      .replace(/(\d)[\s  ](\d)/g, '$1$2')
      .replace(/(\d)[\s  ](\d)/g, '$1$2')
      .replace(/(\d)(kr)\b/gi, '$1 $2');
  }

  function esc(s) {
    return String(normalizeAmount(s))
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
})();
