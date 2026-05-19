/**
 * Ersätter <span data-avgift="nyckel">…</span> med rätt belopp från
 * data/avgifter.json så att vi inte har hårdkodade priser utspridda i HTML:en.
 *
 * Nyckeln matchas mot början av "avgift"-fältet i Sheeten (case-insensitive).
 * Exempel:
 *   <span data-avgift="halvår">1 320 kr</span>
 *   → ersätts med beloppet från raden "Halvårsavgift" i Sheeten.
 */

(async function () {
  const els = document.querySelectorAll('[data-avgift]');
  if (els.length === 0) return;

  let data;
  try {
    const res = await fetch('data/avgifter.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    data = await res.json();
  } catch (err) {
    console.error('dynamic-text: kunde inte ladda avgifter.json', err);
    return;
  }

  const items = data.items || [];

  els.forEach((el) => {
    const key = (el.dataset.avgift || '').toLowerCase().trim();
    if (!key) return;
    const match = items.find((i) => {
      const name = (i.avgift || '').toLowerCase();
      return name.includes(key);
    });
    if (match) {
      el.textContent = match.belopp;
    } else {
      console.warn(`dynamic-text: hittade ingen avgift som matchar "${key}"`);
    }
  });
})();
