/**
 * Renders avgifter from data/avgifter.json.
 *
 * Datan synkas automatiskt från Google Sheet:en "Avgifter" i föreningens
 * Drive — uppdaterar styrelsen Sheeten så ändras sajten nästa dygn.
 */

(async function () {
  const el = document.getElementById('avgifter-table');
  if (!el) return;

  let data;
  try {
    const res = await fetch('data/avgifter.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    data = await res.json();
  } catch (err) {
    el.innerHTML = `
      <div class="notice warning">
        <strong>Kunde inte ladda avgifter.</strong> Visar inget — kontrollera att Avgifter-Sheeten finns i Drive.
      </div>`;
    console.error('Failed to load avgifter.json:', err);
    return;
  }

  if (!data.items || data.items.length === 0) {
    el.innerHTML = `<p class="text-muted">Avgifter laddas in från Google Sheet inom kort.</p>`;
    return;
  }

  const hasNotering = data.items.some((i) => i.notering);

  const rows = data.items.map((item) => `
    <tr>
      <td><strong>${escapeHtml(item.avgift)}</strong></td>
      <td>${escapeHtml(item.belopp)}</td>
      ${hasNotering ? `<td class="text-muted" style="font-size:0.9375rem;">${escapeHtml(item.notering)}</td>` : ''}
    </tr>
  `).join('');

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
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
})();
