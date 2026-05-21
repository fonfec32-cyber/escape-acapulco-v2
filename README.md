# 🚔 Opération Acapulco — v2

Escape game Police Municipale — Affaire Moreau

## Structure
```
escape-acapulco-v2/
├── server.js                  ← Serveur Node.js / Socket.io (23 énigmes)
├── package.json
├── Procfile                   ← Déploiement Render
└── public/
    ├── index.html             ← Interface joueurs (thème dark police)
    ├── admin.html             ← Poste de commandement organisateur
    ├── clue-a.html            ← QR Zone Alpha 🔴 (SMS anonyme → 2023)
    ├── clue-b.html            ← QR Zone Bravo 🔵 (registre faux PV → 7)
    ├── clue-c.html            ← QR Zone Charlie 🟢 (véhicule → 69)
    └── js/
        └── app.js             ← Logique client

## Installation locale
```bash
npm install
npm start
# → http://localhost:3000
```

## Déploiement Render
1. Push sur GitHub
2. New Web Service → connecter le repo
3. Build Command : `npm install`
4. Start Command : `node server.js`
5. Variable d'env : `ADMIN_PASSWORD=votre_mot_de_passe`

## URLs importantes
- Joueurs : https://votre-app.render.com
- Admin : https://votre-app.render.com/admin.html
- QR Alpha 🔴 : https://votre-app.render.com/clue/zone-alpha
- QR Bravo 🔵 : https://votre-app.render.com/clue/zone-bravo
- QR Charlie 🟢 : https://votre-app.render.com/clue/zone-charlie

## QR Codes à imprimer
Générer 3 QR codes pointant vers les URL ci-dessus :
- Fixer le QR Alpha avec un ruban ROUGE dans le parc
- Fixer le QR Bravo avec un ruban BLEU
- Fixer le QR Charlie avec un ruban VERT

## Mot de passe admin par défaut
`acapulco2025` (à changer via variable d'env ADMIN_PASSWORD)

## Les 23 étapes — résumé
| # | Type | Réponse |
|---|------|---------|
| 1 | QCM Police | Établir un périmètre de sécurité |
| 2 | Anagramme | ETIENNE MOREAU |
| 3 | Code César | 2025 |
| 4 | Intrus | 3 |
| 5 | Carte | BORDELAN |
| 6 | Calcul | 215 |
| 7 | Cadenas | 1305 |
| 8 | QR Zone Alpha 🔴 | 2023 |
| 9 | Plan parc | B4 |
| 10 | Mots cachés | RENAULT |
| 11 | QCM Police | LAPI |
| 12 | Puzzle | 2-4-1-3 |
| 13 | QR Zone Bravo 🔵 | 7 |
| 14 | Intrus | 4 |
| 15 | Code numérique | SUSPECT |
| 16 | Cadenas | 1217 |
| 17 | Anagramme | ELU LOCAL |
| 18 | QCM Police | Oui sans restriction |
| 19 | Énigme texte | CORRUPTION |
| 20 | QR Zone Charlie 🟢 | 69 |
| 21 | Chronologie | 3-2-4-5-1 |
| 22 | Coffre 4 verrous | 1884 / Humbert 3 / La Calade / 10 crus |
| 23 | Final 3 questions | Corruption / Élu local / 80-1 |
