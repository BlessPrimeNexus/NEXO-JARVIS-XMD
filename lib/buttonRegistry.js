'use strict';

/*
 * Registre des boutons envoyés par le bot.
 *
 * Pourquoi : quand quelqu'un touche un bouton, certains téléphones n'envoient QUE le texte du bouton
 * (« 🔄 Actualiser ») et pas l'identifiant de la commande (« .sessions »). Sans registre, le bot recevait un
 * message qu'il ne comprenait pas : le clic « partait » dans la discussion mais rien ne se passait.
 *
 * Chaque bouton rapide / ligne de liste envoyé est mémorisé (par message et par discussion) ; au clic on
 * retrouve la commande à partir de l'identifiant de réponse, du message cité ou du texte du bouton.
 * Les boutons fixes sont aussi connus d'avance (STATIC) pour survivre à un redémarrage du bot.
 */

const TTL_MS = 48 * 60 * 60 * 1000;
const MAX_MESSAGES = 500;

const byMessage = new Map();   // idMessage -> Map(libellé -> commande)
const byChat = new (require('./sessionContext').ScopedMap)();      // discussion -> Map(libellé -> { id, at })

// Boutons dont la commande ne dépend pas du contexte (valables même après un redémarrage).
const STATIC = {
    '📜 tous les menus': '.allmenu',
    '↩️ menu principal': '.menu',
    '🏓 diagnostic système': '.ping',
    '🏓 ping': '.ping',
    '📜 menu': '.menu',
    '🔄 actualiser': '.sessions',
    '🧹 purger les hors ligne': '.sessions purge',
    '✅ confirmer la purge': '.sessions purge oui',
    // panel
    '🖥️ panel': '.panel',
    '🔄 actualiser le panel': '.panel',
    '🔄 actualiser la ram': '.ram',
    '🧹 libérer': '.gc',
    // anglais (.lang en)
    '📜 all menus': '.allmenu',
    '↩️ main menu': '.menu',
    '🏓 system diagnostics': '.ping',
    '🔄 refresh': '.sessions',
    '🧹 purge offline sessions': '.sessions purge',
    '✅ confirm purge': '.sessions purge oui',
    '🔄 refresh the panel': '.panel',
    '🔄 refresh ram': '.ram',
    '🧹 free up': '.gc'
};

// Compare sans majuscules, espaces multiples ni variantes d'emoji.
function norm(label) {
    return String(label || '').replace(/\uFE0F/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function entriesOf(buttons = []) {
    const out = [];
    for (const button of buttons) {
        const params = button.params || (button.buttonParamsJson ? safeJson(button.buttonParamsJson) : {});
        if (button.name === 'quick_reply' && params.display_text && params.id) {
            out.push([params.display_text, String(params.id)]);
        } else if (button.name === 'single_select') {
            for (const section of params.sections || []) {
                for (const row of section.rows || []) if (row.title && row.id) out.push([row.title, String(row.id)]);
            }
        }
    }
    return out;
}

function safeJson(text) {
    try { return JSON.parse(text); } catch { return {}; }
}

function register(chatId, messageId, buttons) {
    const entries = entriesOf(buttons);
    if (!entries.length) return;
    const now = Date.now();
    if (messageId) {
        byMessage.set(messageId, new Map(entries.map(([label, id]) => [norm(label), id])));
        while (byMessage.size > MAX_MESSAGES) byMessage.delete(byMessage.keys().next().value);
    }
    if (chatId) {
        const chat = byChat.get(chatId) || new Map();
        for (const [label, id] of entries) chat.set(norm(label), { id, at: now });
        byChat.set(chatId, chat);
    }
}

function unwrap(content) {
    let current = content;
    for (let i = 0; i < 6; i += 1) {
        const next = current?.ephemeralMessage?.message || current?.viewOnceMessage?.message ||
            current?.viewOnceMessageV2?.message || current?.deviceSentMessage?.message;
        if (!next) break;
        current = next;
    }
    return current || {};
}

// Tous les libellés possibles d'un clic (corps de la réponse, texte du bouton, texte simple).
function labelsOf(content) {
    const interactive = content.interactiveResponseMessage;
    const params = safeJson(interactive?.nativeFlowResponseMessage?.paramsJson);
    return [
        params.display_text, params.title,
        interactive?.body?.text,
        content.listResponseMessage?.title,
        content.buttonsResponseMessage?.selectedDisplayText,
        content.templateButtonReplyMessage?.selectedDisplayText,
        content.conversation,
        content.extendedTextMessage?.text
    ].filter(value => typeof value === 'string' && value.trim()).map(value => value.split('\n')[0]);
}

function quotedIdOf(content) {
    return content.interactiveResponseMessage?.contextInfo?.stanzaId ||
        content.extendedTextMessage?.contextInfo?.stanzaId ||
        content.listResponseMessage?.contextInfo?.stanzaId ||
        content.buttonsResponseMessage?.contextInfo?.stanzaId || '';
}

/** Retrouve la commande liée au bouton touché ('' si ce message n'est pas un clic connu). */
function resolve(message, chatId) {
    const content = unwrap(message && message.message);
    const labels = labelsOf(content).map(norm);
    if (!labels.length) return '';

    const quotedId = quotedIdOf(content);
    const sameMessage = quotedId && byMessage.get(quotedId);
    if (sameMessage) {
        for (const label of labels) if (sameMessage.has(label)) return sameMessage.get(label);
    }

    const chat = byChat.get(chatId);
    if (chat) {
        for (const label of labels) {
            const entry = chat.get(label);
            if (entry && Date.now() - entry.at < TTL_MS) return entry.id;
        }
    }

    for (const label of labels) if (STATIC[label]) return STATIC[label];
    return '';
}

function _reset() { byMessage.clear(); byChat.clear(); }

module.exports = { register, resolve, norm, _reset, STATIC };
