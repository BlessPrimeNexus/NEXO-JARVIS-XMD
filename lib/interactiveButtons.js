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
/*
 * Pourquoi les boutons « grisés » : un bouton de réponse rapide (quick_reply) est désactivé par WhatsApp pour
 * l'EXPÉDITEUR du message, et le téléphone du bot est celui de l'expéditeur. La liste déroulante (single_select) et les
 * liens (cta_url) restent actifs partout. Donc toutes les actions sont proposées dans UNE liste « ⚡ Actions » :
 * elles marchent depuis le téléphone du bot comme depuis celui des membres.
 */
function mergeQuickReplies(buttons = []) {
    const quick = buttons.filter(button => button && button.name === 'quick_reply' && button.params && button.params.id);
    if (!quick.length) return buttons;
    const list0 = buttons.find(button => button && button.name === 'single_select' && button.params);
    const known = new Set((list0 ? (list0.params.sections || []) : []).flatMap(section => (section.rows || []).map(row => row.id)));
    const rows = quick.filter(button => !known.has(button.params.id)).map(button => ({ header: '', title: String(button.params.display_text || button.params.id), description: '', id: String(button.params.id) }));
    if (!rows.length) return buttons.filter(button => !quick.includes(button));
    const others = buttons.filter(button => !quick.includes(button));
    const list = others.find(button => button && button.name === 'single_select' && button.params);
    if (list) {
        const merged = { ...list, params: { ...list.params, sections: [...(list.params.sections || []), { title: 'Actions', highlight_label: '', rows }] } };
        return others.map(button => (button === list ? merged : button));
    }
    return [{ name: 'single_select', params: { title: '⚡ Actions', sections: [{ title: 'Actions', highlight_label: '', rows }] } }, ...others];
}

async function sendInteractiveMessage(sock, chatId, options = {}) {
    const {
        body: rawBody = '',
        footer: rawFooter = '',
        title: rawTitle = '',
        image = null,
        video = null,
        buttons: rawButtons = [],
        contextInfo = {},
        quoted
    } = options;
    // .lang en : textes et boutons affichés traduits (les identifiants de commande restent inchangés).
    const i18n = require('./i18n');
    // Boutons de réponse rapide → lignes d'une liste (voir mergeQuickReplies) : ils sont grisés sur le téléphone du bot.
    const mergedButtons = mergeQuickReplies(rawButtons);
    // Plus de pied de message ni de signature : le message se termine sur le contenu utile.
    let body = require('./style').cleanup(rawBody);
    let footer = options.keepFooter ? rawFooter : '';
    let title = rawTitle;
    let buttons = mergedButtons;
    if (!options.raw) {
        // raw : texte à garder tel quel (journaux…). Sinon, en anglais, tout est traduit en une seule requête.
        const [tBody, tFooter, tTitle] = await i18n.translateMany([body, footer, rawTitle]);
        body = tBody; footer = tFooter; title = tTitle;
        buttons = await i18n.translateButtonsAsync(mergedButtons);
        const { stylize } = require('./style');
        const themed = text => { try { return require('./theme').restyle(text); } catch { return text; } };
        body = themed(stylize(body));
        footer = stylize(footer);
    }

    const header = {
        title: String(title || ''),
        hasMediaAttachment: Boolean(image || video)
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
    } else if (video) {
        if (typeof sock.waUploadToServer !== 'function') {
            throw new Error('Le téléchargement WhatsApp des médias est indisponible.');
        }
        const media = await prepareWAMessageMedia(
            { video },
            { upload: sock.waUploadToServer.bind(sock) }
        );
        header.videoMessage = media.videoMessage;
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
        contextInfo: await buildContextInfo(contextInfo, options.preview !== false)
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
    // Mémorise les boutons : si le téléphone ne renvoie que le texte du bouton, on retrouve quand même la commande.
    try { require('./buttonRegistry').register(chatId, generated.key.id, buttons); } catch { /* sans conséquence */ }
    return generated;
}

// Bouton « Voir la chaîne » + aperçu d'image tournant (miniature intégrée, jamais une vraie photo).
async function buildContextInfo(contextInfo, withPreview) {
    const merged = decorateContextInfo(contextInfo);
    if (withPreview && !merged.externalAdReply) {
        const preview = await previewAdReply();
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

module.exports = {
    mergeQuickReplies, sendInteractiveMessage, bizNodes };
