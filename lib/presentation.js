'use strict';

/*
 * Couche de présentation NEXO-JARVIS XMD
 * ──────────────────────────────────────
 * Ne touche JAMAIS à la logique des commandes : elle enveloppe uniquement
 * sock.sendMessage pour que chaque réponse du bot :
 *   1. porte le bouton « Voir la chaîne » (forwardedNewsletterMessageInfo) ;
 *      et cite la commande sous forme de carte « WhatsApp Business ✓ » (lib/quoteCard.js) ;
 *   2. pour les réponses texte, affiche un aperçu de lien avec une image
 *      choisie à tour de rôle parmi la liste hébergée (catbox) : l'image n'est
 *      PAS envoyée comme photo, donc rien ne s'enregistre dans la galerie.
 *
 * Les liens d'images se règlent dans settings.js (previewImages) ou via la
 * variable d'environnement PREVIEW_IMAGES (liens séparés par des virgules).
 */

const axios = require('axios');
const settings = require('../settings');
const { channelInfo } = require('./messageConfig');
const { applyQuoteCard } = require('./quoteCard');
const { remember } = require('./sentMessages');

const WRAPPED = Symbol.for('nexo.jarvis.presentation');
const PLACEHOLDER = /REMPLACE|PLACEHOLDER|example\.com/i;
const THUMB_RETRY_MS = 5 * 60 * 1000;

/* ─── Liste d'images ───────────────────────────────────────── */

function isValidImageUrl(value) {
    try {
        const url = new URL(String(value || '').trim());
        return /^https?:$/.test(url.protocol) && !PLACEHOLDER.test(url.href);
    } catch {
        return false;
    }
}

function configuredImages() {
    const fromEnv = process.env.PREVIEW_IMAGES;
    const raw = fromEnv ? fromEnv.split(/[\s,;]+/) : (settings.previewImages || []);
    return [...new Set(raw.map(item => String(item || '').trim()).filter(isValidImageUrl))];
}

/* ─── Rotation « sac mélangé » ─────────────────────────────────
 * Chaque image sort une fois par cycle, dans un ordre aléatoire, et la
 * première image d'un nouveau cycle n'est jamais celle qui vient de sortir.
 */

function shuffle(list, rng) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

function createRotator(list, rng = Math.random) {
    const items = Array.isArray(list) ? list.slice() : [];
    let bag = [];
    let last = null;

    return {
        size: items.length,
        next() {
            if (!items.length) return null;
            if (items.length === 1) return items[0];
            if (!bag.length) {
                bag = shuffle(items, rng);
                // bag.pop() sort le dernier élément : il ne doit pas répéter le précédent.
                if (bag[bag.length - 1] === last) {
                    [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
                }
            }
            last = bag.pop();
            return last;
        }
    };
}

let rotator = null;
let rotatorKey = '';

function nextImage() {
    const list = configuredImages();
    const key = list.join('|');
    if (!rotator || key !== rotatorKey) {
        rotator = createRotator(list);
        rotatorKey = key;
    }
    return rotator.next();
}

/* ─── Miniatures (mises en cache, chargées en arrière-plan) ─── */

const thumbCache = new Map();    // url -> Buffer
const thumbFailed = new Map();   // url -> timestamp du dernier échec
const thumbPending = new Map();  // url -> Promise

async function loadThumbnail(url) {
    if (thumbCache.has(url)) return thumbCache.get(url);
    if (thumbPending.has(url)) return thumbPending.get(url);
    const failedAt = thumbFailed.get(url);
    if (failedAt && Date.now() - failedAt < THUMB_RETRY_MS) return null;

    const task = (async () => {
        try {
            const response = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: 8000,
                maxContentLength: 6 * 1024 * 1024,
                headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NEXO-JARVIS-XMD)' }
            });
            let buffer = Buffer.from(response.data);
            try {
                // Petite miniature JPEG : légère en mémoire et acceptée par WhatsApp.
                buffer = await require('sharp')(buffer)
                    .resize(480, 252, { fit: 'cover' })
                    .jpeg({ quality: 70 })
                    .toBuffer();
            } catch {
                if (buffer.length > 150 * 1024) buffer = null;
            }
            if (!buffer || !buffer.length) throw new Error('image vide');
            thumbCache.set(url, buffer);
            thumbFailed.delete(url);
            return buffer;
        } catch (error) {
            thumbFailed.set(url, Date.now());
            return null;
        } finally {
            thumbPending.delete(url);
        }
    })();

    thumbPending.set(url, task);
    return task;
}

function cachedThumbnail(url) {
    if (process.env.NEXO_NO_THUMBNAIL_FETCH === '1') return undefined;
    if (thumbCache.has(url)) return thumbCache.get(url);
    loadThumbnail(url).catch(() => {});   // préparer pour le prochain message
    return undefined;
}

function warmup() {
    if (process.env.NEXO_NO_THUMBNAIL_FETCH === '1') return;
    const timer = setTimeout(async () => {
        for (const url of configuredImages()) {
            await loadThumbnail(url).catch(() => {});
        }
    }, 4000);
    timer.unref?.();
}

/* ─── Construction des éléments d'affichage ─────────────────── */

function channelForward() {
    return channelInfo.contextInfo.forwardedNewsletterMessageInfo;
}

function channelLink() {
    return settings.channelLink || 'https://whatsapp.com/channel/0029VbDCIHn4tRrpvS6YS332';
}

function buildExternalAdReply() {
    const imageUrl = nextImage();
    if (!imageUrl) return null;

    const reply = {
        title: settings.previewTitle || settings.botName || 'NEXO-JARVIS XMD',
        body: settings.previewBody || 'Systèmes opérationnels. À votre service.',
        mediaType: 1,
        thumbnailUrl: imageUrl,
        sourceUrl: settings.previewSourceUrl || channelLink(),
        renderLargerThumbnail: true,
        showAdAttribution: false
    };
    const thumbnail = cachedThumbnail(imageUrl);
    if (thumbnail) reply.thumbnail = thumbnail;
    return reply;
}

/* ─── Décoration d'un message sortant ───────────────────────── */

// Types de contenu qu'on ne touche surtout pas.
const UNTOUCHED = [
    'react', 'delete', 'edit', 'pin', 'poll', 'forward', 'disappearingMessagesInChat',
    'sections', 'listMessage', 'interactiveMessage',
    'groupInvite', 'sharePhoneNumber', 'requestPhoneNumber'
];
// Anciens boutons WhatsApp (buttonsMessage / templateMessage) : plus affichés par la plupart des
// téléphones, le message entier risque d'être invisible. On les retire : le texte reste, décoré.
const LEGACY_BUTTONS = ['buttons', 'templateButtons', 'headerType', 'footer'];
const MEDIA_KEYS = ['image', 'video', 'audio', 'sticker', 'document', 'contacts', 'location', 'liveLocation'];

function decorate(jid, content) {
    if (!content || typeof content !== 'object' || Array.isArray(content)) return content;
    const target = String(jid || '');
    if (!target || target === 'status@broadcast' || target.endsWith('@newsletter')) return content;
    if (UNTOUCHED.some(key => content[key] !== undefined)) return content;

    const isText = typeof content.text === 'string';
    const isMedia = MEDIA_KEYS.some(key => content[key] !== undefined);
    if (!isText && !isMedia) return content;
    if (LEGACY_BUTTONS.some(key => content[key] !== undefined)) {
        content = Object.fromEntries(Object.entries(content).filter(([key]) => !LEGACY_BUTTONS.includes(key)));
    }

    const contextInfo = { ...(content.contextInfo || {}) };
    contextInfo.isForwarded = true;
    contextInfo.forwardingScore = Math.max(1, Number(contextInfo.forwardingScore) || 0);
    if (!contextInfo.forwardedNewsletterMessageInfo) {
        contextInfo.forwardedNewsletterMessageInfo = { ...channelForward() };
    }

    // Aperçu d'image uniquement sur les réponses texte (jamais sur les médias).
    if (isText && !contextInfo.externalAdReply) {
        const preview = buildExternalAdReply();
        if (preview) contextInfo.externalAdReply = preview;
    }

    return { ...content, contextInfo };
}

// Pour les messages envoyés via relayMessage (boutons natifs) : bouton chaîne seulement.
function decorateContextInfo(contextInfo = {}) {
    const merged = { ...contextInfo };
    merged.isForwarded = true;
    merged.forwardingScore = Math.max(1, Number(merged.forwardingScore) || 0);
    if (!merged.forwardedNewsletterMessageInfo) {
        merged.forwardedNewsletterMessageInfo = { ...channelForward() };
    }
    return merged;
}

/* ─── Enveloppe du socket ───────────────────────────────────── */

function wrapSocket(sock) {
    if (!sock || typeof sock.sendMessage !== 'function' || sock[WRAPPED]) return sock;

    const original = sock.sendMessage.bind(sock);
    sock.sendMessage = (jid, content, options) => {
        let outgoing = content;
        try {
            outgoing = decorate(jid, content);
        } catch (error) {
            console.warn('[NEXO-JARVIS] présentation ignorée pour ce message :', error.message);
        }
        let outgoingOptions = options;
        try {
            // Toute réponse décorée (texte, média, contact…) porte la fausse citation, qu'elle cite
            // quelque chose ou non ; réactions, suppressions et sondages restent intacts.
            if (outgoing !== content || (content && typeof content === 'object' && content.poll !== undefined)) {
                const quoted = applyQuoteCard(options && options.quoted, jid);
                if (quoted && quoted !== (options && options.quoted)) outgoingOptions = { ...(options || {}), quoted };
            }
        } catch (error) {
            console.warn('[NEXO-JARVIS] carte de citation ignorée :', error.message);
        }
        return Promise.resolve(original(jid, outgoing, outgoingOptions)).then(sent => {
            // Gardé en mémoire pour pouvoir le renvoyer si un téléphone ne l'a pas déchiffré.
            try { remember(sent); } catch { /* sans conséquence */ }
            return sent;
        });
    };

    // Messages envoyés autrement (menus à boutons) : mêmes précautions.
    if (typeof sock.relayMessage === 'function') {
        const originalRelay = sock.relayMessage.bind(sock);
        sock.relayMessage = (jid, message, relayOptions) => {
            return Promise.resolve(originalRelay(jid, message, relayOptions)).then(result => {
                try {
                    const id = relayOptions && relayOptions.messageId;
                    if (id) remember({ key: { remoteJid: jid, id, fromMe: true }, message });
                } catch { /* sans conséquence */ }
                return result;
            });
        };
    }
    sock.sendRaw = original;   // envoi sans aucune décoration (utilisé par .viewtest)
    sock[WRAPPED] = true;
    warmup();
    return sock;
}

module.exports = {
    wrapSocket,
    decorate,
    decorateContextInfo,
    previewAdReply: buildExternalAdReply,
    createRotator,
    configuredImages,
    nextImage
};
