<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:7B2FBE,50:00D4FF,100:7B2FBE&height=200&section=header&text=NEXO-JARVIS%20XMD&fontSize=60&fontColor=ffffff&animation=fadeIn&fontAlignY=38&desc=WhatsApp%20Bot%20%7C%20Web%20Pairing%20Panel&descAlignY=60&descColor=00D4FF" width="100%"/>

<br/>

[![Typing SVG](https://readme-typing-svg.demolab.com?font=Fira+Code&size=22&pause=800&color=00D4FF&center=true&vCenter=true&width=600&lines=🤖+NEXO-JARVIS+XMD+—+WhatsApp+Bot;🌐+Web+Pairing+Panel+on+Render;⚡+Deploy+in+1+Click+•+24%2F7+Online;✅+No+Errors+•+Pro+Grade+Code)](https://git.io/typing-svg)

<br/>

<a href="https://github.com/BlessPrimeNexusDev/NEXO-JARVIS-XMD/stargazers">
  <img src="https://img.shields.io/github/stars/BlessPrimeNexusDev/NEXO-JARVIS-XMD?style=for-the-badge&logo=github&color=7B2FBE&labelColor=0d1117" alt="Stars"/>
</a>
<a href="https://github.com/BlessPrimeNexusDev/NEXO-JARVIS-XMD/network/members">
  <img src="https://img.shields.io/github/forks/BlessPrimeNexusDev/NEXO-JARVIS-XMD?style=for-the-badge&logo=github&color=00D4FF&labelColor=0d1117" alt="Forks"/>
</a>
<img src="https://img.shields.io/badge/Node.js-18%2B-brightgreen?style=for-the-badge&logo=node.js&labelColor=0d1117"/>
<img src="https://img.shields.io/badge/Render-Deploy-46E3B7?style=for-the-badge&logo=render&labelColor=0d1117"/>
<img src="https://img.shields.io/badge/WhatsApp-Baileys-25D366?style=for-the-badge&logo=whatsapp&labelColor=0d1117"/>
<img src="https://img.shields.io/badge/Status-Online%20247-00ff88?style=for-the-badge&logo=statuspage&labelColor=0d1117"/>

</div>

---

<div align="center">

## 🌐 Deploy on Render — 1 Click

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/BlessPrimeNexusDev/NEXO-JARVIS-XMD)

</div>

---

## ✨ Features

```
╔══════════════════════════════════════════════════════╗
║  🌐  Web Pairing Panel — deployed on Render          ║
║  ⚡  Instant pairing code via WhatsApp               ║
║  🛡️  100+ Commands — AI, Stickers, Media, Games     ║
║  🔒  Anti-Bad Word, Anti-Link, Anti-Delete           ║
║  🎵  Music & Video Download (YouTube, Spotify)       ║
║  🤖  AI Chatbot + Image Generation                   ║
║  👑  Full Admin Management                           ║
║  📊  Group Stats & Top Members                       ║
╚══════════════════════════════════════════════════════╝
```

---

## 🚀 Deploy on Render

### Step 1 — Fork the Repository
```
https://github.com/BlessPrimeNexusDev/NEXO-JARVIS-XMD
```
Click **Fork** (top right) to copy the repo to your account.

### Step 2 — Deploy on Render
1. Go to **https://render.com** → Sign in / Sign up (free)
2. Click **New +** → **Web Service**
3. Connect your GitHub account and select: `NEXO-JARVIS-XMD`
4. Fill in the settings:
   - **Name:** `nexo-jarvis-xmd` (or any name you like)
   - **Region:** Choose the nearest to you
   - **Branch:** `main`
   - **Runtime:** `Node`
   - **Build Command:** `npm install --legacy-peer-deps`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free`
5. Under **Environment Variables**, add:
   - `OWNER_NUMBER` → your WhatsApp number without `+` (e.g. `224610835573`)
6. Click **Create Web Service** ✅

> Render will automatically detect `render.yaml` in the repo and pre-fill the settings.
> The default blueprint uses a persistent disk on the Starter plan. Render Free
> does not provide the persistent shared storage or multiple free workers needed
> for reliable multi-session production.

### Step 3 — Get Your Pairing Link
Your panel will be live at:
```
https://nexo-jarvis-xmd.onrender.com
```
*(or the custom URL Render assigns you)*

Enter your WhatsApp number → Get the 8-digit pairing code → Link your bot!

---

## 🦖 Deploy on Pterodactyl

Works great — unlike free hosts, Pterodactyl gives a **persistent disk by
default**, so linked WhatsApp sessions survive restarts without a paid plan.

1. **Create a server** on your Pterodactyl panel using a **Node.js** egg
   (generic "Node.js" / "Generic Node" egg is fine — version **20.x**).
2. **Upload the project files** into the server's file manager (or push via
   SFTP/Git if your panel supports it) — the whole content of this ZIP,
   extracted, goes at the root of the server (same level as `package.json`).
3. **Startup command**, in the egg/server Startup settings:
   ```
   node web.js
   ```
   (or `npm start`, which runs the same file)
4. **Install command** (if your egg lets you set one, otherwise run it once
   in the panel's console):
   ```
   corepack enable && pnpm install --frozen-lockfile
   ```
   If `pnpm`/`corepack` isn't available in your image, `npm install
   --legacy-peer-deps` also works.
5. **Environment variables** — set these in the panel's *Startup* /
   *Variables* tab (copy from `.env.example`):
   - `OWNER_NUMBER` → your WhatsApp number, no `+`
   - `PORT` (or `SERVER_PORT`, both are read) → match the port your egg
     allocates/exposes
   - Optionally `ADMIN_TOKEN`, API keys, etc.
6. **Leave `SESSION_DIR` unset.** The bot defaults to `./sessions` inside
   the project folder, which lives on your Pterodactyl server's persistent
   disk — sessions are kept across restarts automatically.
7. Start the server, open `http://your-panel-address:PORT/` (or the domain
   your host gives you) → pair your number exactly like on Render.

> `render.yaml` and `railway.toml` in this repo are only used by Render and
> Railway respectively — Pterodactyl ignores them, you can leave them or
> delete them, they don't interfere.

---

## 🖼️ Aperçus d'images & bouton « Voir la chaîne »

Toutes les réponses du bot portent le bouton **Voir la chaîne** (newsletter), et les
réponses texte affichent un **aperçu de lien avec une image** choisie à tour de rôle
(aucune photo n'est envoyée : la galerie des utilisateurs reste propre).

1. Les 10 images prêtes à l'emploi sont dans le dossier `jarvis-images/` (1200×630).
2. Héberge-les sur [catbox.moe](https://catbox.moe) (ou utilise les tiennes).
3. Dans `settings.js`, remplace les 10 liens `REMPLACE_xx` de `previewImages`
   (ou définis la variable `PREVIEW_IMAGES`, liens séparés par des virgules).
4. Redémarre le bot. Tant qu'un lien contient « REMPLACE », il est ignoré.

La rotation fonctionne en « sac mélangé » : chaque image sort une fois par cycle,
dans un ordre aléatoire, sans jamais répéter la même deux fois de suite.
Le code se trouve dans `lib/presentation.js` (il n'altère aucune commande).

---

## 👁️ Tout le monde doit voir les réponses du bot

**Constat** : un membre qui voit la *réaction* du bot mais aucune réponse (ni message, ni notification) reçoit bien
les messages, mais son téléphone ne sait pas afficher leur **forme**. Les formats « WhatsApp Business » en sont la
cause la plus probable : les applications WhatsApp Messenger les ignorent sans rien afficher.

**Ce qui est maintenant envoyé à tout le monde, sur CHAQUE réponse du bot** (texte, audio, sticker, contact, sondage…,
avec ou sans citation d'origine) :

- la **fausse citation « WhatsApp ✓ • Statut »** (1000 articles, demandeur, commande, logo), en présentation
  *universelle* (citation d'image de statut, lue par toutes les versions de WhatsApp). Les messages spontanés
  (bienvenue, alertes…) affichent « Commande : automatique » ;
- le bouton **« Voir la chaîne »** ;
- l'**aperçu d'image** tournant (sur les messages texte : un audio ou un sticker ne peut pas porter d'aperçu de lien).

**Menus** : `.menu` envoie d'abord le **menu en texte** (visible partout) puis, juste dessous, la **barre de boutons**
(liste des catégories, menu complet, CHAÎNE). Un téléphone qui n'affiche pas les boutons voit quand même tout le menu.

**Autres corrections** : structure standard des messages à boutons (`messageContextInfo`), anciens `buttonsMessage`
(`.shayari`, `.meme`) supprimés (invisibles sur la plupart des téléphones), mémoire des messages envoyés pour les renvoyer
à un téléphone qui n'a pas pu les déchiffrer (`lib/sentMessages.js`).

**Si un membre ne voit toujours rien : `.viewtest`** (tout le monde peut le lancer, 1 fois par minute et par discussion).
Le bot envoie 8 messages du plus simple au plus riche (1 texte simple, 2 + bouton chaîne, 3 + aperçu d'image, 4 + citation
normale, 5 + fausse citation universelle, 6 + carte de commande Business, 7 boutons, 8 liste). Le membre donne les numéros
qu'il voit : le premier qui manque désigne le format fautif.

**Interrupteurs** (propriétaire, sans redéployer) :
`.menustyle mixte|complet|texte` · `.quotecard on|off|universal|business`.
Valeurs par défaut dans `settings.js` (`menuStyle`, `quoteCard`, `quoteCardStyle`), réglages enregistrés dans `data/display.json`.

---

## 🔗 `.pair`, 🤖 IA, 👋 welcome

- **`.pair <numéro>`** lie un autre numéro WhatsApp au bot : le moteur de jumelage démarre
  dans le bot à la première demande (aucun panneau web ni port public nécessaires) et le
  code à 8 caractères est renvoyé dans la discussion, puis seul dans un second message
  pour le copier d'un appui. 3 numéros maximum par demande. Chaque session liée consomme
  de la mémoire : surveille la RAM de ton hébergement.
- **`.gpt`, `.gemini`, `.imagine`, chatbot** : cascade de fournisseurs (`lib/aiClient.js`).
  Pour une IA fiable, ajoute une clé gratuite (`GEMINI_API_KEY` ou `GROQ_API_KEY`) dans
  les variables d'environnement ou le fichier `.env`. Les échecs sont visibles dans la
  console (`[ia] …`).
- **`.welcome` / `.goodbye`** : `on`, `off`, `test` (aperçu), `set <texte>` (message
  personnalisé avec `{user} {group} {count} {description} {date} {time} {author}`) et `reset`.

---

## 🔗 How Pairing Works

```
┌─────────────────────────────────────────────────────┐
│  1. Visit your Render URL                           │
│  2. Enter your WhatsApp number (with country code)  │
│  3. Click "Get Pairing Code"                        │
│  4. Open WhatsApp → Linked Devices → Link a Device  │
│  5. Enter the 8-digit code                          │
│  6. Bot connected! ✅                               │
└─────────────────────────────────────────────────────┘
```

---

## 📋 Commands List

<details>
<summary><b>🛡️ Group Management</b></summary>

| Command | Description |
|---------|-------------|
| `.kick @user` | Kick a member |
| `.promote @user` | Promote to admin |
| `.demote @user` | Remove admin |
| `.ban @user` | Ban a member |
| `.tagall` | Tag all members |
| `.hidetag` | Tag all (hidden) |
| `.groupinfo` | Show group info |

</details>

<details>
<summary><b>🔒 Anti-Spam & Protection</b></summary>

| Command | Description |
|---------|-------------|
| `.antilink on/off` | Block links |
| `.antibadword on/off` | Block bad words |
| `.antidelete on/off` | Show deleted msgs |
| `.antibot on/off` | Block other bots |
| `.anticall on/off` | Reject calls |

</details>

<details>
<summary><b>🎵 Media & Download</b></summary>

| Command | Description |
|---------|-------------|
| `.play [song]` | Play music |
| `.song [name]` | Download audio |
| `.video [name]` | Download video |
| `.tiktok [url]` | Download TikTok |
| `.spotify [url]` | Spotify download |

</details>

<details>
<summary><b>🤖 AI & Fun</b></summary>

| Command | Description |
|---------|-------------|
| `.ai [question]` | Ask AI |
| `.imagine [prompt]` | Generate image |
| `.sticker` | Create sticker |
| `.attp [text]` | Animated sticker |
| `.joke` | Random joke |
| `.meme` | Random meme |
| `.tictactoe` | Play game |

</details>

---

## ⚙️ Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OWNER_NUMBER` | Administrator WhatsApp number (no `+`) | ✅ Yes |
| `BOT_NUMBER` | WhatsApp number that will be paired as the bot (no `+`) | Recommended |

`OWNER_NUMBER` and `BOT_NUMBER` are intentionally separate. Existing sessions under the persistent disk are restored automatically; pairing a new bot account never overwrites `data/owner.json`.
| `PORT` | Listening port. Auto-set by Render/Railway; on Pterodactyl, set it to the port your egg allocates (`SERVER_PORT` is also read as a fallback) | Auto |
| `PREFIX` | Command prefix (default `.`) | No |
| `BOT_NAME` | Bot display name | No |
| `WORKER_MAX_SESSIONS` | Real session slots per worker (default `100`) | No |
| `MAX_WORKERS` | In-process worker pool size (default `1`) | No |
| `WORKER_ID` | Stable worker identifier | No |
| `SESSION_REGISTRY_FILE` | Persistent metadata registry path | No |
| `ADMIN_TOKEN` | Protects worker/session administration routes | Recommended |
| `MAX_RECONNECT_ATTEMPTS` | Per-session reconnect ceiling | No |

### Multi-session runtime

`web.js` is the production entry point. A new `/pair` request is assigned a
stable `sessionId` and the least-loaded online worker. Each session has its own
Baileys auth directory, socket, message queue, reconnect lock and status record.
The default Render configuration deliberately uses one worker and a persistent
disk; setting `MAX_WORKERS` does not create extra Render services by itself.

Public runtime routes are `/health`, `/ready`, `/status` and `/pair` (with the
legacy `/code` alias preserved). The administrative `/workers`, `/sessions`,
`/session/:id`, `/session/:id/status`, `/debug` and `/reset` routes require
`ADMIN_TOKEN` in production. The registry stores metadata only, never Baileys
credentials.

---

## 📁 Project Structure

```
NEXO-JARVIS-XMD/
├── 📄 web.js              # Entry point — Express pairing server
├── 📄 index.js            # Bot core (WhatsApp connection)
├── 📄 main.js             # Message handler & commands router
├── 📄 config.js           # Bot configuration & API keys
├── 📄 settings.js         # Bot settings (name, owner, etc.)
├── 📄 render.yaml         # Render deployment config
├── 📄 package.json        # Node.js dependencies
├── 📁 public/
│   └── index.html         # Pairing panel UI
├── 📁 commands/           # 100+ command handlers
├── 📁 lib/                # Core utilities & helpers
├── 📁 data/               # JSON data stores
└── 📁 assets/             # Media assets
```

---

## 🛠️ Useful URLs (after deploy)

| URL | Description |
|-----|-------------|
| `/` | Pairing panel |
| `/health` | Service health check |
| `/debug` | Full diagnostic info |
| `/bot-logs` | Live bot logs |
| `/botStatus` | Bot connection status |
| `/reset` | Reset session (re-pair) |
| `/start-bot` | Force-start bot manually |

---

<div align="center">

## ⭐ Support

If this helped you, please **star the repo** 🌟

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:7B2FBE,50:00D4FF,100:7B2FBE&height=120&section=footer&animation=fadeIn" width="100%"/>

**Made with 💜 by ✘🦠𝗕𝗟𝗘𝗦𝗦 | 𝗗𝗘𝗩🧬»𝟰𝟬𝟰. ✘**

</div>
