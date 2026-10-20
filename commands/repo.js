'use strict';

const fs = require('fs');
const path = require('path');
const { channelInfo } = require('../lib/messageConfig');
const { sendInteractiveMessage } = require('../lib/interactiveButtons');

const WEBSITE_URL = 'https://nexo-jarvis-xmd.onrender.com';

function repoCaption() {
    return [
        '╭━━━━⌜𝗡𝗘𝗫𝗢-𝗝𝗔𝗥𝗩𝗜𝗦 𝗫𝗠𝗗⌟',
        '┃⌬╭━━━━━━━━━━━━━≽',
        '┃⌬┃ 🤖 *NEXO-JARVIS XMD*',
        '╰━━━━━━━━━━━━❍',
        '',
        '✅ *Website disponible*',
        WEBSITE_URL,
        '',
        '> © 2026 𝗡𝗘𝗫𝗢-𝗝𝗔𝗥𝗩𝗜𝗦 𝗫𝗠𝗗 • ᴄᴏɴçᴜ ᴘᴀʀ ✘🦠𝗕𝗟𝗘𝗦𝗦 | 𝗗𝗘𝗩🧬»𝟰𝟬𝟰. ✘'
    ].join('\n');
}

function repoButtons() {
    return [
        {
            name: 'cta_url',
            params: {
                display_text: '↗️ Ouvrir le site',
                url: WEBSITE_URL
            }
        },
        {
            name: 'cta_copy',
            params: {
                display_text: '📋 Copier le lien',
                copy_code: WEBSITE_URL
            }
        }
    ];
}

async function repoCommand(sock, chatId, message) {
    const image = null; // l'aperçu d'image est géré par lib/presentation.js
    const options = {
        body: repoCaption(),
        footer: '𝗡𝗘𝗫𝗢-𝗝𝗔𝗥𝗩𝗜𝗦 𝗫𝗠𝗗',
        title: '𝗡𝗘𝗫𝗢-𝗝𝗔𝗥𝗩𝗜𝗦 𝗫𝗠𝗗',
        contextInfo: channelInfo.contextInfo,
        buttons: repoButtons(),
        quoted: message
    };

    try {
        await sendInteractiveMessage(sock, chatId, { ...options, image });
    } catch (error) {
        // Keep the URL visible when a very old WhatsApp client rejects Native Flow.
        console.warn('[repo] Native Flow unavailable:', error.message);
        const fallback = { text: repoCaption(), ...channelInfo };
        await sock.sendMessage(chatId, fallback, { quoted: message });
    }
}

module.exports = repoCommand;
