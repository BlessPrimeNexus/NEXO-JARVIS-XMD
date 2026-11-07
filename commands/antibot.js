'use strict';

const { channelInfo } = require('../lib/messageConfig');
const engine = require('../lib/antibot');

const isAntibotEnabled = engine.isAntibotEnabled;
const handleAntibot = engine.handleAntibot;

const MODE_LABEL = { delete: 'suppression du message', kick: 'suppression + retrait du bot' };

function targetsOf(message) {
    const context = message.message?.extendedTextMessage?.contextInfo;
    const list = [...(context?.mentionedJid || [])];
    if (!list.length && context?.participant) list.push(context.participant);
    return list;
}

function statusText(chatId) {
    const config = engine.getConfig(chatId);
    return [
        '🤖 *ANTIBOT*',
        '',
        `📊 Statut : ${config.enabled ? '✅ Activé' : '❌ Désactivé'}`,
        `⚙️ Action : ${MODE_LABEL[config.action]}`,
        `🧾 Bots connus : ${config.bots.length}`,
        '',
        '📌 Options :',
        '• *.antibot on* / *.antibot off*',
        '• *.antibot mode delete* — supprime seulement',
        '• *.antibot mode kick* — supprime et retire le bot',
        '• *.antibot add @bot* / *.antibot remove @bot*',
        '• *.antibot list*',
        '',
        '💡 Le bot doit être administrateur du groupe pour supprimer ou retirer.'
    ].join('\n');
}

async function antibotCommand(sock, chatId, message, args = [], isSenderAdmin = false) {
    const reply = text => sock.sendMessage(chatId, { text, ...channelInfo }, { quoted: message });

    if (!chatId.endsWith('@g.us')) return reply('❌ Cette fonction n\'est disponible qu\'en groupe, Monsieur.');
    if (!isSenderAdmin) return reply('❌ Accès réservé aux administrateurs du groupe, Monsieur.');

    const action = String(args[0] || 'status').toLowerCase();
    const config = engine.getConfig(chatId);

    switch (action) {
        case 'status': case 'statut': case 'get':
            return reply(statusText(chatId));

        case 'on': case 'activer': case 'enable': {
            if (config.enabled) return reply('⚠️ L\'antibot est déjà activé dans ce groupe.');
            engine.setConfig(chatId, { enabled: true });
            return reply(`✅ *Antibot activé !*\n\n🛡️ Les messages des autres bots seront traités (${MODE_LABEL[config.action]}).\n⚠️ Je dois être administrateur du groupe.`);
        }

        case 'off': case 'desactiver': case 'désactiver': case 'disable': {
            if (!config.enabled) return reply('⚠️ L\'antibot est déjà désactivé dans ce groupe.');
            engine.setConfig(chatId, { enabled: false });
            return reply('❌ *Antibot désactivé !*\n\n🔓 Les autres bots peuvent de nouveau répondre dans ce groupe.');
        }

        case 'mode': case 'set': {
            const mode = String(args[1] || '').toLowerCase();
            if (!engine.ACTIONS.includes(mode)) return reply('❌ Choisissez : *.antibot mode delete* ou *.antibot mode kick*.');
            engine.setConfig(chatId, { action: mode });
            return reply(`✅ Antibot : action réglée sur *${MODE_LABEL[mode]}*.`);
        }

        case 'add': case 'ajouter': {
            const targets = targetsOf(message);
            const typed = args.slice(1).filter(value => /\d{5,}/.test(value));
            const numbers = [...targets, ...typed].map(engine.digits).filter(Boolean);
            if (!numbers.length) return reply('❌ Mentionnez le bot (*.antibot add @bot*), répondez à son message, ou donnez son numéro.');
            let added = 0;
            for (const number of numbers) if (engine.addBot(chatId, number)) added += 1;
            return reply(added ? `✅ ${added} bot(s) ajouté(s) à la liste. Leurs messages seront bloqués même en texte simple.` : 'ℹ️ Ce numéro était déjà dans la liste.');
        }

        case 'remove': case 'del': case 'retirer': {
            const numbers = [...targetsOf(message), ...args.slice(1).filter(value => /\d{5,}/.test(value))].map(engine.digits).filter(Boolean);
            if (!numbers.length) return reply('❌ Mentionnez le bot à retirer (*.antibot remove @bot*) ou donnez son numéro.');
            let removed = 0;
            for (const number of numbers) if (engine.removeBot(chatId, number)) removed += 1;
            return reply(removed ? `✅ ${removed} bot(s) retiré(s) de la liste.` : 'ℹ️ Ce numéro n\'était pas dans la liste.');
        }

        case 'list': case 'liste': {
            if (!config.bots.length) return reply('📭 Aucun bot connu dans ce groupe pour le moment.\nLes bots sont ajoutés automatiquement dès qu\'ils sont détectés.');
            return reply(`🤖 *Bots connus (${config.bots.length})*\n\n${config.bots.map(number => `• @${number}`).join('\n')}`);
        }

        case 'clear': case 'reset': {
            engine.setConfig(chatId, { bots: [] });
            return reply('🧹 Liste des bots connus vidée.');
        }

        default:
            return reply(`❌ Option invalide.\n\n${statusText(chatId)}`);
    }
}

module.exports = { antibotCommand, isAntibotEnabled, handleAntibot };
