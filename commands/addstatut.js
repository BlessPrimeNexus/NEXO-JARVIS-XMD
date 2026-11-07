'use strict';

/*
 * .addstatut — publie un STATUT DE GROUPE (réservé aux admins du groupe et au propriétaire)
 *
 *   .addstatut Bonjour à tous !        → statut texte (fond coloré)
 *   .addstatut                          en réponse à une image / vidéo / texte → publié tel quel
 *   .addstatut Légende                  en réponse à une image / vidéo → avec cette légende
 *   (ou envoyer une image / vidéo avec « .addstatut » en légende)
 *
 * Alias : .gstatus, .statutgroupe
 *
 * Utilise le message « groupStatusMessageV2 » de WhatsApp. Il faut une version de Baileys qui le connaît ;
 * sinon la commande l'indique clairement au lieu d'envoyer un message vide.
 */

const crypto = require('crypto');
const { panel } = require('../lib/style');

const MAX_MEDIA_BYTES = 30 * 1024 * 1024;
const COLORS = ['#128C7E', '#075E54', '#6D4C41', '#4A148C', '#B71C1C', '#0D47A1', '#1B5E20', '#E65100', '#37474F', '#AD1457'];

function baileys() {
    return require('@whiskeysockets/baileys');
}

function unwrap(content) {
    let current = content;
    for (let i = 0; i < 6; i += 1) {
        const next = current?.ephemeralMessage?.message || current?.viewOnceMessage?.message ||
            current?.viewOnceMessageV2?.message || current?.documentWithCaptionMessage?.message;
        if (!next) break;
        current = next;
    }
    return current || {};
}

// Les versions de Baileys sans ce type de message l'ignoreraient en silence (message vide) : on vérifie avant.
function groupStatusSupported() {
    try {
        const { proto } = baileys();
        return Boolean(proto.Message.fromObject({ groupStatusMessageV2: { message: {} } }).groupStatusMessageV2);
    } catch {
        return false;
    }
}

/*
 * Image / vidéo : pourquoi le texte passait mais pas le média
 * Baileys repère le type de média (attribut « mediatype » de l'envoi) en regardant message.imageMessage /
 * message.videoMessage au NIVEAU RACINE. Ici le média est enveloppé dans groupStatusMessageV2 : le type n'est
 * pas détecté, l'envoi part « comme un texte » et WhatsApp ignore le statut (sans aucune erreur).
 * Solution : on laisse la fonction de détection de Baileys (getMediaType / getMessageType) voir le média à la racine,
 * et seulement elle. Pour tout le reste (encodage du message) le média n'existe pas à la racine : il ne peut donc pas
 * partir en double dans la discussion.
 */
const MEDIA_KEYS = ['imageMessage', 'videoMessage', 'audioMessage', 'documentMessage'];

function exposeMediaType(message, inside) {
    const mediaKey = MEDIA_KEYS.find(key => inside && inside[key]);
    if (!mediaKey) return message;
    const marker = inside[mediaKey];
    return new Proxy(message, {
        get(target, prop, receiver) {
            if (prop === mediaKey) {
                const stack = new Error().stack || '';
                return /getMediaType|getMessageType/.test(stack) ? marker : undefined;
            }
            return Reflect.get(target, prop, receiver);
        }
    });
}

// Journal de diagnostic (une fois) : la version de Baileys installée connaît-elle déjà ce type de message ?
let diagnosed = false;
function diagnoseBaileys() {
    if (diagnosed) return;
    diagnosed = true;
    try {
        const fs = require('fs');
        const path = require('path');
        const root = path.dirname(require.resolve('@whiskeysockets/baileys/package.json'));
        const files = ['lib/Socket/messages-send.js', 'lib/Utils/messages.js'].map(file => path.join(root, file)).filter(file => fs.existsSync(file));
        const known = files.some(file => fs.readFileSync(file, 'utf8').includes('groupStatusMessageV2'));
        console.log(`[addstatut] diagnostic : Baileys connaît groupStatusMessageV2 dans l'envoi = ${known ? 'oui' : 'non (contournement média actif)'}`);
    } catch {
        console.log('[addstatut] diagnostic : sources de Baileys illisibles');
    }
}

async function download(mediaMessage, type) {
    const { downloadContentFromMessage } = baileys();
    const stream = await downloadContentFromMessage(mediaMessage, type);
    const chunks = [];
    let size = 0;
    for await (const chunk of stream) {
        size += chunk.length;
        if (size > MAX_MEDIA_BYTES) throw new Error('média trop lourd');
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
}

// Ce que l'on publie : { kind: 'image' | 'video' | 'text', media?, caption?, text? }
function pickSource(message, argument) {
    const own = unwrap(message.message);
    const quoted = unwrap(own.extendedTextMessage?.contextInfo?.quotedMessage);

    for (const [holder, isOwn] of [[own, true], [quoted, false]]) {
        if (holder.imageMessage) return { kind: 'image', media: holder.imageMessage, caption: argument || (isOwn ? '' : holder.imageMessage.caption) || '' };
        if (holder.videoMessage) return { kind: 'video', media: holder.videoMessage, caption: argument || (isOwn ? '' : holder.videoMessage.caption) || '' };
    }
    const quotedText = quoted.conversation || quoted.extendedTextMessage?.text || '';
    const text = (argument || quotedText || '').trim();
    return text ? { kind: 'text', text } : null;
}

/*
 * Après une publication réussie et la confirmation du bot : le message de commande disparaît (et l'éventuelle vidéo / image
 * qu'il portait), sinon les membres regarderaient directement le média dans la discussion au lieu d'aller voir le statut.
 *   • le message de commande lui-même (cas « média + légende .addstatut ») ;
 *   • le média cité (cas « réponse à une vidéo »), seulement s'il a été envoyé par la même personne que la commande.
 * Dans un groupe, supprimer le message d'un autre membre demande que le bot soit admin ; sinon on le signale.
 */
function sameAuthor(a, b) {
    const isAdmin = require('../lib/isAdmin');
    const left = new Set(isAdmin.identityVariants(a));
    return isAdmin.identityVariants(b).some(value => left.has(value));
}

async function cleanupCommand(sock, chatId, message, { isBotAdmin }) {
    const result = { command: false, source: false, blocked: false };
    // Commande envoyée depuis le compte du bot lui-même : l'auteur, c'est ce compte.
    const sender = message.key.fromMe ? (sock.user?.id || '') : (message.key.participant || message.key.remoteJid);
    const isGroup = String(chatId).endsWith('@g.us');
    const canDelete = message.key.fromMe || (isGroup && isBotAdmin);
    if (!canDelete) { result.blocked = true; return result; }

    const targets = [{ id: message.key.id, participant: message.key.participant, fromMe: !!message.key.fromMe, kind: 'command' }];
    const ctx = message.message?.extendedTextMessage?.contextInfo;
    if (ctx?.stanzaId && ctx.quotedMessage && (ctx.quotedMessage.imageMessage || ctx.quotedMessage.videoMessage) && ctx.participant && sameAuthor(ctx.participant, sender)) {
        targets.push({ id: ctx.stanzaId, participant: ctx.participant, fromMe: !!message.key.fromMe, kind: 'source' });
    }
    for (const target of targets) {
        try {
            await sock.sendMessage(chatId, { delete: { remoteJid: chatId, fromMe: target.fromMe, id: target.id, participant: target.participant || undefined } });
            result[target.kind] = true;
        } catch (error) {
            console.warn('[addstatut] suppression impossible :', error.message);
        }
        await new Promise(resolve => setTimeout(resolve, 300));
    }
    return result;
}

async function addStatutCommand(sock, chatId, message, argument = '') {
    const reply = (text) => sock.sendMessage(chatId, { text }, { quoted: message });

    if (!String(chatId).endsWith('@g.us')) {
        return reply(panel('📣 STATUT DE GROUPE', ['Cette commande fonctionne uniquement dans un groupe.']));
    }

    // Admins du groupe et propriétaire uniquement.
    const ownerAuth = require('../lib/ownerAuth');
    const isAdmin = require('../lib/isAdmin');
    const senderId = message.key.participant || message.key.remoteJid;
    let allowed = await ownerAuth.isOwnerOrSudoMessage(sock, message, chatId);
    const adminInfo = await isAdmin(sock, chatId, senderId);
    if (!allowed) allowed = Boolean(adminInfo.isSenderAdmin);
    if (!allowed) {
        return reply(panel('⛔ ACCÈS REFUSÉ', ['Seuls les admins du groupe peuvent publier un statut de groupe.']));
    }

    const source = pickSource(message, String(argument || '').trim());
    if (!source) {
        return reply(panel('📣 STATUT DE GROUPE', [
            '.addstatut <texte>',
            'ou répondez à une image, une vidéo ou un texte avec .addstatut'
        ], 'Réservé aux admins du groupe.'));
    }

    if (!groupStatusSupported()) {
        return reply(panel('⚠️ NON SUPPORTÉ', [
            'La version de Baileys installée ne gère pas les statuts de groupe.'
        ], 'Mettez à jour @whiskeysockets/baileys puis redéployez.'));
    }

    try {
        const { generateWAMessageContent, generateWAMessageFromContent } = baileys();
        let content;
        if (source.kind === 'text') {
            content = { text: source.text };
        } else {
            const buffer = await download(source.media, source.kind);
            content = source.kind === 'image'
                ? { image: buffer, caption: source.caption }
                : { video: buffer, caption: source.caption };
        }

        const inside = await generateWAMessageContent(content, {
            upload: sock.waUploadToServer.bind(sock),
            backgroundColor: COLORS[crypto.randomInt(0, COLORS.length)]
        });
        const messageSecret = crypto.randomBytes(32);
        const built = generateWAMessageFromContent(chatId, {
            messageContextInfo: { messageSecret },
            groupStatusMessageV2: { message: { ...inside, messageContextInfo: { messageSecret } } }
        }, { userJid: sock.user.id });

        diagnoseBaileys();
        await sock.relayMessage(chatId, exposeMediaType(built.message, inside), { messageId: built.key.id });
        await reply(panel('✅ STATUT PUBLIÉ', [
            ['📣 Type', source.kind === 'text' ? 'Texte' : source.kind === 'image' ? 'Image' : 'Vidéo'],
            'Il est visible par les membres du groupe.'
        ]));
        // Puis, tout de suite : le message de commande (et la vidéo / image qu'il portait) est supprimé du groupe.
        const cleaned = await cleanupCommand(sock, chatId, message, { isBotAdmin: adminInfo.isBotAdmin });
        if (cleaned.blocked) {
            await reply(panel('⚠️ MÉDIA TOUJOURS VISIBLE', ['Je ne suis pas admin : je ne peux pas supprimer votre message.'], 'Supprimez-le vous-même, ou rendez-moi admin.'));
        }
        return undefined;
    } catch (error) {
        console.error('[addstatut]', error.message);
        const tooBig = /trop lourd/.test(error.message);
        return reply(panel('❌ ÉCHEC', [tooBig ? 'Ce média est trop lourd (30 Mo maximum).' : 'Le statut n’a pas pu être publié.'], tooBig ? '' : 'Réessayez avec un média plus léger.'));
    }
}

module.exports = addStatutCommand;
module.exports.pickSource = pickSource;
module.exports.groupStatusSupported = groupStatusSupported;
module.exports.exposeMediaType = exposeMediaType;
module.exports.cleanupCommand = cleanupCommand;
