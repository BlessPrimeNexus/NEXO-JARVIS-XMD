'use strict';

/*
 * Couche de présentation NEXO-JARVIS XMD
 * ──────────────────────────────────────
 * Ne touche JAMAIS à la logique des commandes : elle enveloppe uniquement
 * sock.sendMessage pour que chaque réponse du bot :
 *   1. porte le bouton « Voir la chaîne » (forwardedNewsletterMessageInfo) ;
 *      et cite la commande sous forme de carte « WhatsApp Business ✓ » (lib/quoteCard.js) ;
 *   2. pour les réponses texte, affiche un aperçu de lien avec une image
 *      choisie à tour de rôle parmi le dossier jarvis-images/. L'image est
 *      embarquée sous forme de MINIATURE dans le message (aucun lien distant),
 *      donc elle s'affiche pour tout le monde et rien ne s'enregistre dans la
 *      galerie ni dans le cache des membres.
 *
 * Ajouter / remplacer des images : déposer des .jpg/.png dans jarvis-images/
 * (ou PREVIEW_IMAGES_DIR=/chemin/dossier). Couper l'aperçu : .preview off
 */

const fs = require('fs');
const path = require('path');
const settings = require('../settings');
const channel = require('./channel');
const displayFlags = require('./displayFlags');
const { applyQuoteCard, logoBuffer } = require('./quoteCard');
const { remember } = require('./sentMessages');
const { frameText, restyleLegacy, stylize, cleanup } = require('./style');
const i18n = require('./i18n');

const WRAPPED = Symbol.for('nexo.jarvis.presentation');
const IMAGE_DIR = path.join(__dirname, '..', 'jarvis-images');
const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;
const PHOTO_MAX_CAPTION = 1000;
// Une miniature intégrée pèse quelques Ko : c'est elle (et non un lien distant) que WhatsApp affiche.
const THUMB_MAX_BYTES = 26 * 1024;

/* ─── Liste d'images (fichiers locaux du bot) ───────────────────
 * Avant : l'aperçu pointait vers un lien catbox que CHAQUE téléphone devait télécharger lui-même.
 * Un téléphone qui n'y arrivait pas (réseau, blocage du site…) n'affichait tout simplement pas le
 * message, et les téléphones qui y arrivaient gardaient l'image en cache. Maintenant l'image est lue
 * ici, réduite en miniature, et embarquée dans le message : aucune requête côté membre, rien à
 * enregistrer chez eux, et un affichage identique pour tout le monde.
 */

function localImages() {
    const custom = process.env.PREVIEW_IMAGES_DIR;
    let themeDir = IMAGE_DIR;
    try { themeDir = require('./theme').imagesDir(); } catch { /* images par défaut */ }
    const dir = custom ? path.resolve(custom) : themeDir;
    try {
        return fs.readdirSync(dir)
            .filter(file => IMAGE_EXT.test(file))
            .sort()
            .map(file => path.join(dir, file));
    } catch {
        return [];
    }
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
    const list = localImages();
    const key = list.join('|');
    if (!rotator || key !== rotatorKey) {
        rotator = createRotator(list);
        rotatorKey = key;
    }
    return rotator.next();
}

/* ─── Miniatures (préparées une fois, gardées en mémoire) ───── */

const thumbCache = new Map();    // fichier -> Buffer JPEG
const thumbPending = new Map();  // fichier -> Promise

async function makeThumbnail(file) {
    const source = fs.readFileSync(file);
    try {
        const sharp = require('sharp');
        for (const [width, height, quality] of [[480, 252, 62], [400, 210, 52], [320, 168, 44], [256, 134, 36]]) {
            const buffer = await sharp(source)
                .rotate()
                .resize(width, height, { fit: 'cover' })
                .jpeg({ quality, mozjpeg: true })
                .toBuffer();
            if (buffer.length <= THUMB_MAX_BYTES) return buffer;
        }
    } catch { /* sharp indisponible : repli ci-dessous */ }
    return source.length <= THUMB_MAX_BYTES ? source : null;
}

function loadThumbnail(file) {
    if (thumbCache.has(file)) return Promise.resolve(thumbCache.get(file));
    if (thumbPending.has(file)) return thumbPending.get(file);
    const task = makeThumbnail(file)
        .then(buffer => {
            // Repli : le logo JARVIS embarqué, pour qu'un aperçu soit TOUJOURS présent et jamais distant.
            const final = buffer || logoBuffer();
            thumbCache.set(file, final);
            return final;
        })
        .catch(() => {
            const fallback = logoBuffer();
            thumbCache.set(file, fallback);
            return fallback;
        })
        .finally(() => thumbPending.delete(file));
    thumbPending.set(file, task);
    return task;
}

function warmup() {
    if (process.env.NEXO_NO_THUMBNAIL_FETCH === '1') return;
    const timer = setTimeout(async () => {
        for (const file of localImages()) await loadThumbnail(file).catch(() => {});
    }, 1500);
    timer.unref?.();
}

/* ─── Vraies images (mode .imagemode on) ───────────────────────
 * Solution temporaire demandée : la réponse part comme une vraie photo + légende (au lieu d'un simple
 * aperçu). L'image est redimensionnée une fois puis gardée en mémoire. Attention : WhatsApp enregistre
 * ces photos dans la galerie des membres qui ont le téléchargement automatique activé.
 */

const photoCache = new Map();

async function loadPhoto(file) {
    if (photoCache.has(file)) return photoCache.get(file);
    let buffer;
    try {
        const sharp = require('sharp');
        buffer = await sharp(fs.readFileSync(file)).rotate().resize(900, 472, { fit: 'cover' }).jpeg({ quality: 78, mozjpeg: true }).toBuffer();
    } catch {
        buffer = fs.readFileSync(file);
    }
    photoCache.set(file, buffer);
    return buffer;
}

async function nextPhoto() {
    const file = nextImage();
    if (!file) return null;
    try { return await loadPhoto(file); } catch { return null; }
}

function imageReplyEnabled() {
    try { return displayFlags.get('imageReply'); } catch { return false; }
}

function replyFrameEnabled() {
    try { return displayFlags.get('replyFrame'); } catch { return true; }
}

/* ─── Construction des éléments d'affichage ─────────────────── */

function previewEnabled() {
    // Interrupteur propriétaire : .preview on|off (activé par défaut).
    try { return displayFlags.get('previewImage'); } catch { return true; }
}

// Bouton « Voir la chaîne » : toujours la chaîne officielle actuelle, quel que soit ce que la commande a écrit.
function applyChannelForward(contextInfo) {
    const info = channel.forwardInfo();
    if (info) {
        contextInfo.isForwarded = true;
        contextInfo.forwardingScore = Math.max(1, Number(contextInfo.forwardingScore) || 0);
        contextInfo.forwardedNewsletterMessageInfo = { ...info };
    } else if (contextInfo.forwardedNewsletterMessageInfo) {
        // JID pas encore résolu : mieux vaut aucun bloc qu'un bloc pointant vers l'ancienne chaîne.
        delete contextInfo.forwardedNewsletterMessageInfo;
    }
    return contextInfo;
}

// Aperçu d'image : miniature INTÉGRÉE au message, sans lien distant (thumbnailUrl) ni mediaUrl.
async function buildExternalAdReply() {
    if (!previewEnabled()) return null;
    const file = nextImage();
    let thumbnail;
    if (file) {
        thumbnail = process.env.NEXO_NO_THUMBNAIL_FETCH === '1'
            ? logoBuffer()
            : await Promise.race([
                loadThumbnail(file),
                new Promise(resolve => setTimeout(() => resolve(null), 2500))
            ]);
    }
    return {
        title: settings.previewTitle || settings.botName || 'NEXO-JARVIS XMD',
        body: settings.previewBody || 'Systèmes opérationnels. À votre service.',
        mediaType: 1,
        thumbnail: thumbnail || logoBuffer(),
        sourceUrl: channel.link(),
        renderLargerThumbnail: true,
        showAdAttribution: false
    };
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

function isSkippedTarget(jid) {
    const target = String(jid || '');
    return !target || target === 'status@broadcast' || target.endsWith('@newsletter');
}

// Symboles du thème actif (cadres, puces, séparateurs) sur le texte final.
function themed(text) {
    try { return require('./theme').restyle(text); } catch { return text; }
}

async function decorate(jid, content) {
    if (!content || typeof content !== 'object' || Array.isArray(content)) return content;
    if (isSkippedTarget(jid)) return content;
    // Sondages : question et choix suivent la langue du bot (sinon ils restaient en français avec .lang en).
    if (content.poll && content.poll.__plain !== true && i18n.isEnglish()) {
        const [name, ...values] = await i18n.translateMany([content.poll.name, ...(content.poll.values || [])]);
        content = { ...content, poll: { ...content.poll, name, values } };
    }
    if (UNTOUCHED.some(key => content[key] !== undefined)) return content;

    const isText = typeof content.text === 'string';
    const isMedia = MEDIA_KEYS.some(key => content[key] !== undefined);
    if (!isText && !isMedia) return content;
    if (LEGACY_BUTTONS.some(key => content[key] !== undefined)) {
        content = Object.fromEntries(Object.entries(content).filter(([key]) => !LEGACY_BUTTONS.includes(key)));
    }

    // __plain : réponse libre (IA, chatbot) → ni cadre ni traduction ; __noframe : déjà mis en page (menus) → traduit, sans cadre.
    const plain = content.__plain === true;
    const noFrame = plain || content.__noframe === true;
    // __edittext : message qui sera MODIFIÉ plus tard (barre de progression). WhatsApp ne sait modifier qu'un vrai texte :
    // pas de conversion en photo, pas de carte d'aperçu.
    const editable = content.__edittext === true;
    if ('__plain' in content || '__noframe' in content || '__edittext' in content) {
        content = { ...content };
        delete content.__plain;
        delete content.__noframe;
        delete content.__edittext;
    }
    if (isText && !plain) content = { ...content, text: await i18n.translateAsync(cleanup(content.text)) };   // .lang en : tout est traduit
    if (isText && !noFrame && replyFrameEnabled()) content = { ...content, text: frameText(content.text) };
    if (!isText && typeof content.caption === 'string' && !plain) content = { ...content, caption: await i18n.translateAsync(cleanup(content.caption)) };
    if (!isText && typeof content.caption === 'string' && !noFrame && replyFrameEnabled()) content = { ...content, caption: restyleLegacy(content.caption) };

    // Police monospace des titres / libellés / commandes (après traduction, juste avant l'envoi).
    if (isText && !plain) content = { ...content, text: themed(stylize(content.text)) };
    if (!isText && typeof content.caption === 'string' && !plain) content = { ...content, caption: themed(stylize(content.caption)) };

    const contextInfo = applyChannelForward({ ...(content.contextInfo || {}) });

    // Mode « vraie image » : la réponse courte part comme photo + légende.
    if (isText && !editable && imageReplyEnabled() && content.text.length <= PHOTO_MAX_CAPTION && !content.contextInfo?.externalAdReply) {
        const photo = await nextPhoto();
        if (photo) {
            const { text, linkPreview, ...rest } = content;
            return { ...rest, image: photo, caption: text, contextInfo };
        }
    }

    // Aperçu d'image uniquement sur les réponses texte (jamais sur les médias). Un aperçu déjà fourni
    // par la commande est conservé, mais sans lien distant : on retire thumbnailUrl / mediaUrl.
    if (editable) {
        delete contextInfo.externalAdReply;   // message modifiable : texte simple
    } else if (!previewEnabled()) {
        // Aperçu coupé : on retire aussi ceux ajoutés par les commandes (cause d'invisibilité chez certains téléphones).
        delete contextInfo.externalAdReply;
    } else if (isText) {
        if (contextInfo.externalAdReply) {
            const { thumbnailUrl, mediaUrl, ...safe } = contextInfo.externalAdReply;
            if (!safe.thumbnail && !safe.jpegThumbnail) safe.thumbnail = logoBuffer();
            contextInfo.externalAdReply = safe;
        } else {
            const preview = await buildExternalAdReply();
            if (preview) contextInfo.externalAdReply = preview;
        }
    }

    // Titre / texte de l'aperçu (carte sous le message) : traduits aussi.
    if (i18n.isEnglish() && contextInfo.externalAdReply) {
        const ad = contextInfo.externalAdReply;
        const [title, body] = await i18n.translateMany([ad.title, ad.body]);
        contextInfo.externalAdReply = { ...ad, title, body };
    }

    return { ...content, contextInfo };
}

/** Texte d'une MODIFICATION de message (barre de progression) : même traduction et même police que l'envoi d'origine. */
async function formatEditText(text) {
    let out = String(text || '');
    try { out = await i18n.translateAsync(cleanup(out)); } catch { /* texte d'origine */ }
    try { out = themed(stylize(out)); } catch { /* texte d'origine */ }
    return out;
}

// Pour les messages envoyés via relayMessage (boutons natifs) : bouton chaîne seulement.
function decorateContextInfo(contextInfo = {}) {
    const info = applyChannelForward({ ...contextInfo });
    if (!previewEnabled()) delete info.externalAdReply;
    return info;
}



/* ─── Clés de groupe : réparation automatique ───────────────────
 * Bug connu de Baileys 7 (issues WhiskeySockets #2297 / #2704, toujours présent dans rc14) : le bot garde en
 * mémoire « ce membre a déjà reçu ma clé de groupe » (sender-key-memory) et ne la renvoie plus jamais, même si
 * le membre a changé de téléphone / réinstallé WhatsApp / s'est reconnecté. Résultat : CE MEMBRE ne voit plus
 * aucune réponse du bot (ou « En attente du message »), alors que les autres la voient. Surtout sur iPhone.
 * Contournement documenté : effacer cette mémoire pour le groupe → la clé est renvoyée à tous au message suivant.
 * Fait au premier envoi dans chaque groupe après un démarrage, puis au plus une fois par heure
 * (SENDER_KEY_RESET_MINUTES=0 pour couper). `.fixgroup` le force à la demande.
 */
const keyResetAt = new Map();

async function healSenderKeys(sock, jid, { force = false } = {}) {
    try {
        if (!String(jid || '').endsWith('@g.us')) return false;
        const minutes = process.env.SENDER_KEY_RESET_MINUTES === undefined ? 60 : Number(process.env.SENDER_KEY_RESET_MINUTES);
        if (!force && !(minutes > 0)) return false;
        const keys = sock && sock.authState && sock.authState.keys;
        if (!keys || typeof keys.set !== 'function') return false;
        const stamp = `${String(sock.user && sock.user.id || '').split(':')[0].split('@')[0]}|${jid}`;
        if (!force && Date.now() - (keyResetAt.get(stamp) || 0) < minutes * 60 * 1000) return false;
        keyResetAt.set(stamp, Date.now());
        await keys.set({ 'sender-key-memory': { [jid]: null } });
        return true;
    } catch (error) {
        console.warn('[NEXO-JARVIS] réinitialisation des clés de groupe impossible :', error.message);
        return false;
    }
}

/* ─── Filet de sécurité ─────────────────────────────────────────
 * Si WhatsApp refuse la version décorée (image, fausse citation, aperçu…), la réponse repart quand même :
 *   1. texte + citation (sans image ni aperçu), 2. texte brut avec le vrai message cité.
 * Après 3 refus d'image, le mode « vraie image » se coupe tout seul jusqu'au prochain redémarrage.
 */
let imageFailures = 0;

function isRetryableDecoration(error) {
    const message = String(error && error.message || '');
    return !/connection closed|not-authorized|forbidden|rate-overlimit|logged out|403|401/i.test(message);
}

async function sendSimplified(original, jid, decorated, originalContent, options, firstError) {
    if (decorated.image) {
        imageFailures += 1;
        if (imageFailures >= 3) {
            displayFlags.override('imageReply', false);
            console.warn('[NEXO-JARVIS] Envois d\'images refusés 3 fois : mode « vraie image » coupé (relancez .imagemode on pour réessayer après redémarrage).');
        }
    }
    const text = decorated.caption || decorated.text || originalContent.text || originalContent.caption || '';
    const { image, caption, contextInfo, ...rest } = decorated;
    const attempts = [];
    if (decorated.image) {
        const { externalAdReply, ...safeContext } = contextInfo || {};
        attempts.push([{ ...rest, text, contextInfo: safeContext }, options]);
    }
    attempts.push([{ text, mentions: decorated.mentions }, options && options.quoted && options.quoted.key && options.quoted.key.remoteJid !== 'status@broadcast' ? options : undefined]);
    let lastError = firstError;
    for (const [content, opts] of attempts) {
        try {
            return await original(jid, content, opts);
        } catch (error) {
            lastError = error;
            console.warn(`[NEXO-JARVIS] repli refusé aussi : ${error.message}`);
        }
    }
    throw lastError;
}

/* ─── Enveloppe du socket ───────────────────────────────────── */

function wrapSocket(sock) {
    if (!sock || typeof sock.sendMessage !== 'function' || sock[WRAPPED]) return sock;

    const original = sock.sendMessage.bind(sock);
    sock.sendMessage = async (jid, content, options) => {
        let outgoing = content;
        try {
            outgoing = await decorate(jid, content);
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
        await healSenderKeys(sock, jid);
        let sent;
        try {
            sent = await original(jid, outgoing, outgoingOptions);
        } catch (error) {
            // Un format refusé (image, citation, aperçu…) ne doit jamais laisser le membre sans réponse :
            // on réessaie en version plus simple, et on affiche la vraie cause dans les journaux.
            console.warn(`[NEXO-JARVIS] envoi décoré refusé vers ${String(jid).endsWith('@g.us') ? 'un groupe' : 'un privé'} : ${error.message}`);
            if (!isRetryableDecoration(error) || outgoing === content) throw error;
            sent = await sendSimplified(original, jid, outgoing, content, options, error);
        }
        // Gardé en mémoire pour pouvoir le renvoyer si un téléphone ne l'a pas déchiffré.
        try { remember(sent); } catch { /* sans conséquence */ }
        return sent;
    };

    // Messages envoyés autrement (menus à boutons) : mêmes précautions.
    if (typeof sock.relayMessage === 'function') {
        const originalRelay = sock.relayMessage.bind(sock);
        sock.relayMessage = async (jid, message, relayOptions) => {
            await healSenderKeys(sock, jid);
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
    nextPhoto,
    imageReplyEnabled,
    formatEditText,
    healSenderKeys,
    createRotator,
    localImages,
    nextImage,
    loadThumbnail,
    THUMB_MAX_BYTES
};
