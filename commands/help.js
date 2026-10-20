'use strict';

const fs = require('fs');
const path = require('path');
const settings = require('../settings');
const { getPrefix } = require('../lib/prefix');

const channelInfo = {
  contextInfo: {
    forwardingScore: 1,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
      newsletterJid: '120363426264191950@newsletter',
      newsletterName: '𝗡𝗘𝗫𝗢-𝗝𝗔𝗥𝗩𝗜𝗦 𝗫𝗠𝗗',
      serverMessageId: -1
    }
  }
};

// These are the commands exposed by the current NEXO-JARVIS command router.
// Keeping them here makes the menu searchable without changing command behavior.
const categories = [
  {
    key: 'confidentialite',
    title: 'ᴄᴏɴғɪᴅᴇɴᴛɪᴀʟɪᴛé',
    icon: '🔐',
    aliases: ['privacy', 'securite'],
    commands: ['antidelete', 'pmblocker', 'anticall', 'antibot', 'antilink']
  },
  {
    key: 'conversion',
    title: 'ᴄᴏɴᴠᴇʀsɪᴏɴ',
    icon: '🔄',
    commands: ['sticker', 'simage', 'stickertelegram', 'emojimix', 'translate', 'tts', 'attp']
  },
  {
    key: 'fun',
    title: 'ғᴜɴ',
    icon: '🎭',
    commands: ['joke', 'quote', 'fact', 'compliment', 'insult', 'flirt', 'truth', 'dare', 'ship', 'character']
  },
  {
    key: 'fx_audio',
    title: 'ғx_ᴀᴜᴅɪᴏ',
    icon: '🎧',
    aliases: ['audio', 'music'],
    commands: ['play', 'song', 'spotify', 'lyrics', 'tts', 'attp', 'wasted']
  },
  {
    key: 'groupe',
    title: 'ɢʀᴏᴜᴘᴇ',
    icon: '🛡️',
    aliases: ['group', 'groupes'],
    commands: [
      'groupinfo', 'staff', 'tagall', 'tag', 'hidetag', 'tagnotadmin',
      'kick', 'kickall', 'kickall2', 'promote', 'demote', 'warn', 'warnings',
      'mute', 'unmute', 'open', 'close', 'antilink', 'antitag',
      'antiflood', 'antispam', 'antimedia', 'antisticker', 'antivoice',
      'antibadword', 'antibot', 'welcome', 'goodbye', 'setgname',
      'setgdesc', 'setgpp', 'resetlink', 'delete', 'clear', 'deleteall',
      'groupid', 'members', 'admins', 'nonadmins', 'mentionall',
      'mentionadmins', 'mentionnonadmins', 'groupstats', 'groupcreated',
      'rules', 'setrules', 'clearrules', 'announce', 'grouplink',
      'revokeinvite', 'lockchat', 'unlockchat', 'restrictchat',
      'unrestrictchat', 'slowmode', 'clearwarns', 'promoteall',
      'demoteall', 'kickbots', 'poll', 'groupaudit', 'hijack',
      'groupmenu', 'openchat', 'closechat', 'demoteadmin'
    ]
  },
  {
    key: 'ia',
    title: 'AI',
    icon: '🧠',
    aliases: ['ai', 'intelligenceartificielle'],
    commands: ['ai', 'chatbot', 'imagine', 'sora', 'anime']
  },
  {
    key: 'image_edits',
    title: 'ɪᴍᴀɢᴇ_ᴇᴅɪᴛs',
    icon: '🖼️',
    aliases: ['images', 'photo', 'photoedit'],
    commands: ['blur', 'removebg', 'remini', 'crop', 'sticker', 'simage', 'meme', 'take']
  },
  {
    key: 'logo',
    title: 'ʟᴏɢᴏ & ᴛᴇxᴛᴇ',
    icon: '✨',
    aliases: ['logos', 'text'],
    commands: ['textmaker', 'neon', 'glitch', 'fire', 'ice', 'snow', 'matrix', 'hacker', 'devil', 'sand', 'blackpink', 'thunder', 'arena']
  },
  {
    key: 'outils',
    title: 'ᴏᴜᴛɪʟs',
    icon: '🧰',
    aliases: ['tools', 'utilitaires'],
    commands: ['ping', 'alive', 'pair', 'menustyle', 'quotecard', 'viewtest', 'owner', 'jid', 'url', 'ss', 'ssweb', 'screenshot', 'settings', 'groupinfo', 'menu', 'allmenu', 'setprefix', 'prefix', 'prefixe', 'setcmd', 'vv', 'vv2']
  },
  {
    key: 'owner',
    title: 'ᴏᴡɴᴇʀ',
    icon: '👑',
    aliases: ['proprietaire', 'propriétaire'],
    commands: ['mode', 'clearsession', 'cleartmp', 'update', 'settings', 'autostatus', 'autoread', 'autotyping', 'anticall', 'pmblocker', 'setpp', 'areact', 'fakeract', 'sudo']
  },
  {
    key: 'reactions',
    title: 'ʀéᴀᴄᴛɪᴏɴs',
    icon: '💫',
    aliases: ['reaction', 'react'],
    commands: ['areact', 'autoreact', 'fakeract', 'mention', 'setmention', 'heart']
  },
  {
    key: 'recherche',
    title: 'sᴇᴀʀᴄʜ',
    icon: '🔎',
    aliases: ['search', 'recherche'],
    commands: ['weather', 'news', 'github', 'repo', 'url', 'lyrics']
  },
  {
    key: 'statut',
    title: 'sᴛᴀᴛᴜs',
    icon: '📡',
    aliases: ['status'],
    commands: ['alive', 'ping', 'autostatus', 'autoread', 'autotyping']
  },
  {
    key: 'systeme',
    title: 'sʏsᴛèᴍᴇ',
    icon: '⚙️',
    aliases: ['system', 'config'],
    commands: ['menu', 'allmenu', 'settings', 'update', 'clearsession', 'cleartmp']
  },
  {
    key: 'telechargement',
    title: 'ᴛéʟéᴄʜᴀʀɢᴇᴍᴇɴᴛ',
    icon: '📥',
    aliases: ['download', 'downloads', 'telechargements'],
    commands: ['play', 'song', 'video', 'instagram', 'facebook', 'tiktok', 'spotify']
  },
  {
    key: 'jeux',
    title: 'ᴊᴀʀᴠɪs-ɢᴀᴍᴇs',
    icon: '🎮',
    aliases: ['games', 'game', 'jeu'],
    commands: ['tictactoe', 'hangman', 'trivia', '8ball', 'truth', 'dare', 'ship']
  },
  {
    key: 'medias',
    title: 'ᴍéᴅɪᴀs',
    icon: '🎨',
    aliases: ['media', 'sticker'],
    commands: ['sticker', 'simage', 'stickertelegram', 'stickercrop', 'gif', 'meme', 'take', 'vv', 'vv2']
  }
];

const commandCount = settings.commandCount || 148;

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function nowInfo() {
  const now = new Date();
  return {
    date: now.toLocaleDateString('fr-FR', { timeZone: 'Africa/Kinshasa' }),
    time: now.toLocaleTimeString('fr-FR', { timeZone: 'Africa/Kinshasa', hour12: false, hour: '2-digit', minute: '2-digit' }),
    runtime: (() => {
      const seconds = Math.floor(process.uptime());
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
    })()
  };
}

// Noms lisibles pour la liste déroulante des boutons.
const LABELS = {
  confidentialite: 'Confidentialité', conversion: 'Conversion', fun: 'Divertissement',
  fx_audio: 'Effets audio', groupe: 'Groupe', ia: 'Intelligence artificielle',
  image_edits: "Retouche d'images", logo: 'Logos & texte', outils: 'Outils',
  owner: 'Propriétaire', reactions: 'Réactions', recherche: 'Recherche',
  statut: 'Statuts', systeme: 'Système', telechargement: 'Téléchargements',
  jeux: 'Jeux', medias: 'Médias'
};

// Titres affichés dans le corps du menu (petites capitales, en français).
const TITLES = {
  confidentialite: 'ᴄᴏɴғɪᴅᴇɴᴛɪᴀʟɪᴛé', conversion: 'ᴄᴏɴᴠᴇʀsɪᴏɴ', fun: 'ᴅɪᴠᴇʀᴛɪssᴇᴍᴇɴᴛ',
  fx_audio: 'ᴇғғᴇᴛs ᴀᴜᴅɪᴏ', groupe: 'ɢʀᴏᴜᴘᴇ', ia: 'ɪɴᴛᴇʟʟɪɢᴇɴᴄᴇ ᴀʀᴛɪғɪᴄɪᴇʟʟᴇ',
  image_edits: "ʀᴇᴛᴏᴜᴄʜᴇ ᴅ'ɪᴍᴀɢᴇs", logo: 'ʟᴏɢᴏs & ᴛᴇxᴛᴇ', outils: 'ᴏᴜᴛɪʟs',
  owner: 'ᴘʀᴏᴘʀɪéᴛᴀɪʀᴇ', reactions: 'ʀéᴀᴄᴛɪᴏɴs', recherche: 'ʀᴇᴄʜᴇʀᴄʜᴇ',
  statut: 'sᴛᴀᴛᴜᴛs', systeme: 'sʏsᴛèᴍᴇ', telechargement: 'ᴛéʟéᴄʜᴀʀɢᴇᴍᴇɴᴛs',
  jeux: 'ᴊᴇᴜx', medias: 'ᴍéᴅɪᴀs'
};
const titleOf = (category) => TITLES[category.key] || category.title;

function botMode() {
  try {
    const data = JSON.parse(fs.readFileSync('./data/messageCount.json', 'utf8'));
    return data.isPublic === false ? 'privé' : 'public';
  } catch {
    return 'public';
  }
}

function menuHeader(senderNum, prefix) {
  const info = nowInfo();
  const who = senderNum && senderNum !== '?' ? `@${senderNum}` : 'Monsieur';
  return (
    `╭━━⟪ 𝗡𝗘𝗫𝗢-𝗝𝗔𝗥𝗩𝗜𝗦 𝗫𝗠𝗗 ⟫━━╮\n` +
    `┃ Bonjour ${who}.\n` +
    `┃ Tous mes systèmes sont opérationnels.\n` +
    `┃\n` +
    `┃ ◈ ᴘʀéғɪxᴇ : ${prefix}\n` +
    `┃ ◈ ᴍᴏᴅᴇ : ${botMode()}\n` +
    `┃ ◈ ᴄᴏᴍᴍᴀɴᴅᴇs : ${commandCount}\n` +
    `┃ ◈ ᴅᴀᴛᴇ : ${info.date} • ${info.time}\n` +
    `┃ ◈ ᴅɪsᴘᴏɴɪʙɪʟɪᴛé : ${info.runtime}\n` +
    `┃ ◈ ᴠᴇʀsɪᴏɴ : ${settings.version || '2.0.0'}\n` +
    `┃ ◈ ᴘʀᴏᴘʀɪéᴛᴀɪʀᴇ : ${settings.menuOwner || settings.botOwner || 'NEXO-JARVIS'}\n` +
    `╰━━━━━━━━━━━━━━━━━━━╯`
  );
}

function categoryBox(category, prefix) {
  return (
    `╭━━⟪ ${titleOf(category)} ⟫━━╮\n` +
    category.commands.map((command, index) =>
      `┃ ➠ ${String(index + 1).padStart(2, '0')} • ${prefix}${command}`
    ).join('\n') +
    `\n╰━━━━━━━━━━━━━━━━━━━╯`
  );
}

function categoryIndex(query) {
  const normalized = normalize(query);
  if (/^\d+$/.test(String(query).trim())) {
    const index = Number(query) - 1;
    return categories[index] ? index : -1;
  }
  return categories.findIndex(category => (
    normalize(category.key) === normalized ||
    normalize(category.title) === normalized ||
    normalize(LABELS[category.key]) === normalized ||
    (category.aliases || []).some(alias => normalize(alias) === normalized)
  ));
}

function overview(senderNum, prefix, notice = '') {
  const categoryLines = categories.map((category, index) =>
    `┃ ➠ ${String(index + 1).padStart(2, '0')} • ${titleOf(category)}`
  ).join('\n');

  return (
    `${notice ? `${notice}\n\n` : ''}` +
    `${menuHeader(senderNum, prefix)}\n\n` +
    `╭━━⟪ ᴄᴀᴛéɢᴏʀɪᴇs ⟫━━╮\n` +
    `${categoryLines}\n` +
    `╰━━━━━━━━━━━━━━━━━━━╯\n\n` +
    `Choisissez une catégorie pour afficher ses commandes, Monsieur.`
  );
}

function allMenu(senderNum, prefix) {
  return (
    `${menuHeader(senderNum, prefix)}\n\n` +
    categories.map(category => categoryBox(category, prefix)).join('\n\n') +
    `\n\nTapez *${prefix}menu* pour revenir aux catégories.\n` +
    `> 𝗡𝗘𝗫𝗢-𝗝𝗔𝗥𝗩𝗜𝗦 𝗫𝗠𝗗 • ᴇɴsᴇᴍʙʟᴇ ᴅᴇs sʏsᴛèᴍᴇs ᴅɪsᴘᴏɴɪʙʟᴇs`
  );
}

/* ─── Boutons (native flow) ─────────────────────────────────── */

const channelLink = () => settings.channelLink || 'https://whatsapp.com/channel/0029VbDCIHn4tRrpvS6YS332';

function categoryRows(prefix) {
  return categories.map((category, index) => ({
    header: '',
    title: `${category.icon} ${LABELS[category.key] || category.key}`,
    description: `${category.commands.length} commande${category.commands.length > 1 ? 's' : ''}`,
    id: `${prefix}menu ${index + 1}`
  }));
}

function listButton(prefix) {
  const rows = categoryRows(prefix);
  const sections = [];
  for (let i = 0; i < rows.length; i += 9) {
    sections.push({
      title: rows.length > 9 ? `Catégories ${Math.floor(i / 9) + 1}/${Math.ceil(rows.length / 9)}` : 'Catégories',
      highlight_label: '',
      rows: rows.slice(i, i + 9)
    });
  }
  sections.push({
    title: 'Raccourcis',
    highlight_label: '',
    rows: [
      { header: '', title: 'Menu complet', description: 'Toutes les commandes en un message', id: `${prefix}allmenu` },
      { header: '', title: 'Diagnostic système', description: 'Latence et état des systèmes', id: `${prefix}ping` }
    ]
  });
  return { name: 'single_select', params: { title: 'Catégories de commandes', sections } };
}

function channelButton() {
  return { name: 'cta_url', params: { display_text: 'CHAÎNE', url: channelLink(), merchant_url: channelLink() } };
}

function quickButton(text, id) {
  return { name: 'quick_reply', params: { display_text: text, id } };
}

function buttonsFor(view, prefix) {
  if (view === 'overview') return [listButton(prefix), quickButton('Menu complet', `${prefix}allmenu`), channelButton()];
  return [listButton(prefix), quickButton('Retour au menu', `${prefix}menu`), channelButton()];
}

/* ─── Envoi ─────────────────────────────────────────────────── */

const barText = (view) => view === 'overview'
  ? 'Choisissez une catégorie, Monsieur.'
  : 'Navigation du menu, Monsieur.';

async function sendMenu(sock, chatId, message, text, senderId, view = 'overview', prefix = '.') {
  // Styles (réglables avec .menustyle) :
  //  - mixte (défaut) : le menu en TEXTE, lu par toutes les versions de WhatsApp, puis une barre de
  //    boutons juste en dessous. Les boutons sont un format WhatsApp Business : un téléphone qui ne les
  //    affiche pas voit quand même tout le menu.
  //  - complet : un seul message à boutons (invisible sur les téléphones qui ne gèrent pas ce format).
  //  - texte : texte seul.
  // L'aperçu d'image, le bouton chaîne et la fausse citation sont ajoutés par lib/presentation.js.
  const style = require('../lib/displayFlags').getValue('menuStyle') || 'mixte';
  const buttonContext = { ...channelInfo.contextInfo, mentionedJid: [senderId] };

  if (style === 'complet' && view !== 'all') {
    try {
      const { sendInteractiveMessage } = require('../lib/interactiveButtons');
      await sendInteractiveMessage(sock, chatId, {
        title: '𝗡𝗘𝗫𝗢-𝗝𝗔𝗥𝗩𝗜𝗦 𝗫𝗠𝗗',
        body: text,
        footer: 'À votre service, Monsieur.',
        buttons: buttonsFor(view, prefix),
        contextInfo: buttonContext,
        quoted: message
      });
      return;
    } catch (error) {
      console.warn('[menu] Boutons indisponibles, envoi du menu en texte :', error.message);
    }
  }

  await sock.sendMessage(chatId, {
    text,
    mentions: [senderId],
    ...channelInfo
  }, { quoted: message });

  if (style === 'texte' || style === 'complet') return;

  try {
    const { sendInteractiveMessage } = require('../lib/interactiveButtons');
    await sendInteractiveMessage(sock, chatId, {
      title: '𝗡𝗘𝗫𝗢-𝗝𝗔𝗥𝗩𝗜𝗦 𝗫𝗠𝗗',
      body: barText(view),
      footer: 'À votre service, Monsieur.',
      buttons: buttonsFor(view, prefix),
      contextInfo: buttonContext,
      quoted: message
    });
  } catch (error) {
    console.warn('[menu] Barre de boutons non envoyée (le menu texte est déjà livré) :', error.message);
  }
}

// Retrouve la commande à partir du titre d'une ligne choisie (« 🧠 Intelligence artificielle »).
function resolveMenuChoice(title, prefix = '.') {
  const clean = normalize(String(title).replace(/^[^\p{L}\p{N}]+/u, ''));
  if (!clean) return '';
  if (clean === normalize('Menu complet')) return `${prefix}allmenu`;
  if (clean === normalize('Retour au menu')) return `${prefix}menu`;
  if (clean === normalize('Diagnostic système')) return `${prefix}ping`;
  const index = categories.findIndex(category =>
    normalize(LABELS[category.key] || '') === clean ||
    normalize(titleOf(category)) === clean ||
    normalize(category.key) === clean
  );
  return index >= 0 ? `${prefix}menu ${index + 1}` : '';
}

async function helpCommand(sock, chatId, message, query = '') {
  const senderId = message.key.participant || message.key.remoteJid || '';
  const senderNum = senderId.split('@')[0] || '?';
  const prefix = getPrefix(chatId);
  const normalizedQuery = String(query || '').trim();

  if (!normalizedQuery || ['menu', 'categories', 'category'].includes(normalize(normalizedQuery))) {
    await sendMenu(sock, chatId, message, overview(senderNum, prefix), senderId, 'overview', prefix);
    return;
  }

  if (['all', 'allmenu', 'full', 'tout'].includes(normalize(normalizedQuery))) {
    await sendMenu(sock, chatId, message, allMenu(senderNum, prefix), senderId, 'all', prefix);
    return;
  }

  const index = categoryIndex(normalizedQuery);
  if (index < 0) {
    await sendMenu(
      sock,
      chatId,
      message,
      overview(senderNum, prefix, `Je ne trouve aucune catégorie correspondant à *${normalizedQuery}*, Monsieur.`),
      senderId,
      'overview',
      prefix
    );
    return;
  }

  const category = categories[index];
  await sendMenu(
    sock,
    chatId,
    message,
    `${categoryBox(category, prefix)}\n\n` +
    `Catégorie ${index + 1}/${categories.length} • ${LABELS[category.key] || category.key}`,
    senderId,
    'category',
    prefix
  );
}

module.exports = helpCommand;
module.exports.resolveMenuChoice = resolveMenuChoice;
