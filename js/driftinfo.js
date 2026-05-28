/**
 * Renderar driftinformation-banner på förstasidan från data/driftinfo.json.
 *
 * Datan kommer från Driftinfo-Sheet:en i Drive med två kolumner: Nyckel | Värde
 * Nycklar som används:
 *  - rubrik     — om tom: ingen banner visas alls
 *  - text       — brödtext (radbrytningar bevaras)
 *  - uppdaterad — t.ex. "28 maj kl 17:01" (valfri)
 *
 * För att aktivera: skriv en rubrik i Sheeten.
 * För att inaktivera: töm rubrik-cellen.
 */

(async function () {
  const container = document.getElementById('driftinfo');
  if (!container) return;

  let data;
  try {
    const res = await fetch('data/driftinfo.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    data = await res.json();
  } catch (err) {
    // Tyst fail — om filen saknas så syns inget banner
    console.warn('driftinfo: kunde inte ladda data/driftinfo.json', err);
    return;
  }

  const v = data.values || {};
  const rubrik = (v.rubrik || '').trim();
  const text = (v.text || '').trim();
  const uppdaterad = (v.uppdaterad || '').trim();

  // Ingen rubrik → inget banner
  if (!rubrik) return;

  container.innerHTML = `
    <section class="driftinfo-banner">
      <div class="container">
        <div class="driftinfo-card">
          <div class="driftinfo-icon" aria-hidden="true">⚠️</div>
          <div class="driftinfo-content">
            <div class="driftinfo-label">Driftinformation</div>
            <h2>${esc(rubrik)}</h2>
            <p>${formatText(text)}</p>
            ${uppdaterad ? `<p class="driftinfo-updated">Senast uppdaterad: ${esc(uppdaterad)}</p>` : ''}
          </div>
        </div>
      </div>
    </section>
  `;

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatText(s) {
    // Bevara radbrytningar från Sheets
    return esc(s).replace(/\n/g, '<br>');
  }
})();
