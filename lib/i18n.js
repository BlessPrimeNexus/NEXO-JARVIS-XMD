'use strict';

/*
 * Langue du bot : français (par défaut) ou anglais — commande .lang fr | en.
 *
 * Fonctionnement : quand la langue est l'anglais, TOUT message sortant (texte, légende, boutons, listes) est traduit :
 *   1. le dictionnaire ci-dessous (termes du bot, instantané, vocabulaire cohérent) ;
 *   2. puis une vraie traduction automatique (Google Translate, le même service que la commande .translate) pour tout
 *      ce qui reste en français, en UNE requête par message, avec cache (data/translations.json) ;
 *   3. si le service est injoignable, le message part quand même avec la traduction du dictionnaire.
 * Jamais traduits : commandes (.menu), liens, @mentions, <paramètres>, blocs ``` (journaux, mots de passe), noms propres,
 * et les réponses libres de l'IA / du chatbot (__plain).
 */

const fs = require('fs');
const path = require('path');

const CACHE_FILE = process.env.TRANSLATION_CACHE_FILE || path.join(__dirname, '..', 'data', 'translations.json');
const FILE = process.env.LANG_FILE || path.join(__dirname, '..', 'data', 'lang.json');
// Langue PAR SESSION : chaque numéro connecté a sa propre langue (data/sessions/<numéro>/lang.json).
const sessionContext = require('./sessionContext');
const langBySession = new Map();   // numéro de session → 'fr' | 'en'

function readStoredLang() {
    try {
        const saved = JSON.parse(fs.readFileSync(FILE, 'utf8')).lang;
        if (saved === 'en' || saved === 'fr') return saved;
    } catch { /* français par défaut */ }
    return 'fr';
}

function currentLang() {
    const number = sessionContext.currentNumber();
    if (!langBySession.has(number)) langBySession.set(number, readStoredLang());
    return langBySession.get(number);
}

const getLang = () => currentLang();
const isEnglish = () => currentLang() === 'en';

function setLang(value) {
    if (value !== 'en' && value !== 'fr') throw new Error('langue inconnue');
    langBySession.set(sessionContext.currentNumber(), value);
    try {
        fs.mkdirSync(path.dirname(FILE), { recursive: true });
        fs.writeFileSync(FILE, JSON.stringify({ lang: value }));
    } catch { /* la langue reste active en mémoire */ }
    return value;
}

/* ─── Dictionnaire français → anglais ───────────────────────── */
const DICTIONARY = [
    // Titres des menus et catégories
    ['MENU PRINCIPAL', 'MAIN MENU'], ['MENU GROUPE', 'GROUP MENU'], ['MENU ADMIN', 'ADMIN MENU'], ['MENU PROTECTIONS', 'PROTECTION MENU'],
    ['MENU TÉLÉCHARGEMENT', 'DOWNLOAD MENU'], ['MENU OUTILS', 'TOOLS MENU'], ['MENU JEUX', 'GAMES MENU'], ['MENU DIVERTISSEMENT', 'FUN MENU'],
    ['MENU LOGOS', 'LOGO MENU'], ['MENU IA', 'AI MENU'], ['MENU ANIME', 'ANIME MENU'], ['MENU CALCUL', 'MATH MENU'], ['MENU DATE', 'DATE MENU'],
    ['MENU TEXTE', 'TEXT MENU'], ['MENU PROPRIÉTAIRE', 'OWNER MENU'], ['MENU RÉGLAGES', 'SETTINGS MENU'], ['MENU INFOS', 'INFO MENU'], ['MENU PANEL', 'PANEL MENU'],
    ['TOUS LES MENUS', 'ALL MENUS'], ['INTELLIGENCE ARTIFICIELLE', 'ARTIFICIAL INTELLIGENCE'], ['TÉLÉCHARGEMENT', 'DOWNLOAD'], ['DIVERTISSEMENT', 'FUN'],
    ['PROPRIÉTAIRE', 'OWNER'], ['DATE & HEURE', 'DATE & TIME'], ['PROTECTIONS', 'PROTECTIONS'], ['RÉGLAGES', 'SETTINGS'], ['GROUPE', 'GROUP'],
    ['OUTILS', 'TOOLS'], ['JEUX', 'GAMES'], ['CALCUL', 'MATH'], ['TEXTE', 'TEXT'],
    // Menu principal (présentation « bot multi-appareils »)
    ['BOT WHATSAPP MULTI-APPAREILS', 'WHATSAPP BOT MULTI DEVICE'], ['INFORMATIONS DU BOT', 'BOT INFORMATION'],
    ['Veuillez choisir une catégorie', 'Please select any category'], ['Visiter mon créateur', 'Visit My Creator'],
    ['Bonne nuit', 'Good Night'], ['Bon après-midi', 'Good Afternoon'], ['Bonsoir', 'Good Evening'], ['Bonjour', 'Good Morning'],
    ["je m'appelle", 'my name is'], ['Je peux vous aider dans de nombreuses tâches sur WhatsApp', 'I can help you with many tasks on WhatsApp'],
    ['Touchez « Voir toutes les options » pour choisir une catégorie', 'Tap “View all options” to pick a category'],
    ['À utiliser avec responsabilité', 'Use responsibly'], ['Créateur', 'Creator'], ['Disponibilité', 'Uptime'],
    ['⚡ Actions', '⚡ Actions'], ['Voir le statut', 'View status'], ['Activer', 'Enable'], ['Désactiver', 'Disable'],
    // Menu
    ['Utilisateurs', 'Users'], ['Utilisateur', 'User'], ['Sessions actives', 'Active sessions'], ['Commandes', 'Commands'], ['commandes', 'commands'],
    ['commande', 'command'], ['Préfixe', 'Prefix'], ['Bot actif', 'Bot uptime'], ['Serveur actif', 'Server uptime'], ['Heure', 'Time'],
    ['Propriétaire', 'Owner'], ['Tous les menus', 'All menus'], ['Menu principal', 'Main menu'], ['Ouvrir un menu', 'Open a menu'],
    ['Raccourcis', 'Shortcuts'], ['Diagnostic système', 'System diagnostics'], ['Latence et état des systèmes', 'Latency and system status'],
    ['Toutes les commandes en un message', 'All commands in one message'], ['Voir la chaîne', 'View channel'], ['Ouvrir la chaîne', 'Open the channel'],
    ['Tapez', 'Type'], ['pour revenir au menu principal', 'to go back to the main menu'], ['Chaîne :', 'Channel:'],
    ['Aucun menu ne correspond à', 'No menu matches'], ['Actualiser', 'Refresh'],
    // Réponses générales
    ['Accès réservé au propriétaire du système', 'Access restricted to the system owner'], ['Cette commande est réservée au propriétaire du bot', 'This command is reserved for the bot owner'],
    ['Réservé aux admins du groupe', 'Reserved for group admins'], ['Seuls les admins du groupe peuvent', 'Only group admins can'],
    ['Cette commande fonctionne uniquement dans un groupe', 'This command only works in a group'], ['ACCÈS REFUSÉ', 'ACCESS DENIED'],
    ['Option invalide', 'Invalid option'], ['Utilisez', 'Use'], ['Réglage enregistré', 'Setting saved'], ['Monsieur', 'Sir'], ['activé', 'enabled'],
    ['désactivé', 'disabled'], ['Impossible de', 'Unable to'], ['Réessayez', 'Try again'], ['ÉCHEC', 'FAILED'], ['INTROUVABLE', 'NOT FOUND'],
    ['Aucune session enregistrée', 'No session registered'],
    // Ping / alive / stats
    ['DIAGNOSTIC SYSTÈME', 'SYSTEM DIAGNOSTIC'], ['Latence', 'Latency'], ['État', 'Status'], ['LENT', 'SLOW'], ['Disponible', 'Uptime'], ['Mémoire', 'Memory'], ['Charge', 'Load'], ['Moteur', 'Engine'],
    ['Tous les systèmes répondent normalement', 'All systems are responding normally'], ['SYSTÈMES EN LIGNE', 'SYSTEMS ONLINE'],
    ['Systèmes opérationnels. Je suis à votre disposition', 'Systems operational. At your service'], ['Accès', 'Access'], ['Public', 'Public'],
    ['ÉTAT DES SESSIONS', 'SESSION STATUS'], ['Sessions recensées', 'Sessions listed'], ['en ligne', 'online'], ['hors ligne', 'offline'],
    // Développeur / chaîne
    ['DÉVELOPPEUR', 'DEVELOPER'], ['Développeur', 'Developer'], ['Rôle', 'Role'], ['Nom', 'Name'], ['Contacter', 'Contact'], ['Site', 'Website'],
    ['ID DE CHAÎNE', 'CHANNEL ID'], ['Abonnés', 'Subscribers'], ['Créée le', 'Created on'], ['Copier le JID', 'Copy the JID'],
    ['Appuyez sur le bouton pour copier le JID', 'Tap the button to copy the JID'], ['CHAÎNE INTROUVABLE', 'CHANNEL NOT FOUND'],
    // Sessions / panel
    ['SESSIONS DU BOT', 'BOT SESSIONS'], ['Hors ligne', 'Offline'], ['En ligne', 'Online'], ['Détails', 'Details'], ['Supprimer', 'Delete'], ['SUPPRIMER ?', 'DELETE?'],
    ['Oui, supprimer', 'Yes, delete'], ['SESSION SUPPRIMÉE', 'SESSION DELETED'], ['SUPPRESSION INCOMPLÈTE', 'INCOMPLETE DELETION'], ['Relancer', 'Restart'],
    ['Purger les hors ligne', 'Purge offline sessions'], ['PURGE TERMINÉE', 'PURGE COMPLETE'], ['Confirmer la purge', 'Confirm purge'], ['Reconnexions', 'Reconnections'],
    ['Dernière activité', 'Last activity'], ['Dernière coupure', 'Last disconnection'], ['Messages en attente', 'Pending messages'], ['Créée', 'Created'],
    ['Action définitive', 'This cannot be undone'], ['Numéro', 'Number'], ['Total', 'Total'], ['il y a', 'ago'], ['jamais', 'never'], ['aucune', 'none'],
    ['PANEL DE CONTRÔLE', 'CONTROL PANEL'], ['Sections', 'Sections'], ['Ouvrir une section', 'Open a section'], ['Mémoire du bot', 'Bot memory'],
    ['Libérer la mémoire', 'Free memory'], ['Journaux', 'Logs'], ['Erreurs récentes', 'Recent errors'], ['Espace disque', 'Disk space'], ['Réglages', 'Settings'],
    ['Propriétaires', 'Owners'], ['Redémarrer le bot', 'Restart the bot'], ['Langue', 'Language'], ['Actualiser le panel', 'Refresh the panel'],
    ['Actualiser la RAM', 'Refresh RAM'], ['Libérer', 'Free up'], ['RAM', 'RAM'], ['Tas utilisé', 'Heap used'], ['Tas total', 'Heap total'], ['Limite du tas', 'Heap limit'],
    ['Par session', 'Per session'], ['Seuil de nettoyage', 'Cleanup threshold'], ['Dernier nettoyage', 'Last cleanup'], ['Libéré', 'Freed'], ['Avant', 'Before'], ['Après', 'After'],
    ['NETTOYAGE TERMINÉ', 'CLEANUP COMPLETE'], ['REDÉMARRAGE', 'RESTART'], ['Redémarrage en cours', 'Restarting now'], ['Oui, redémarrer', 'Yes, restart'],
    ['Aucune ligne', 'No lines'], ['LANGUE', 'LANGUAGE'], ['Langue actuelle', 'Current language'],
    ['Langue changée', 'Language changed'], ['propriétaire principal', 'main owner'],
    // Titres et libellés des rapports (nouveau design)
    ['Système', 'System'], ['Activité', 'Activity'], ['Ressources', 'Resources'], ['Liste', 'List'], ['Carte', 'Card'], ['Fonctionnent', 'Working'],
    ['En échec', 'Failed'], ['Environnement', 'Environment'], ['Statut', 'Status'], ['Nettoyage', 'Cleanup'], ['Seuil', 'Threshold'], ['Dossiers', 'Folders'],
    ['Tas V8', 'V8 heap'], ['Utilisé', 'Used'], ['Limite', 'Limit'], ['Mémoire externe', 'External memory'], ['Tampons', 'Buffers'], ['Serveur libre', 'Free server'],
    ['Opérationnel', 'Operational'], ['Recensées', 'Listed'], ['Dernier', 'Last'], ['Nettoyages', 'Cleanups'], ['Activité du bot', 'Bot activity'],
    ['Projet', 'Project'], ['Cookies', 'Cookies'], ['Sources OK', 'Working sources'], ['Test des sources', 'Source test'], ['Je suis à votre disposition', 'At your service'],
    ['Tapez', 'Type'], ['Modes', 'Modes'], ['Mode', 'Mode'],
    // Suppression / statut
    ['SUPPRESSION TERMINÉE', 'DELETION COMPLETE'], ['Supprimés', 'Deleted'], ['Cible', 'Target'], ['Échecs', 'Failures'], ['RIEN À SUPPRIMER', 'NOTHING TO DELETE'],
    ['STATUT PUBLIÉ', 'STATUS POSTED'], ['STATUT DE GROUPE', 'GROUP STATUS'], ['Il est visible par les membres du groupe', 'It is visible to group members'],
    ['Image', 'Image'], ['Vidéo', 'Video'], ['Texte', 'Text']
];

// Les titres en MAJUSCULES du dictionnaire ont aussi leur version « Titre » (le nouveau design écrit « Panel de contrôle »).
{
    const { niceTitle } = require('./style');
    const twins = [];
    for (const [fr, en] of DICTIONARY) {
        if (fr === fr.toUpperCase() && fr !== fr.toLowerCase() && fr.length > 3) twins.push([niceTitle(fr), niceTitle(en)]);
    }
    DICTIONARY.push(...twins);
}

const escapeRe = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const compiled = DICTIONARY
    .slice()
    .sort((a, b) => b[0].length - a[0].length)
    .map(([fr, en]) => {
        // Entrées en MAJUSCULES : ne s'appliquent qu'aux textes en majuscules (sinon « Menu principal » deviendrait « MAIN MENU »).
        const upperOnly = fr === fr.toUpperCase() && fr !== fr.toLowerCase();
        return { re: new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(fr)}(?![\\p{L}\\p{N}])`, upperOnly ? 'gu' : 'giu'), en };
    });

function matchCase(source, english) {
    if (source.length > 1 && source === source.toUpperCase() && source !== source.toLowerCase()) return english.toUpperCase();
    if (source[0] === source[0].toUpperCase() && source[0] !== source[0].toLowerCase()) return english[0].toUpperCase() + english.slice(1);
    return /^[A-Z]{2,}/.test(english) ? english : english[0].toLowerCase() + english.slice(1);
}

function translate(text) {
    if (currentLang() !== 'en' || typeof text !== 'string' || !text) return text;
    let out = text;
    for (const { re, en } of compiled) out = out.replace(re, match => matchCase(match, en));
    return out;
}

// Boutons / lignes de liste : seuls les textes affichés sont traduits (jamais id, url, copy_code).
function translateButtons(buttons) {
    if (currentLang() !== 'en' || !Array.isArray(buttons)) return buttons;
    return buttons.map(button => {
        const params = button.params ? { ...button.params } : null;
        if (!params) return button;
        for (const key of ['display_text', 'title', 'description', 'highlight_label']) if (typeof params[key] === 'string') params[key] = translate(params[key]);
        if (Array.isArray(params.sections)) {
            params.sections = params.sections.map(section => ({
                ...section,
                title: translate(section.title),
                rows: (section.rows || []).map(row => ({ ...row, title: translate(row.title), description: translate(row.description), header: translate(row.header) }))
            }));
        }
        return { ...button, params };
    });
}


/* ─── Traduction automatique (tout ce que le dictionnaire ne couvre pas) ─── */

// Ce qui ne doit JAMAIS être traduit : blocs de code, liens, commandes (.menu), mentions, <paramètres>,
// puis les décorations (* _ ~ │ ╭ ╰ ─ ❏ 『』 〔〕) et les retours à la ligne, qui servent de séparateurs.
const TOKEN = /```[\s\S]*?```|https?:\/\/\S+|(?<![\p{L}\p{N}])[.\/][a-z][a-z0-9]*|@\d+|<[^>\n]*>|[*_~`│┃║╭╰╮╯─━═❏『』〔〕◈◇✦⛨⤫→↳]+|\n+/giu;
const FRENCH_HINT = /[àâçéèêëîïôûùüÿœ]|(?:^|[^\p{L}])(?:le|la|les|un|une|des|du|de|et|ou|est|sont|pas|pour|avec|sur|dans|vous|votre|vos|je|tu|il|elle|nous|ce|cette|ces|aucun|aucune|tous|toutes|oui|non|merci|bonjour|veuillez|mon|ma|mes|ton|sont|été|être|avoir|fait|faire|peut|plus|moins|très|aussi|mais|donc|alors|quand|comme|si|ne|qui|que|où|il\s+y\s+a)(?![\p{L}])/iu;
const HAS_LETTERS = /[A-Za-zÀ-ÿ]{2,}/;
const ENGLISH_HINT = /(?:^|[^\p{L}])(?:the|and|is|are|was|to|of|in|you|your|for|with|this|that|not|all|please|error|failed|from|has|have|will|can|it|on|by|or|an|be)(?![\p{L}])/iu;
const ENGLISH_WORDS = new Set(DICTIONARY.flatMap(([, en]) => en.toLowerCase().split(/[^\p{L}]+/u)).filter(Boolean));
const LONG_WORD = /[A-Za-zÀ-ÿ]{4,}/;

let cache = new Map();
let cacheTimer = null;
let fetcher = null;           // injectable pour les tests : async (segments[]) => segments[]
let failures = 0;
let pausedUntil = 0;

try {
    cache = new Map(Object.entries(JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'))));
} catch { /* pas encore de cache */ }

function saveCacheSoon() {
    if (cacheTimer) return;
    cacheTimer = setTimeout(() => {
        cacheTimer = null;
        try {
            while (cache.size > 4000) cache.delete(cache.keys().next().value);
            fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
            fs.writeFileSync(CACHE_FILE, JSON.stringify(Object.fromEntries(cache)));
        } catch { /* cache en mémoire seulement */ }
    }, 4000);
    cacheTimer.unref?.();
}

// Découpe un texte en morceaux { text, translate } : seuls les morceaux « translate » partent à la traduction.
function pieces(text) {
    const out = [];
    let last = 0;
    const push = (value, translate) => { if (value) out.push({ text: value, translate }); };
    for (const match of text.matchAll(TOKEN)) {
        push(text.slice(last, match.index), true);
        push(match[0], false);
        last = match.index + match[0].length;
    }
    push(text.slice(last), true);
    // Un morceau part à la traduction s'il a des lettres et n'est pas reconnu comme de l'anglais (sinon un mot français
    // sans accent, ex. « Disque », resterait en français). Le service renvoie tel quel ce qui est déjà anglais.
    const isEnglish = (value) => {
        const words = (value.toLowerCase().match(/\p{L}+/gu) || []).filter(word => word.length > 3);
        if (words.length && words.every(word => ENGLISH_WORDS.has(word))) return true;   // uniquement des termes déjà traduits
        return ENGLISH_HINT.test(value) && !FRENCH_HINT.test(value);
    };
    return out.map(piece => {
        if (!piece.translate) return piece;
        const frenchLike = HAS_LETTERS.test(piece.text) && FRENCH_HINT.test(piece.text);
        const unknownWord = LONG_WORD.test(piece.text) && !isEnglish(piece.text);
        return frenchLike || unknownWord ? piece : { ...piece, translate: false };
    });
}

async function googleFetcher(segments) {
    const axios = require('axios');
    const joined = segments.join('\n');
    const response = await axios.post(
        'https://translate.googleapis.com/translate_a/single?client=gtx&sl=fr&tl=en&dt=t',
        new URLSearchParams({ q: joined }).toString(),
        { timeout: 4000, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    const translated = (response.data?.[0] || []).map(chunk => chunk[0]).join('');
    const lines = translated.split('\n');
    if (lines.length !== segments.length) throw new Error('traduction désalignée');
    return lines;
}

async function translateSegments(segments) {
    const missing = [...new Set(segments.filter(segment => !cache.has(segment)))];
    if (!missing.length || Date.now() < pausedUntil) return;
    const run = fetcher || googleFetcher;
    try {
        for (let start = 0; start < missing.length;) {
            // Lots de ~3500 caractères (limite d'une requête).
            let end = start;
            let size = 0;
            while (end < missing.length && (size + missing[end].length < 3500 || end === start)) { size += missing[end].length + 1; end += 1; }
            const batch = missing.slice(start, end);
            const result = await run(batch);
            batch.forEach((segment, index) => { if (typeof result[index] === 'string' && result[index].trim()) cache.set(segment, result[index].trim()); });
            start = end;
        }
        failures = 0;
        saveCacheSoon();
    } catch (error) {
        failures += 1;
        if (failures >= 3) { pausedUntil = Date.now() + 60 * 1000; failures = 0; }   // service coupé : on n'attend plus à chaque message
        console.warn('[langue] traduction automatique indisponible, dictionnaire seul :', error.message);
    }
}

/** Traduit plusieurs textes en une seule requête. Ne lève jamais d'erreur : au pire, dictionnaire seul. */
async function translateMany(texts) {
    if (currentLang() !== 'en') return texts;
    const base = texts.map(text => translate(text));                 // 1. dictionnaire
    const split = base.map(text => (typeof text === 'string' && text ? pieces(text) : null));
    const wanted = [];
    for (const list of split) for (const piece of list || []) if (piece.translate) wanted.push(piece.text.trim());
    if (wanted.length) await translateSegments(wanted);               // 2. traduction automatique (restes en français)
    return split.map((list, index) => {
        if (!list) return base[index];
        return list.map(piece => {
            if (!piece.translate) return piece.text;
            const lead = piece.text.match(/^\s*/)[0];
            const tail = piece.text.match(/\s*$/)[0];
            const done = cache.get(piece.text.trim());
            return done ? `${lead}${done}${tail}` : piece.text;
        }).join('');
    });
}

async function translateAsync(text) {
    if (currentLang() !== 'en' || typeof text !== 'string' || !text) return text;
    return (await translateMany([text]))[0];
}

// Boutons et listes : tous les textes affichés partent ensemble (une requête) ; id, url et copy_code restent intacts.
async function translateButtonsAsync(buttons) {
    if (currentLang() !== 'en' || !Array.isArray(buttons)) return buttons;
    const slots = [];
    const clone = buttons.map(button => {
        if (!button.params) return button;
        const params = { ...button.params };
        for (const key of ['display_text', 'title', 'description', 'highlight_label']) if (typeof params[key] === 'string') slots.push({ target: params, key });
        if (Array.isArray(params.sections)) {
            params.sections = params.sections.map(section => {
                const copy = { ...section, rows: (section.rows || []).map(row => ({ ...row })) };
                if (typeof copy.title === 'string') slots.push({ target: copy, key: 'title' });
                for (const row of copy.rows) for (const key of ['title', 'description', 'header']) if (typeof row[key] === 'string') slots.push({ target: row, key });
                return copy;
            });
        }
        return { ...button, params };
    });
    const results = await translateMany(slots.map(slot => slot.target[slot.key]));
    slots.forEach((slot, index) => { slot.target[slot.key] = results[index]; });
    return clone;
}

function _setFetcher(fn) { fetcher = fn; failures = 0; pausedUntil = 0; }
function _clearCache() { cache = new Map(); }

module.exports = { getLang, isEnglish, setLang, translate, translateButtons, translateMany, translateAsync, translateButtonsAsync, pieces, _setFetcher, _clearCache, DICTIONARY };
