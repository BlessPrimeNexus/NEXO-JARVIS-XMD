'use strict';

/*
 * .idch <lien de la chaîne>  — récupère le JID (…@newsletter) d'une chaîne WhatsApp
 *   .idch https://whatsapp.com/channel/0029Vb78ycrInlqYocbYLX0P
 * Accepte aussi le code seul, ou un lien dans le message auquel on répond.
 */

const { panel } = require('../lib/style');

const LINK = /(?:https?:\/\/)?(?:www\.)?whatsapp\.com\/channel\/([A-Za-z0-9_-]{10,})/i;
const BARE_CODE = /^[A-Za-z0-9_-]{18,32}$/;
const JID = /^\d{8,}@newsletter$/;

function extractCode(text) {
    const value = String(text || '').trim();
    const link = value.match(LINK);
    if (link) return { type: 'invite', key: link[1] };
    const token = value.split(/\s+/)[0] || '';
    if (JID.test(token)) return { type: 'jid', key: token };
    if (BARE_CODE.test(token) && !/^\d+$/.test(token)) return { type: 'invite', key: token };
    return null;
}

function quotedText(message) {
    const context = message?.message?.extendedTextMessage?.contextInfo;
    const quoted = context?.quotedMessage;
    return quoted?.conversation || quoted?.extendedTextMessage?.text || quoted?.imageMessage?.caption || '';
}

// Les versions de Baileys n'organisent pas toutes la réponse de la même façon.
function readMetadata(metadata) {
    const thread = metadata?.thread_metadata || {};
    const pick = (...values) => values.find(value => value !== undefined && value !== null && value !== '');
    const text = (value) => (value && typeof value === 'object' ? value.text : value);
    const created = pick(metadata?.creation_time, thread.creation_time);
    return {
        id: pick(metadata?.id, metadata?.jid),
        name: text(pick(metadata?.name, thread.name)),
        description: text(pick(metadata?.description, thread.description)),
        subscribers: pick(metadata?.subscribers, thread.subscribers_count, thread.subscribers),
        verified: String(pick(metadata?.verification, thread.verification) || '').toUpperCase() === 'VERIFIED',
        created: created ? new Date(Number(created) * (String(created).length > 11 ? 1 : 1000)) : null
    };
}

async function idchCommand(sock, chatId, message, argument = '') {
    const reply = (text) => sock.sendMessage(chatId, { text }, { quoted: message });
    const target = extractCode(argument) || extractCode(quotedText(message));

    if (!target) {
        return reply(panel('📢 ID DE CHAÎNE', [
            'Envoyez la commande suivie du lien de la chaîne :',
            '.idch https://whatsapp.com/channel/…'
        ], 'Vous pouvez aussi répondre à un message contenant le lien.'));
    }

    try {
        const metadata = await sock.newsletterMetadata(target.type, target.key);
        const info = readMetadata(metadata);
        if (!info.id) throw new Error('chaîne introuvable');

        // Une seule carte : nom, abonnés, date et JID ensemble. Pas de description (trop longue, elle cassait le cadre).
        const rows = [['📛 Nom', info.name || 'Sans nom']];
        if (info.subscribers !== undefined) rows.push(['👥 Abonnés', Number(info.subscribers).toLocaleString('fr-FR')]);
        if (info.created && !Number.isNaN(info.created.getTime())) rows.push(['🗓️ Créée le', info.created.toLocaleDateString('fr-FR')]);
        rows.push(['🆔 JID', info.id]);
        const card = panel('📢 ID DE CHAÎNE', rows);

        const buttons = [{ name: 'cta_copy', params: { display_text: '📋 Copier le JID', copy_code: info.id } }];
        if (target.type === 'invite') {
            const link = `https://whatsapp.com/channel/${target.key}`;
            buttons.push({ name: 'cta_url', params: { display_text: '📢 Ouvrir la chaîne', url: link, merchant_url: link } });
        }
        try {
            const { sendInteractiveMessage } = require('../lib/interactiveButtons');
            await sendInteractiveMessage(sock, chatId, {
                title: '',
                body: card,
                footer: 'Appuyez sur le bouton pour copier le JID',
                buttons,
                quoted: message
            });
            return undefined;
        } catch (buttonError) {
            console.warn('[idch] boutons indisponibles, carte envoyée en texte :', buttonError.message);
            return reply(card);
        }
    } catch (error) {
        console.warn('[idch]', error.message);
        return reply(panel('❌ CHAÎNE INTROUVABLE', [
            'Je n\'ai pas pu lire cette chaîne.',
            'Vérifiez le lien, ou qu\'elle existe toujours.'
        ]));
    }
}

module.exports = idchCommand;
module.exports.extractCode = extractCode;
module.exports.readMetadata = readMetadata;
