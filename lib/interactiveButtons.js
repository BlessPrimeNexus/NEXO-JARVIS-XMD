'use strict';

const {
    generateWAMessageFromContent,
    prepareWAMessageMedia,
    proto
} = require('@whiskeysockets/baileys');
const { decorateContextInfo, previewAdReply } = require('./presentation');
const { applyQuoteCard } = require('./quoteCard');
const settings = require('../settings');

/*
 * WhatsApp native-flow buttons.
 * templateButtons is not rendered consistently by Baileys 7 / newer clients;
 * nativeFlowMessage is the format used by the current WhatsApp clients.
 */
async function sendInteractiveMessage(sock, chatId, options = {}) {
    const {
        body = '',
        footer = '',
        title = '',
        image = null,
        buttons = [],
        contextInfo = {},
        quoted
    } = options;

    const header = {
        title: String(title || ''),
        hasMediaAttachment: Boolean(image)
    };

    if (image) {
        if (typeof sock.waUploadToServer !== 'function') {
            throw new Error('Le téléchargement WhatsApp des médias est indisponible.');
        }
        const media = await prepareWAMessageMedia(
            { image },
            { upload: sock.waUploadToServer.bind(sock) }
        );
        header.imageMessage = media.imageMessage;
    }

    const nativeButtons = buttons
        .filter(button => button && button.name)
        .map(button => ({
            name: String(button.name),
            buttonParamsJson: JSON.stringify(button.params || {})
        }));

    const interactiveMessage = proto.Message.InteractiveMessage.create({
        body: proto.Message.InteractiveMessage.Body.create({
            text: String(body || '')
        }),
        footer: proto.Message.InteractiveMessage.Footer.create({
            text: String(footer || '')
        }),
        header: proto.Message.InteractiveMessage.Header.create(header),
        nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
            buttons: nativeButtons,
            // WhatsApp clients reject the flow when this field is omitted or
            // sent as a string.
            messageVersion: 1
        }),
        contextInfo: buildContextInfo(contextInfo, options.preview !== false)
    });

    const generated = generateWAMessageFromContent(
        chatId,
        {
            viewOnceMessage: {
                message: {
                    // Obligatoire dans la structure standard des messages à boutons : sans lui, certains
                    // clients WhatsApp (selon la plateforme) n'affichent simplement rien.
                    messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
                    interactiveMessage
                }
            }
        },
        {
            quoted: options.card === false ? (quoted || undefined) : applyQuoteCard(quoted, chatId),
            userJid: sock.user?.id
        }
    );

    const relayOptions = { messageId: generated.key.id };
    const nodes = bizNodes(chatId);
    if (nodes) relayOptions.additionalNodes = nodes;
    await sock.relayMessage(chatId, generated.message, relayOptions);
    return generated;
}

// Bouton « Voir la chaîne » + aperçu d'image tournant (jamais une vraie image).
function buildContextInfo(contextInfo, withPreview) {
    const merged = decorateContextInfo(contextInfo);
    if (withPreview && !merged.externalAdReply) {
        const preview = previewAdReply();
        if (preview) merged.externalAdReply = preview;
    }
    return merged;
}

// Les clients WhatsApp n'affichent les boutons « native flow » que si le message
// porte ce nœud <biz> (et <bot> en conversation privée). Désactivable : interactiveBizNodes: false.
function bizNodes(chatId) {
    if (settings.interactiveBizNodes === false) return null;
    const nodes = [{
        tag: 'biz',
        attrs: {},
        content: [{
            tag: 'interactive',
            attrs: { type: 'native_flow', v: '1' },
            content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }]
        }]
    }];
    if (!String(chatId).endsWith('@g.us')) nodes.push({ tag: 'bot', attrs: { biz_bot: '1' } });
    return nodes;
}

module.exports = { sendInteractiveMessage, bizNodes };
