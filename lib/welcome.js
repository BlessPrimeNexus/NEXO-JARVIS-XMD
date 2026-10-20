'use strict';

const { addWelcome, delWelcome, isWelcomeOn, addGoodbye, delGoodBye, isGoodByeOn, getWelcome, getGoodbye } = require('../lib/index');
const { DEFAULT_MARK, buildWelcome, buildGoodbye } = require('./memberEvent');

const DEFAULT_WELCOME = DEFAULT_MARK;
const DEFAULT_GOODBYE = DEFAULT_MARK;
const PLACEHOLDERS = '{user} {group} {count} {description} {date} {time} {author}';

function actionFrom(match) {
    return String(match || '').trim().split(/\s+/)[0].toLowerCase();
}

function welcomeHelp() {
    return '📥 *Messages de bienvenue*\n\n' +
        '✅ *.welcome on* — Activer\n' +
        '🚫 *.welcome off* — Désactiver\n' +
        '🧪 *.welcome test* — Aperçu du message actuel\n' +
        '✏️ *.welcome set <texte>* — Message personnalisé\n' +
        '♻️ *.welcome reset* — Revenir au style JARVIS\n\n' +
        `Variables : ${PLACEHOLDERS}`;
}

function goodbyeHelp() {
    return '📤 *Messages de départ*\n\n' +
        '✅ *.goodbye on* — Activer\n' +
        '🚫 *.goodbye off* — Désactiver\n' +
        '🧪 *.goodbye test* — Aperçu du message actuel\n' +
        '✏️ *.goodbye set <texte>* — Message personnalisé\n' +
        '♻️ *.goodbye reset* — Revenir au style JARVIS\n\n' +
        `Variables : ${PLACEHOLDERS}`;
}

// Texte qui suit « set » (ou « reset ») dans la commande.
function customText(match) {
    return String(match || '').trim().replace(/^\S+\s*/, '').trim();
}

async function previewGroup(sock, chatId, message, kind) {
    const senderId = message.key.participant || message.key.remoteJid;
    let metadata = null;
    try { metadata = await sock.groupMetadata(chatId); } catch { /* aperçu avec valeurs par défaut */ }
    const common = {
        jid: senderId,
        groupName: metadata?.subject || 'ce groupe',
        count: (metadata?.participants || []).length || 1,
        description: metadata?.desc,
        author: null
    };
    if (kind === 'welcome') return buildWelcome({ ...common, template: await getWelcome(chatId) });
    return buildGoodbye({ ...common, template: await getGoodbye(chatId) });
}

async function handleWelcome(sock, chatId, message, match) {
    const action = actionFrom(match);
    if (!action) {
        return sock.sendMessage(chatId, { text: welcomeHelp() }, { quoted: message });
    }

    if (action === 'on') {
        if (await isWelcomeOn(chatId)) {
            return sock.sendMessage(chatId, {
                text: '⚠️ Les messages de bienvenue sont déjà actifs, Monsieur — inutile d\'insister.'
            }, { quoted: message });
        }
        await addWelcome(chatId, true, DEFAULT_WELCOME);
        return sock.sendMessage(chatId, {
            text: '✅ Messages de bienvenue *activés* avec le format NEXO-JARVIS.'
        }, { quoted: message });
    }

    if (action === 'off') {
        if (!(await isWelcomeOn(chatId))) {
            return sock.sendMessage(chatId, {
                text: '⚠️ Les messages de bienvenue sont déjà silencieux, Monsieur.'
            }, { quoted: message });
        }
        await delWelcome(chatId);
        return sock.sendMessage(chatId, {
            text: '✅ Messages de bienvenue *désactivés* pour ce groupe.'
        }, { quoted: message });
    }

    if (action === 'test') {
        const text = await previewGroup(sock, chatId, message, 'welcome');
        return sock.sendMessage(chatId, { text, mentions: [message.key.participant || message.key.remoteJid] }, { quoted: message });
    }

    if (action === 'set') {
        const text = customText(match);
        if (!text) {
            return sock.sendMessage(chatId, {
                text: `❌ Indiquez le texte, Monsieur.\nExemple : *.welcome set Bienvenue {user} dans {group} !*\nVariables : ${PLACEHOLDERS}`
            }, { quoted: message });
        }
        await addWelcome(chatId, true, text);
        return sock.sendMessage(chatId, { text: '✅ Message de bienvenue personnalisé enregistré et *activé*, Monsieur.' }, { quoted: message });
    }

    if (action === 'reset') {
        await addWelcome(chatId, true, DEFAULT_WELCOME);
        return sock.sendMessage(chatId, { text: '✅ Retour au message de bienvenue NEXO-JARVIS (actif).' }, { quoted: message });
    }

    return sock.sendMessage(chatId, {
        text: '❌ Option invalide. Tapez *.welcome* pour consulter l\'aide.'
    }, { quoted: message });
}

async function handleGoodbye(sock, chatId, message, match) {
    const action = actionFrom(match);
    if (!action) {
        return sock.sendMessage(chatId, { text: goodbyeHelp() }, { quoted: message });
    }

    if (action === 'on') {
        if (await isGoodByeOn(chatId)) {
            return sock.sendMessage(chatId, {
                text: '⚠️ Les messages de départ sont déjà actifs, Monsieur.'
            }, { quoted: message });
        }
        await addGoodbye(chatId, true, DEFAULT_GOODBYE);
        return sock.sendMessage(chatId, {
            text: '✅ Messages de départ *activés* avec le format NEXO-JARVIS.'
        }, { quoted: message });
    }

    if (action === 'off') {
        if (!(await isGoodByeOn(chatId))) {
            return sock.sendMessage(chatId, {
                text: '⚠️ Les messages de départ sont déjà silencieux, Monsieur.'
            }, { quoted: message });
        }
        await delGoodBye(chatId);
        return sock.sendMessage(chatId, {
            text: '✅ Messages de départ *désactivés* pour ce groupe.'
        }, { quoted: message });
    }

    if (action === 'test') {
        const text = await previewGroup(sock, chatId, message, 'goodbye');
        return sock.sendMessage(chatId, { text, mentions: [message.key.participant || message.key.remoteJid] }, { quoted: message });
    }

    if (action === 'set') {
        const text = customText(match);
        if (!text) {
            return sock.sendMessage(chatId, {
                text: `❌ Indiquez le texte, Monsieur.\nExemple : *.goodbye set Au revoir {user}, à bientôt !*\nVariables : ${PLACEHOLDERS}`
            }, { quoted: message });
        }
        await addGoodbye(chatId, true, text);
        return sock.sendMessage(chatId, { text: '✅ Message de départ personnalisé enregistré et *activé*, Monsieur.' }, { quoted: message });
    }

    if (action === 'reset') {
        await addGoodbye(chatId, true, DEFAULT_GOODBYE);
        return sock.sendMessage(chatId, { text: '✅ Retour au message de départ NEXO-JARVIS (actif).' }, { quoted: message });
    }

    return sock.sendMessage(chatId, {
        text: '❌ Option invalide. Tapez *.goodbye* pour consulter l\'aide.'
    }, { quoted: message });
}

module.exports = { handleWelcome, handleGoodbye };
