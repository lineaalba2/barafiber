/**
 * Ersätter dynamiska textfält med värden från Sheets.
 *
 *  <span data-avgift="halvår">1 320 kr</span>
 *      → matchas mot data/avgifter.json (rader med "halvår" i avgift-namnet)
 *      → fältet "belopp" från första matchande rad används
 *
 *  <span data-text="antal_hushåll">723</span>
 *      → matchas mot data/innehall.json (key/value-par från Innehåll-Sheeten)
 *      → exakt nyckel-match
 *
 * Båda är säkra fallbacks: om värdet inte hittas behålls det som står i HTML.
 */

(async function () {
  const avgiftEls  = document.querySelectorAll('[data-avgift]');
  const textEls    = document.querySelectorAll('[data-text]');
  if (avgiftEls.length === 0 && textEls.length === 0) return;

  const [avgifter, innehall] = await Promise.all([
    avgiftEls.length > 0 ? loadJson('data/avgifter.json') : null,
    textEls.length   > 0 ? loadJson('data/innehall.json') : null,
  ]);

  if (avgifter) {
    const items = avgifter.items || [];
    avgiftEls.forEach((el) => {
      const key = (el.dataset.avgift || '').toLowerCase().trim();
      if (!key) return;
      const match = items.find((i) =>
        (i.avgift || '').toLowerCase().includes(key)
      );
      if (match) {
        el.textContent = match.belopp;
      } else {
        console.warn(`dynamic-text: hittade ingen avgift som matchar "${key}"`);
      }
    });
  }

  if (innehall) {
    const values = innehall.values || {};
    textEls.forEach((el) => {
      const key = (el.dataset.text || '').trim();
      if (!key) return;
      if (values[key] !== undefined) {
        el.textContent = values[key];
      } else {
        console.warn(`dynamic-text: hittade ingen innehållsnyckel "${key}"`);
      }
    });
  }

  async function loadJson(path) {
    try {
      const res = await fetch(path, { cache: 'no-cache' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (err) {
      console.error(`dynamic-text: kunde inte ladda ${path}`, err);
      return null;
    }
  }
})();
