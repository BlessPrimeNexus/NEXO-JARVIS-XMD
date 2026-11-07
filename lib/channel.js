'use strict';

/*
 * Chaîne WhatsApp officielle — source unique pour tout le bot
 * ───────────────────────────────────────────────────────────
 * Le lien d'invitation (code) est connu ; le JID technique (xxxx@newsletter), indispensable au
 * bouton « Voir la chaîne » (forwardedNewsletterMessageInfo), est demandé à WhatsApp dès que le
 * bot est connecté (sock.newsletterMetadata('invite', code)), puis gardé en mémoire et sur disque.
 *
 * Pour le forcer à la main (facultatif) : variable d'environnement CHANNEL_JID=120363...@newsletter
 */

const fs = require('fs');
const path = require('path');

const CODE = '0029Vb78ycrInlqYocbYLX0P';
const LINK = `https://whatsapp.com/channel/${CODE}`;
const DEFAULT_NAME = '𝗡𝗘𝗫𝗢-𝗝𝗔𝗥𝗩𝗜𝗦 𝗫𝗠𝗗';
const FILE = process.env.CHANNEL_CACHE_FILE || path.join(__dirname, '..', 'data', 'channel.json');
const RETRY_MS = 60 * 1000;

const JID_PATTERN = /^\d{8,}@newsletter$/;

let current = { jid: '', name: '' };
let pending = null;
let lastAttempt = 0;

function validJid(value) {
    return JID_PATTERN.test(String(value || '').trim());
}

function loadCache() {
    try {
        const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
        if (data && data.code === CODE && validJid(data.jid)) {
            current = { jid: data.jid, name: String(data.name || '') };
        }
    } catch { /* pas encore de cache */ }
}

function saveCache() {
    try {
        fs.mkdirSync(path.dirname(FILE), { recursive: true });
        fs.writeFileSync(FILE, JSON.stringify({ code: CODE, jid: current.jid, name: current.name }, null, 2));
    } catch (error) {
        console.warn('[channel] cache non enregistré :', error.message);
    }
}

if (validJid(process.env.CHANNEL_JID)) {
    current = { jid: process.env.CHANNEL_JID.trim(), name: '' };
} else {
    loadCache();
}

const link = () => LINK;
const code = () => CODE;
const jid = () => current.jid;
const name = () => current.name || DEFAULT_NAME;
const isReady = () => validJid(current.jid);

// Bloc prêt à placer dans contextInfo.forwardedNewsletterMessageInfo ; null tant que le JID est inconnu.
function forwardInfo() {
    if (!isReady()) return null;
    return { newsletterJid: current.jid, newsletterName: name(), serverMessageId: -1 };
}

// Interroge WhatsApp (une fois à la fois, pas plus d'une tentative par minute).
async function resolve(sock, { force = false } = {}) {
    if (isReady() && process.env.CHANNEL_JID) return current.jid;
    if (isReady() && force) return current.jid;
    if (pending) return pending;
    if (!force && Date.now() - lastAttempt < RETRY_MS && !isReady()) return current.jid || null;
    if (!sock || typeof sock.newsletterMetadata !== 'function') return current.jid || null;

    lastAttempt = Date.now();
    pending = (async () => {
        try {
            const metadata = await sock.newsletterMetadata('invite', CODE);
            const found = metadata && (metadata.id || metadata.jid);
            if (!validJid(found)) throw new Error('JID de chaîne introuvable dans la réponse');
            const title = metadata.name || metadata.thread_metadata?.name?.text || '';
            const changed = found !== current.jid;
            current = { jid: found, name: String(title || current.name || '') };
            if (changed) {
                saveCache();
                console.log(`[channel] ✅ Chaîne officielle résolue : ${found}`);
            }
            return found;
        } catch (error) {
            console.warn(`[channel] JID de la chaîne non résolu pour l'instant (${error.message}). Nouvel essai à la prochaine connexion.`);
            return current.jid || null;
        } finally {
            pending = null;
        }
    })();
    return pending;
}

// Test uniquement.
function _reset(value = {}) {
    current = { jid: value.jid || '', name: value.name || '' };
    pending = null;
    lastAttempt = 0;
}

module.exports = { CODE, LINK, link, code, jid, name, isReady, forwardInfo, resolve, validJid, _reset };
