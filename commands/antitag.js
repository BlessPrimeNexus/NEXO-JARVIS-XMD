'use strict';

const { setAntitag, getAntitag, removeAntitag } = require('../lib/index');
const isAdmin = require('../lib/isAdmin');
const { channelInfo } = require('../lib/messageConfig');

// ─── Commande .antitag ────────────────────────────────────────────────────────
async function handleAntitagCommand(sock, chatId, userMessage, senderId, isSenderAdmin, message) {
    try {
        if (!isSenderAdmin) {
            await sock.sendMessage(chatId, { text: '```Réservé aux administrateurs du groupe, Monsieur.```', ...channelInfo }, { quoted: message });
            return;
        }

        const prefix = '.';
        const args   = userMessage.slice(9).toLowerCase().trim().split(' ');
        const action = args[0];

        if (!action) {
            const usage =
                `\`\`\`ANTITAG SETUP\n\n` +
                `${prefix}antitag on\n` +
                `${prefix}antitag set delete | kick\n` +
                `${prefix}antitag off\`\`\``;
            await sock.sendMessage(chatId, { text: usage, ...channelInfo }, { quoted: message });
            return;
        }

        switch (action) {
            case 'on': {
                const existingConfig = await getAntitag(chatId, 'on');
                // FIX: la DB stocke `.enabled`, pas `.activé`
                if (existingConfig?.enabled) {
                    await sock.sendMessage(chatId, { text: '*_L\'antitag est déjà actif, Monsieur._*', ...channelInfo }, { quoted: message });
                    return;
                }
                const result = await setAntitag(chatId, 'on', 'delete');
                await sock.sendMessage(chatId, {
                    text: result ? '*_Antitag activé, Monsieur._*' : '*_L\'activation de l\'antitag a échoué._*',
                    ...channelInfo
                }, { quoted: message });
                break;
            }

            case 'off':
                await removeAntitag(chatId, 'on');
                await sock.sendMessage(chatId, { text: '*_Antitag désactivé._*', ...channelInfo }, { quoted: message });
                break;

            case 'set': {
                if (args.length < 2) {
                    await sock.sendMessage(chatId, {
                        text: `*_Précisez une action : ${prefix}antitag set delete | kick_*`,
                        ...channelInfo
                    }, { quoted: message });
                    return;
                }
                const setAction = args[1];
                if (!['delete', 'kick'].includes(setAction)) {
                    await sock.sendMessage(chatId, {
                        text: '*_Action invalide. Choisissez delete ou kick._*',
                        ...channelInfo
                    }, { quoted: message });
                    return;
                }
                const setResult = await setAntitag(chatId, 'on', setAction);
                await sock.sendMessage(chatId, {
                    text: setResult ? `*_Action antitag définie sur ${setAction}._*` : '*_La définition de l\'action a échoué._*',
                    ...channelInfo
                }, { quoted: message });
                break;
            }

            case 'get': {
                const status = await getAntitag(chatId, 'on');
                await sock.sendMessage(chatId, {
                    text:
                        `*_Antitag Configuration:_*\n` +
                        `Statut : ${status?.enabled ? 'ACTIF ✅' : 'INACTIF ❌'}\n` +
                        `Action: ${status?.action || 'Non défini'}`,
                    ...channelInfo
                }, { quoted: message });
                break;
            }

            default:
                await sock.sendMessage(chatId, {
                    text: `*_Tapez ${prefix}antitag pour consulter l\'aide._*`,
                    ...channelInfo
                }, { quoted: message });
        }
    } catch (error) {
        console.error('[antitag] Erreur commande:', error.message);
        await sock.sendMessage(chatId, { text: '*_Une anomalie est survenue sur la commande antitag._*', ...channelInfo }, { quoted: message });
    }
}

// ─── Détection automatique du tagall dans les groupes ────────────────────────
async function handleTagDetection(sock, chatId, message, senderId) {
    try {
        const antitagSetting = await getAntitag(chatId, 'on');

        // FIX CRITIQUE : la DB stocke `.enabled`, pas `.activé`
        if (!antitagSetting || !antitagSetting.enabled) return;

        // Ignorer les messages du bot lui-même
        if (message.key.fromMe) return;

        // Ignorer les admins
        try {
            const { isSenderAdmin } = await isAdmin(sock, chatId, senderId);
            if (isSenderAdmin) return;
        } catch { /* continue */ }

        // Mentions officielles WhatsApp
        const mentionedJids = message.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];

        // Texte du message
        const messageText =
            message.message?.conversation ||
            message.message?.extendedTextMessage?.text ||
            message.message?.imageMessage?.caption ||
            message.message?.videoMessage?.caption ||
            '';

        // Mentions numériques dans le texte (pattern bot tagall)
        const numericMentions   = messageText.match(/@\d{8,}/g) || [];
        const uniqueNumericNums = new Set(numericMentions.map(m => m.replace('@', '')));

        const mentionedJidCount  = mentionedJids.length;
        const numericMentionCount = uniqueNumericNums.size;
        const totalMentions       = Math.max(mentionedJidCount, numericMentionCount);

        if (totalMentions < 3) return;

        // Seuil : plus de 50 % des membres
        const groupMetadata   = await sock.groupMetadata(chatId);
        const participants    = groupMetadata.participants || [];
        const mentionThreshold = Math.ceil(participants.length * 0.5);

        const hasManyNumericMentions =
            numericMentionCount >= 10 ||
            (numericMentionCount >= 5 && numericMentionCount >= mentionThreshold);

        if (totalMentions < mentionThreshold && !hasManyNumericMentions) return;

        const action = antitagSetting.action || 'delete';

        // Supprimer le message
        try {
            await sock.sendMessage(chatId, {
                delete: {
                    remoteJid:   chatId,
                    fromMe:      false,
                    id:          message.key.id,
                    participant: senderId
                }
            });
        } catch { /* le message a peut-être déjà disparu */ }

        if (action === 'delete') {
            await sock.sendMessage(chatId, {
                text: `⚠️ *Tagall interdit !* @${senderId.split('@')[0]} a été averti.`,
                mentions: [senderId],
                ...channelInfo
            });
        } else if (action === 'kick') {
            try {
                await sock.groupParticipantsUpdate(chatId, [senderId], 'remove');
                await sock.sendMessage(chatId, {
                    text: `🚫 *Antitag :* @${senderId.split('@')[0]} a été expulsé pour avoir tagué tous les membres.`,
                    mentions: [senderId],
                    ...channelInfo
                });
            } catch (e) {
                console.error('[antitag] Erreur kick:', e.message);
            }
        }

    } catch (error) {
        console.error('[antitag] Erreur détection:', error.message);
    }
}

module.exports = { handleAntitagCommand, handleTagDetection };
