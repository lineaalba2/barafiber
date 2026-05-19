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
    footnote.textContent = `Uppgifter från ${data.lastUpdated}.`;
  }
})();
