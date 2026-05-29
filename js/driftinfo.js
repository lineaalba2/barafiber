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
  const synligTill = (v.synlig_till || '').trim();

  // Ingen rubrik → inget banner
  if (!rubrik) return;

  // Om synlig_till är satt (YYYY-MM-DD) och dagens datum är efter det → göm banner
  if (synligTill) {
    const m = synligTill.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const expiry = new Date(`${synligTill}T00:00:00`);
      if (today > expiry) {
        console.info(`driftinfo: synlig_till (${synligTill}) har passerats — banner döljs.`);
        return;
      }
    } else {
      console.warn(`driftinfo: synlig_till "${synligTill}" har fel format. Använd YYYY-MM-DD.`);
    }
  }

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
