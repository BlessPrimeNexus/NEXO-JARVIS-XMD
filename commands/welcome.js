'use strict';

const { handleWelcome } = require('../lib/welcome');
const { isWelcomeOn, getWelcome } = require('../lib/index');
const { buildWelcome, channelInfo, participantJid, sendMemberEvent } = require('../lib/memberEvent');

function commandArgs(text, command) {
    return text.replace(new RegExp('^\\s*\\.' + command + '\\b', 'i'), '').trim();
}

async function welcomeCommand(sock, chatId, message) {
    if (!chatId.endsWith('@g.us')) {
        await sock.sendMessage(chatId, { text: 'Cette fonction n\'est disponible qu\'en groupe, Monsieur.' }, { quoted: message });
        return;
    }
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    await handleWelcome(sock, chatId, message, commandArgs(text, 'welcome'));
}

async function handleJoinEvent(sock, id, participants, author) {
    if (!(await isWelcomeOn(id))) return;

    let groupMetadata;
    try {
        groupMetadata = await sock.groupMetadata(id);
    } catch {
        return;
    }

    const groupName = groupMetadata.subject || 'ce groupe';
    const template = await getWelcome(id);

    for (const participant of participants || []) {
        const jid = participantJid(participant);
        try {
            const caption = buildWelcome({
                jid,
                groupName,
                count: (groupMetadata.participants || []).length,
                description: groupMetadata.desc,
                author,
                template
            });
            await sendMemberEvent(sock, id, jid, caption, author ? [author] : []);
        } catch (err) {
            console.error('[welcome] Erreur :', err.message);
            try {
                await sock.sendMessage(id, {
                    text: `Bienvenue @${jid.split('@')[0]} dans *${groupName}*.`,
                    mentions: [jid],
                    ...channelInfo()
                });
            } catch { /* rien */ }
        }
    }
}

module.exports = { welcomeCommand, handleJoinEvent };
