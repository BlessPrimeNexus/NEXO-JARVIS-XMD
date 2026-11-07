'use strict';

/*
 * Menu NEXO-JARVIS XMD — UN SEUL message (menu + boutons + bouton chaîne).
 * Le catalogue ci-dessous ne liste que des commandes réellement branchées dans main.js :
 * test/menu-routes.test.js le vérifie, donc le menu ne peut plus annoncer une commande fantôme.
 *
 * Réglage : .menustyle complet (défaut : menu + boutons dans le même message) | texte (sans boutons)
 */

const os = require('os');
const settings = require('../settings');
const channel = require('../lib/channel');
const displayFlags = require('../lib/displayFlags');
const { getPrefix } = require('../lib/prefix');
const style = require('../lib/style');

/* ─── Catalogue ─────────────────────────────────────────────── */

const MENUS = [
  {
    key: 'ai', icon: '🤖', label: 'IA', title: 'MENU IA',
    aliases: ['ia', 'intelligence', 'gpt'],
    commands: ['ai', 'gpt', 'gemini', 'chatbot']
  },
  {
    key: 'aiImage', icon: '🎨', label: 'IA IMAGE', title: 'MENU IA IMAGE',
    aliases: ['aiimage', 'imageia', 'iaimage', 'imagia'],
    commands: ['imagine', 'flux', 'dalle', 'sora', 'remini', 'removebg']
  },
  {
    key: 'download', icon: '📥', label: 'TÉLÉCHARGEMENT', title: 'MENU TÉLÉCHARGEMENT',
    aliases: ['downloads', 'telechargement', 'téléchargement', 'telechargements', 'dl'],
    commands: ['play', 'song', 'mp3', 'ytmp3', 'video', 'ytmp4', 'spotify', 'tiktok', 'instagram', 'igs', 'facebook', 'tourl']
  },
  {
    key: 'apk', icon: '📱', label: 'APK', title: 'MENU APK',
    aliases: ['apps', 'application', 'applications'],
    commands: ['apk', 'apksearch']
  },
  {
    key: 'group', icon: '👥', label: 'GROUPE', title: 'MENU GROUPE',
    aliases: ['groupe', 'groupes', 'groups', 'admin', 'administration', 'moderation', 'modération'],
    commands: ['groupinfo', 'staff', 'groupid', 'members', 'admins', 'nonadmins', 'groupstats', 'groupcreated', 'topmembers', 'rules', 'setrules', 'clearrules', 'grouplink', 'resetlink', 'revokeinvite', 'tagall', 'tag', 'hidetag', 'tagnotadmin', 'mentionall', 'mentionadmins', 'mentionnonadmins', 'poll', 'warn', 'warnings', 'clearwarns', 'kick', 'kickall', 'kickall2', 'kicktime', 'kickbots', 'promote', 'demote', 'promotetime', 'promoteall', 'demoteall', 'demoteadmin', 'mute', 'unmute', 'ban', 'unban', 'open', 'close', 'openchat', 'closechat', 'lockchat', 'unlockchat', 'restrictchat', 'unrestrictchat', 'slowmode', 'announce', 'approveall', 'setgname', 'setgdesc', 'setgpp', 'del', 'deleteall', 'clear', 'groupaudit', 'hijack', 'fixgroup', 'welcome', 'goodbye', 'jid']
  },
  {
    key: 'anti', icon: '🛡️', label: 'PROTECTIONS', title: 'MENU PROTECTIONS',
    aliases: ['protect', 'protection', 'protections', 'securite', 'sécurité', 'privacy', 'security'],
    commands: ['antilink', 'antitag', 'antibot', 'antibadword', 'antipromote', 'antimentiongc', 'antiflood', 'antispam', 'antimedia', 'antisticker', 'antivoice', 'antidelete', 'anticall', 'pmblocker']
  },
  {
    key: 'sticker', icon: '🦊', label: 'STICKERS', title: 'MENU STICKERS',
    aliases: ['stickers', 'autocollant', 'autocollants'],
    commands: ['sticker', 'simage', 'take', 'crop', 'attp', 'emojimix', 'stickertelegram']
  },
  {
    key: 'media', icon: '🎬', label: 'MÉDIAS', title: 'MENU MÉDIAS',
    aliases: ['medias', 'médias', 'image', 'images', 'effets'],
    commands: ['gif', 'vv', 'vv2', 'blur', 'wasted', 'circle', 'lgbt', 'lolice', 'comrade', 'gay', 'glass', 'jail', 'passed', 'triggered', 'simpcard', 'tonikawa', 'namecard', 'oogway', 'oogway2', 'tweet', 'ytcomment', 'heart', 'horny']
  },
  {
    key: 'search', icon: '🔍', label: 'RECHERCHE', title: 'MENU RECHERCHE',
    aliases: ['recherche', 'recherches', 'chercher'],
    commands: ['yts', 'wiki', 'define', 'lyrics', 'news', 'github', 'ss']
  },
  {
    key: 'tools', icon: '🛠️', label: 'OUTILS', title: 'MENU OUTILS',
    aliases: ['tool', 'outils', 'outil', 'utilitaires'],
    commands: ['translate', 'tts', 'ss', 'qr', 'calc', 'percent', 'password', 'encode', 'decode', 'count', 'upper', 'lower', 'reverse', 'idch', 'tourl']
  },
  {
    key: 'fun', icon: '🎮', label: 'DIVERTISSEMENT', title: 'MENU DIVERTISSEMENT',
    aliases: ['divertissement', 'amusement', 'funny'],
    commands: ['joke', 'quote', 'fact', 'meme', 'compliment', 'insult', 'flirt', 'goodnight', 'shayari', 'roseday', 'character', 'simp', 'stupid', 'pies', 'china', 'india', 'indonesia', 'japan', 'korea', 'malaysia', 'thailand']
  },
  {
    key: 'game', icon: '🎯', label: 'JEUX', title: 'MENU JEUX',
    aliases: ['games', 'jeu', 'jeux'],
    commands: ['tictactoe', 'move', 'surrender', 'hangman', 'guess', 'trivia', 'answer', '8ball', 'truth', 'dare', 'ship', 'dice', 'flip', 'choose']
  },
  {
    key: 'economy', icon: '💰', label: 'ÉCONOMIE', title: 'MENU ÉCONOMIE',
    aliases: ['economie', 'économie', 'eco', 'money', 'argent'],
    commands: ['balance', 'daily', 'work', 'deposit', 'withdraw', 'transfer', 'gamble', 'richest']
  },
  {
    key: 'religi', icon: '🟣', label: 'RELIGION', title: 'MENU RELIGION',
    aliases: ['religion', 'religions', 'religieux'],
    commands: ['quran', 'bible', 'prayer']
  },
  {
    key: 'status', icon: '📸', label: 'STATUTS', title: 'MENU STATUTS',
    aliases: ['statut', 'statuts', 'story', 'stories'],
    commands: ['addstatut', 'gstatus', 'autostatus', 'areact']
  },
  {
    key: 'owner', icon: '👑', label: 'PROPRIÉTAIRE', title: 'MENU PROPRIÉTAIRE',
    aliases: ['proprietaire', 'propriétaire', 'proprio', 'panel', 'console', 'settings', 'reglages', 'réglages', 'config'],
    commands: ['mode', 'owners', 'autoread', 'autotyping', 'areact', 'fakeract', 'channelalert', 'setpp', 'panel', 'sessions', 'delsession', 'ram', 'gc', 'logs', 'disk', 'dltest', 'config', 'lang', 'restart', 'cleartmp', 'clearsession', 'update', 'stats', 'settings', 'prefix', 'setprefix', 'setcmd', 'mention', 'setmention', 'menustyle', 'quotecard', 'preview', 'imagemode', 'replystyle', 'viewtest', 'followchannel']
  },
  {
    key: 'profile', icon: '👤', label: 'PROFIL', title: 'MENU PROFIL',
    aliases: ['profil', 'profils', 'moi'],
    commands: ['profile', 'getpp', 'setpp', 'setbio', 'setname', 'owner']
  },
  {
    key: 'notes', icon: '📝', label: 'NOTES', title: 'MENU NOTES',
    aliases: ['note', 'memo', 'mémo', 'carnet'],
    commands: ['addnote', 'notes', 'delnote', 'clearnotes']
  },
  {
    key: 'cyber', icon: '🔒', label: 'CYBER', title: 'MENU CYBER',
    aliases: ['cybersecurite', 'cybersécurité', 'hack', 'reseau', 'réseau'],
    commands: ['ip', 'dns', 'hash', 'b64', 'unb64', 'passcheck', 'genpass', 'urlcheck']
  },
  {
    key: 'logo', icon: '✨', label: 'LOGOS', title: 'MENU LOGOS',
    aliases: ['logos', 'logotype'],
    commands: ['neon', 'devil', 'purple', 'hacker', 'blackpink', 'glitch', 'fire', '1917', 'arena']
  },
  {
    key: 'textEffects', icon: '🎨', label: 'EFFETS DE TEXTE', title: 'MENU EFFETS DE TEXTE',
    aliases: ['effetstexte', 'texteffect', 'texteffects', 'effetsdetexte'],
    commands: ['metallic', 'ice', 'snow', 'impressive', 'matrix', 'light', 'thunder', 'leaves', 'sand']
  },
  {
    key: 'music', icon: '🎵', label: 'MUSIQUE', title: 'MENU MUSIQUE',
    aliases: ['musique', 'musiques', 'musics'],
    commands: ['play', 'song', 'mp3', 'ytmp3', 'spotify', 'lyrics', 'music']
  },
  {
    key: 'anime', icon: '🌸', label: 'ANIME', title: 'MENU ANIME',
    aliases: ['animes', 'animu'],
    commands: ['animu', 'animuquote', 'nom', 'poke', 'cry', 'kiss', 'pat', 'hug', 'wink', 'facepalm']
  },
  {
    key: 'convert', icon: '🔄', label: 'CONVERSION', title: 'MENU CONVERSION',
    aliases: ['convertir', 'conversion', 'converter'],
    commands: ['sticker', 'simage', 'tourl', 'tts', 'translate', 'attp', 'emojimix', 'tomp3']
  },
  {
    key: 'utils', icon: '⚙️', label: 'UTILITAIRES', title: 'MENU UTILITAIRES',
    aliases: ['util', 'utilitaire', 'heure', 'infos', 'info', 'maths', 'calcul'],
    commands: ['calc', 'percent', 'date', 'time', 'age', 'countdown', 'uptime', 'ping', 'alive', 'pair', 'stats', 'repo', 'qr']
  },
  {
    key: 'broadcast', icon: '📡', label: 'DIFFUSION', title: 'MENU DIFFUSION',
    aliases: ['diffusion', 'bc', 'annonce'],
    commands: ['broadcast', 'bcgc', 'listgc']
  },
  {
    key: 'random', icon: '🎲', label: 'ALÉATOIRE', title: 'MENU ALÉATOIRE',
    aliases: ['aleatoire', 'aléatoire', 'hasard'],
    commands: ['random', 'dice', 'flip', 'choose', '8ball', 'color', 'emoji']
  },
  {
    key: 'social', icon: '💞', label: 'SOCIAL', title: 'MENU SOCIAL',
    aliases: ['sociale', 'amour', 'love'],
    commands: ['ship', 'flirt', 'compliment', 'hug', 'kiss', 'pat', 'wink', 'poke', 'cry', 'simp', 'heart']
  },
  {
    key: 'weather', icon: '🌤️', label: 'MÉTÉO', title: 'MENU MÉTÉO',
    aliases: ['meteo', 'météo', 'climat'],
    commands: ['weather', 'meteo', 'forecast']
  },
  {
    key: 'health', icon: '💪', label: 'SANTÉ', title: 'MENU SANTÉ',
    aliases: ['sante', 'santé', 'fitness', 'forme'],
    commands: ['bmi', 'bmr', 'water', 'idealweight', 'sleep']
  },
  {
    key: 'premium', icon: '💎', label: 'PREMIUM', title: 'MENU PREMIUM',
    aliases: ['vip', 'prime'],
    commands: ['premium', 'sudo', 'kicktime', 'promotetime']
  },
];

// Commandes affichées en tête du menu principal.
const MAIN_COMMANDS = ['ping', 'pair'];

function allCommands() {
  const set = new Set(MAIN_COMMANDS);
  for (const menu of MENUS) for (const command of menu.commands) set.add(command);
  return set;
}

const commandCount = () => allCommands().size;

/* ─── Outils de mise en forme ───────────────────────────────── */

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [plural(d, 'jour', 'jours'), plural(h, 'heure', 'heures'), plural(m, 'minute', 'minutes'), plural(s, 'seconde', 'secondes')].join(' • ');
}

function nowText() {
  const now = new Date();
  const date = now.toLocaleDateString('fr-FR', { timeZone: 'Africa/Kinshasa' });
  const time = now.toLocaleTimeString('fr-FR', { timeZone: 'Africa/Kinshasa', hour12: false });
  return `${date} ${time}`;
}

function sessionStats() {
  let total = 0;
  let active = 0;
  try {
    total = require('../lib/session-manager').sessionManager.listSessions().length;
  } catch { /* gestionnaire indisponible */ }
  try {
    active = require('../lib/botInstance').getConnectedBots().length;
  } catch { /* aucune instance */ }
  if (!total) total = active;
  return { total, active };
}

// Durée courte : « 15 h 23 min », « 34 min 7 s »… (les unités à zéro en tête disparaissent).
function shortDuration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const parts = [
    [Math.floor(seconds / 86400), 'j'], [Math.floor((seconds % 86400) / 3600), 'h'],
    [Math.floor((seconds % 3600) / 60), 'min'], [seconds % 60, 's']
  ];
  const first = parts.findIndex(([value]) => value > 0);
  return (first === -1 ? [[0, 's']] : parts.slice(first, first + 3)).map(([value, unit]) => `${value} ${unit}`).join(' ');
}

function menuHeader({ user, prefix, menuName }) {
  const { total, active } = sessionStats();
  const now = new Date();
  return style.header(`🤖 ${settings.botName || 'NEXO-JARVIS XMD'}`, [
    ['Utilisateur', user],
    ['Préfixe', `[${prefix}]`],
    ['Propriétaire', settings.menuOwner || settings.botOwner || 'NEXO-JARVIS'],
    ['Commandes', commandCount()],
    ['Sessions', `${active} / ${total}`],
    ['Bot actif', shortDuration(process.uptime())],
    ['Serveur actif', shortDuration(os.uptime())],
    ['Date', now.toLocaleDateString('fr-FR', { timeZone: 'Africa/Kinshasa' })],
    ['Heure', now.toLocaleTimeString('fr-FR', { timeZone: 'Africa/Kinshasa', hour12: false })],
    ['Statut', '🟢 En ligne']
  ]);
}

// Une boîte par catégorie : ╭═『 👥 Groupe 』═╮ / │ ◈ .commande / ╰═══╯
function categoryBox(menu, prefix) {
  return style.listBox(`${menu.icon} ${menu.label}`, menu.commands.map(command => `${prefix}${command}`));
}

function footerText() {
  return '';
}

// Le bas du menu n'est écrit qu'UNE fois : dans le pied du message à boutons, ou à la fin du texte simple.
function textTail() {
  return '';
}

/* ─── Contenu des vues ──────────────────────────────────────── */

function mainMenuItems(prefix) {
  const items = [`🏓 ${prefix}ping`, `🔗 ${prefix}pair`];
  for (const menu of MENUS) items.push(`${menu.icon} ${prefix}${menu.key}menu`);
  items.push(`📜 ${prefix}allmenu`);
  return items;
}

// Présentation de la capture, en français : titre, salutation, bloc « INFORMATIONS DU BOT » (barre verticale), boutons.
function greeting(date = new Date()) {
  const hour = Number(date.toLocaleString('en-GB', { timeZone: 'Africa/Kinshasa', hour: '2-digit', hour12: false })) % 24;
  if (hour < 5) return 'Bonne nuit 🌙';
  if (hour < 12) return 'Bonjour ☀️';
  if (hour < 18) return 'Bon après-midi 🌤️';
  if (hour < 22) return 'Bonsoir 🌆';
  return 'Bonne nuit 🌙';
}

const MENU_FOOTER = () => `À utiliser avec responsabilité | ${settings.menuOwner || settings.botOwner || 'NEXO-JARVIS'}`;

function overviewText(ctx) {
  const { total, active } = sessionStats();
  const now = new Date();
  const botName = settings.botName || 'NEXO-JARVIS XMD';
  const info = [
    ['🍵', 'Créateur', settings.menuOwner || settings.botOwner || 'NEXO-JARVIS'],
    ['🍔', 'Nom', botName],
    ['🍉', 'Version', settings.version || '2.0.0'],
    ['🔣', 'Préfixe', `[${ctx.prefix}]`],
    ['📚', 'Commandes', commandCount()],
    ['🔌', 'Sessions', `${active} / ${total}`],
    ['⏳', 'Disponibilité', shortDuration(process.uptime())],
    ['🕒', 'Heure', now.toLocaleTimeString('fr-FR', { timeZone: 'Africa/Kinshasa' })]
  ];
  return [
    `🌐 *BOT WHATSAPP MULTI-APPAREILS*`,
    `${greeting(now)} *${ctx.user}*, je m'appelle *${botName}*.`,
    `✨ _Je peux vous aider dans de nombreuses tâches sur WhatsApp._`,
    '```INFORMATIONS DU BOT```\n' + info.map(([icon, label, value]) => `> ${icon} *${label} :* ${value}`).join('\n'),
    `👇 _Touchez « Voir toutes les options » pour choisir une catégorie._`
  ].join('\n\n');
}

function categoryText(menu, ctx) {
  return [
    menuHeader({ ...ctx, menuName: menu.label }),
    categoryBox(menu, ctx.prefix)
  ].join('\n\n');
}

function allMenuText(ctx) {
  return [
    menuHeader({ ...ctx, menuName: 'Tous les menus' }),
    ...MENUS.map(menu => categoryBox(menu, ctx.prefix))
  ].join('\n\n');
}

function findMenu(query) {
  if (/^\d+$/.test(String(query).trim())) return MENUS[Number(query) - 1] || null;
  const wanted = normalize(String(query || '').replace(/menu$/i, ''));
  if (!wanted) return null;
  return MENUS.find(menu =>
    normalize(menu.key) === wanted ||
    normalize(menu.label) === wanted ||
    normalize(menu.title) === wanted ||
    menu.aliases.some(alias => normalize(alias) === wanted)
  ) || null;
}

/* ─── Boutons (native flow) ─────────────────────────────────── */

// Présentation « Please select any category » : une seule liste, une ligne par catégorie (icône + nom + « Menu »).
function listButton(prefix) {
  const rows = MENUS.map(menu => ({
    header: '',
    title: `${menu.icon} ${menu.key} Menu`,
    description: '',
    id: `${prefix}${menu.key.toLowerCase()}menu`
  }));
  return { name: 'single_select', params: { title: 'Veuillez choisir une catégorie', sections: [{ title: '', highlight_label: '', rows }] } };
}

function creatorUrl() {
  const number = String(settings.ownerNumber || (Array.isArray(settings.ownerNumbers) && settings.ownerNumbers[0]) || '').replace(/\D/g, '');
  return number ? `https://wa.me/${number}` : channel.link();
}

// « Visit My Creator » : premier élément de la feuille, comme sur la capture.
const creatorButton = () => ({
  name: 'cta_url',
  params: { display_text: 'Visiter mon créateur', url: creatorUrl(), merchant_url: creatorUrl() }
});

const quickButton = (text, id) => ({ name: 'quick_reply', params: { display_text: text, id } });

function buttonsFor(view, prefix) {
  if (view === 'overview') return [creatorButton(), listButton(prefix)];
  return [creatorButton(), listButton(prefix), quickButton('↩️ Menu principal', `${prefix}menu`)];
}

/* ─── Envoi : TOUJOURS un seul message ──────────────────────── */

async function sendMenu(sock, chatId, message, text, senderId, view, prefix) {
  const style = displayFlags.getValue('menuStyle') === 'texte' ? 'texte' : 'complet';

  // « allmenu » est trop long pour un message à boutons : il part en texte simple (toujours un seul message).
  if (style === 'complet' && view !== 'all') {
    try {
      const { sendInteractiveMessage } = require('../lib/interactiveButtons');
      const presentation = require('../lib/presentation');
      // Mode « vraie image » : la photo est en tête du menu (sinon aperçu de lien intégré).
      const photo = presentation.imageReplyEnabled() ? await presentation.nextPhoto() : null;
      await sendInteractiveMessage(sock, chatId, {
        title: '',
        body: text,
        
        buttons: buttonsFor(view, prefix),
        footer: view === 'overview' ? MENU_FOOTER() : '',
        keepFooter: view === 'overview',
        image: photo,
        preview: !photo,
        quoted: message
      });
      return;
    } catch (error) {
      console.warn('[menu] Boutons indisponibles, envoi du menu en texte :', error.message);
    }
  }

  // Menu en texte : le bouton « Voir la chaîne », l'aperçu d'image et la fausse citation sont ajoutés par lib/presentation.js.
  await sock.sendMessage(chatId, { text: text + textTail(), __noframe: true }, { quoted: message });
}

// Retrouve la commande à partir du titre d'une ligne choisie (« 👥 group Menu »).
function resolveMenuChoice(title, prefix = '.') {
  const clean = normalize(String(title).replace(/^[^\p{L}\p{N}]+/u, ''));
  if (!clean) return '';
  if (clean === normalize('Tous les menus')) return `${prefix}allmenu`;
  if (clean === normalize('Menu principal')) return `${prefix}menu`;
  if (clean === normalize('Diagnostic système')) return `${prefix}ping`;
  const menu = MENUS.find(item => {
    const names = [item.key, `${item.key}menu`, item.label, item.title].map(normalize);
    return names.includes(clean);
  });
  return menu ? `${prefix}${menu.key}menu` : '';
}

async function helpCommand(sock, chatId, message, query = '') {
  const senderId = message.key.participant || message.key.remoteJid || '';
  const senderNum = senderId.split('@')[0].split(':')[0] || '?';
  const user = (message.pushName && String(message.pushName).trim()) || senderNum;
  const prefix = getPrefix(chatId);
  const ctx = { user, prefix };
  const wanted = String(query || '').trim();
  const key = normalize(wanted);

  if (!wanted || ['menu', 'main', 'principal', 'categories', 'category', 'help', 'aide'].includes(key)) {
    await sendMenu(sock, chatId, message, overviewText(ctx), senderId, 'overview', prefix);
    return;
  }

  if (['all', 'allmenu', 'full', 'tout', 'tous', 'list'].includes(key)) {
    await sendMenu(sock, chatId, message, allMenuText(ctx), senderId, 'all', prefix);
    return;
  }

  const menu = findMenu(wanted);
  if (!menu) {
    const notice = `*⚠️ Aucun menu ne correspond à « ${wanted} ».*`;
    await sendMenu(sock, chatId, message, `${notice}\n\n${overviewText(ctx)}`, senderId, 'overview', prefix);
    return;
  }

  await sendMenu(sock, chatId, message, categoryText(menu, ctx), senderId, 'category', prefix);
}

module.exports = helpCommand;
module.exports.resolveMenuChoice = resolveMenuChoice;
module.exports.listButtonRows = prefix => listButton(prefix).params.sections[0].rows;
module.exports.MENUS = MENUS;
module.exports.MAIN_COMMANDS = MAIN_COMMANDS;
module.exports.allCommands = allCommands;
module.exports.commandCount = commandCount;
module.exports.overviewText = overviewText;
module.exports.allMenuText = allMenuText;
module.exports.findMenu = findMenu;
module.exports.formatDuration = formatDuration;
module.exports.shortDuration = shortDuration;
