/**
 * Renderar ordningsreglerna från data/ordningsregler.json (Google Doc-export).
 *
 * Innehållet kommer från en Google Doc i föreningens Drive — sync-scriptet
 * exporterar dokumentet som HTML och städar bort Google:s strul innan det
 * skrivs till JSON:en. Här renderar vi den städade HTML:en direkt i .prose.
 *
 * Om dokumentet saknas eller är tomt visas ett vänligt meddelande.
 */

(async function () {
  const content = document.getElementById('ordningsregler-content');
  const source = document.getElementById('ordningsregler-source');
  if (!content) return;

  let data;
  try {
    const res = await fetch('data/ordningsregler.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    data = await res.json();
  } catch (err) {
    content.innerHTML = `
      <div class="notice warning">
        <strong>Kunde inte ladda ordningsreglerna.</strong>
        Försök igen senare eller kontakta styrelsen.
      </div>`;
    console.error('ordningsregler: kunde inte ladda data', err);
    return;
  }

  const html = (data.html || '').trim();

  if (!html) {
    content.innerHTML = `
      <p class="text-muted">
        Ordningsreglerna är på väg upp. Skapa ett Google Doc med namnet
        "Ordningsregler" i föreningens Drive-rotmapp så plockas innehållet
        upp automatiskt vid nästa sync.
      </p>`;
    return;
  }

  content.innerHTML = html;

  if (source && data.sourceDoc && data.sourceUrl) {
    source.innerHTML = `
      Källa: ${esc(data.sourceDoc)} —
      <a href="${esc(data.sourceUrl)}" target="_blank" rel="noopener">visa originaldokument i Google Docs</a>.
    `;
  }

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
})();
