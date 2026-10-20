'use strict';

const { bots }                                      = require('../lib/antilink');
const { setAntilink, getAntilink, removeAntilink }  = require('../lib/index');
const isAdmin                                       = require('../lib/isAdmin');
const { channelInfo }                               = require('../lib/messageConfig');

// ─── Commande .antilink ───────────────────────────────────────────────────────
async function handleAntilinkCommand(sock, chatId, userMessage, senderId, isSenderAdmin, message) {
    try {
        if (!isSenderAdmin) {
            await sock.sendMessage(chatId, {
                text: '❌ Accès réservé aux administrateurs du groupe, Monsieur.'
            }, { quoted: message });
            return;
        }

        const prefix = '.';
        const args   = userMessage.slice(9).toLowerCase().trim().split(' ');
        const action = args[0];

        if (!action) {
            const usage =
                `╭──⟪𝗡𝗘𝗫𝗢-𝗝𝗔𝗥𝗩𝗜𝗦 𝗔𝗡𝗧𝗜𝗟𝗜𝗡𝗞⟫──╮\n` +
                `┃⌬┃ Statut : consulte avec .antilink get\n` +
                `┃⌬┃ .antilink on\n` +
                `┃⌬┃ .antilink set delete | kick | warn\n` +
                `┃⌬┃ .antilink off\n` +
                `╰━━━━━━━━━━━━❍`;
            await sock.sendMessage(chatId, { text: usage, ...channelInfo }, { quoted: message });
            return;
        }

        switch (action) {
            case 'on': {
                const existingConfig = await getAntilink(chatId, 'on');
                // FIX: la DB stocke `.enabled`, pas `.activé`
                if (existingConfig?.enabled) {
                    await sock.sendMessage(chatId, { text: '⚠️ L\'antilien est déjà actif, Monsieur — je ne dors jamais.', ...channelInfo }, { quoted: message });
                    return;
                }
                const result = await setAntilink(chatId, 'on', 'delete');
                await sock.sendMessage(chatId, {
                    text: result ? '╭──⟪𝗡𝗘𝗫𝗢-𝗝𝗔𝗥𝗩𝗜𝗦 𝗔𝗡𝗧𝗜𝗟𝗜𝗡𝗞⟫──╮\n┃⌬┃ ✅ Protection activée.\n┃⌬┃ Action actuelle : suppression.\n╰━━━━━━━━━━━━❍' : '❌ Je n\'ai pas pu activer la protection antilien, Monsieur.',
                    ...channelInfo
                }, { quoted: message });
                break;
            }

            case 'off':
                await removeAntilink(chatId, 'on');
                await sock.sendMessage(chatId, { text: '╭──⟪𝗡𝗘𝗫𝗢-𝗝𝗔𝗥𝗩𝗜𝗦 𝗔𝗡𝗧𝗜𝗟𝗜𝗡𝗞⟫──╮\n┃⌬┃ 🔕 Protection désactivée.\n╰━━━━━━━━━━━━❍', ...channelInfo }, { quoted: message });
                break;

            case 'set': {
                if (args.length < 2) {
                    await sock.sendMessage(chatId, {
                        text: `❌ Choisissez une action : ${prefix}antilink set delete | kick | warn`,
                        ...channelInfo
                    }, { quoted: message });
                    return;
                }
                const setAction = args[1];
                if (!['delete', 'kick', 'warn'].includes(setAction)) {
                    await sock.sendMessage(chatId, {
                        text: '❌ Action invalide, Monsieur. Choisissez entre delete, kick ou warn.',
                        ...channelInfo
                    }, { quoted: message });
                    return;
                }
                const setResult = await setAntilink(chatId, 'on', setAction);
                await sock.sendMessage(chatId, {
                    text: setResult ? `✅ NEXO-JARVIS antilink configuré sur : ${setAction}.` : '❌ Je n\'ai pas pu modifier le réglage antilien, Monsieur.',
                    ...channelInfo
                }, { quoted: message });
                break;
            }

            case 'get': {
                const status = await getAntilink(chatId, 'on');
                await sock.sendMessage(chatId, {
                    text:
                        `╭──⟪𝗡𝗘𝗫𝗢-𝗝𝗔𝗥𝗩𝗜𝗦 𝗔𝗡𝗧𝗜𝗟𝗜𝗡𝗞⟫──╮\n` +
                        `┃⌬┃ Statut : ${status?.enabled ? '✅ Activé' : '❌ Désactivé'}\n` +
                        `┃⌬┃ Action : ${status?.action || 'delete'}\n` +
                        `╰━━━━━━━━━━━━❍`,
                    ...channelInfo
                }, { quoted: message });
                break;
            }

            default:
                await sock.sendMessage(chatId, {
                    text: `❌ Option invalide. Tapez ${prefix}antilink pour l’aide.`,
                    ...channelInfo
                }, { quoted: message });
        }
    } catch (error) {
        console.error('[antilink] Erreur commande:', error.message);
        await sock.sendMessage(chatId, { text: '❌ Une erreur a empêché NEXO-JARVIS de traiter antilink.', ...channelInfo }, { quoted: message });
    }
}

// ─── Détection de liens (fonction legacy, la détection principale est dans lib/antilink.js) ──
async function handleLinkDetection(sock, chatId, message, userMessage, senderId) {
    // La détection réelle est gérée par lib/antilink.js (Antilink) appelé dans main.js
    // Cette fonction est conservée pour compatibilité
}

module.exports = { handleAntilinkCommand, handleLinkDetection };
