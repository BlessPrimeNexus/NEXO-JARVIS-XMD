'use strict';

const { channelInfo } = require('../lib/messageConfig');

async function openGroupCommand(sock, chatId, message) {
    if (!chatId.endsWith('@g.us')) {
        return sock.sendMessage(chatId, {
            text: '❌ Cette fonction n\'est disponible qu\'en groupe, Monsieur.',
            ...channelInfo
        }, { quoted: message });
    }

    try {
        await sock.groupSettingUpdate(chatId, 'not_announcement');
        const meta = await sock.groupMetadata(chatId);
        await sock.sendMessage(chatId, {
            text:
                `╭━━━━⌜𝗚𝗥𝗢𝗨𝗣𝗘 𝗢𝗨𝗩𝗘𝗥𝗧⌟\n` +
                `┃⌬┃ 🔓 *${meta.subject || 'Groupe'}*\n` +
                `┃⌬┃\n` +
                `┃⌬┃ ✅ Le groupe est de nouveau *ouvert*. Les portes sont rouvertes.\n` +
                `┃⌬┃ Tous les membres peuvent écrire. 💬\n` +
                `╰━━━━━━━━━━━━━━━━❍\n` +
                `\n> © 2026 𝗡𝗘𝗫𝗢-𝗝𝗔𝗥𝗩𝗜𝗦 𝗫𝗠𝗗`,
            ...channelInfo
        }, { quoted: message });
    } catch (err) {
        console.error('[open] error:', err.message);
        await sock.sendMessage(chatId, {
            text: '❌ Impossible d\'ouvrir le groupe.',
            ...channelInfo
        }, { quoted: message });
    }
}

async function closeGroupCommand(sock, chatId, message) {
    if (!chatId.endsWith('@g.us')) {
        return sock.sendMessage(chatId, {
            text: '❌ Cette fonction n\'est disponible qu\'en groupe, Monsieur.',
            ...channelInfo
        }, { quoted: message });
    }

    try {
        await sock.groupSettingUpdate(chatId, 'announcement');
        const meta = await sock.groupMetadata(chatId);
        await sock.sendMessage(chatId, {
            text:
                `╭━━━━⌜𝗚𝗥𝗢𝗨𝗣𝗘 𝗙𝗘𝗥𝗠𝗘⌟\n` +
                `┃⌬┃ 🔒 *${meta.subject || 'Groupe'}*\n` +
                `┃⌬┃\n` +
                `┃⌬┃ ✅ Groupe verrouillé. Silence radio pour les non-membres, Monsieur.\n` +
                `┃⌬┃ Seuls les admins peuvent écrire. 🔐\n` +
                `╰━━━━━━━━━━━━━━━━❍\n` +
                `\n> © 2026 𝗡𝗘𝗫𝗢-𝗝𝗔𝗥𝗩𝗜𝗦 𝗫𝗠𝗗`,
            ...channelInfo
        }, { quoted: message });
    } catch (err) {
        console.error('[close] error:', err.message);
        await sock.sendMessage(chatId, {
            text: '❌ Je n\'ai pas pu fermer le groupe, Monsieur.',
            ...channelInfo
        }, { quoted: message });
    }
}

module.exports = { openGroupCommand, closeGroupCommand };
