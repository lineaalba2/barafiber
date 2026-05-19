/**
 * Renders styrelse + revisorer + valberedning från data/styrelse.json.
 *
 * Uppdateras manuellt efter varje årsstämma — se data/styrelse.json
 * för instruktioner.
 */

(async function () {
  const styrelseEl    = document.getElementById('styrelse-list');
  const revisorerEl   = document.getElementById('revisorer-list');
  const valberedEl    = document.getElementById('valberedning-list');
  if (!styrelseEl && !revisorerEl && !valberedEl) return;

  let data;
  try {
    const res = await fetch('data/styrelse.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    data = await res.json();
  } catch (err) {
    console.error('Kunde inte ladda styrelse.json:', err);
    return;
  }

  function memberCard(role, name, term) {
    const card = document.createElement('div');
    card.className = 'board-member';
    if (role) {
      const roleEl = document.createElement('div');
      roleEl.className = 'board-member-role';
      roleEl.textContent = role;
      card.appendChild(roleEl);
    }
    const nameEl = document.createElement('div');
    nameEl.className = 'board-member-name';
    nameEl.textContent = name;
    card.appendChild(nameEl);
    if (term) {
      const termEl = document.createElement('div');
      termEl.style.fontSize = '0.8125rem';
      termEl.style.color = 'var(--color-text-muted)';
      termEl.style.marginTop = '0.25rem';
      termEl.textContent = `Mandat ${term}`;
      card.appendChild(termEl);
    }
    return card;
  }

  // Styrelsen
  if (styrelseEl) {
    styrelseEl.innerHTML = '';
    (data.ordforande || []).forEach((m) => styrelseEl.appendChild(memberCard('Ordförande', m.name, m.term)));
    (data.ledamoter  || []).forEach((m) => styrelseEl.appendChild(memberCard('Ledamot',    m.name, m.term)));
    (data.suppleanter|| []).forEach((m) => styrelseEl.appendChild(memberCard('Suppleant',  m.name, m.term)));
  }

  // Revisorer
  if (revisorerEl) {
    revisorerEl.innerHTML = '';
    (data.revisorer || []).forEach((m) => {
      revisorerEl.appendChild(memberCard(m.role || 'Revisor', m.name, m.term));
    });
  }

  // Valberedning (uppdatera även om sidan redan har hårdkodade namn)
  if (valberedEl) {
    valberedEl.innerHTML = '';
    (data.valberedning || []).forEach((m) => {
      valberedEl.appendChild(memberCard('Valberedningen', m.name, m.term));
    });
  }

  // Footer-info (vilket protokoll uppgifterna kommer från)
  const footnote = document.getElementById('styrelse-footnote');
  if (footnote && data.lastUpdated) {
    // Om lastUpdated är ett ISO-datum (från Sheet-sync), formatera till
    // svensk kort form. Annars (manuellt fritext-värde) visa som det är.
    const iso = data.lastUpdated;
    const d = new Date(iso);
    const isValidIso = !isNaN(d.getTime()) && /\d{4}-\d{2}-\d{2}/.test(iso);
    const formatted = isValidIso
      ? d.toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' })
      : iso;
    footnote.textContent = `Uppgifter från ${formatted}.`;
  }
})();
