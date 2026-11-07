'use strict';

/*
 * ANTIBOT — moteur de détection et d'application.
 *
 * Pourquoi l'ancienne version ne faisait « rien » :
 *   1. lib/botInstance.js jetait tous les messages dont l'ID commence par « BAE5 » (ID des bots Baileys)
 *      AVANT main.js : l'antibot ne voyait donc jamais les messages des autres bots.
 *   2. la détection reposait sur « le JID contient : » (suffixe d'appareil), absent des messages de groupe.
 *   3. même quand un message était reconnu, il était seulement ignoré : jamais supprimé, aucun retour visuel.
 *
 * Signaux utilisés (du plus sûr au plus faible) :
 *   • ID de message « BAE5… » (16 car.) ou « 3EB0… » (12 car.) = générés par Baileys, jamais par un vrai téléphone ;
 *   • type de message réservé aux bots / API : boutons natifs (interactiveMessage), buttonsMessage, listMessage,
 *     templateMessage… un utilisateur normal ne peut PAS en envoyer ;
 *   • aperçu publicitaire (externalAdReply) sur un message non transféré ;
 *   • numéro déjà appris comme bot dans ce groupe (.antibot add @user, ou détecté automatiquement une fois) :
 *     ses messages texte simples sont alors bloqués aussi.
 */

const fs = require('fs');
const path = require('path');

const FILE = process.env.ANTIBOT_FILE || path.join(__dirname, '..', 'data', 'antibot.json');
const ACTIONS = ['delete', 'kick'];

const BOT_CONTENT_KEYS = [
    'interactiveMessage', 'buttonsMessage', 'listMessage', 'templateMessage',
    'highlyStructuredMessage', 'productMessage', 'orderMessage', 'carouselMessage'
];

const digits = value => String(value || '').split('@')[0].split(':')[0].replace(/\D/g, '');

/* ─── Stockage (compatible avec l'ancien format { groupe: true|false }) ─── */

function readAll() {
    try {
        if (!fs.existsSync(FILE)) return {};
        const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
        return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
    } catch {
        return {};
    }
}

function writeAll(state) {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    const temp = `${FILE}.${process.pid}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(state, null, 2));
    fs.renameSync(temp, FILE);
}

function normalize(entry) {
    if (entry === true || entry === false) return { enabled: entry, action: 'delete', bots: [] };
    const value = entry && typeof entry === 'object' ? entry : {};
    return {
        enabled: Boolean(value.enabled),
        action: ACTIONS.includes(value.action) ? value.action : 'delete',
        bots: Array.isArray(value.bots) ? [...new Set(value.bots.map(digits).filter(Boolean))] : []
    };
}

function getConfig(chatId) {
    return normalize(readAll()[chatId]);
}

function setConfig(chatId, patch = {}) {
    const state = readAll();
    const next = { ...normalize(state[chatId]), ...patch };
    next.action = ACTIONS.includes(next.action) ? next.action : 'delete';
    state[chatId] = next;
    writeAll(state);
    return normalize(next);
}

function isAntibotEnabled(chatId) {
    return getConfig(chatId).enabled;
}

function addBot(chatId, number) {
    const clean = digits(number);
    if (clean.length < 5) return false;
    const config = getConfig(chatId);
    if (config.bots.includes(clean)) return false;
    setConfig(chatId, { bots: [...config.bots, clean] });
    return true;
}

function removeBot(chatId, number) {
    const clean = digits(number);
    const config = getConfig(chatId);
    if (!config.bots.includes(clean)) return false;
    setConfig(chatId, { bots: config.bots.filter(value => value !== clean) });
    return true;
}

/* ─── Détection ─── */

function contextsOf(content) {
    const list = [];
    for (const value of Object.values(content || {})) {
        if (value && typeof value === 'object' && value.contextInfo) list.push(value.contextInfo);
    }
    return list;
}

/** Retourne la raison pour laquelle ce message vient d'un bot ('' si c'est un humain). */
function detectBotMessage(message) {
    if (!message || !message.key || message.key.fromMe) return '';
    const id = String(message.key.id || '');
    if (id.startsWith('BAE5') && id.length === 16) return 'id-baileys';
    if (id.startsWith('3EB0') && id.length === 12) return 'id-baileys-ancien';

    const content = message.message || {};
    for (const key of BOT_CONTENT_KEYS) {
        if (content[key]) return `type-${key}`;
    }
    for (const info of contextsOf(content)) {
        if (info.externalAdReply && !info.isForwarded && !info.forwardingScore) return 'apercu-publicitaire';
    }
    return '';
}

/** True si l'ID est celui d'un message Baileys d'un autre bot (jamais traité comme une commande). */
function isForeignBaileysId(message) {
    const id = String(message?.key?.id || '');
    return !message?.key?.fromMe && id.startsWith('BAE5') && id.length === 16;
}

/* ─── Application ─── */

const notices = new Map();   // clé → horodatage (évite de spammer le groupe)
function shouldNotice(key, delayMs) {
    const now = Date.now();
    if ((notices.get(key) || 0) > now) return false;
    notices.set(key, now + delayMs);
    if (notices.size > 500) notices.delete(notices.keys().next().value);
    return true;
}

function ownSessionNumbers() {
    const numbers = new Set();
    try {
        for (const bot of require('./botInstance').getConnectedBots()) numbers.add(digits(bot.number));
    } catch { /* aucune instance */ }
    try {
        for (const session of require('./session-manager').sessionManager.listSessions()) {
            numbers.add(digits(session.phoneNumber || session.phone || session.number));
        }
    } catch { /* gestionnaire indisponible */ }
    numbers.delete('');
    return numbers;
}

/**
 * Appelé pour chaque message de groupe. Retourne true si le message venait d'un bot et a été traité :
 * main.js doit alors s'arrêter là (aucune autre fonction ne répond à un bot).
 */
async function handleAntibot(sock, chatId, message, senderId, { senderIsOwnerOrSudo = false } = {}) {
    if (!chatId || !String(chatId).endsWith('@g.us')) return false;
    if (!message?.key || message.key.fromMe) return false;
    const config = getConfig(chatId);
    if (!config.enabled) return false;
    if (senderIsOwnerOrSudo) return false;

    const senderNumbers = [senderId, message.key.participantAlt, message.key.participant]
        .map(digits).filter(Boolean);
    if (!senderNumbers.length) return false;

    // Les autres sessions de CE bot (multi-sessions) ne sont jamais bloquées.
    const own = ownSessionNumbers();
    if (senderNumbers.some(number => own.has(number))) return false;

    const known = senderNumbers.some(number => config.bots.includes(number));
    const reason = detectBotMessage(message) || (known ? 'bot-connu' : '');
    if (!reason) return false;

    // Mémorise l'expéditeur : ses prochains messages texte seront bloqués aussi.
    if (!known && reason !== 'bot-connu') {
        try { addBot(chatId, senderNumbers[0]); } catch { /* sans conséquence */ }
    }

    const isAdmin = require('./isAdmin');
    let botIsAdmin = false;
    let targetIsAdmin = false;
    try {
        const status = await isAdmin(sock, chatId, senderId);
        botIsAdmin = Boolean(status.isBotAdmin);
        targetIsAdmin = Boolean(status.isSenderAdmin);
    } catch { /* on tente quand même */ }

    if (!botIsAdmin) {
        if (shouldNotice(`noadmin:${chatId}`, 30 * 60 * 1000)) {
            try {
                await sock.sendMessage(chatId, {
                    text: '⚠️ *ANTIBOT* actif, mais je ne suis pas administrateur du groupe : je ne peux ni supprimer les messages des bots ni les retirer. Faites-moi admin pour que la protection agisse.'
                });
            } catch { /* sans conséquence */ }
        }
        return true;   // le message d'un bot n'est de toute façon jamais traité comme une commande
    }

    try {
        await sock.sendMessage(chatId, { delete: message.key });
    } catch (error) {
        console.error('[antibot] suppression impossible :', error.message);
    }

    const tag = `@${senderNumbers[0]}`;
    if (config.action === 'kick' && !targetIsAdmin) {
        try {
            await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');
            if (shouldNotice(`kick:${chatId}:${senderNumbers[0]}`, 60 * 1000)) {
                await sock.sendMessage(chatId, {
                    text: `🤖🚫 *ANTIBOT* : ${tag} est un bot, il a été retiré du groupe.`,
                    mentions: [senderId]
                });
            }
        } catch (error) {
            console.error('[antibot] retrait impossible :', error.message);
        }
    } else if (shouldNotice(`del:${chatId}:${senderNumbers[0]}`, 60 * 1000)) {
        try {
            await sock.sendMessage(chatId, {
                text: `🤖🛡️ *ANTIBOT* : message du bot ${tag} supprimé. Les autres bots ne sont pas autorisés ici.`,
                mentions: [senderId]
            });
        } catch { /* sans conséquence */ }
    }
    return true;
}

module.exports = {
    ACTIONS, digits, getConfig, setConfig, isAntibotEnabled, addBot, removeBot,
    detectBotMessage, isForeignBaileysId, handleAntibot, _FILE: FILE
};
