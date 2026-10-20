'use strict';

/*
 * Fausse citation « WhatsApp ✓ • Statut » sur CHAQUE message du bot
 * ───────────────────────────────────────────────────────────────
 *   - en-tête « WhatsApp ✓ • Statut » (fabriqué par WhatsApp à partir de l'expéditeur
 *     officiel 0@s.whatsapp.net et du fil status@broadcast) ;
 *   - « 1000 articles », puis le demandeur et la commande ;
 *   - miniature carrée du logo JARVIS.
 *
 * Deux présentations :
 *   - « universelle » (défaut) : citation d'image de statut. Lue par TOUTES les versions de
 *     WhatsApp (Messenger, Business, Android, iPhone).
 *   - « business » : vraie carte de commande (orderMessage). Format réservé à WhatsApp Business :
 *     une application WhatsApp Messenger peut ne rien afficher du tout.
 * Le message cité d'origine est toujours remplacé par la carte, y compris quand le bot écrit
 * spontanément (sans rien citer) : la carte indique alors « automatique ».
 */

const settings = require('../settings');
const displayFlags = require('./displayFlags');
const { selectedInteractiveId, isInteractiveResponse } = require('./interactiveReply');

// Logo carré 160x160 (JPEG) embarqué : aucune image à héberger.
const LOGO_B64 = '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';
let logo = null;
function logoBuffer() {
    if (!logo) logo = Buffer.from(LOGO_B64, 'base64');
    return logo;
}

function textOf(message) {
    let content = message || {};
    for (let i = 0; i < 6; i += 1) {
        const inner = content.ephemeralMessage?.message || content.viewOnceMessage?.message ||
            content.viewOnceMessageV2?.message || content.documentWithCaptionMessage?.message;
        if (!inner) break;
        content = inner;
    }
    return String(
        content.conversation ||
        content.extendedTextMessage?.text ||
        content.imageMessage?.caption ||
        content.videoMessage?.caption ||
        ''
    ).trim();
}

// Renvoie le nom de la commande si le texte commence par un préfixe (ex. « .menu »), sinon ''.
function commandName(text) {
    const first = String(text || '').trim().split(/\s+/)[0] || '';
    if (!/^[^\p{L}\p{N}\s]/u.test(first)) return '';
    return first.replace(/^[^\p{L}\p{N}]+/u, '').toLowerCase();
}

// Texte de commande d'un message cité : texte tapé, ou choix fait dans un bouton / une liste.
function commandText(quoted) {
    const typed = textOf(quoted.message);
    if (commandName(typed)) return typed;
    if (isInteractiveResponse(quoted)) return selectedInteractiveId(quoted) || '.menu';
    return typed;
}

function isCommandLike(quoted) {
    return Boolean(quoted && quoted.message && commandName(commandText(quoted)));
}

// Qui a demandé quoi : @numéro et nom de commande (ou « conversation » / « média » / « automatique »).
function describeQuoted(quoted) {
    if (!quoted || !quoted.message) {
        return { sender: settings.botName || 'NEXO-JARVIS XMD', command: 'automatique' };
    }
    const digits = String(quoted.key?.participant || quoted.key?.remoteJid || '')
        .split('@')[0].split(':')[0].replace(/\D/g, '');
    const typed = commandText(quoted);
    let command = commandName(typed);
    if (!command) command = typed ? 'conversation' : 'média';
    return { sender: digits ? `@${digits}` : 'inconnu', command };
}

function buildQuoteCard(quoted, style) {
    const chosen = style || displayFlags.getValue('quoteCardStyle') || 'universal';
    const { sender, command } = describeQuoted(quoted);
    const lines = [`Demandeur : ${sender}`, `Commande : ${command}`];
    const key = {
        remoteJid: 'status@broadcast',
        fromMe: false,
        participant: '0@s.whatsapp.net',
        id: 'NEXOJARVIS' + Math.random().toString(16).slice(2, 12).toUpperCase()
    };

    if (chosen === 'business') {
        return {
            key,
            message: {
                orderMessage: {
                    itemCount: 1000,
                    status: 1,
                    surface: 1,
                    message: lines.join('\n'),
                    orderTitle: settings.botName || 'NEXO-JARVIS XMD',
                    sellerJid: '0@s.whatsapp.net',
                    thumbnail: logoBuffer()
                }
            }
        };
    }

    return {
        key,
        message: {
            imageMessage: {
                mimetype: 'image/jpeg',
                caption: ['🛒 1000 articles', ...lines].join('\n'),
                jpegThumbnail: logoBuffer(),
                height: 160,
                width: 160
            }
        }
    };
}

// Point d'entrée : renvoie TOUJOURS la carte (sauf chaînes, statuts ou carte désactivée).
// `quoted` peut être absent : le bot écrit alors de lui-même.
function applyQuoteCard(quoted, jid) {
    try {
        if (!displayFlags.get('quoteCard')) return quoted;
        const target = String(jid || '');
        if (!target || target === 'status@broadcast' || target.endsWith('@newsletter')) return quoted;
        return buildQuoteCard(quoted);
    } catch {
        return quoted;
    }
}

module.exports = { applyQuoteCard, buildQuoteCard, describeQuoted, commandName, isCommandLike, textOf };
