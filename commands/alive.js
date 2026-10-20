const settings = require('../settings');

async function aliveCommand(sock, chatId, message) {
    const sender = message.key.participant || message.key.remoteJid;
    const senderNumber = sender ? sender.split('@')[0] : 'User';
    try {
        const aliveMsg = `
╭━━━━⌜𝗡𝗘𝗫𝗢-𝗝𝗔𝗥𝗩𝗜𝗦 𝗫𝗠𝗗⌟
┃⌬╭━━━━━━━━━━━━━━━≽
┃⌬┃ @${senderNumber}
┃⌬┃✅️ Systèmes opérationnels. Je suis à votre disposition 🟢
┃⌬┃♻️ *ᴠᴇʀsɪᴏɴ*  :  v${String(settings.version).padEnd(6)}
┃⌬┃🌍 *ᴀᴄᴄès*    :  Public 
┃⌬┃👑 *ᴘʀᴏᴘʀɪéᴛᴀɪʀᴇ* :  ✘🦠𝗕𝗟𝗘𝗦𝗦 | 𝗗𝗘𝗩🧬»𝟰𝟬𝟰. ✘ ❍
╰━━━━━━━━━━━━❍

> © 2026 𝗡𝗘𝗫𝗢-𝗝𝗔𝗥𝗩𝗜𝗦 𝗫𝗠𝗗 • ᴄᴏɴçᴜ ᴘᴀʀ ✘🦠𝗕𝗟𝗘𝗦𝗦 | 𝗗𝗘𝗩🧬»𝟰𝟬𝟰. ✘`.trim();

        // Texte + aperçu d'image tournant (ajouté par lib/presentation.js)
        await sock.sendMessage(chatId, {
            text: aliveMsg,
            mentions: sender ? [sender] : []
        }, { quoted: message });
    } catch (error) {
        console.error('Error in alive command:', error);
        await sock.sendMessage(chatId, { text: '🤖 Systèmes opérationnels. Je suis à votre disposition, Monsieur.' }, { quoted: message });
    }
}

module.exports = aliveCommand;
