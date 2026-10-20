'use strict';

const channelInfo = {
    contextInfo: {
        forwardingScore: 1,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid:  '120363426264191950@newsletter',
            newsletterName: '𝗡𝗘𝗫𝗢-𝗝𝗔𝗥𝗩𝗜𝗦 𝗫𝗠𝗗',
            serverMessageId: -1
        }
    }
};

async function tagAllCommand(sock, chatId, senderId, message) {
    try {
        if (!chatId.endsWith('@g.us')) {
            await sock.sendMessage(chatId, { text: '❌ Cette fonction n\'est disponible qu\'en groupe, Monsieur.' }, { quoted: message });
            return;
        }

        const groupMetadata = await sock.groupMetadata(chatId);
        const participants  = groupMetadata.participants;

        if (!participants || participants.length === 0) {
            await sock.sendMessage(chatId, { text: '❌ Aucun participant trouvé.' }, { quoted: message });
            return;
        }

        const groupName = groupMetadata.subject || 'Groupe';
        const count     = participants.length;
        const senderNum = senderId.split('@')[0];
        const mentions  = participants.map(p => p.id);

        const memberList = participants
            .map((p, i) => `⌬  ${i + 1}. @${p.id.split('@')[0]}`)
            .join('\n');

        const tagMessage =
            `╭━━━━⌜𝗡𝗘𝗫𝗢-𝗝𝗔𝗥𝗩𝗜𝗦 𝗫𝗠𝗗⌟\n` +
            `┃⌬╭━━━━━━━━━━━━━≽\n` +
            `┃⌬┃ @${senderNum}\n` +
            `╰━━━━━━━━━━━━❍\n` +
            `    📢 𝗔𝗡𝗡𝗢𝗡𝗖𝗘 ❍𝗙𝗙𝗜𝗖𝗜𝗔𝗟\n` +
            `┃⌬┃ 🏷️ *${groupName}*\n` +
            `┃⌬┃ 👥 *Membres tagués : ${count}*\n` +
            `\n` +
            `${memberList}\n` +
            `\n` +
            `┃⌬┃\n` +
            `┃⌬┃ 🔔 ᴀᴛᴛᴇɴᴛɪᴏɴ ᴛᴏᴜᴛ\n` +
            `┃⌬┃  ʟᴇ ᴍᴏɴᴅᴇ !\n` +
            `╰━━━━━━━━━━━━❍\n` +
            `\n` +
            `> © 2026 𝗡𝗘𝗫𝗢-𝗝𝗔𝗥𝗩𝗜𝗦 𝗫𝗠𝗗 • ᴄᴏɴçᴜ ᴘᴀʀ ✘🦠𝗕𝗟𝗘𝗦𝗦 | 𝗗𝗘𝗩🧬»𝟰𝟬𝟰. ✘`;

        await sock.sendMessage(chatId, {
            text:     tagMessage,
            mentions: mentions,
            ...channelInfo
        }, { quoted: message });

    } catch (err) {
        console.error('[tagall] error:', err.message);
        await sock.sendMessage(chatId, { text: '❌ Je n\'ai pas pu notifier tous les membres, Monsieur.' }, { quoted: message });
    }
}

module.exports = tagAllCommand;
