'use strict';

/*
 * Journal léger des messages de groupe vus par le bot (identifiants seulement, pas le contenu).
 * Sert à `.del` : WhatsApp ne permet pas au bot de relire l'historique, il ne peut donc supprimer que
 * les messages qu'il a vus passer. Gardé en mémoire et sauvegardé sur disque (survit aux redémarrages).
 */

const fs = require('fs');
const path = require('path');

const FILE = process.env.MESSAGE_LOG_FILE || path.join(__dirname, '..', 'data', 'messageLog.json');
const MAX_PER_CHAT = 400;
const MAX_CHATS = 300;

const { ScopedMap } = require('./sessionContext');
let chats = new ScopedMap();   // chatId -> [{ id, participant, alt, ts, type }]
let timer = null;

try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    chats = new Map(Object.entries(raw).filter(([, list]) => Array.isArray(list)));
} catch { /* premier démarrage */ }

function scheduleSave() {
    if (timer) return;
    timer = setTimeout(() => {
        timer = null;
        try {
            fs.mkdirSync(path.dirname(FILE), { recursive: true });
            const trimmed = Object.fromEntries([...chats].map(([chat, list]) => [chat, list.slice(-150)]));
            fs.writeFileSync(`${FILE}.tmp`, JSON.stringify(trimmed));
            fs.renameSync(`${FILE}.tmp`, FILE);
        } catch { /* disque indisponible : le journal reste en mémoire */ }
    }, 5000);
    timer.unref?.();
}

function typeOf(content = {}) {
    const key = Object.keys(content).find(name => name.endsWith('Message') || name === 'conversation');
    return key || 'unknown';
}

function record(chatId, message) {
    try {
        if (!String(chatId).endsWith('@g.us') || !message?.key?.id || !message.message) return;
        if (message.key.fromMe) return;
        const content = message.message;
        if (content.protocolMessage || content.reactionMessage || content.senderKeyDistributionMessage) return;

        const list = chats.get(chatId) || [];
        if (list.some(entry => entry.id === message.key.id)) return;
        list.push({
            id: message.key.id,
            participant: message.key.participant || '',
            alt: message.key.participantAlt || '',
            ts: Number(message.messageTimestamp) || Math.floor(Date.now() / 1000),
            type: typeOf(content)
        });
        if (list.length > MAX_PER_CHAT) list.splice(0, list.length - MAX_PER_CHAT);
        chats.set(chatId, list);
        if (chats.size > MAX_CHATS) chats.delete(chats.keys().next().value);
        scheduleSave();
    } catch { /* le journal ne doit jamais gêner le bot */ }
}

// Du plus récent au plus ancien.
function recent(chatId) {
    return [...(chats.get(chatId) || [])].reverse();
}

function forget(chatId, ids) {
    const drop = new Set(ids);
    const list = chats.get(chatId);
    if (!list) return;
    chats.set(chatId, list.filter(entry => !drop.has(entry.id)));
    scheduleSave();
}

// Allège le journal en gardant seulement les `keep` messages les plus récents par groupe.
function trim(keep = 60) {
    for (const [chat, list] of Map.prototype.entries.call(chats)) Map.prototype.set.call(chats, chat, list.slice(-keep));
}

function _reset() { chats = new ScopedMap(); }

module.exports = { record, recent, forget, trim, _reset };
