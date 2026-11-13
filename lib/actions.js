'use strict';

/*
 * BOUTONS D'ACTION — toutes les commandes qui ont 2 options ou plus.
 *
 * Principe : chaque commande à options est décrite ci-dessous (SPECS). Quand elle répond par un texte
 * (statut, aide, confirmation), main.js remplace ce texte par UN message à boutons natifs :
 *   corps = le texte de la réponse, bouton « ⚡ Actions » = liste de toutes les options de la commande.
 * Toucher une ligne exécute la commande correspondante comme si la personne l'avait tapée (mêmes droits :
 * un membre qui touche « Désactiver » sur .antilink est refusé comme s'il avait écrit .antilink off).
 *
 * Les réponses d'erreur / de refus (❌, ⛔, « réservé aux admins »…) ne reçoivent pas de boutons.
 * Si l'envoi du message à boutons échoue, le texte part normalement avec les options écrites en clair.
 */

const { getPrefix } = require('./prefix');

const ON = { label: '✅ Activer', desc: 'Active la fonction' };
const OFF = { label: '❌ Désactiver', desc: 'Désactive la fonction' };

function toggle(command, extra = []) {
    return [
        { label: ON.label, cmd: `${command} on`, desc: ON.desc },
        { label: OFF.label, cmd: `${command} off`, desc: OFF.desc },
        ...extra,
        { label: '📊 Voir le statut', cmd: `${command} status`, desc: 'État actuel' }
    ];
}

const SPECS = {
    // ── Protections de groupe ──────────────────────────────────────────────
    antilink: { title: '🔗 Antilink', options: [
        { label: '✅ Activer', cmd: 'antilink on', desc: 'Supprime les liens' },
        { label: '❌ Désactiver', cmd: 'antilink off', desc: 'Désactive la protection' },
        { label: '🗑️ Action : supprimer', cmd: 'antilink set delete', desc: 'Supprime le message' },
        { label: '⚠️ Action : avertir', cmd: 'antilink set warn', desc: 'Supprime + avertissement' },
        { label: '🚫 Action : expulser', cmd: 'antilink set kick', desc: 'Supprime + retire le membre' },
        { label: '📊 Voir le statut', cmd: 'antilink get', desc: 'État actuel' }
    ] },
    antitag: { title: '🏷️ Antitag', options: [
        { label: '✅ Activer', cmd: 'antitag on', desc: 'Bloque les tagall abusifs' },
        { label: '❌ Désactiver', cmd: 'antitag off', desc: 'Désactive la protection' },
        { label: '🗑️ Action : supprimer', cmd: 'antitag set delete', desc: 'Supprime le message' },
        { label: '🚫 Action : expulser', cmd: 'antitag set kick', desc: 'Supprime + retire le membre' },
        { label: '📊 Voir le statut', cmd: 'antitag get', desc: 'État actuel' }
    ] },
    antibot: { title: '🤖 Antibot', options: [
        { label: '✅ Activer', cmd: 'antibot on', desc: 'Bloque les autres bots' },
        { label: '❌ Désactiver', cmd: 'antibot off', desc: 'Désactive la protection' },
        { label: '🗑️ Mode : supprimer', cmd: 'antibot mode delete', desc: 'Supprime leurs messages' },
        { label: '🚫 Mode : retirer le bot', cmd: 'antibot mode kick', desc: 'Supprime + retire le bot' },
        { label: '📋 Bots connus', cmd: 'antibot list', desc: 'Liste des bots détectés' },
        { label: '📊 Voir le statut', cmd: 'antibot status', desc: 'État actuel' }
    ] },
    antibadword: { title: '🤬 Antibadword', options: [
        { label: '✅ Activer', cmd: 'antibadword on', desc: 'Filtre les insultes' },
        { label: '❌ Désactiver', cmd: 'antibadword off', desc: 'Désactive le filtre' },
        { label: '🗑️ Action : supprimer', cmd: 'antibadword set delete', desc: 'Supprime le message' },
        { label: '⚠️ Action : avertir', cmd: 'antibadword set warn', desc: '3 avertissements = retrait' },
        { label: '🚫 Action : expulser', cmd: 'antibadword set kick', desc: 'Retire le membre' },
        { label: '📋 Mots interdits', cmd: 'antibadword list', desc: 'Voir la liste' }
    ] },
    antipromote: { title: '👑 Antipromote', options: toggle('antipromote') },
    antimentiongc: { title: '📢 Antimentiongc', options: toggle('antimentiongc') },
    antiflood: { title: '🌊 Antiflood', options: [...toggle('antiflood'),
        { label: '⚙️ Limite : 5 messages', cmd: 'antiflood limit 5', desc: 'Sur 10 secondes' },
        { label: '⚙️ Limite : 8 messages', cmd: 'antiflood limit 8', desc: 'Sur 10 secondes' }] },
    antispam: { title: '📨 Antispam', options: toggle('antispam') },
    antimedia: { title: '🖼️ Antimedia', options: toggle('antimedia') },
    antisticker: { title: '🎭 Antisticker', options: toggle('antisticker') },
    antivoice: { title: '🎙️ Antivoice', options: toggle('antivoice') },
    antidelete: { title: '🗑️ Antidelete', options: [
        { label: '✅ Activer', cmd: 'antidelete on', desc: 'Récupère les messages supprimés' },
        { label: '❌ Désactiver', cmd: 'antidelete off', desc: 'Désactive la fonction' }
    ] },
    anticall: { title: '📵 Anticall', options: toggle('anticall') },
    pmblocker: { title: '🚷 PM Blocker', options: toggle('pmblocker') },

    // ── Accueil / départ ───────────────────────────────────────────────────
    welcome: { title: '📥 Bienvenue', options: [
        { label: '✅ Activer', cmd: 'welcome on', desc: 'Message à chaque arrivée' },
        { label: '❌ Désactiver', cmd: 'welcome off', desc: 'Plus de message' },
        { label: '🧪 Aperçu', cmd: 'welcome test', desc: 'Voir le message actuel' },
        { label: '♻️ Réinitialiser', cmd: 'welcome reset', desc: 'Style NEXO-JARVIS par défaut' }
    ] },
    goodbye: { title: '📤 Au revoir', options: [
        { label: '✅ Activer', cmd: 'goodbye on', desc: 'Message à chaque départ' },
        { label: '❌ Désactiver', cmd: 'goodbye off', desc: 'Plus de message' },
        { label: '🧪 Aperçu', cmd: 'goodbye test', desc: 'Voir le message actuel' },
        { label: '♻️ Réinitialiser', cmd: 'goodbye reset', desc: 'Style NEXO-JARVIS par défaut' }
    ] },

    // ── Automatismes du propriétaire ───────────────────────────────────────
    chatbot: { title: '💬 Chatbot', options: [
        { label: '✅ Activer ici', cmd: 'chatbot on', desc: 'Cette discussion' },
        { label: '❌ Désactiver ici', cmd: 'chatbot off', desc: 'Cette discussion' },
        { label: '👥 Tous les groupes : ON', cmd: 'chatbot group on', desc: 'Réglage global' },
        { label: '👥 Tous les groupes : OFF', cmd: 'chatbot group off', desc: 'Réglage global' },
        { label: '📩 Tous les privés : ON', cmd: 'chatbot dm on', desc: 'Réglage global' },
        { label: '📩 Tous les privés : OFF', cmd: 'chatbot dm off', desc: 'Réglage global' },
        { label: '📊 Voir le statut', cmd: 'chatbot status', desc: 'Configuration' }
    ] },
    autoread: { title: '👁️ Autoread', options: [
        { label: '✅ Activer', cmd: 'autoread on', desc: 'Lit tous les messages' },
        { label: '❌ Désactiver', cmd: 'autoread off', desc: 'Ne lit plus automatiquement' }
    ] },
    autotyping: { title: '⌨️ Autotyping', options: [
        { label: '✅ Activer', cmd: 'autotyping on', desc: '« écrit… » automatique' },
        { label: '❌ Désactiver', cmd: 'autotyping off', desc: 'Désactive' }
    ] },
    autostatus: { title: '📸 Autostatus', options: [
        { label: '✅ Voir les statuts : ON', cmd: 'autostatus on', desc: 'Visualisation automatique' },
        { label: '❌ Voir les statuts : OFF', cmd: 'autostatus off', desc: 'Désactive' },
        { label: '💫 Réactions : ON', cmd: 'autostatus react on', desc: 'Réagit aux statuts' },
        { label: '🚫 Réactions : OFF', cmd: 'autostatus react off', desc: 'Plus de réaction' }
    ] },
    areact: { title: '😀 Autoreact', options: [
        { label: '✅ Activer', cmd: 'areact on', desc: 'Réagit à tous les messages' },
        { label: '❌ Désactiver', cmd: 'areact off', desc: 'Désactive' }
    ] },
    mention: { title: '📣 Mention auto', options: [
        { label: '✅ Activer', cmd: 'mention on', desc: 'Répond quand on mentionne le bot' },
        { label: '❌ Désactiver', cmd: 'mention off', desc: 'Désactive' }
    ] },
    mode: { title: '🔐 Mode du bot', options: [
        { label: '🌐 Public', cmd: 'mode public', desc: 'Tout le monde peut utiliser le bot' },
        { label: '🔒 Privé', cmd: 'mode private', desc: 'Propriétaire et sudo seulement' }
    ] },

    // ── Affichage ──────────────────────────────────────────────────────────
    menustyle: { title: '🎨 Style du menu', options: [
        { label: '📋 Complet (boutons)', cmd: 'menustyle complet', desc: 'Menu + boutons' },
        { label: '📝 Texte seul', cmd: 'menustyle texte', desc: 'Sans boutons' }
    ] },
    imagemode: { title: '🖼️ Mode image', options: [
        { label: '✅ Activer', cmd: 'imagemode on', desc: 'Réponses avec photo' },
        { label: '❌ Désactiver', cmd: 'imagemode off', desc: 'Réponses sans photo' }
    ] },
    replystyle: { title: '🧩 Cadre des réponses', options: [
        { label: '✅ Activer', cmd: 'replystyle on', desc: 'Cadre autour des réponses' },
        { label: '❌ Désactiver', cmd: 'replystyle off', desc: 'Réponses sans cadre' }
    ] },
    preview: { title: '🔎 Aperçu du lien', options: [
        { label: '✅ Activer', cmd: 'preview on', desc: 'Aperçu d\'image' },
        { label: '❌ Désactiver', cmd: 'preview off', desc: 'Sans aperçu' }
    ] },
    quotecard: { title: '💳 Fausse citation', options: [
        { label: '✅ Activer', cmd: 'quotecard on', desc: 'Carte de citation' },
        { label: '❌ Désactiver', cmd: 'quotecard off', desc: 'Sans carte' }
    ] },
    lang: { title: '🌐 Langue', options: [
        { label: '🇫🇷 Français', cmd: 'lang fr', desc: 'Réponses en français' },
        { label: '🇬🇧 English', cmd: 'lang en', desc: 'Replies in English' }
    ] },

    // ── Groupe ─────────────────────────────────────────────────────────────
    hijack: { title: '🛑 Hijack', options: [
        { label: '🔒 Verrouiller', cmd: 'hijack', desc: 'Verrouille le groupe' },
        { label: '⏱️ Verrouiller 10 min', cmd: 'hijack 10m', desc: 'Temporaire' },
        { label: '⏱️ Verrouiller 1 h', cmd: 'hijack 1h', desc: 'Temporaire' },
        { label: '🔓 Déverrouiller', cmd: 'hijack off', desc: 'Désactive et ouvre' },
        { label: '📊 Voir le statut', cmd: 'hijack status', desc: 'État actuel' }
    ] },
    open: { title: '🔓 Groupe', options: [
        { label: '🔓 Ouvrir', cmd: 'open', desc: 'Tout le monde écrit' },
        { label: '🔒 Fermer', cmd: 'close', desc: 'Admins seulement' }
    ] },
    close: { title: '🔒 Groupe', options: [
        { label: '🔓 Ouvrir', cmd: 'open', desc: 'Tout le monde écrit' },
        { label: '🔒 Fermer', cmd: 'close', desc: 'Admins seulement' }
    ] },
    sudo: { title: '👑 Sudo', options: [
        { label: '➕ Ajouter', cmd: 'sudo add', desc: 'Répondre / mentionner' },
        { label: '➖ Retirer', cmd: 'sudo del', desc: 'Répondre / mentionner' },
        { label: '📋 Liste', cmd: 'sudo list', desc: 'Voir les sudo' }
    ] },
    slowmode: { title: '🐢 Mode lent', options: [
        { label: '⏱️ 10 secondes', cmd: 'slowmode 10', desc: 'Délai entre messages' },
        { label: '⏱️ 30 secondes', cmd: 'slowmode 30', desc: 'Délai entre messages' },
        { label: '⏱️ 60 secondes', cmd: 'slowmode 60', desc: 'Délai entre messages' },
        { label: '❌ Désactiver', cmd: 'slowmode off', desc: 'Retire le délai' }
    ] },
    lockchat: { title: '🔒 Discussion', options: [
        { label: '🔒 Verrouiller', cmd: 'lockchat', desc: 'Admins seulement' },
        { label: '🔓 Déverrouiller', cmd: 'unlockchat', desc: 'Tout le monde écrit' }
    ] },
    unlockchat: { title: '🔒 Discussion', options: [
        { label: '🔒 Verrouiller', cmd: 'lockchat', desc: 'Admins seulement' },
        { label: '🔓 Déverrouiller', cmd: 'unlockchat', desc: 'Tout le monde écrit' }
    ] },
    restrictchat: { title: '⚙️ Infos du groupe', options: [
        { label: '🔒 Admins seulement', cmd: 'restrictchat', desc: 'Modifier les infos' },
        { label: '🔓 Tous les membres', cmd: 'unrestrictchat', desc: 'Modifier les infos' }
    ] },
    unrestrictchat: { title: '⚙️ Infos du groupe', options: [
        { label: '🔒 Admins seulement', cmd: 'restrictchat', desc: 'Modifier les infos' },
        { label: '🔓 Tous les membres', cmd: 'unrestrictchat', desc: 'Modifier les infos' }
    ] }
};

// Thèmes : la liste vient du dossier themes/ (un bouton par thème disponible).
Object.defineProperty(SPECS, 'theme', {
    enumerable: true,
    get() {
        const themes = require('./theme');
        const active = themes.currentId();
        return { title: '🎨 Thèmes', options: themes.list().map(theme => ({ label: `${theme.icon} ${theme.name}`, cmd: `theme ${theme.id}`, desc: theme.id === active ? 'Thème actuel' : 'Images et style' })) };
    }
});

// Alias de commandes → spec
const ALIASES = { autoreact: 'areact', autoreaction: 'areact', themes: 'theme' };

function specFor(command) {
    const key = ALIASES[command] || command;
    return SPECS[key] || null;
}

// Réponses d'erreur / de refus : pas d'options de la commande, seulement la navigation.
const DENIAL = /^[\s*_`~>]*(?:❌|⛔|🚫|🚷)|r[ée]serv[ée]|seuls? (?:les )?(?:admin|propri)|acc[èe]s r[ée]serv|n'est disponible qu'en groupe|doit [êe]tre admin|faites-moi d'abord admin|option invalide|invalid/i;

function isDenial(text) {
    return DENIAL.test(String(text || '').slice(0, 220));
}

/* ─── Actions « universelles » : adaptées à la catégorie de chaque commande ─────────────────────────────── */

// Commandes sans argument qui prolongent naturellement la catégorie (une touche = une action).
const CATEGORY_ACTIONS = {
    ai: [['🎨 Menu IA image', 'aiimagemenu']],
    aiImage: [['🤖 Menu IA', 'aimenu'], ['🖼️ Améliorer une photo', 'remini']],
    download: [['🎵 Menu musique', 'musicmenu'], ['🎬 Menu médias', 'mediamenu']],
    apk: [['🔍 Chercher une appli', 'apksearch']],
    group: [['ℹ️ Infos du groupe', 'groupinfo'], ['👑 Admins', 'admins'], ['📜 Règles', 'rules'], ['🛡️ Protections', 'antimenu']],
    anti: [['🔗 Antilink', 'antilink'], ['🤖 Antibot', 'antibot'], ['🏷️ Antitag', 'antitag'], ['🤬 Antibadword', 'antibadword'], ['👥 Menu groupe', 'groupmenu']],
    sticker: [['🖼️ Sticker en image', 'simage'], ['🔄 Menu conversion', 'convertmenu']],
    media: [['🦊 Menu stickers', 'stickermenu']],
    search: [['📚 Wikipédia', 'wiki'], ['📖 Dictionnaire', 'define'], ['📰 Actualités', 'news']],
    tools: [['🌐 Traduire', 'translate'], ['🔊 Texte en voix', 'tts'], ['🔳 QR code', 'qr'], ['🧮 Calculer', 'calc']],
    fun: [['😂 Blague', 'joke'], ['💡 Anecdote', 'fact'], ['💬 Citation', 'quote'], ['😘 Compliment', 'compliment']],
    game: [['⭕ Morpion', 'tictactoe'], ['🔤 Pendu', 'hangman'], ['🎯 Quiz', 'trivia'], ['🎱 Boule magique', '8ball']],
    economy: [['💰 Solde', 'balance'], ['🎁 Récompense du jour', 'daily'], ['💼 Travailler', 'work'], ['🏆 Classement', 'richest']],
    religi: [['📖 Coran', 'quran'], ['✝️ Bible', 'bible'], ['🕌 Heures de prière', 'prayer']],
    status: [['⚙️ Autostatus', 'autostatus'], ['😀 Autoréaction', 'areact']],
    owner: [['⚙️ Réglages', 'settings'], ['🔐 Mode du bot', 'mode'], ['🌐 Langue', 'lang'], ['📊 Statistiques', 'stats']],
    profile: [['👤 Mon profil', 'profile'], ['🖼️ Photo de profil', 'getpp'], ['✏️ Changer la bio', 'setbio']],
    notes: [['📝 Mes notes', 'notes'], ['➕ Ajouter une note', 'addnote']],
    cyber: [['🔑 Mot de passe', 'genpass'], ['🌐 Adresse IP', 'ip'], ['🔐 Empreinte', 'hash']],
    logo: [['🎨 Effets de texte', 'texteffectsmenu']],
    textEffects: [['✨ Logos', 'logomenu']],
    music: [['🎧 Spotify', 'spotify'], ['🎤 Paroles', 'lyrics']],
    anime: [['🤗 Câlin', 'hug'], ['😘 Bisou', 'kiss'], ['🥰 Caresse', 'pat']],
    convert: [['🔊 Texte en voix', 'tts'], ['🌐 Traduire', 'translate'], ['🎵 Vidéo en MP3', 'tomp3']],
    utils: [['🏓 Ping', 'ping'], ['⏱️ Disponibilité', 'uptime'], ['📊 Statistiques', 'stats']],
    broadcast: [['👥 Mes groupes', 'listgc']],
    random: [['🎲 Dé', 'dice'], ['🪙 Pile ou face', 'flip'], ['🎨 Couleur', 'color'], ['😀 Emoji', 'emoji']],
    social: [['💞 Compatibilité', 'ship'], ['😘 Compliment', 'compliment'], ['💬 Drague', 'flirt']],
    weather: [['🌡️ Météo', 'meteo'], ['🌦️ Prévisions', 'forecast']],
    health: [['⚖️ IMC', 'bmi'], ['💧 Eau par jour', 'water'], ['😴 Sommeil', 'sleep']],
    premium: [['👑 Sudo', 'sudo'], ['📋 Liste sudo', 'sudo list']]
};

// Catégories où « Relancer » (même commande, mêmes arguments) a du sens et ne risque rien.
const REPEATABLE = new Set(['ai', 'aiImage', 'fun', 'game', 'random', 'anime', 'social', 'search', 'weather', 'health', 'religi', 'cyber', 'tools', 'utils', 'convert', 'music']);

// Jamais de bouton pour ces commandes (menus, messages qui se modifient, diffusions…).
const EXCLUDED = new Set(['menu', 'help', 'allmenu', 'ytdl', 'sendall', 'notifyall', 'broadcast', 'bcgc', 'setcmd', 'pair']);

let categoryIndex = null;
function categories() {
    if (categoryIndex) return categoryIndex;
    categoryIndex = { byCommand: new Map(), menus: new Map() };
    try {
        for (const menu of require('../commands/help').MENUS) {
            categoryIndex.menus.set(menu.key, menu);
            for (const command of menu.commands) if (!categoryIndex.byCommand.has(command)) categoryIndex.byCommand.set(command, menu.key);
        }
    } catch { /* menus indisponibles : navigation générale seulement */ }
    return categoryIndex;
}

function categoryOf(command) {
    return categories().byCommand.get(ALIASES[command] || command) || 'utils';
}

const capitalize = text => String(text || '').charAt(0) + String(text || '').slice(1).toLowerCase();
const ROW_ID_MAX = 190;

/** Options adaptées à la commande : ses propres réglages (SPECS) ou, à défaut, des actions de sa catégorie. */
function optionsFor(command, args = '', { denial = false } = {}) {
    const key = ALIASES[command] || command;
    const known = categories().byCommand.has(key);
    const category = categoryOf(key);
    const menu = known ? categories().menus.get(category) : null;
    const options = [];

    if (!denial) {
        const spec = SPECS[key];
        if (spec) {
            options.push(...spec.options.map(option => ({ ...option })));
        } else {
            const repeat = `${key} ${args}`.trim();
            if (known && REPEATABLE.has(category) && repeat.length <= ROW_ID_MAX - 10) {
                options.push({ label: '🔁 Relancer', cmd: repeat, desc: args ? 'Même demande' : 'Un autre résultat' });
            }
            for (const [label, cmd] of (known ? CATEGORY_ACTIONS[category] : null) || []) {
                if (cmd.split(' ')[0] === key) continue;   // pas de bouton qui renvoie vers la commande en cours
                options.push({ label, cmd, desc: '' });
            }
        }
    }
    if (menu) options.push({ label: `📂 Menu ${capitalize(menu.label)}`, cmd: `${category.toLowerCase()}menu`, desc: 'Toutes les commandes de la catégorie' });
    options.push({ label: '🏠 Menu principal', cmd: 'menu', desc: 'Toutes les catégories' });
    return { title: spec_title(key, menu), options };
}

function spec_title(key, menu) {
    const spec = SPECS[key];
    if (spec) return spec.title;
    return menu ? `${menu.icon} ${capitalize(menu.label)}` : 'Actions';
}

function rowsFor(spec, prefix) {
    return spec.options.map(option => ({
        header: '',
        title: option.label,
        description: option.desc || '',
        id: `${prefix}${option.cmd}`
    }));
}

function buildButtons(spec, prefix) {
    const rows = rowsFor(spec, prefix);
    const sections = [];
    for (let index = 0; index < rows.length; index += 10) {
        sections.push({
            title: rows.length > 10 ? `${spec.title} ${Math.floor(index / 10) + 1}/${Math.ceil(rows.length / 10)}` : spec.title,
            highlight_label: '',
            rows: rows.slice(index, index + 10)
        });
    }
    return [{ name: 'single_select', params: { title: '⚡ Actions', sections } }];
}

// Texte de secours quand le message à boutons ne peut pas partir.
function plainOptions(spec, prefix) {
    return `\n\n⚡ *Actions*\n${spec.options.map(option => `• ${prefix}${option.cmd} — ${option.label.replace(/^\S+\s/, '')}`).join('\n')}`;
}

// Contenus qui ne peuvent PAS porter de boutons (ou qui ne doivent surtout pas être transformés).
const NEVER_KEYS = ['react', 'delete', 'edit', 'pin', 'poll', 'forward', 'sticker', 'audio', 'document', 'contacts', 'location',
    'viewOnce', 'buttons', 'templateButtons', 'sections', 'listMessage', 'interactiveMessage', '__edittext', 'gifPlayback', 'ptt'];

function eligibility(content) {
    if (!content || typeof content !== 'object') return null;
    if (NEVER_KEYS.some(key => content[key] !== undefined)) return null;
    if (typeof content.text === 'string' && content.text.trim() && content.image === undefined && content.video === undefined) {
        return { kind: 'text', body: content.text };
    }
    if (content.image !== undefined && typeof content.caption === 'string' && content.caption.trim()) return { kind: 'image', body: content.caption };
    if (content.video !== undefined && typeof content.caption === 'string' && content.caption.trim()) return { kind: 'video', body: content.caption };
    return null;
}

/**
 * Enveloppe le socket pour UNE commande : la première réponse éligible (texte, photo ou vidéo légendée) part avec
 * un bouton « ⚡ Actions » adapté à la commande. Audios, stickers et documents ne peuvent pas porter de boutons
 * dans WhatsApp : ils partent tels quels.
 */
function wrapSock(sock, { chatId, message, command, args = '' }) {
    if (!sock || typeof sock.sendMessage !== 'function' || !command || EXCLUDED.has(command)) return sock;
    const prefix = getPrefix(chatId);
    let attached = false;

    return new Proxy(sock, {
        get(target, property) {
            if (property !== 'sendMessage') {
                const value = Reflect.get(target, property, target);
                return typeof value === 'function' ? value.bind(target) : value;
            }
            return async (jid, content, options) => {
                const kind = jid === chatId && !attached ? eligibility(content) : null;
                if (!kind) return target.sendMessage(jid, content, options);

                attached = true;
                const denial = isDenial(kind.body);
                const spec = optionsFor(command, args, { denial });
                try {
                    const { sendInteractiveMessage } = require('./interactiveButtons');
                    const mentions = Array.isArray(content.mentions) ? content.mentions : [];
                    const contextInfo = { ...(content.contextInfo || {}) };
                    if (mentions.length) contextInfo.mentionedJid = mentions;
                    delete contextInfo.externalAdReply;
                    const payload = {
                        title: '',
                        body: kind.body,
                        buttons: buildButtons(spec, prefix),
                        contextInfo,
                        preview: false,
                        quoted: (options && options.quoted) || message
                    };
                    if (kind.kind === 'image') payload.image = content.image;
                    if (kind.kind === 'video') payload.video = content.video;
                    return await sendInteractiveMessage(target, chatId, payload);
                } catch (error) {
                    console.warn(`[actions] boutons indisponibles pour .${command} (${error.message}) : envoi normal`);
                    if (kind.kind === 'text') return target.sendMessage(jid, { ...content, text: content.text + plainOptions(spec, prefix) }, options);
                    return target.sendMessage(jid, content, options);
                }
            };
        }
    });
}

function commandNameOf(userMessage) {
    return String(userMessage || '').trim().split(/\s+/)[0].replace(/^\./, '').toLowerCase();
}

module.exports = {
    SPECS, CATEGORY_ACTIONS, EXCLUDED, specFor, optionsFor, categoryOf, wrapSock, buildButtons, plainOptions, isDenial, commandNameOf, rowsFor
};
