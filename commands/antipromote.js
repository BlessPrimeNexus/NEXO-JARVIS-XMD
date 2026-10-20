'use strict';
const fs = require('fs');
const { channelInfo } = require('../lib/messageConfig');

const DATA_FILE = './data/antipromote.json';

function readState() {
    try {
        if (!fs.existsSync(DATA_FILE)) return {};
        return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) || {};
    } catch { return {}; }
}

function writeState(state) {
    try {
        if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });
        fs.writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
    } catch {}
}

function isAntiPromoteEnabled(chatId) {
    return !!readState()[chatId];
}

async function antiPromoteCommand(sock, chatId, senderId, message, args) {
    if (!chatId.endsWith('@g.us')) {
        return sock.sendMessage(chatId, {
            text:
                `╭━━━━⌜𝗡𝗘𝗫𝗢-𝗝𝗔𝗥𝗩𝗜𝗦 𝗫𝗠𝗗⌟\n` +
                `┃⌬┃ ❌ Réservé aux groupes, Monsieur.\n` +
                `╰━━━━━━━━━━━━❍`,
            ...channelInfo
        }, { quoted: message });
    }

    const sub = (args || '').trim().toLowerCase();
    const state = readState();

    if (sub === 'on') {
        state[chatId] = true;
        writeState(state);
        return sock.sendMessage(chatId, {
            text:
                `╭━━━━⌜𝗡𝗘𝗫𝗢-𝗝𝗔𝗥𝗩𝗜𝗦 𝗫𝗠𝗗⌟\n` +
                `┃⌬╭━━━━━━━━━━━━━≽\n` +
                `┃⌬┃ 🛡️ *ANTIPROMOTE*\n` +
                `╰━━━━━━━━━━━━❍\n` +
                `    📢𝗔𝗡𝗡𝗢𝗡𝗖𝗘 ❍𝗙𝗙𝗜𝗖𝗜𝗔𝗟\n` +
                `┃⌬┃ ✅ Activé ! Tout membre\n` +
                `┃⌬┃ promu sera auto-démis,\n` +
                `┃⌬┃ même par un admin !\n` +
                `╰━━━━━━━━━━━━❍\n` +
                `\n> © 2026 𝗡𝗘𝗫𝗢-𝗝𝗔𝗥𝗩𝗜𝗦 𝗫𝗠𝗗 • ᴄᴏɴçᴜ ᴘᴀʀ ✘🦠𝗕𝗟𝗘𝗦𝗦 | 𝗗𝗘𝗩🧬»𝟰𝟬𝟰. ✘`,
            ...channelInfo
        }, { quoted: message });
    } else if (sub === 'off') {
        delete state[chatId];
        writeState(state);
        return sock.sendMessage(chatId, {
            text:
                `╭━━━━⌜𝗡𝗘𝗫𝗢-𝗝𝗔𝗥𝗩𝗜𝗦 𝗫𝗠𝗗⌟\n` +
                `┃⌬┃ 🛡️ *ANTIPROMOTE*\n` +
                `┃⌬┃ ❌ Désactivé.\n` +
                `╰━━━━━━━━━━━━❍\n` +
                `\n> © 2026 𝗡𝗘𝗫𝗢-𝗝𝗔𝗥𝗩𝗜𝗦 𝗫𝗠𝗗 • ᴄᴏɴçᴜ ᴘᴀʀ ✘🦠𝗕𝗟𝗘𝗦𝗦 | 𝗗𝗘𝗩🧬»𝟰𝟬𝟰. ✘`,
            ...channelInfo
        }, { quoted: message });
    } else {
        const enabled = !!state[chatId];
        return sock.sendMessage(chatId, {
            text:
                `╭━━━━⌜𝗡𝗘𝗫𝗢-𝗝𝗔𝗥𝗩𝗜𝗦 𝗫𝗠𝗗⌟\n` +
                `┃⌬╭━━━━━━━━━━━━━≽\n` +
                `┃⌬┃ 🛡️ *ANTIPROMOTE*\n` +
                `╰━━━━━━━━━━━━❍\n` +
                `┃⌬┃ Statut : *${enabled ? '✅ Activé' : '❌ Désactivé'}*\n` +
                `┃⌬┃\n` +
                `┃⌬┃ Usage :\n` +
                `┃⌬┃ .antipromote on  — activer\n` +
                `┃⌬┃ .antipromote off — désactiver\n` +
                `╰━━━━━━━━━━━━❍\n` +
                `\n> © 2026 𝗡𝗘𝗫𝗢-𝗝𝗔𝗥𝗩𝗜𝗦 𝗫𝗠𝗗 • ᴄᴏɴçᴜ ᴘᴀʀ ✘🦠𝗕𝗟𝗘𝗦𝗦 | 𝗗𝗘𝗩🧬»𝟰𝟬𝟰. ✘`,
            ...channelInfo
        }, { quoted: message });
    }
}

/**
 * Appelé depuis handleGroupParticipantUpdate quand action === 'promote'
 * Retourne true si antipromote était actif et a démis le membre.
 */
async function handleAntiPromoteEvent(sock, groupId, participants) {
    if (!isAntiPromoteEnabled(groupId)) return false;
    try {
        await sock.groupParticipantsUpdate(groupId, participants, 'demote');
        const memberList = participants.map(p => `⌬  @${p.split('@')[0]}`).join('\n');
        await sock.sendMessage(groupId, {
            text:
                `╭━━━━⌜𝗡𝗘𝗫𝗢-𝗝𝗔𝗥𝗩𝗜𝗦 𝗫𝗠𝗗⌟\n` +
                `┃⌬╭━━━━━━━━━━━━━≽\n` +
                `┃⌬┃ 🛡️ *ANTIPROMOTE ACTIF*\n` +
                `╰━━━━━━━━━━━━❍\n` +
                `    🚫 𝗣𝗥𝗢𝗠𝗢𝗧𝗜𝗢𝗡 𝗥𝗘𝗙𝗨𝗦𝗘́𝗘\n` +
                `\n` +
                `${memberList}\n` +
                `\n` +
                `┃⌬┃ 🔔 Ce membre a été démis\n` +
                `┃⌬┃  automatiquement !\n` +
                `╰━━━━━━━━━━━━❍\n` +
                `\n> © 2026 𝗡𝗘𝗫𝗢-𝗝𝗔𝗥𝗩𝗜𝗦 𝗫𝗠𝗗 • ᴄᴏɴçᴜ ᴘᴀʀ ✘🦠𝗕𝗟𝗘𝗦𝗦 | 𝗗𝗘𝗩🧬»𝟰𝟬𝟰. ✘`,
            mentions: participants,
            ...channelInfo
        });
        return true;
    } catch (err) {
        console.error('[antipromote] error:', err.message);
        return false;
    }
}

module.exports = { antiPromoteCommand, handleAntiPromoteEvent, isAntiPromoteEnabled };
