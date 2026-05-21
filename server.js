const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'acapulco2025';

app.use(express.static(path.join(__dirname, 'public')));

// ─── Scènes QR ────────────────────────────────────────────────────────────────
app.get('/clue/zone-alpha', (req, res) => res.sendFile(path.join(__dirname, 'public/clue-a.html')));
app.get('/clue/zone-bravo', (req, res) => res.sendFile(path.join(__dirname, 'public/clue-b.html')));
app.get('/clue/zone-charlie', (req, res) => res.sendFile(path.join(__dirname, 'public/clue-c.html')));

// ─── Énigmes ──────────────────────────────────────────────────────────────────
const enigmas = [
  // ── PHASE 1 : Ouverture du dossier ──────────────────────────────────────────
  {
    id: 1,
    type: 'qcm',
    phase: 'PHASE 1 — Ouverture du dossier',
    title: 'Convocation urgente',
    text: 'Vous recevez une convocation d\'urgence. Première question de procédure : quelle est la PREMIÈRE action à effectuer à l\'arrivée sur une scène de crime ?',
    options: ['Interroger les témoins', 'Établir un périmètre de sécurité', 'Photographier les indices', 'Appeler le parquet'],
    answer: 'Établir un périmètre de sécurité',
    hint: 'La scène doit être préservée avant toute chose.'
  },
  {
    id: 2,
    type: 'anagram',
    phase: 'PHASE 1 — Ouverture du dossier',
    title: 'Identité de la victime',
    text: 'Les lettres du nom de la victime ont été mélangées par le suspect pour brouiller les pistes. Reconstituez le PRÉNOM et le NOM à partir de ces 13 lettres :',
    letters: 'U A E N R E T M I E E O N',
    answer: 'ETIENNE MOREAU',
    hint: 'Un prénom de 7 lettres, un nom de 6 lettres.'
  },
  {
    id: 3,
    type: 'code',
    phase: 'PHASE 1 — Ouverture du dossier',
    title: 'Le mot de passe du casier',
    text: 'Un message anonyme a été intercepté. Chaque lettre a été décalée de +3 dans l\'alphabet (chiffre de César). Déchiffrez le message pour trouver le code à 4 chiffres :\n\n« OHVVHFUHWHVW2025 »\n\nIndice : le code est le nombre visible dans le message déchiffré.',
    answer: '2025',
    hint: 'A+3=D, B+3=E, C+3=F… cherchez le nombre dans le texte décodé.'
  },
  {
    id: 4,
    type: 'intrus',
    phase: 'PHASE 1 — Ouverture du dossier',
    title: 'L\'alibi suspect',
    text: 'Cinq témoignages ont été recueillis. L\'un d\'eux contient une incohérence flagrante. Lequel ?\n\n1. « J\'étais chez moi rue des Acacias de 14h à 19h, ma voisine peut confirmer. »\n2. « J\'ai fait mes courses au Carrefour de 15h à 17h — j\'ai le ticket de caisse. »\n3. « J\'étais en réunion à Lyon toute la journée, mais je suis passé au parc de Bordelan vers 16h30. »\n4. « Je travaillais à la boulangerie jusqu\'à 18h, puis je suis rentré directement. »\n5. « J\'ai emmené mes enfants à l\'école à 14h puis j\'ai rejoint des amis au café. »\n\nEntrez le numéro du témoignage incohérent.',
    answer: '3',
    hint: 'Lyon et Villefranche simultanément, c\'est impossible.'
  },
  {
    id: 5,
    type: 'map',
    phase: 'PHASE 1 — Ouverture du dossier',
    title: 'La scène de crime',
    text: 'Une carte du secteur apparaît avec plusieurs espaces verts indiqués. Une croix rouge marque l\'emplacement exact où le corps d\'Étienne Moreau a été retrouvé.\n\nIdentifiez et saisissez le nom de ce parc.',
    mapLocation: 'Parc de Bordelan, chemin de Bordelan, 69400 Villefranche-sur-Saône',
    answer: 'BORDELAN',
    hint: 'Chemin de Bordelan, Villefranche-sur-Saône.'
  },

  // ── PHASE 2 : Collecte des preuves ──────────────────────────────────────────
  {
    id: 6,
    type: 'code',
    phase: 'PHASE 2 — Collecte des preuves',
    title: 'Horodatage critique',
    text: 'Selon les témoins, Étienne Moreau a été vu vivant pour la dernière fois à 14h37. Son corps a été découvert à 18h12.\n\nCombien de minutes se sont écoulées entre ces deux moments ?\n\nEntrez le nombre de minutes.',
    answer: '215',
    hint: 'Calculez d\'abord les minutes jusqu\'à 15h00, puis ajoutez le reste.'
  },
  {
    id: 7,
    type: 'padlock',
    phase: 'PHASE 2 — Collecte des preuves',
    title: 'Armoire à preuves',
    text: 'L\'armoire à preuves est verrouillée par un cadenas à 4 chiffres.\n\nIndice : sur la fiche de service de Moreau figure la date de son dernier procès-verbal dressé avant sa mort.\n\nDate du PV : 13 mai\n\nEntrez les 4 chiffres (jour + mois).',
    answer: '1305',
    hint: '13 mai = 13ème jour, 5ème mois.'
  },
  {
    id: 8,
    type: 'qrcode',
    phase: 'PHASE 2 — Collecte des preuves',
    title: '🔴 Scan QR — Zone Alpha',
    text: 'Rendez-vous sur le terrain.\n\nRepérez le ruban ROUGE dans le parc et scannez le QR code fixé à proximité.\n\nUne pièce à conviction apparaîtra. Lisez-la attentivement et entrez l\'année demandée.',
    qrUrl: '/clue/zone-alpha',
    answer: '2023',
    hint: 'L\'année est partiellement masquée mais un détail de la mise en page la trahit.'
  },
  {
    id: 9,
    type: 'map',
    phase: 'PHASE 2 — Collecte des preuves',
    title: 'Localisation du véhicule suspect',
    text: 'Une riveraine a décrit la position du véhicule suspect :\n\n« C\'était dans la 3ème allée en partant de l\'entrée principale, face au banc près de la fontaine. »\n\nSur le plan du parc affiché, chaque zone est identifiée par une lettre et un chiffre. Entrez le code de zone correspondant.',
    answer: 'B4',
    hint: 'Comptez les allées depuis l\'entrée principale, puis repérez la fontaine.'
  },
  {
    id: 10,
    type: 'wordsearch',
    phase: 'PHASE 2 — Collecte des preuves',
    title: 'La marque du véhicule',
    text: 'Une grille de lettres a été retrouvée dans les affaires de Moreau. La marque du véhicule suspect y est cachée horizontalement.\n\nTrouvez et saisissez la marque.',
    grid: [
      'AMLOPRQSBT',
      'ZRENAULTXK',
      'VBCDFGHJML',
      'PKQRSTUYWZ',
      'XABCDEFGHI',
      'JKLMNOPQRS',
      'TUVWXYZABC',
      'DEFGHIJKLM'
    ],
    answer: 'RENAULT',
    hint: 'Cherchez horizontalement dans chaque ligne.'
  },

  // ── PHASE 3 : Analyse des indices ───────────────────────────────────────────
  {
    id: 11,
    type: 'qcm',
    phase: 'PHASE 3 — Analyse des indices',
    title: 'Identification LAPI',
    text: 'La riveraine a relevé une partie de la plaque d\'immatriculation du véhicule suspect.\n\nQuelle technologie la Police Municipale peut-elle utiliser pour identifier un véhicule à partir d\'une plaque partielle, en vertu de l\'article 39 de la loi LOM ?',
    options: ['FNAEG', 'LAPI', 'TAJ', 'FPR'],
    answer: 'LAPI',
    hint: 'Lecture Automatisée des Plaques d\'Immatriculation.'
  },
  {
    id: 12,
    type: 'puzzle',
    phase: 'PHASE 3 — Analyse des indices',
    title: 'Reconstitution du scellé',
    text: 'La photo principale de la pièce à conviction a été fragmentée en 4 morceaux numérotés et mélangés.\n\nObservez les fragments affichés et entrez l\'ordre correct pour reconstituer l\'image (ex: 3-1-4-2).',
    answer: '2-4-1-3',
    hint: 'Regardez les bords de chaque fragment pour trouver les raccords.'
  },
  {
    id: 13,
    type: 'qrcode',
    phase: 'PHASE 3 — Analyse des indices',
    title: '🔵 Scan QR — Zone Bravo',
    text: 'Rendez-vous sur le terrain.\n\nRepérez le ruban BLEU dans le parc et scannez le QR code fixé à proximité.\n\nUn registre confidentiel apparaîtra. Comptez le nombre de faux PV listés et entrez ce chiffre.',
    qrUrl: '/clue/zone-bravo',
    answer: '7',
    hint: 'Comptez uniquement les lignes avec un numéro de PV visible.'
  },
  {
    id: 14,
    type: 'intrus',
    phase: 'PHASE 3 — Analyse des indices',
    title: 'La liste des suspects',
    text: 'Six suspects ont été identifiés, chacun avec un alibi :\n\n1. M. Dupont — était en formation à Mâcon toute la journée (attestation fournie)\n2. Mme Girard — travaillait en mairie, badgeage confirmé 8h-17h\n3. M. Tissot — en congé, chez sa mère à Bourg-en-Bresse (confirmé)\n4. M. Perrin — déplacement officiel à Lyon, mais son badge signale une connexion au réseau Villefranche à 16h45\n5. Mme Faure — en arrêt maladie, médecin consulté le matin\n6. M. Bernard — retraité, visible par des voisins toute la journée\n\nEntrez le numéro du suspect dont l\'alibi est impossible.',
    answer: '4',
    hint: 'Un badge de connexion réseau ne ment pas.'
  },
  {
    id: 15,
    type: 'code',
    phase: 'PHASE 3 — Analyse des indices',
    title: 'Le message du commanditaire',
    text: 'Un post-it retrouvé dans les affaires de Moreau. Chaque chiffre correspond à une lettre (A=1, B=2, C=3…)\n\n« 19 – 21 – 19 – 16 – 5 – 3 – 20 »\n\nDéchiffrez et entrez le mot en majuscules.',
    answer: 'SUSPECT',
    hint: 'S=19, U=21, S=19, P=16, E=5, C=3, T=20'
  },

  // ── PHASE 4 : Identification ─────────────────────────────────────────────────
  {
    id: 16,
    type: 'padlock',
    phase: 'PHASE 4 — Identification',
    title: 'Coffre des scellés numériques',
    text: 'Le coffre des scellés numériques est verrouillé par un code à 4 chiffres.\n\nIndice juridique : quel est le numéro de l\'article du Code pénal qui définit la COMPLICITÉ ?\n\nEntrez les 4 chiffres de cet article (sans le tiret).',
    answer: '1217',
    hint: 'Article 121-7 du Code pénal → 1217'
  },
  {
    id: 17,
    type: 'anagram',
    phase: 'PHASE 4 — Identification',
    title: 'La fonction du commanditaire',
    text: 'Les lettres de la fonction du commanditaire ont été mélangées. Reconstituez les deux mots :\n\n« C L L U O A É L »\n\nDe qui s\'agit-il ?',
    letters: 'C L L U O A É L',
    answer: 'ELU LOCAL',
    hint: 'Il représente les citoyens des différentes collectivités territoriales.',
    hintButton: true
  },
  {
    id: 18,
    type: 'qcm',
    phase: 'PHASE 4 — Identification',
    title: 'Mise en cause d\'un élu',
    text: 'Le commanditaire identifié est un élu local. Peut-il être auditionné dans le cadre d\'une enquête criminelle ?',
    options: ['Non, il bénéficie d\'une immunité totale', 'Oui, sans aucune restriction', 'Oui, mais seulement avec autorisation préfectorale', 'Seulement par le parquet de Paris'],
    answer: 'Oui, sans aucune restriction',
    hint: 'Les élus locaux ne bénéficient d\'aucune immunité pénale pour les crimes de droit commun.'
  },
  {
    id: 19,
    type: 'riddle',
    phase: 'PHASE 4 — Identification',
    title: 'Le mobile du crime',
    text: 'Une énigme a été glissée sous la porte du commissariat :\n\n« Je ne vole pas toujours directement,\nmais sans moi beaucoup de voleurs\nne seraient jamais riches.\nJe fais fermer les yeux\nà ceux qui devraient voir.\nQui suis-je ? »\n\nEntrez le mot en majuscules.',
    answer: 'CORRUPTION',
    hint: 'Je graisse les rouages qui devraient tourner droit.'
  },
  {
    id: 20,
    type: 'qrcode',
    phase: 'PHASE 4 — Identification',
    title: '🟢 Scan QR — Zone Charlie',
    text: 'Rendez-vous sur le terrain.\n\nRepérez le ruban VERT dans le parc et scannez le QR code fixé à proximité.\n\nUne photo du véhicule suspect apparaîtra avec une note manuscrite. Déduisez le département d\'immatriculation et entrez les 2 chiffres.',
    qrUrl: '/clue/zone-charlie',
    answer: '69',
    hint: 'Le Rhône, département de Villefranche-sur-Saône.'
  },

  // ── PHASE 5 : Clôture ────────────────────────────────────────────────────────
  {
    id: 21,
    type: 'code',
    phase: 'PHASE 5 — Clôture de l\'affaire',
    title: 'La chronologie de l\'affaire',
    text: 'Remettez ces 5 événements dans l\'ordre chronologique et entrez la séquence (ex: 3-1-5-2-4) :\n\n1. Moreau retrouvé sans vie dans le parc\n2. Moreau rédige le rapport sur les faux PV\n3. Le réseau de faux PV est constitué par l\'élu\n4. Moreau reçoit le SMS de menace anonyme\n5. L\'élu commande le crime pour faire taire Moreau',
    answer: '3-2-4-5-1',
    hint: 'Le réseau existait avant que Moreau ne l\'découvre.'
  },
  {
    id: 22,
    type: 'vault',
    phase: 'PHASE 5 — Clôture de l\'affaire',
    title: 'Le coffre de la vérité',
    text: 'Le coffre final s\'ouvre en 4 étapes. Répondez aux 4 questions pour lever les verrous un par un.',
    vaultQuestions: [
      {
        q: 'En quelle année a été créée la Police Municipale en France ?',
        a: '1884',
        hint: 'Fin du XIXème siècle, sous la IIIème République.'
      },
      {
        q: 'Qui a fondé Villefranche-sur-Saône ?',
        a: 'HUMBERT 3',
        hint: 'Un seigneur du Beaujolais, au XIIème siècle.',
        acceptedAnswers: ['HUMBERT 3', 'HUMBERT III', 'HUMBERT 3 DE BEAUJEU', 'HUMBERT III DE BEAUJEU']
      },
      {
        q: 'Comment s\'appelle le pavage de dalles plates devant l\'église Notre-Dame-des-Marais à Villefranche ?',
        a: 'LA CALADE',
        hint: 'Un mot d\'origine provençale désignant un pavage en pierre.',
        acceptedAnswers: ['LA CALADE', 'CALADE']
      },
      {
        q: 'Citez les 10 crus du Beaujolais (dans n\'importe quel ordre, séparés par des virgules).',
        a: 'SAINT-AMOUR, JULIENAS, CHENAS, MOULIN-A-VENT, FLEURIE, CHIROUBLES, MORGON, REGNIE, BROUILLY, COTE DE BROUILLY',
        hint: 'Du nord au sud : Saint-Amour, Juliénas, Chénas, Moulin-à-Vent, Fleurie, Chiroubles, Morgon, Régnié, Brouilly, Côte de Brouilly.',
        freeText: true
      }
    ]
  },
  {
    id: 23,
    type: 'final',
    phase: 'PHASE 5 — Clôture de l\'affaire',
    title: 'Verdict — Affaire classée ?',
    text: 'L\'enquête touche à sa fin. Trois questions de clôture pour lever l\'Opération Acapulco :',
    finalQuestions: [
      { q: 'Quel était le mobile du meurtre ?', a: 'CORRUPTION', hint: 'L\'enjeu : faire taire celui qui savait.' },
      { q: 'Qui est le commanditaire ?', a: 'ELU LOCAL', hint: 'La fonction reconstituée en phase 4.' },
      { q: 'Quel article régit la mise en examen ? (numéro uniquement)', a: '80-1', hint: 'Article 80-1 du Code de procédure pénale.', acceptedAnswers: ['80-1', '801', 'L3432-1'] }
    ]
  }
];

// ─── État du jeu ───────────────────────────────────────────────────────────────
const teams = {
  'Alpha':   { color: '#E53E3E', emoji: '🔴', players: [], currentEnigma: 0, completed: false, score: 0 },
  'Bravo':   { color: '#3182CE', emoji: '🔵', players: [], currentEnigma: 0, completed: false, score: 0 },
  'Charlie': { color: '#38A169', emoji: '🟢', players: [], currentEnigma: 0, completed: false, score: 0 },
  'Delta':   { color: '#D69E2E', emoji: '🟡', players: [], currentEnigma: 0, completed: false, score: 0 },
  'Echo':    { color: '#805AD5', emoji: '🟣', players: [], currentEnigma: 0, completed: false, score: 0 }
};

let gameStarted = false;
let gameFinished = false;
let rankings = [];

function checkAnswer(enigma, rawAnswer) {
  const normalize = s => s.toString().trim().toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9\-]/g, ' ').replace(/\s+/g, ' ').trim();

  const ans = normalize(rawAnswer);
  const correct = normalize(enigma.answer);

  if (ans === correct) return true;

  if (enigma.acceptedAnswers) {
    return enigma.acceptedAnswers.some(a => normalize(a) === ans);
  }

  // Pour les réponses partielles de type "BORDELAN"
  if (correct.includes(ans) && ans.length >= 4) return true;

  return false;
}

function getTeamState(teamName) {
  const team = teams[teamName];
  const idx = team.currentEnigma;
  if (idx >= enigmas.length) return { done: true };
  return {
    enigma: enigmas[idx],
    progress: idx,
    total: enigmas.length,
    teamName,
    color: team.color,
    emoji: team.emoji
  };
}

function broadcastAdmin() {
  const state = Object.entries(teams).map(([name, t]) => ({
    name, color: t.color, emoji: t.emoji,
    players: t.players.length,
    progress: t.currentEnigma,
    total: enigmas.length,
    completed: t.completed,
    score: t.score,
    currentTitle: t.currentEnigma < enigmas.length ? enigmas[t.currentEnigma].title : 'Terminé !'
  }));
  io.to('admin').emit('admin-state', { teams: state, gameStarted, gameFinished, rankings });
}

// ─── Socket.io ────────────────────────────────────────────────────────────────
io.on('connection', (socket) => {

  // Rejoindre une brigade
  socket.on('join-team', ({ playerName, teamName }) => {
    if (!teams[teamName]) return;
    socket.join(teamName);
    socket.data.teamName = teamName;
    socket.data.playerName = playerName;
    if (!teams[teamName].players.includes(playerName)) {
      teams[teamName].players.push(playerName);
    }
    socket.emit('joined', { teamName, color: teams[teamName].color, emoji: teams[teamName].emoji });
    if (gameStarted) {
      socket.emit('game-start');
      socket.emit('enigma', getTeamState(teamName));
    }
    broadcastAdmin();
  });

  // Soumettre une réponse
  socket.on('submit-answer', ({ answer, enigmaId, vaultStep }) => {
    const teamName = socket.data.teamName;
    if (!teamName || !gameStarted) return;
    const team = teams[teamName];
    const enigma = enigmas[team.currentEnigma];
    if (!enigma || enigma.id !== enigmaId) return;

    // Gestion du coffre progressif (étape 22)
    if (enigma.type === 'vault') {
      const vq = enigma.vaultQuestions[vaultStep];
      if (!vq) return;
      const ok = vq.freeText ? answer.trim().length > 5 : checkAnswer({ answer: vq.a, acceptedAnswers: vq.acceptedAnswers }, answer);
      if (ok) {
        socket.emit('vault-step-ok', { step: vaultStep, total: enigma.vaultQuestions.length });
        if (vaultStep === enigma.vaultQuestions.length - 1) {
          advanceTeam(team, teamName, socket);
        }
      } else {
        socket.emit('wrong-answer', { enigmaId });
      }
      return;
    }

    // Gestion du final (étape 23)
    if (enigma.type === 'final') {
      const fq = enigma.finalQuestions[vaultStep || 0];
      if (!fq) return;
      const ok = checkAnswer({ answer: fq.a, acceptedAnswers: fq.acceptedAnswers }, answer);
      if (ok) {
        socket.emit('vault-step-ok', { step: vaultStep, total: enigma.finalQuestions.length });
        if ((vaultStep || 0) === enigma.finalQuestions.length - 1) {
          advanceTeam(team, teamName, socket);
        }
      } else {
        socket.emit('wrong-answer', { enigmaId });
      }
      return;
    }

    // Réponse standard
    if (checkAnswer(enigma, answer)) {
      advanceTeam(team, teamName, socket);
    } else {
      socket.emit('wrong-answer', { enigmaId });
    }
  });

  function advanceTeam(team, teamName, socket) {
    team.currentEnigma++;
    team.score++;
    if (team.currentEnigma >= enigmas.length) {
      team.completed = true;
      rankings.push({ teamName, time: new Date().toLocaleTimeString('fr-FR') });
      io.to(teamName).emit('game-won', { rankings });
      if (!gameFinished) gameFinished = true;
    } else {
      io.to(teamName).emit('correct-answer');
      setTimeout(() => {
        io.to(teamName).emit('enigma', getTeamState(teamName));
      }, 1500);
    }
    broadcastAdmin();
  }

  // Demander un indice
  socket.on('request-hint', () => {
    const teamName = socket.data.teamName;
    if (!teamName) return;
    const enigma = enigmas[teams[teamName].currentEnigma];
    if (enigma?.hint) {
      socket.emit('hint', { text: enigma.hint });
    }
  });

  // Admin
  socket.on('admin-auth', ({ password }) => {
    if (password === ADMIN_PASSWORD) {
      socket.join('admin');
      socket.emit('admin-ok');
      broadcastAdmin();
    } else {
      socket.emit('admin-fail');
    }
  });

  socket.on('admin-start', () => {
    gameStarted = true;
    Object.keys(teams).forEach(t => { teams[t].currentEnigma = 0; teams[t].completed = false; teams[t].score = 0; });
    rankings = [];
    gameFinished = false;
    io.emit('game-start');
    Object.keys(teams).forEach(t => io.to(t).emit('enigma', getTeamState(t)));
    broadcastAdmin();
  });

  socket.on('admin-reset', () => {
    gameStarted = false;
    gameFinished = false;
    rankings = [];
    Object.keys(teams).forEach(t => {
      teams[t].currentEnigma = 0;
      teams[t].completed = false;
      teams[t].score = 0;
      teams[t].players = [];
    });
    io.emit('game-reset');
    broadcastAdmin();
  });

  socket.on('admin-hint', ({ teamName }) => {
    const enigma = enigmas[teams[teamName]?.currentEnigma];
    if (enigma?.hint) io.to(teamName).emit('hint', { text: enigma.hint });
  });

  socket.on('admin-advance', ({ teamName }) => {
    const team = teams[teamName];
    if (!team) return;
    team.currentEnigma = Math.min(team.currentEnigma + 1, enigmas.length);
    if (team.currentEnigma < enigmas.length) {
      io.to(teamName).emit('enigma', getTeamState(teamName));
    }
    broadcastAdmin();
  });

  socket.on('disconnect', () => {
    broadcastAdmin();
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚔 Opération Acapulco — serveur lancé sur le port ${PORT}`));
