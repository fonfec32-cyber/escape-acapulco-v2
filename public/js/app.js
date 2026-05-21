// ─── Opération Acapulco — app.js v2 ──────────────────────────────────────────
const socket = io();

// ── État ────────────────────────────────────────────────────────────────────
let state = {
  teamName: '',
  teamColor: '#e8b84b',
  teamEmoji: '',
  currentEnigma: null,
  history: [],         // énigmes déjà vues
  viewingIndex: -1,    // -1 = énigme courante
  selectedOption: null,
  padlockValues: [0,0,0,0],
  vaultStep: 0,
  hintVisible: false
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function setTeamColor(color) {
  document.getElementById('header-dot').style.background = color;
}

// ── Rejoindre ─────────────────────────────────────────────────────────────────
document.getElementById('btn-join').addEventListener('click', () => {
  const name = document.getElementById('input-name').value.trim();
  const team = document.getElementById('input-team').value;
  if (!name || !team) { alert('Veuillez saisir votre prénom et choisir une brigade.'); return; }
  socket.emit('join-team', { playerName: name, teamName: team });
});

socket.on('joined', ({ teamName, color, emoji }) => {
  state.teamName = teamName;
  state.teamColor = color;
  state.teamEmoji = emoji;
  document.getElementById('wait-team').innerHTML = `${emoji} Brigade ${teamName}`;
  document.getElementById('wait-team').style.color = color;
  show('screen-waiting');
});

// ── Démarrage ─────────────────────────────────────────────────────────────────
socket.on('game-start', () => {});

socket.on('enigma', (data) => {
  state.currentEnigma = data.enigma;
  state.vaultStep = 0;
  state.hintVisible = false;
  state.selectedOption = null;
  state.padlockValues = [0,0,0,0];

  // Historique
  if (!state.history.find(e => e.id === data.enigma.id)) {
    state.history.push(data.enigma);
  }
  state.viewingIndex = -1;

  renderEnigma(data.enigma, data.progress, data.total);
  show('screen-enigma');
});

// ── Navigation historique ──────────────────────────────────────────────────────
document.getElementById('btn-prev').addEventListener('click', () => {
  const maxIdx = state.history.length - 1;
  if (state.viewingIndex === -1) {
    state.viewingIndex = maxIdx - 1;
  } else if (state.viewingIndex > 0) {
    state.viewingIndex--;
  }
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
  const prev = document.getElementById('btn-prev');
  const next = document.getElementById('btn-next');
  const atCurrent = state.viewingIndex === -1;
  prev.disabled = (state.history.length <= 1 && atCurrent) || state.viewingIndex === 0;
  next.disabled = atCurrent;
}

// ── Rendu principal ────────────────────────────────────────────────────────────
function renderEnigma(enigma, progress, total, readonly = false) {
  if (!enigma) return;

  // Header
  if (progress !== null && total !== null) {
    document.getElementById('header-progress').textContent = `Étape ${progress + 1}/${total}`;
    document.getElementById('progress-fill').style.width = `${((progress) / total) * 100}%`;
    document.getElementById('header-phase').textContent = enigma.phase || '';
    setTeamColor(state.teamColor);
  }

  document.getElementById('enigma-num').textContent = `ÉTAPE ${enigma.id} / 23`;
  document.getElementById('enigma-title').textContent = enigma.title;

  // Contenu selon type
  const content = document.getElementById('enigma-content');
  content.innerHTML = '';

  switch (enigma.type) {
    case 'qcm':       renderQcm(content, enigma, readonly); break;
    case 'code':      renderCode(content, enigma, readonly); break;
    case 'anagram':   renderAnagram(content, enigma, readonly); break;
    case 'padlock':   renderPadlock(content, enigma, readonly); break;
    case 'intrus':    renderCode(content, enigma, readonly); break;
    case 'map':       renderMap(content, enigma, readonly); break;
    case 'wordsearch':renderWordSearch(content, enigma, readonly); break;
    case 'qrcode':    renderQr(content, enigma, readonly); break;
    case 'puzzle':    renderCode(content, enigma, readonly); break;
    case 'riddle':    renderRiddle(content, enigma, readonly); break;
    case 'vault':     renderVault(content, enigma, readonly); break;
    case 'final':     renderFinal(content, enigma, readonly); break;
    default:          renderCode(content, enigma, readonly);
  }

  updateNavBtns();
}

// ── QCM ───────────────────────────────────────────────────────────────────────
function renderQcm(el, enigma, readonly) {
  const text = document.createElement('div');
  text.className = 'enigma-text';
  text.textContent = enigma.text;
  el.appendChild(text);

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
        btn.classList.add('selected');
        state.selectedOption = opt;
      });
    } else {
      btn.disabled = true;
    }
    grid.appendChild(btn);
  });
  el.appendChild(grid);

  if (!readonly) {
    appendHint(el, enigma);
    const submitBtn = makeSubmitBtn(() => {
      if (!state.selectedOption) return;
      submitAnswer(enigma.id, state.selectedOption);
    });
    el.appendChild(submitBtn);
  }
}

// ── Code / texte libre ────────────────────────────────────────────────────────
function renderCode(el, enigma, readonly) {
  const text = document.createElement('div');
  text.className = 'enigma-text';
  text.textContent = enigma.text;
  el.appendChild(text);

  if (!readonly) {
    appendHint(el, enigma);
    const inp = makeAnswerInput(enigma.id);
    el.appendChild(inp.wrap);
    const submitBtn = makeSubmitBtn(() => {
      const val = inp.input.value.trim();
      if (!val) return;
      submitAnswer(enigma.id, val, null, inp.input);
    });
    el.appendChild(submitBtn);
  }
}

// ── Anagramme ─────────────────────────────────────────────────────────────────
function renderAnagram(el, enigma, readonly) {
  const text = document.createElement('div');
  text.className = 'enigma-text';
  text.textContent = enigma.text;
  el.appendChild(text);

  const letters = document.createElement('div');
  letters.className = 'letters-display';
  letters.textContent = enigma.letters;
  el.appendChild(letters);

  if (!readonly) {
    if (enigma.hintButton) {
      const hintWrap = document.createElement('div');
      hintWrap.innerHTML = `<div class="hint-box" id="hint-anagram" style="display:none"></div>
        <button class="btn-hint" id="btn-hint-anagram" style="margin-bottom:12px;width:100%">💡 Voir l'indice</button>`;
      el.appendChild(hintWrap);
      hintWrap.querySelector('#btn-hint-anagram').addEventListener('click', () => {
        const box = hintWrap.querySelector('#hint-anagram');
        box.textContent = enigma.hint;
        box.style.display = 'block';
        hintWrap.querySelector('#btn-hint-anagram').style.display = 'none';
      });
    } else {
      appendHint(el, enigma);
    }

    const inp = makeAnswerInput(enigma.id);
    el.appendChild(inp.wrap);
    const submitBtn = makeSubmitBtn(() => {
      const val = inp.input.value.trim();
      if (!val) return;
      submitAnswer(enigma.id, val, null, inp.input);
    });
    el.appendChild(submitBtn);
  }
}

// ── Cadenas ───────────────────────────────────────────────────────────────────
function renderPadlock(el, enigma, readonly) {
  const text = document.createElement('div');
  text.className = 'enigma-text';
  text.textContent = enigma.text;
  el.appendChild(text);

  state.padlockValues = [0,0,0,0];
  const display = document.createElement('div');
  display.className = 'padlock-display';

  for (let i = 0; i < 4; i++) {
    const col = document.createElement('div');
    col.className = 'padlock-digit';

    const up = document.createElement('button');
    up.textContent = '▲';
    const valEl = document.createElement('div');
    valEl.className = 'padlock-digit-val';
    valEl.textContent = '0';
    const down = document.createElement('button');
    down.textContent = '▼';

    if (!readonly) {
      up.addEventListener('click', () => {
        state.padlockValues[i] = (state.padlockValues[i] + 1) % 10;
        valEl.textContent = state.padlockValues[i];
      });
      down.addEventListener('click', () => {
        state.padlockValues[i] = (state.padlockValues[i] + 9) % 10;
        valEl.textContent = state.padlockValues[i];
      });
    } else {
      up.disabled = true; down.disabled = true;
    }

    col.appendChild(up); col.appendChild(valEl); col.appendChild(down);
    display.appendChild(col);
  }
  el.appendChild(display);

  if (!readonly) {
    appendHint(el, enigma);
    const submitBtn = makeSubmitBtn(() => {
      const code = state.padlockValues.join('');
      submitAnswer(enigma.id, code);
    });
    el.appendChild(submitBtn);
  }
}

// ── Carte ─────────────────────────────────────────────────────────────────────
function renderMap(el, enigma, readonly) {
  const text = document.createElement('div');
  text.className = 'enigma-text';
  text.textContent = enigma.text;
  el.appendChild(text);

  // Carte SVG stylisée du secteur
  const mapWrap = document.createElement('div');
  mapWrap.className = 'map-placeholder';
  mapWrap.innerHTML = `
    <svg class="map-svg" viewBox="0 0 320 200" xmlns="http://www.w3.org/2000/svg">
      <!-- Fond -->
      <rect width="320" height="200" fill="#111318"/>
      <!-- Routes -->
      <line x1="0" y1="100" x2="320" y2="100" stroke="#2a2f3a" stroke-width="6"/>
      <line x1="160" y1="0" x2="160" y2="200" stroke="#2a2f3a" stroke-width="4"/>
      <line x1="0" y1="60" x2="320" y2="60" stroke="#2a2f3a" stroke-width="2"/>
      <line x1="0" y1="150" x2="320" y2="150" stroke="#2a2f3a" stroke-width="2"/>
      <!-- Parc Bordelan (zone verte) -->
      <rect x="50" y="70" width="80" height="60" rx="4" fill="rgba(56,161,105,0.2)" stroke="#38a169" stroke-width="1.5"/>
      <text x="90" y="95" font-family="monospace" font-size="7" fill="#38a169" text-anchor="middle">Parc de</text>
      <text x="90" y="105" font-family="monospace" font-size="7" fill="#38a169" text-anchor="middle">Bordelan</text>
      <!-- Croix rouge -->
      <line x1="82" y1="117" x2="98" y2="133" stroke="#e53e3e" stroke-width="3" stroke-linecap="round"/>
      <line x1="98" y1="117" x2="82" y2="133" stroke="#e53e3e" stroke-width="3" stroke-linecap="round"/>
      <!-- Autre parc (leurre) -->
      <rect x="200" y="30" width="60" height="40" rx="4" fill="rgba(56,161,105,0.08)" stroke="#2a2f3a" stroke-width="1"/>
      <text x="230" y="54" font-family="monospace" font-size="6" fill="#5a6070" text-anchor="middle">Parc Fleuri</text>
      <!-- Autre leurre -->
      <rect x="210" y="120" width="70" height="50" rx="4" fill="rgba(56,161,105,0.08)" stroke="#2a2f3a" stroke-width="1"/>
      <text x="245" y="148" font-family="monospace" font-size="6" fill="#5a6070" text-anchor="middle">Square du</text>
      <text x="245" y="158" font-family="monospace" font-size="6" fill="#5a6070" text-anchor="middle">Moulin</text>
      <!-- Légende croix -->
      <circle cx="282" cy="30" r="6" fill="rgba(229,62,62,0.2)" stroke="#e53e3e" stroke-width="1"/>
      <text x="282" y="33" font-family="monospace" font-size="8" fill="#e53e3e" text-anchor="middle">✕</text>
      <text x="294" y="33" font-family="monospace" font-size="7" fill="#9aa0b0">Scène</text>
      <!-- Chemin de Bordelan label -->
      <text x="90" y="145" font-family="monospace" font-size="6" fill="#5a6070" text-anchor="middle">Ch. de Bordelan</text>
      <!-- Boussole -->
      <text x="300" y="185" font-family="monospace" font-size="9" fill="#5a6070">N↑</text>
    </svg>`;
  el.appendChild(mapWrap);

  if (!readonly) {
    appendHint(el, enigma);
    const inp = makeAnswerInput(enigma.id);
    el.appendChild(inp.wrap);
    const submitBtn = makeSubmitBtn(() => {
      const val = inp.input.value.trim();
      if (!val) return;
      submitAnswer(enigma.id, val, null, inp.input);
    });
    el.appendChild(submitBtn);
  }
}

// ── Grille mots cachés ────────────────────────────────────────────────────────
function renderWordSearch(el, enigma, readonly) {
  const text = document.createElement('div');
  text.className = 'enigma-text';
  text.textContent = enigma.text;
  el.appendChild(text);

  const grid = document.createElement('div');
  grid.className = 'word-grid';
  grid.innerHTML = enigma.grid.map(row =>
    row.split('').join(' ')
  ).join('<br>');
  el.appendChild(grid);

  if (!readonly) {
    appendHint(el, enigma);
    const inp = makeAnswerInput(enigma.id);
    el.appendChild(inp.wrap);
    const submitBtn = makeSubmitBtn(() => {
      const val = inp.input.value.trim();
      if (!val) return;
      submitAnswer(enigma.id, val, null, inp.input);
    });
    el.appendChild(submitBtn);
  }
}

// ── QR Code ───────────────────────────────────────────────────────────────────
function renderQr(el, enigma, readonly) {
  const instruction = document.createElement('div');
  instruction.className = 'qr-instruction';
  instruction.innerHTML = `
    <div class="qr-emoji">📷</div>
    <div class="qr-text">${enigma.text}</div>`;
  el.appendChild(instruction);

  if (!readonly) {
    appendHint(el, enigma);
    const inp = makeAnswerInput(enigma.id);
    inp.input.placeholder = 'ENTREZ LA RÉPONSE TROUVÉE…';
    el.appendChild(inp.wrap);
    const submitBtn = makeSubmitBtn(() => {
      const val = inp.input.value.trim();
      if (!val) return;
      submitAnswer(enigma.id, val, null, inp.input);
    });
    el.appendChild(submitBtn);
  }
}

// ── Énigme texte (riddle) ─────────────────────────────────────────────────────
function renderRiddle(el, enigma, readonly) {
  const box = document.createElement('div');
  box.className = 'riddle-box';
  box.textContent = enigma.text;
  el.appendChild(box);

  if (!readonly) {
    appendHint(el, enigma);
    const inp = makeAnswerInput(enigma.id);
    el.appendChild(inp.wrap);
    const submitBtn = makeSubmitBtn(() => {
      const val = inp.input.value.trim();
      if (!val) return;
      submitAnswer(enigma.id, val, null, inp.input);
    });
    el.appendChild(submitBtn);
  }
}

// ── Coffre progressif ─────────────────────────────────────────────────────────
function renderVault(el, enigma, readonly) {
  const text = document.createElement('div');
  text.className = 'enigma-text';
  text.textContent = enigma.text;
  el.appendChild(text);

  // Cadenas visuels
  const locks = document.createElement('div');
  locks.className = 'vault-locks';
  locks.id = 'vault-locks';
  enigma.vaultQuestions.forEach((_, i) => {
    const lock = document.createElement('div');
    lock.className = 'vault-lock';
    lock.id = `vault-lock-${i}`;
    lock.textContent = '🔒';
    locks.appendChild(lock);
  });
  el.appendChild(locks);

  // Question courante
  const qWrap = document.createElement('div');
  qWrap.id = 'vault-q-wrap';
  el.appendChild(qWrap);

  renderVaultStep(enigma, qWrap, readonly);
}

function renderVaultStep(enigma, wrap, readonly) {
  const step = state.vaultStep;
  if (step >= enigma.vaultQuestions.length) return;
  const vq = enigma.vaultQuestions[step];

  wrap.innerHTML = '';
  const qEl = document.createElement('div');
  qEl.className = 'vault-question';
  qEl.textContent = `🔐 Question ${step + 1}/4 — ${vq.q}`;
  wrap.appendChild(qEl);

  if (!readonly) {
    const hintBox = document.createElement('div');
    hintBox.className = 'hint-box';
    hintBox.id = 'vault-hint';
    wrap.appendChild(hintBox);

    let inputEl;
    if (vq.freeText) {
      // Zone texte libre pour les 10 crus
      const ta = document.createElement('textarea');
      ta.className = 'answer-input';
      ta.style.minHeight = '80px';
      ta.style.resize = 'vertical';
      ta.style.letterSpacing = '0';
      ta.style.fontSize = '13px';
      ta.placeholder = 'Listez les 10 crus séparés par des virgules…';
      wrap.appendChild(ta);
      inputEl = ta;
    } else {
      const inp = makeAnswerInput(enigma.id);
      wrap.appendChild(inp.wrap);
      inputEl = inp.input;
    }

    const row = document.createElement('div');
    row.className = 'action-row';

    const hintBtn = document.createElement('button');
    hintBtn.className = 'btn-hint';
    hintBtn.textContent = '💡 Indice';
    hintBtn.addEventListener('click', () => {
      hintBox.textContent = vq.hint;
      hintBox.classList.add('visible');
    });

    const submitBtn = document.createElement('button');
    submitBtn.className = 'btn btn-primary';
    submitBtn.style.flex = '1';
    submitBtn.textContent = step < enigma.vaultQuestions.length - 1 ? 'Valider — Verrou suivant →' : '🔓 Ouvrir le coffre';
    submitBtn.addEventListener('click', () => {
      const val = inputEl.value.trim();
      if (!val) return;
      socket.emit('submit-answer', { answer: val, enigmaId: enigma.id, vaultStep: step });
    });

    row.appendChild(hintBtn);
    row.appendChild(submitBtn);
    wrap.appendChild(row);
  }
}

// ── Final ─────────────────────────────────────────────────────────────────────
function renderFinal(el, enigma, readonly) {
  const text = document.createElement('div');
  text.className = 'enigma-text';
  text.textContent = enigma.text;
  el.appendChild(text);

  // Réutilise la logique vault pour les 3 questions finales
  const locks = document.createElement('div');
  locks.className = 'vault-locks';
  locks.id = 'vault-locks';
  enigma.finalQuestions.forEach((_, i) => {
    const lock = document.createElement('div');
    lock.className = 'vault-lock';
    lock.id = `vault-lock-${i}`;
    lock.textContent = '⚖️';
    locks.appendChild(lock);
  });
  el.appendChild(locks);

  const qWrap = document.createElement('div');
  qWrap.id = 'vault-q-wrap';
  el.appendChild(qWrap);

  renderFinalStep(enigma, qWrap, readonly);
}

function renderFinalStep(enigma, wrap, readonly) {
  const step = state.vaultStep;
  if (step >= enigma.finalQuestions.length) return;
  const fq = enigma.finalQuestions[step];

  wrap.innerHTML = '';
  const qEl = document.createElement('div');
  qEl.className = 'vault-question';
  qEl.textContent = `⚖️ Question ${step + 1}/3 — ${fq.q}`;
  wrap.appendChild(qEl);

  if (!readonly) {
    const hintBox = document.createElement('div');
    hintBox.className = 'hint-box';
    wrap.appendChild(hintBox);

    const inp = makeAnswerInput(enigma.id);
    wrap.appendChild(inp.wrap);

    const row = document.createElement('div');
    row.className = 'action-row';

    const hintBtn = document.createElement('button');
    hintBtn.className = 'btn-hint';
    hintBtn.textContent = '💡 Indice';
    hintBtn.addEventListener('click', () => {
      hintBox.textContent = fq.hint;
      hintBox.classList.add('visible');
    });

    const submitBtn = document.createElement('button');
    submitBtn.className = 'btn btn-primary';
    submitBtn.style.flex = '1';
    submitBtn.textContent = step < enigma.finalQuestions.length - 1 ? 'Valider →' : '🏆 Clore l\'affaire';
    submitBtn.addEventListener('click', () => {
      const val = inp.input.value.trim();
      if (!val) return;
      socket.emit('submit-answer', { answer: val, enigmaId: enigma.id, vaultStep: step });
    });

    row.appendChild(hintBtn);
    row.appendChild(submitBtn);
    wrap.appendChild(row);
  }
}

// ── Helpers UI ────────────────────────────────────────────────────────────────
function makeAnswerInput(enigmaId) {
  const wrap = document.createElement('div');
  wrap.className = 'answer-input-wrap';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'answer-input';
  input.placeholder = 'VOTRE RÉPONSE…';
  input.autocomplete = 'off';
  input.id = `ans-${enigmaId}`;
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') input.nextElementSibling?.click?.() || wrap.nextElementSibling?.click?.();
  });
  wrap.appendChild(input);
  return { wrap, input };
}

function makeSubmitBtn(onClick) {
  const btn = document.createElement('button');
  btn.className = 'btn btn-primary';
  btn.textContent = 'Valider la réponse';
  btn.addEventListener('click', onClick);
  return btn;
}

function appendHint(el, enigma) {
  if (!enigma.hint) return;
  const hintBox = document.createElement('div');
  hintBox.className = 'hint-box';
  hintBox.id = 'hint-global';
  el.appendChild(hintBox);

  const row = document.createElement('div');
  row.className = 'action-row';
  const btn = document.createElement('button');
  btn.className = 'btn-hint';
  btn.textContent = '💡 Indice';
  btn.addEventListener('click', () => {
    socket.emit('request-hint');
    hintBox.textContent = enigma.hint;
    hintBox.classList.add('visible');
  });
  row.appendChild(btn);
  el.appendChild(row);
}

// ── Réponses serveur ──────────────────────────────────────────────────────────
function submitAnswer(enigmaId, answer, vaultStep = null, inputEl = null) {
  socket.emit('submit-answer', { answer, enigmaId, vaultStep });
}

socket.on('correct-answer', () => {
  show('screen-correct');
  setTimeout(() => show('screen-enigma'), 1800);
});

socket.on('wrong-answer', ({ enigmaId }) => {
  const inp = document.getElementById(`ans-${enigmaId}`);
  if (inp) {
    inp.classList.add('wrong');
    setTimeout(() => inp.classList.remove('wrong'), 600);
    inp.value = '';
    inp.focus();
  }
  // Retour à l'énigme courante si en mode révision
  if (state.viewingIndex !== -1) {
    state.viewingIndex = -1;
    renderEnigma(state.currentEnigma, null, null, false);
  }
});

socket.on('vault-step-ok', ({ step, total }) => {
  // Ouvrir le verrou visuel
  const lock = document.getElementById(`vault-lock-${step}`);
  if (lock) {
    lock.textContent = '🔓';
    lock.classList.add('open');
  }
  state.vaultStep = step + 1;

  // Avancer à la question suivante dans le vault
  const wrap = document.getElementById('vault-q-wrap');
  if (wrap && state.currentEnigma) {
    if (state.currentEnigma.type === 'vault') {
      renderVaultStep(state.currentEnigma, wrap, false);
    } else if (state.currentEnigma.type === 'final') {
      renderFinalStep(state.currentEnigma, wrap, false);
    }
  }
});

socket.on('hint', ({ text }) => {
  const box = document.getElementById('hint-global');
  if (box) { box.textContent = text; box.classList.add('visible'); }
});

socket.on('game-won', ({ rankings }) => {
  document.getElementById('won-team').textContent = `${state.teamEmoji} Brigade ${state.teamName}`;
  document.getElementById('won-team').style.color = state.teamColor;
  const rankEl = document.getElementById('won-rankings');
  rankEl.innerHTML = '';
  if (rankings && rankings.length > 0) {
    const title = document.createElement('div');
    title.style.cssText = 'font-family:var(--mono);font-size:10px;letter-spacing:2px;color:var(--text3);margin-bottom:10px;text-transform:uppercase';
    title.textContent = 'Classement des brigades';
    rankEl.appendChild(title);
    rankings.forEach((r, i) => {
      const row = document.createElement('div');
      row.className = 'ranking-row';
      row.innerHTML = `<span class="ranking-pos">${['🥇','🥈','🥉'][i] || (i+1)+'.'}</span><span>${r.teamName}</span><span style="margin-left:auto;font-size:11px;color:var(--text3)">${r.time}</span>`;
      rankEl.appendChild(row);
    });
  }
  show('screen-won');
});

socket.on('game-reset', () => {
  state = { teamName:'', teamColor:'#e8b84b', teamEmoji:'', currentEnigma:null, history:[], viewingIndex:-1, selectedOption:null, padlockValues:[0,0,0,0], vaultStep:0, hintVisible:false };
  show('screen-join');
});
