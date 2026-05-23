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
  if (!readonly) el.appendChild(makeSubmitBtn(() => {
    const sel = el.querySelector('.option-btn.selected');
    if (sel) { const opt = sel.textContent.replace(/^[A-D]/, '').trim(); submitAnswer(enigma.id, opt); }
    else if (state.selectedOption) submitAnswer(enigma.id, state.selectedOption);
  }));
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
    inp.input.placeholder = 'COORDONNÉES DE ZONE…';
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


// ── Mémo judiciaire ──────────────────────────────────────────────────────────
function renderPuzzle(el, enigma, readonly) {
  el.appendChild(makeText(enigma.text));

  const svgIcons = {
    badge: `<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg" width="48" height="48">
      <polygon points="30,3 34,13 46,10 41,21 52,27 41,33 46,44 34,41 30,51 26,41 14,44 19,33 8,27 19,21 14,10 26,13" fill="#e8b84b" stroke="#c4982d" stroke-width="1.5"/>
      <circle cx="30" cy="27" r="10" fill="#1a2030" stroke="#e8b84b" stroke-width="1.5"/>
      <text x="30" y="24" font-family="Arial" font-size="5" font-weight="bold" fill="#e8b84b" text-anchor="middle">POLICE</text>
      <text x="30" y="31" font-family="Arial" font-size="7" font-weight="bold" fill="#e8b84b" text-anchor="middle">PM</text>
      <text x="30" y="38" font-family="Arial" font-size="4" fill="#c4982d" text-anchor="middle">★ ★ ★</text>
    </svg>`,
    menottes: `<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg" width="48" height="48">
      <circle cx="17" cy="30" r="11" fill="none" stroke="#c0c0c0" stroke-width="3.5"/>
      <circle cx="17" cy="30" r="6" fill="none" stroke="#c0c0c0" stroke-width="2"/>
      <circle cx="43" cy="30" r="11" fill="none" stroke="#c0c0c0" stroke-width="3.5"/>
      <circle cx="43" cy="30" r="6" fill="none" stroke="#c0c0c0" stroke-width="2"/>
      <rect x="26" y="27" width="8" height="6" rx="1" fill="#b0b0b0"/>
      <line x1="23" y1="30" x2="26" y2="30" stroke="#c0c0c0" stroke-width="3"/>
      <line x1="34" y1="30" x2="37" y2="30" stroke="#c0c0c0" stroke-width="3"/>
      <rect x="13" y="17" width="8" height="5" rx="1" fill="none" stroke="#c0c0c0" stroke-width="1.5"/>
      <rect x="39" y="17" width="8" height="5" rx="1" fill="none" stroke="#c0c0c0" stroke-width="1.5"/>
    </svg>`,
    pistolet: `<svg viewBox="0 0 70 60" xmlns="http://www.w3.org/2000/svg" width="54" height="46">
      <rect x="28" y="19" width="36" height="8" rx="1.5" fill="#4a4a4a"/>
      <rect x="62" y="20" width="4" height="6" rx="0.5" fill="#333"/>
      <rect x="60" y="16" width="3" height="4" rx="0.5" fill="#777"/>
      <rect x="24" y="17" width="38" height="12" rx="2" fill="#3a3a3a" stroke="#555" stroke-width="0.8"/>
      <line x1="26" y1="21" x2="60" y2="21" stroke="#222" stroke-width="1.5"/>
      <line x1="26" y1="26" x2="60" y2="26" stroke="#222" stroke-width="1.5"/>
      <line x1="52" y1="18" x2="52" y2="28" stroke="#555" stroke-width="1"/>
      <line x1="55" y1="18" x2="55" y2="28" stroke="#555" stroke-width="1"/>
      <line x1="58" y1="18" x2="58" y2="28" stroke="#555" stroke-width="1"/>
      <path d="M10 27 L24 27 L24 29 L28 29 L28 17 L24 17 L24 27" fill="#444"/>
      <rect x="10" y="27" width="18" height="4" rx="0" fill="#444"/>
      <path d="M10 31 L22 31 L20 53 Q19 56 16 56 L12 56 Q9 56 9 53 Z" fill="#5a3520" stroke="#3a2010" stroke-width="0.8"/>
      <line x1="11" y1="35" x2="20" y2="35" stroke="#3a2010" stroke-width="0.6" opacity="0.7"/>
      <line x1="11" y1="39" x2="19" y2="39" stroke="#3a2010" stroke-width="0.6" opacity="0.7"/>
      <line x1="11" y1="43" x2="19" y2="43" stroke="#3a2010" stroke-width="0.6" opacity="0.7"/>
      <line x1="11" y1="47" x2="18" y2="47" stroke="#3a2010" stroke-width="0.6" opacity="0.7"/>
      <rect x="11" y="43" width="9" height="12" rx="1" fill="#3a3a3a" stroke="#222" stroke-width="0.5"/>
      <path d="M16 31 Q18 37 16 43" fill="none" stroke="#888" stroke-width="2" stroke-linecap="round"/>
      <path d="M12 31 Q16 41 22 31" fill="none" stroke="#555" stroke-width="1.5"/>
      <text x="38" y="25" font-family="Arial" font-size="4" fill="#666" text-anchor="middle">PM-9</text>
    </svg>`,
    talkie: `<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg" width="48" height="48">
      <rect x="18" y="8" width="24" height="44" rx="4" fill="#2a2a3a" stroke="#4a4a5a" stroke-width="1.5"/>
      <rect x="20" y="10" width="20" height="12" rx="2" fill="#1a3a2a" stroke="#38a169" stroke-width="1"/>
      <text x="30" y="19" font-family="monospace" font-size="6" fill="#38a169" text-anchor="middle">────</text>
      <rect x="21" y="25" width="18" height="3" rx="1" fill="#e8b84b"/>
      <circle cx="25" cy="34" r="2.5" fill="#e53e3e"/>
      <circle cx="30" cy="34" r="2.5" fill="#4a4a5a"/>
      <circle cx="35" cy="34" r="2.5" fill="#38a169"/>
      <rect x="22" y="40" width="16" height="8" rx="2" fill="#1a1a2a" stroke="#3a3a4a" stroke-width="1"/>
      <line x1="24" y1="43" x2="36" y2="43" stroke="#3a3a4a" stroke-width="1"/>
      <line x1="24" y1="46" x2="36" y2="46" stroke="#3a3a4a" stroke-width="1"/>
      <rect x="24" y="4" width="12" height="6" rx="2" fill="#333" stroke="#4a4a5a" stroke-width="1"/>
    </svg>`,
    gyrophare: `<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg" width="48" height="48">
      <rect x="16" y="36" width="28" height="10" rx="3" fill="#222"/>
      <ellipse cx="30" cy="30" rx="14" ry="10" fill="#cc1111"/>
      <ellipse cx="30" cy="30" rx="10" ry="7" fill="#e53e3e"/>
      <ellipse cx="30" cy="30" rx="6" ry="4" fill="white" opacity="0.9"/>
      <ellipse cx="30" cy="30" rx="3" ry="2" fill="#e8b84b"/>
      <line x1="30" y1="20" x2="22" y2="12" stroke="#e53e3e" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
      <line x1="30" y1="20" x2="38" y2="12" stroke="#e53e3e" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
      <line x1="16" y1="30" x2="8" y2="30" stroke="#e53e3e" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
      <line x1="44" y1="30" x2="52" y2="30" stroke="#e53e3e" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
      <rect x="20" y="44" width="20" height="5" rx="2" fill="#111"/>
    </svg>`,
    voiture: `<svg viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg" width="48" height="48">
      <rect x="6" y="30" width="48" height="18" rx="4" fill="#1a2a4a"/>
      <path d="M12 30 L16 18 L44 18 L48 30 Z" fill="#1a2a4a"/>
      <rect x="18" y="20" width="10" height="8" rx="1" fill="#b8d4f4" opacity="0.8"/>
      <rect x="32" y="20" width="10" height="8" rx="1" fill="#b8d4f4" opacity="0.8"/>
      <circle cx="16" cy="48" r="5" fill="#222" stroke="#555" stroke-width="1.5"/>
      <circle cx="16" cy="48" r="2" fill="#444"/>
      <circle cx="44" cy="48" r="5" fill="#222" stroke="#555" stroke-width="1.5"/>
      <circle cx="44" cy="48" r="2" fill="#444"/>
      <rect x="6" y="32" width="48" height="3" fill="#e8b84b" opacity="0.7"/>
      <rect x="7" y="33" width="6" height="4" rx="1" fill="#e53e3e" opacity="0.9"/>
      <rect x="47" y="33" width="6" height="4" rx="1" fill="#e53e3e" opacity="0.9"/>
      <rect x="20" y="35" width="20" height="5" rx="1" fill="#1a3a6a"/>
      <text x="30" y="39.5" font-family="Arial" font-size="4" font-weight="bold" fill="white" text-anchor="middle">POLICE</text>
    </svg>`
  };

  const iconList = [
    { key:'badge', label:'Badge' },
    { key:'menottes', label:'Menottes' },
    { key:'pistolet', label:'Pistolet' },
    { key:'talkie', label:'Talkie-Walkie' },
    { key:'gyrophare', label:'Gyrophare' },
    { key:'voiture', label:'Voiture' }
  ];

  // 12 cartes : 2 de chaque
  let cards = [];
  iconList.forEach((ic, i) => {
    cards.push({ ...ic, uid: i });
    cards.push({ ...ic, uid: i });
  });
  // Mélange Fisher-Yates
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }

  // Grille
  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:16px;max-width:420px';

  let flipped = [], matched = 0, locked = false;

  const pairsInfo = document.createElement('div');
  pairsInfo.style.cssText = 'font-family:var(--mono);font-size:11px;color:var(--text2);margin-bottom:10px;letter-spacing:1px';
  pairsInfo.innerHTML = 'Paires trouvées : <span id="pair-count" style="color:var(--accent);font-weight:bold">0</span> / 6';
  el.appendChild(pairsInfo);

  const answerBox = document.createElement('div');
  answerBox.style.cssText = 'display:none;background:#0d1420;border:1px solid var(--accent);border-radius:2px;padding:14px;text-align:center;margin-bottom:16px;font-family:var(--mono);';
  answerBox.innerHTML = '<div style="font-size:11px;color:var(--text2);margin-bottom:8px;letter-spacing:1px">✅ TOUTES LES PAIRES TROUVÉES — NUMÉRO DU SCELLÉ :</div><div style="font-size:28px;font-weight:bold;color:var(--accent);letter-spacing:8px;margin:8px 0">24037</div><div style="font-size:11px;color:var(--text2)">Entrez ce numéro sur votre interface brigade</div>';

  cards.forEach((card) => {
    const cardEl = document.createElement('div');
    cardEl.style.cssText = 'aspect-ratio:1;cursor:pointer;perspective:600px;position:relative;border-radius:4px;';

    const inner = document.createElement('div');
    inner.style.cssText = 'width:100%;height:100%;position:relative;transform-style:preserve-3d;transition:transform 0.4s;border-radius:4px;';

    const front = document.createElement('div');
    front.style.cssText = 'position:absolute;inset:0;border-radius:4px;backface-visibility:hidden;background:#0a0c0f;border:1.5px solid #e8b84b;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;';
    front.innerHTML = '<span style="font-family:var(--head);font-size:7px;letter-spacing:2px;color:#e8b84b;text-transform:uppercase;font-weight:600">AGENCE</span><span style="font-family:var(--head);font-size:7px;letter-spacing:2px;color:#e8b84b;text-transform:uppercase;font-weight:600">ACAPULCO</span><span style="font-size:8px;color:#3a4050;margin-top:2px">▪ ▪ ▪</span>';

    const back = document.createElement('div');
    back.style.cssText = 'position:absolute;inset:0;border-radius:4px;backface-visibility:hidden;background:#111820;border:1.5px solid #3a4558;transform:rotateY(180deg);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:4px;';
    back.innerHTML = card.svgIcons + svgIcons[card.key] + '<span style="font-size:6px;color:#9aa0b0;letter-spacing:1px;text-transform:uppercase">' + card.label + '</span>';

    inner.appendChild(front);
    inner.appendChild(back);
    cardEl.appendChild(inner);

    if (!readonly) {
      cardEl.addEventListener('click', () => {
        if (locked || inner.dataset.flipped === '1' || inner.dataset.matched === '1') return;
        inner.style.transform = 'rotateY(180deg)';
        inner.dataset.flipped = '1';
        flipped.push({ inner, card });

        if (flipped.length === 2) {
          locked = true;
          setTimeout(() => {
            if (flipped[0].card.uid === flipped[1].card.uid) {
              flipped[0].inner.dataset.matched = '1';
              flipped[1].inner.dataset.matched = '1';
              flipped[0].inner.style.borderColor = '#38a169';
              flipped[1].inner.style.borderColor = '#38a169';
              matched++;
              const pc = document.getElementById('pair-count');
              if (pc) pc.textContent = matched;
              if (matched === 6) {
                answerBox.style.display = 'block';
                if (!readonly) {
                  const inp = makeAnswerInput(enigma.id);
                  inp.input.placeholder = 'NUMÉRO DU SCELLÉ…';
                  el.appendChild(inp.wrap);
                  el.appendChild(makeSubmitBtn(() => {
                    const v = inp.input.value.trim();
                    if (v) submitAnswer(enigma.id, v, null, inp.input);
                  }));
                }
              }
            } else {
              flipped[0].inner.style.transform = '';
              flipped[0].inner.dataset.flipped = '0';
              flipped[1].inner.style.transform = '';
              flipped[1].inner.dataset.flipped = '0';
            }
            flipped = []; locked = false;
          }, 900);
        }
      });
    }

    grid.appendChild(cardEl);
  });

  el.appendChild(grid);
  el.appendChild(answerBox);
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
