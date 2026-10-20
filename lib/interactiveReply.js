'use strict';

/*
 * Lit le choix fait dans une réponse de bouton WhatsApp et le renvoie sous forme
 * de commande (ex. « .menu 3 »), traitée ensuite comme si l'utilisateur l'avait tapée.
 *
 * Sources lues, dans l'ordre :
 *  1. native flow (liste « single_select », bouton « quick_reply »…) : paramsJson.id
 *  2. ancienne liste (listResponseMessage) : selectedRowId
 *  3. à défaut d'identifiant : le titre de la ligne choisie (body.text), résolu par
 *     la fonction `resolveTitle` fournie par le menu.
 */

const IGNORED_FLOWS = new Set(['cta_url', 'cta_copy', 'cta_call']);
const ID_KEYS = ['id', 'selectedRowId', 'selected_row_id', 'rowId', 'row_id', 'selectedId', 'selected_id'];

function unwrap(content) {
    let current = content;
    for (let i = 0; i < 6; i += 1) {
        const next = current?.ephemeralMessage?.message || current?.viewOnceMessage?.message ||
            current?.viewOnceMessageV2?.message || current?.deviceSentMessage?.message;
        if (!next) break;
        current = next;
    }
    return current;
}

function idFromParams(paramsJson) {
    try {
        const params = JSON.parse(paramsJson || '{}');
        for (const key of ID_KEYS) {
            const value = params[key];
            if (typeof value === 'string' && value.trim()) return value.trim();
        }
    } catch { /* paramsJson illisible : ignoré */ }
    return '';
}

function isInteractiveResponse(message) {
    const content = unwrap(message && message.message);
    return Boolean(content && (content.interactiveResponseMessage || content.listResponseMessage));
}

function selectedInteractiveId(message, resolveTitle) {
    const content = unwrap(message && message.message);
    if (!content) return '';

    const interactive = content.interactiveResponseMessage;
    const flow = interactive?.nativeFlowResponseMessage;
    if (flow && !IGNORED_FLOWS.has(flow.name)) {
        const id = idFromParams(flow.paramsJson);
        if (id) return id;
    }

    const row = content.listResponseMessage?.singleSelectReply?.selectedRowId;
    if (row) return String(row).trim();

    if (typeof resolveTitle === 'function') {
        const title = String(interactive?.body?.text || content.listResponseMessage?.title || '').split('\n')[0].trim();
        if (title) {
            try {
                const resolved = resolveTitle(title);
                if (resolved) return String(resolved).trim();
            } catch { /* titre non reconnu */ }
        }
    }
    return '';
}

module.exports = { selectedInteractiveId, isInteractiveResponse, unwrap };
