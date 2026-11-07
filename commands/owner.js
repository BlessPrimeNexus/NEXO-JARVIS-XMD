'use strict';

/*
 * .owner — carte du développeur (courte et lisible)
 *   1. un seul message : fiche (nom, rôle, contact) + boutons « Contacter », « Voir la chaîne », « Site », « Menu » ;
 *      les liens sont dans les boutons, pas dans le texte (un lien long déborde toujours du cadre) ;
 *   2. puis la fiche contact WhatsApp (vCard) à enregistrer d'un clic (ownerSendContact: false pour l'enlever).
 */

const settings = require('../settings');
const channel = require('../lib/channel');
const { report } = require('../lib/style');

const digits = (value) => String(value || '').replace(/\D/g, '');

function ownerName() {
    return settings.botOwner || settings.menuOwner || 'Développeur';
}

function chatLink() {
    return `https://wa.me/${digits(settings.ownerNumber)}`;
}

// +243802506198 → +243 802 506 198
function prettyNumber(value) {
    const n = digits(value);
    return n.length === 12 ? `+${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6, 9)} ${n.slice(9)}` : `+${n}`;
}

function ownerCardText({ withLinks = false } = {}) {
    const rows = [['👤 Nom', ownerName()], ['🎖️ Rôle', settings.ownerRole || 'Développeur'], ['📞 Contact', prettyNumber(settings.ownerNumber)]];
    if (withLinks) rows.push(['💬 Discuter', chatLink()]);
    return report('👑 Développeur', [['Projet', settings.botName || 'NEXO-JARVIS XMD']], [{ title: '🪪 Carte', rows }]);
}

function ownerVcard() {
    const name = ownerName();
    const number = digits(settings.ownerNumber);
    const lines = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `FN:${name}`,
        `N:;${name};;;`,
        `ORG:${settings.botName || 'NEXO-JARVIS XMD'}`,
        `TITLE:${settings.ownerRole || 'Développeur'}`,
        `TEL;type=CELL;type=VOICE;waid=${number}:+${number}`,
        `URL:${channel.link()}`
    ];
    if (settings.ownerWebsite) lines.push(`URL:${settings.ownerWebsite}`);
    if (settings.ownerBio) lines.push(`NOTE:${settings.ownerBio}`);
    lines.push('END:VCARD');
    return lines.join('\n');
}

function ownerButtons(prefix = '.') {
    const url = (text, link) => ({ name: 'cta_url', params: { display_text: text, url: link, merchant_url: link } });
    const buttons = [url('💬 Contacter', chatLink()), url('📢 Voir la chaîne', channel.link())];
    if (settings.ownerWebsite) buttons.push(url('🌐 Site', settings.ownerWebsite));
    buttons.push({ name: 'quick_reply', params: { display_text: '📜 Menu', id: `${prefix}menu` } });
    return buttons;
}

async function ownerCommand(sock, chatId, message) {
    const quoted = message || undefined;
    try {
        let sentCard = false;
        try {
            const { sendInteractiveMessage } = require('../lib/interactiveButtons');
            const presentation = require('../lib/presentation');
            const photo = presentation.imageReplyEnabled() ? await presentation.nextPhoto() : null;
            let prefix = '.';
            try { prefix = require('../lib/prefix').getPrefix(chatId) || '.'; } catch { /* préfixe par défaut */ }
            await sendInteractiveMessage(sock, chatId, {
                title: photo ? '' : (settings.botName || 'NEXO-JARVIS XMD'),
                body: ownerCardText(),
                footer: `©Power by ${settings.botName || 'NEXO-JARVIS XMD'}`,
                buttons: ownerButtons(prefix),
                image: photo,
                preview: !photo,
                quoted
            });
            sentCard = true;
        } catch (error) {
            console.warn('[owner] Boutons indisponibles, carte envoyée en texte :', error.message);
        }
        if (!sentCard) {
            await sock.sendMessage(chatId, { text: ownerCardText({ withLinks: true }) }, { quoted });
        }

        if (settings.ownerSendContact !== false) {
            await sock.sendMessage(chatId, {
                contacts: { displayName: ownerName(), contacts: [{ vcard: ownerVcard() }] }
            }, { quoted });
        }
    } catch (error) {
        console.error('Error in owner command:', error);
        try {
            await sock.sendMessage(chatId, { text: '❌ Impossible d\'afficher la carte du développeur pour le moment.' }, { quoted });
        } catch { /* conversation indisponible */ }
    }
}

module.exports = ownerCommand;
module.exports.ownerCardText = ownerCardText;
module.exports.ownerVcard = ownerVcard;
module.exports.ownerButtons = ownerButtons;
