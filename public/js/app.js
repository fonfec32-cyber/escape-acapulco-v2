const socket = io();

// ── Reconnexion automatique après scan QR ────────────────────────────────────
function saveSession() {
  if (state.teamName) {
    sessionStorage.setItem('acapulco_session', JSON.stringify({
      teamName: state.teamName, playerName: state.playerName || '',
      teamColor: state.teamColor, teamEmoji: state.teamEmoji
    }));
  }
}

function restoreSession() {
  const saved = sessionStorage.getItem('acapulco_session');
  if (!saved) return;
  try {
    const s = JSON.parse(saved);
    if (s.teamName) {
      socket.emit('join-team', { playerName: s.playerName || 'Agent', teamName: s.teamName });
    }
  } catch(e) {}
}

socket.on('connect', () => { restoreSession(); });

let state = {
  teamName: '', playerName: '', teamColor: '#e8b84b', teamEmoji: '',
  currentEnigma: null, history: [], viewingIndex: -1,
  selectedOption: null, padlockValues: [0,0,0,0], padlock3Values: [0,0,0],
  vaultStep: 0, hintVisible: false
};

// ── Timer ────────────────────────────────────────────────────────────────────
let timerInterval = null;

function startClientTimer(remaining) {
  if (timerInterval) clearInterval(timerInterval);
  let ms = remaining;
  updateTimerDisplay(ms);
  timerInterval = setInterval(() => {
    ms -= 1000;
    if (ms <= 0) { ms = 0; clearInterval(timerInterval); }
    updateTimerDisplay(ms);
  }, 1000);
}

function updateTimerDisplay(ms) {
  const el = document.getElementById('timer-display');
  if (!el) return;
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60).toString().padStart(2, '0');
  const sec = (totalSec % 60).toString().padStart(2, '0');
  el.textContent = `${min}:${sec}`;
  if (totalSec <= 300) { el.style.color = '#e53e3e'; el.style.animation = 'pulse 1s infinite'; }
  else if (totalSec <= 600) { el.style.color = '#e8b84b'; el.style.animation = 'none'; }
  else { el.style.color = '#9aa0b0'; el.style.animation = 'none'; }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ── Rejoindre ─────────────────────────────────────────────────────────────────
document.getElementById('btn-join').addEventListener('click', () => {
  const name = document.getElementById('input-name').value.trim();
  const team = document.getElementById('input-team').value;
  if (!name || !team) { alert('Veuillez saisir votre prénom et choisir une brigade.'); return; }
  state.playerName = name;
  socket.emit('join-team', { playerName: name, teamName: team });
});

socket.on('joined', ({ teamName, color, emoji }) => {
  state.teamName = teamName; state.teamColor = color; state.teamEmoji = emoji;
  document.getElementById('wait-team').innerHTML = `${emoji} Brigade ${teamName}`;
  document.getElementById('wait-team').style.color = color;
  saveSession();
  show('screen-waiting');
});

socket.on('game-start', ({ remaining }) => {
  startClientTimer(remaining);
});

socket.on('timer-update', ({ remaining }) => {
  updateTimerDisplay(remaining);
});

socket.on('enigma', (data) => {
  state.currentEnigma = data.enigma;
  state.vaultStep = 0; state.hintVisible = false;
  state.selectedOption = null; state.padlockValues = [0,0,0,0]; state.padlock3Values = [0,0,0];
  if (!state.history.find(e => e.id === data.enigma.id)) state.history.push(data.enigma);
  state.viewingIndex = -1;
  renderEnigma(data.enigma, data.progress, data.total);
  show('screen-enigma');
});

// ── Navigation ────────────────────────────────────────────────────────────────
document.getElementById('btn-prev').addEventListener('click', () => {
  const maxIdx = state.history.length - 1;
  if (state.viewingIndex === -1) state.viewingIndex = maxIdx - 1;
  else if (state.viewingIndex > 0) state.viewingIndex--;
  renderEnigma(state.history[state.viewingIndex], null, null, true);
  updateNavBtns();
});

document.getElementById('btn-next').addEventListener('click', () => {
  if (state.viewingIndex < state.history.length - 1) {
    state.viewingIndex++;
    renderEnigma(state.history[state.viewingIndex], null, null, true);
  } else {
    state.viewingIndex = -1;
    renderEnigma(state.currentEnigma, null, null, false);
  }
  updateNavBtns();
});

function updateNavBtns() {
  document.getElementById('btn-prev').disabled = (state.history.length <= 1 && state.viewingIndex === -1) || state.viewingIndex === 0;
  document.getElementById('btn-next').disabled = state.viewingIndex === -1;
}

// ── Rendu ─────────────────────────────────────────────────────────────────────
function renderEnigma(enigma, progress, total, readonly = false) {
  if (!enigma) return;
  if (progress !== null && total !== null) {
    document.getElementById('header-progress').textContent = `Étape ${progress + 1}/${total}`;
    document.getElementById('progress-fill').style.width = `${(progress / total) * 100}%`;
    document.getElementById('header-phase').textContent = enigma.phase || '';
    document.getElementById('header-dot').style.background = state.teamColor;
  }
  document.getElementById('enigma-num').textContent = `ÉTAPE ${enigma.id} / 23`;
  document.getElementById('enigma-title').textContent = enigma.title;
  const content = document.getElementById('enigma-content');
  content.innerHTML = '';
  const renderers = {
    qcm: renderQcm, code: renderCode, anagram: renderAnagram,
    padlock: renderPadlock, padlock3: renderPadlock3,
    intrus: renderCode, map: renderMap, mapphoto: renderMapPhoto,
    gps: renderGps, wordsearch: renderWordSearch,
    qrcode: renderQr, puzzle: renderPuzzle, riddle: renderRiddle,
    vault: renderVault, final: renderFinal
  };
  (renderers[enigma.type] || renderCode)(content, enigma, readonly);
  updateNavBtns();
}

// ── QCM ───────────────────────────────────────────────────────────────────────
function renderQcm(el, enigma, readonly) {
  el.appendChild(makeText(enigma.text));
  const grid = document.createElement('div');
  grid.className = 'options-grid';
  const letters = ['A','B','C','D'];
  enigma.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.innerHTML = `<span class="option-letter">${letters[i]}</span>${opt}`;
    if (!readonly) {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected'); state.selectedOption = opt;
      });
    } else btn.disabled = true;
    grid.appendChild(btn);
  });
  el.appendChild(grid);
  if (!readonly) el.appendChild(makeSubmitBtn(() => { if (state.selectedOption) submitAnswer(enigma.id, state.selectedOption); }));
}

// ── Code ──────────────────────────────────────────────────────────────────────
function renderCode(el, enigma, readonly) {
  el.appendChild(makeText(enigma.text));
  if (!readonly) {
    const inp = makeAnswerInput(enigma.id);
    el.appendChild(inp.wrap);
    el.appendChild(makeSubmitBtn(() => { const v = inp.input.value.trim(); if (v) submitAnswer(enigma.id, v, null, inp.input); }));
  }
}

// ── Anagramme ─────────────────────────────────────────────────────────────────
function renderAnagram(el, enigma, readonly) {
  el.appendChild(makeText(enigma.text));
  const letters = document.createElement('div');
  letters.className = 'letters-display';
  letters.textContent = enigma.letters;
  el.appendChild(letters);
  if (!readonly) {
    if (enigma.hintButton) {
      const hintBox = document.createElement('div');
      hintBox.className = 'hint-box'; hintBox.style.display = 'none';
      const hintBtn = document.createElement('button');
      hintBtn.className = 'btn-hint'; hintBtn.style.cssText = 'margin-bottom:12px;width:100%';
      hintBtn.textContent = '💡 Voir l\'indice';
      hintBtn.addEventListener('click', () => { hintBox.textContent = enigma.hint; hintBox.style.display = 'block'; hintBtn.style.display = 'none'; });
      el.appendChild(hintBox); el.appendChild(hintBtn);
    }
    const inp = makeAnswerInput(enigma.id);
    el.appendChild(inp.wrap);
    el.appendChild(makeSubmitBtn(() => { const v = inp.input.value.trim(); if (v) submitAnswer(enigma.id, v, null, inp.input); }));
  }
}

// ── GPS ───────────────────────────────────────────────────────────────────────
function renderGps(el, enigma, readonly) {
  el.appendChild(makeText(enigma.text));
  const box = document.createElement('div');
  box.style.cssText = 'text-align:center;padding:16px;background:var(--bg3);border:1px solid var(--border);border-radius:2px;margin-bottom:16px';
  box.innerHTML = `
    <div style="font-size:36px;margin-bottom:10px">📍</div>
    <div style="font-family:var(--mono);font-size:20px;letter-spacing:4px;color:var(--accent);margin-bottom:8px">8FQ6XP9V+GP</div>
    <div style="font-size:12px;color:var(--text2)">Copiez ce code dans Google Maps → activez Street View</div>
    <a href="https://maps.google.com/?q=8FQ6XP9V%2BGP" target="_blank"
       style="display:inline-block;margin-top:12px;padding:8px 20px;background:var(--accent);color:#0a0c0f;font-family:var(--head);font-size:12px;font-weight:600;letter-spacing:2px;text-decoration:none;border-radius:2px">
      Ouvrir dans Maps
    </a>`;
  el.appendChild(box);
  if (!readonly) {
    const inp = makeAnswerInput(enigma.id);
    inp.input.placeholder = 'NUMÉRO DE VOIRIE…';
    el.appendChild(inp.wrap);
    el.appendChild(makeSubmitBtn(() => { const v = inp.input.value.trim(); if (v) submitAnswer(enigma.id, v, null, inp.input); }));
  }
}

// ── Carte photo (plan quadrillé) ──────────────────────────────────────────────
function renderMapPhoto(el, enigma, readonly) {
  el.appendChild(makeText(enigma.text));
  const img = document.createElement('img');
  img.src = enigma.mapImage;
  img.alt = 'Plan quadrillé du secteur';
  img.style.cssText = 'width:100%;border-radius:2px;border:1px solid var(--border);margin-bottom:16px;display:block';
  el.appendChild(img);
  if (!readonly) {
    const inp = makeAnswerInput(enigma.id);
    inp.input.placeholder = 'EX: B2';
    el.appendChild(inp.wrap);
    el.appendChild(makeSubmitBtn(() => { const v = inp.input.value.trim(); if (v) submitAnswer(enigma.id, v, null, inp.input); }));
  }
}

// ── Carte SVG ─────────────────────────────────────────────────────────────────
function renderMap(el, enigma, readonly) {
  el.appendChild(makeText(enigma.text));
  const mapWrap = document.createElement('div');
  mapWrap.style.cssText = 'background:#0d1014;border:1px solid var(--border);border-radius:2px;padding:12px;margin-bottom:16px;text-align:center';
  mapWrap.innerHTML = `
    <svg viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:320px">
      <rect width="320" height="200" fill="#111318"/>
      <line x1="0" y1="100" x2="320" y2="100" stroke="#2a2f3a" stroke-width="6"/>
      <line x1="160" y1="0" x2="160" y2="200" stroke="#2a2f3a" stroke-width="4"/>
      <rect x="50" y="70" width="80" height="60" rx="4" fill="rgba(56,161,105,0.2)" stroke="#38a169" stroke-width="1.5"/>
      <text x="90" y="95" font-family="monospace" font-size="7" fill="#38a169" text-anchor="middle">Parc de</text>
      <text x="90" y="105" font-family="monospace" font-size="7" fill="#38a169" text-anchor="middle">Bordelan</text>
      <line x1="82" y1="117" x2="98" y2="133" stroke="#e53e3e" stroke-width="3" stroke-linecap="round"/>
      <line x1="98" y1="117" x2="82" y2="133" stroke="#e53e3e" stroke-width="3" stroke-linecap="round"/>
      <text x="300" y="185" font-family="monospace" font-size="9" fill="#5a6070">N↑</text>
    </svg>`;
  el.appendChild(mapWrap);
  if (!readonly) {
    const inp = makeAnswerInput(enigma.id);
    el.appendChild(inp.wrap);
    el.appendChild(makeSubmitBtn(() => { const v = inp.input.value.trim(); if (v) submitAnswer(enigma.id, v, null, inp.input); }));
  }
}

// ── Cadenas 4 chiffres ────────────────────────────────────────────────────────
function renderPadlock(el, enigma, readonly) {
  el.appendChild(makeText(enigma.text));
  el.appendChild(makePadlockUI(4, state.padlockValues, readonly));
  if (!readonly) el.appendChild(makeSubmitBtn(() => submitAnswer(enigma.id, state.padlockValues.join(''))));
}

// ── Cadenas 3 chiffres ────────────────────────────────────────────────────────
function renderPadlock3(el, enigma, readonly) {
  el.appendChild(makeText(enigma.text));
  el.appendChild(makePadlockUI(3, state.padlock3Values, readonly));
  if (!readonly) el.appendChild(makeSubmitBtn(() => submitAnswer(enigma.id, state.padlock3Values.join(''))));
}

function makePadlockUI(digits, valArr, readonly) {
  const display = document.createElement('div');
  display.className = 'padlock-display';
  for (let i = 0; i < digits; i++) {
    const col = document.createElement('div'); col.className = 'padlock-digit';
    const up = document.createElement('button'); up.textContent = '▲';
    const valEl = document.createElement('div'); valEl.className = 'padlock-digit-val'; valEl.textContent = '0';
    const down = document.createElement('button'); down.textContent = '▼';
    if (!readonly) {
      up.addEventListener('click', () => { valArr[i] = (valArr[i] + 1) % 10; valEl.textContent = valArr[i]; });
      down.addEventListener('click', () => { valArr[i] = (valArr[i] + 9) % 10; valEl.textContent = valArr[i]; });
    } else { up.disabled = true; down.disabled = true; }
    col.appendChild(up); col.appendChild(valEl); col.appendChild(down);
    display.appendChild(col);
  }
  return display;
}


// ── Puzzle scellé judiciaire ──────────────────────────────────────────────────
function renderPuzzle(el, enigma, readonly) {
  el.appendChild(makeText(enigma.text));

  // Les 6 fragments dans leur ordre AFFICHÉ (mélangé) : position affichée → numéro imprimé dessus
  // Ordre logique correct (haut→bas) : 3-6-1-4-2-5
  // Affiché dans cet ordre : fragment n°3, n°6, n°1, n°4, n°2, n°5
  // Mais on affiche les fragments dans cet ordre visuel : 5,2,6,1,3,4
  // avec leurs numéros imprimés dessus
  const fragments = [
    { num: 5, svg: scelleSVG(5) },
    { num: 2, svg: scelleSVG(2) },
    { num: 6, svg: scelleSVG(6) },
    { num: 1, svg: scelleSVG(1) },
    { num: 3, svg: scelleSVG(3) },
    { num: 4, svg: scelleSVG(4) },
  ];

  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:16px;';

  fragments.forEach(f => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;border:1px solid var(--border);overflow:hidden;';
    const numBadge = document.createElement('div');
    numBadge.style.cssText = 'position:absolute;top:4px;left:4px;z-index:2;background:#e53e3e;color:white;font-family:var(--mono);font-size:13px;font-weight:bold;width:24px;height:24px;display:flex;align-items:center;justify-content:center;border-radius:2px;';
    numBadge.textContent = f.num;
    wrap.innerHTML = f.svg;
    wrap.appendChild(numBadge);
    grid.appendChild(wrap);
  });

  el.appendChild(grid);

  if (!readonly) {
    const inp = makeAnswerInput(enigma.id);
    inp.input.placeholder = 'EX : 3-1-5-2-6-4';
    el.appendChild(inp.wrap);
    el.appendChild(makeSubmitBtn(() => {
      const v = inp.input.value.trim();
      if (v) submitAnswer(enigma.id, v, null, inp.input);
    }));
  }
}

function scelleSVG(fragment) {
  // Scellé judiciaire complet divisé en 6 bandes horizontales
  // viewBox total : 0 0 300 540 → chaque fragment = 90px de haut
  const h = 90;
  const y = (fragment - 1) * h;
  return `<svg viewBox="0 ${y} 300 ${h}" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block">
    <!-- Fond sac plastique -->
    <rect x="0" y="0" width="300" height="540" fill="#e8e8e0"/>
    <!-- Liseré gauche/droit -->
    <rect x="0" y="0" width="8" height="540" fill="#c8c8b8"/>
    <rect x="292" y="0" width="8" height="540" fill="#c8c8b8"/>

    <!-- ZONE 1 : En-tête haut (y=0 à y=90) -->
    <!-- Titre SCELLE JUDICIAIRE -->
    <text x="150" y="28" font-family="Arial,sans-serif" font-size="13" font-weight="bold" fill="#1a1a1a" text-anchor="middle" letter-spacing="1">SCELLÉ JUDICIAIRE N°</text>
    <!-- Numéro code barres style -->
    <rect x="90" y="38" width="120" height="22" rx="2" fill="white" stroke="#aaa" stroke-width="0.5"/>
    <text x="150" y="54" font-family="monospace" font-size="12" font-weight="bold" fill="#1a1a1a" text-anchor="middle" letter-spacing="2">00175955</text>
    <!-- Petits traits code-barres décoratifs -->
    <line x1="90" y1="38" x2="90" y2="60" stroke="#555" stroke-width="1.5"/>
    <line x1="95" y1="38" x2="95" y2="60" stroke="#555" stroke-width="0.5"/>
    <line x1="98" y1="38" x2="98" y2="60" stroke="#555" stroke-width="1"/>
    <line x1="103" y1="38" x2="103" y2="60" stroke="#555" stroke-width="0.5"/>
    <line x1="200" y1="38" x2="200" y2="60" stroke="#555" stroke-width="1"/>
    <line x1="205" y1="38" x2="205" y2="60" stroke="#555" stroke-width="0.5"/>
    <line x1="208" y1="38" x2="208" y2="60" stroke="#555" stroke-width="1.5"/>
    <!-- Textes latéraux rotatifs simulés -->
    <text x="4" y="70" font-family="Arial,sans-serif" font-size="5" fill="#999" transform="rotate(-90,4,70)">SCELLÉ JUDICIAIRE</text>

    <!-- ZONE 2 : Bandeau rouge NE PAS OUVRIR (y=90 à y=180) -->
    <rect x="8" y="90" width="284" height="50" fill="#cc1111"/>
    <text x="150" y="120" font-family="Arial,sans-serif" font-size="9" font-weight="bold" fill="white" text-anchor="middle" letter-spacing="2">NE PAS OUVRIR — SCELLÉ JUDICIAIRE — NE PAS OUVRIR</text>
    <!-- Numéro sur bandeau -->
    <rect x="8" y="140" width="284" height="40" fill="#d4d4c4"/>
    <text x="230" y="163" font-family="monospace" font-size="11" font-weight="bold" fill="#cc1111" text-anchor="middle">00175955</text>

    <!-- ZONE 3 : Tableau formulaire partie haute (y=180 à y=270) -->
    <!-- Fond formulaire -->
    <rect x="20" y="185" width="260" height="80" fill="white" stroke="#888" stroke-width="0.5"/>
    <!-- Lignes internes -->
    <line x1="20" y1="205" x2="280" y2="205" stroke="#888" stroke-width="0.5"/>
    <line x1="110" y1="185" x2="110" y2="265" stroke="#888" stroke-width="0.5"/>
    <!-- Labels -->
    <text x="25" y="198" font-family="Arial,sans-serif" font-size="6" fill="#333">SCELLÉ N°</text>
    <text x="115" y="193" font-family="Arial,sans-serif" font-size="5.5" fill="#333">PARQUET N°</text>
    <text x="115" y="201" font-family="Arial,sans-serif" font-size="5.5" fill="#333">INSTRUCTION N°</text>
    <text x="115" y="209" font-family="Arial,sans-serif" font-size="5.5" fill="#333">DATE DE L'AUDITION</text>
    <!-- Valeurs -->
    <text x="25" y="220" font-family="monospace" font-size="7" font-weight="bold" fill="#cc1111">PM-2025-114</text>
    <text x="115" y="225" font-family="monospace" font-size="6" fill="#333">17/05/2025</text>
    <!-- 2ème ligne tableau -->
    <line x1="20" y1="240" x2="280" y2="240" stroke="#888" stroke-width="0.5"/>
    <text x="150" y="252" font-family="Arial,sans-serif" font-size="6" fill="#333" text-anchor="middle">NATURE DE L'INFRACTION</text>
    <text x="150" y="260" font-family="Arial,sans-serif" font-size="6" fill="#555" text-anchor="middle">HOMICIDE VOLONTAIRE — AFFAIRE MOREAU</text>

    <!-- ZONE 4 : Tableau formulaire partie milieu (y=270 à y=360) -->
    <rect x="20" y="270" width="260" height="85" fill="white" stroke="#888" stroke-width="0.5"/>
    <line x1="20" y1="290" x2="280" y2="290" stroke="#888" stroke-width="0.5"/>
    <line x1="107" y1="270" x2="107" y2="355" stroke="#888" stroke-width="0.5"/>
    <line x1="194" y1="270" x2="194" y2="355" stroke="#888" stroke-width="0.5"/>
    <text x="63" y="283" font-family="Arial,sans-serif" font-size="6" fill="#333" text-anchor="middle">TÉMOIN(S)</text>
    <text x="150" y="283" font-family="Arial,sans-serif" font-size="6" fill="#333" text-anchor="middle">PARTIE(S) CIVILE(S)</text>
    <text x="237" y="280" font-family="Arial,sans-serif" font-size="5.5" fill="#333" text-anchor="middle">PERSONNE(S) MISE(S)</text>
    <text x="237" y="288" font-family="Arial,sans-serif" font-size="5.5" fill="#333" text-anchor="middle">EN EXAMEN</text>
    <!-- Noms fictifs -->
    <text x="63" y="320" font-family="Arial,sans-serif" font-size="6" fill="#555" text-anchor="middle">A. PETIT</text>
    <text x="150" y="320" font-family="Arial,sans-serif" font-size="6" fill="#555" text-anchor="middle">—</text>
    <text x="237" y="320" font-family="Arial,sans-serif" font-size="6" fill="#cc1111" text-anchor="middle">EN COURS</text>
    <!-- Ligne nature objet -->
    <line x1="20" y1="340" x2="280" y2="340" stroke="#888" stroke-width="0.5"/>
    <text x="150" y="350" font-family="Arial,sans-serif" font-size="6" fill="#333" text-anchor="middle">NATURE DE L'OBJET — CONTENU DU SCELLÉ</text>

    <!-- ZONE 5 : Signatures + watermark (y=360 à y=450) -->
    <rect x="20" y="360" width="260" height="85" fill="white" stroke="#888" stroke-width="0.5"/>
    <!-- Watermark SJP -->
    <text x="150" y="415" font-family="Arial,sans-serif" font-size="48" font-weight="bold" fill="#e8e8e8" text-anchor="middle" opacity="0.6">SJP</text>
    <!-- Lignes signatures -->
    <line x1="20" y1="380" x2="280" y2="380" stroke="#888" stroke-width="0.5"/>
    <line x1="107" y1="360" x2="107" y2="445" stroke="#888" stroke-width="0.5"/>
    <line x1="194" y1="360" x2="194" y2="445" stroke="#888" stroke-width="0.5"/>
    <text x="30" y="373" font-family="Arial,sans-serif" font-size="5.5" fill="#333">TÉMOIN(S)</text>
    <text x="55" y="373" font-family="Arial,sans-serif" font-size="5.5" fill="#555">(signature)</text>
    <text x="115" y="373" font-family="Arial,sans-serif" font-size="5.5" fill="#333">JUGE D'INSTRUCTION</text>
    <text x="175" y="373" font-family="Arial,sans-serif" font-size="5.5" fill="#555">(signature)</text>
    <text x="200" y="373" font-family="Arial,sans-serif" font-size="5.5" fill="#555">(signature)</text>
    <text x="30" y="400" font-family="Arial,sans-serif" font-size="5.5" fill="#333">PARTIE(S) CIVILE(S)</text>
    <text x="80" y="400" font-family="Arial,sans-serif" font-size="5.5" fill="#555">(signature)</text>
    <text x="30" y="420" font-family="Arial,sans-serif" font-size="5.5" fill="#333">PERSONNE(S) MISE(S) EN EXAMEN</text>
    <text x="30" y="432" font-family="Arial,sans-serif" font-size="5.5" fill="#555">(signature)</text>
    <text x="115" y="410" font-family="Arial,sans-serif" font-size="5.5" fill="#333">GREFFIER</text>
    <text x="148" y="410" font-family="Arial,sans-serif" font-size="5.5" fill="#555">(signature)</text>

    <!-- ZONE 6 : Bas du document (y=450 à y=540) -->
    <rect x="20" y="455" width="260" height="50" fill="white" stroke="#888" stroke-width="0.5"/>
    <text x="150" y="470" font-family="Arial,sans-serif" font-size="6" fill="#333" text-anchor="middle">EMPLACEMENT RÉSERVÉ AU GREFFE</text>
    <text x="150" y="488" font-family="monospace" font-size="6" fill="#666" text-anchor="middle">22 46 07 95 7 (0) 03 + tél</text>
    <text x="150" y="498" font-family="monospace" font-size="6" fill="#666" text-anchor="middle">mac.exploitationtbj-sjp.www</text>
    <!-- Bas : bande inversée POUR OUVRIR -->
    <rect x="8" y="510" width="284" height="25" fill="#d4d4c4"/>
    <text x="150" y="525" font-family="Arial,sans-serif" font-size="7" font-weight="bold" fill="#cc1111" text-anchor="middle">◄ POUR OUVRIR ►</text>
  </svg>`;
}

// ── Grille mots cachés ────────────────────────────────────────────────────────
function renderWordSearch(el, enigma, readonly) {
  el.appendChild(makeText(enigma.text));
  const grid = document.createElement('div');
  grid.className = 'word-grid';
  grid.innerHTML = enigma.grid.map(row => row.split('').join(' ')).join('<br>');
  el.appendChild(grid);
  if (!readonly) {
    const inp = makeAnswerInput(enigma.id);
    el.appendChild(inp.wrap);
    el.appendChild(makeSubmitBtn(() => { const v = inp.input.value.trim(); if (v) submitAnswer(enigma.id, v, null, inp.input); }));
  }
}

// ── QR Code ───────────────────────────────────────────────────────────────────
function renderQr(el, enigma, readonly) {
  const box = document.createElement('div');
  box.className = 'qr-instruction';
  box.innerHTML = `<div class="qr-emoji">📷</div><div class="qr-text">${enigma.text}</div>`;
  el.appendChild(box);
  if (!readonly) {
    const inp = makeAnswerInput(enigma.id);
    inp.input.placeholder = 'ENTREZ LA RÉPONSE TROUVÉE…';
    el.appendChild(inp.wrap);
    el.appendChild(makeSubmitBtn(() => { const v = inp.input.value.trim(); if (v) submitAnswer(enigma.id, v, null, inp.input); }));
  }
}

// ── Riddle ────────────────────────────────────────────────────────────────────
function renderRiddle(el, enigma, readonly) {
  const box = document.createElement('div');
  box.className = 'riddle-box';
  box.textContent = enigma.text;
  el.appendChild(box);
  if (!readonly) {
    const inp = makeAnswerInput(enigma.id);
    el.appendChild(inp.wrap);
    el.appendChild(makeSubmitBtn(() => { const v = inp.input.value.trim(); if (v) submitAnswer(enigma.id, v, null, inp.input); }));
  }
}

// ── Vault ─────────────────────────────────────────────────────────────────────
function renderVault(el, enigma, readonly) {
  el.appendChild(makeText(enigma.text));
  const locks = document.createElement('div'); locks.className = 'vault-locks'; locks.id = 'vault-locks';
  enigma.vaultQuestions.forEach((_, i) => {
    const l = document.createElement('div'); l.className = 'vault-lock'; l.id = `vault-lock-${i}`; l.textContent = '🔒';
    locks.appendChild(l);
  });
  el.appendChild(locks);
  const qWrap = document.createElement('div'); qWrap.id = 'vault-q-wrap';
  el.appendChild(qWrap);
  renderVaultStep(enigma, qWrap, readonly);
}

function renderVaultStep(enigma, wrap, readonly) {
  const step = state.vaultStep;
  if (step >= enigma.vaultQuestions.length) return;
  const vq = enigma.vaultQuestions[step];
  wrap.innerHTML = '';
  const qEl = document.createElement('div'); qEl.className = 'vault-question';
  qEl.textContent = `🔐 Question ${step + 1}/4 — ${vq.q}`;
  wrap.appendChild(qEl);
  if (!readonly) {
    let inputEl;
    if (vq.freeText) {
      const ta = document.createElement('textarea');
      ta.className = 'answer-input'; ta.style.cssText = 'min-height:80px;resize:vertical;letter-spacing:0;font-size:13px';
      ta.placeholder = 'Listez les 10 crus séparés par des virgules…';
      wrap.appendChild(ta); inputEl = ta;
    } else {
      const inp = makeAnswerInput(enigma.id); wrap.appendChild(inp.wrap); inputEl = inp.input;
    }
    const row = document.createElement('div'); row.className = 'action-row';
    const sub = document.createElement('button'); sub.className = 'btn btn-primary'; sub.style.flex = '1';
    sub.textContent = step < enigma.vaultQuestions.length - 1 ? 'Valider — Verrou suivant →' : '🔓 Ouvrir le coffre';
    sub.addEventListener('click', () => { const v = inputEl.value.trim(); if (v) socket.emit('submit-answer', { answer: v, enigmaId: enigma.id, vaultStep: step }); });
    row.appendChild(sub); wrap.appendChild(row);
  }
}

// ── Final ─────────────────────────────────────────────────────────────────────
function renderFinal(el, enigma, readonly) {
  el.appendChild(makeText(enigma.text));
  const locks = document.createElement('div'); locks.className = 'vault-locks'; locks.id = 'vault-locks';
  enigma.finalQuestions.forEach((_, i) => {
    const l = document.createElement('div'); l.className = 'vault-lock'; l.id = `vault-lock-${i}`; l.textContent = '⚖️';
    locks.appendChild(l);
  });
  el.appendChild(locks);
  const qWrap = document.createElement('div'); qWrap.id = 'vault-q-wrap'; el.appendChild(qWrap);
  renderFinalStep(enigma, qWrap, readonly);
}

function renderFinalStep(enigma, wrap, readonly) {
  const step = state.vaultStep;
  if (step >= enigma.finalQuestions.length) return;
  const fq = enigma.finalQuestions[step];
  wrap.innerHTML = '';
  const qEl = document.createElement('div'); qEl.className = 'vault-question';
  qEl.textContent = `⚖️ Question ${step + 1}/3 — ${fq.q}`;
  wrap.appendChild(qEl);
  if (!readonly) {
    const inp = makeAnswerInput(enigma.id); wrap.appendChild(inp.wrap);
    const sub = document.createElement('button'); sub.className = 'btn btn-primary';
    sub.textContent = step < enigma.finalQuestions.length - 1 ? 'Valider →' : '🏆 Clore l\'affaire';
    sub.addEventListener('click', () => { const v = inp.input.value.trim(); if (v) socket.emit('submit-answer', { answer: v, enigmaId: enigma.id, vaultStep: step }); });
    wrap.appendChild(sub);
  }
}

// ── Helpers UI ────────────────────────────────────────────────────────────────
function makeText(text) {
  const el = document.createElement('div'); el.className = 'enigma-text'; el.textContent = text; return el;
}
function makeAnswerInput(enigmaId) {
  const wrap = document.createElement('div'); wrap.className = 'answer-input-wrap';
  const input = document.createElement('input'); input.type = 'text'; input.className = 'answer-input';
  input.placeholder = 'VOTRE RÉPONSE…'; input.autocomplete = 'off'; input.id = `ans-${enigmaId}`;
  wrap.appendChild(input); return { wrap, input };
}
function makeSubmitBtn(onClick) {
  const btn = document.createElement('button'); btn.className = 'btn btn-primary';
  btn.textContent = 'Valider la réponse'; btn.addEventListener('click', onClick); return btn;
}

// ── Soumission ────────────────────────────────────────────────────────────────
function submitAnswer(enigmaId, answer, vaultStep = null, inputEl = null) {
  socket.emit('submit-answer', { answer, enigmaId, vaultStep });
}

socket.on('correct-answer', () => { show('screen-correct'); setTimeout(() => show('screen-enigma'), 1800); });

socket.on('wrong-answer', ({ enigmaId }) => {
  const inp = document.getElementById(`ans-${enigmaId}`);
  if (inp) { inp.classList.add('wrong'); setTimeout(() => inp.classList.remove('wrong'), 600); inp.value = ''; inp.focus(); }
  if (state.viewingIndex !== -1) { state.viewingIndex = -1; renderEnigma(state.currentEnigma, null, null, false); }
});

socket.on('vault-step-ok', ({ step, total }) => {
  const lock = document.getElementById(`vault-lock-${step}`);
  if (lock) { lock.textContent = '🔓'; lock.classList.add('open'); }
  state.vaultStep = step + 1;
  const wrap = document.getElementById('vault-q-wrap');
  if (wrap && state.currentEnigma) {
    if (state.currentEnigma.type === 'vault') renderVaultStep(state.currentEnigma, wrap, false);
    else if (state.currentEnigma.type === 'final') renderFinalStep(state.currentEnigma, wrap, false);
  }
});

socket.on('hint', ({ text }) => {
  const box = document.getElementById('hint-global');
  if (box) { box.textContent = text; box.classList.add('visible'); }
});

socket.on('game-won', ({ rankings }) => {
  if (timerInterval) clearInterval(timerInterval);
  document.getElementById('won-team').textContent = `${state.teamEmoji} Brigade ${state.teamName}`;
  document.getElementById('won-team').style.color = state.teamColor;
  const rankEl = document.getElementById('won-rankings'); rankEl.innerHTML = '';
  if (rankings?.length > 0) {
    const title = document.createElement('div');
    title.style.cssText = 'font-family:var(--mono);font-size:10px;letter-spacing:2px;color:var(--text3);margin-bottom:10px;text-transform:uppercase';
    title.textContent = 'Classement des brigades'; rankEl.appendChild(title);
    rankings.forEach((r, i) => {
      const row = document.createElement('div'); row.className = 'ranking-row';
      row.innerHTML = `<span class="ranking-pos">${['🥇','🥈','🥉'][i]||i+1}</span><span>${r.teamName}</span><span style="margin-left:auto;font-size:11px;color:var(--text3)">${r.time}</span>`;
      rankEl.appendChild(row);
    });
  }
  show('screen-won');
});

// ── BOMBE ─────────────────────────────────────────────────────────────────────
socket.on('game-exploded', () => {
  if (timerInterval) clearInterval(timerInterval);
  show('screen-exploded');
  // Animation bombe
  let count = 0;
  const flash = setInterval(() => {
    document.getElementById('screen-exploded').style.background = count % 2 === 0 ? '#e53e3e' : '#0a0c0f';
    count++;
    if (count > 6) { clearInterval(flash); document.getElementById('screen-exploded').style.background = '#0a0c0f'; }
  }, 200);
});

socket.on('game-reset', () => {
  if (timerInterval) clearInterval(timerInterval);
  state = { teamName:'', teamColor:'#e8b84b', teamEmoji:'', currentEnigma:null, history:[], viewingIndex:-1, selectedOption:null, padlockValues:[0,0,0,0], padlock3Values:[0,0,0], vaultStep:0, hintVisible:false };
  show('screen-join');
});
