'use strict';

const { handleGoodbye } = require('../lib/welcome');
const { isGoodByeOn, getGoodbye } = require('../lib/index');
const { buildGoodbye, channelInfo, memberCountAfterLeave, participantJid, sendMemberEvent } = require('../lib/memberEvent');

function commandArgs(text, command) {
    return text.replace(new RegExp('^\\s*\\.' + command + '\\b', 'i'), '').trim();
}

async function goodbyeCommand(sock, chatId, message) {
    if (!chatId.endsWith('@g.us')) {
        await sock.sendMessage(chatId, { text: 'Cette fonction n\'est disponible qu\'en groupe, Monsieur.' }, { quoted: message });
        return;
    }
    const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
    await handleGoodbye(sock, chatId, message, commandArgs(text, 'goodbye'));
}

async function handleLeaveEvent(sock, id, participants, author) {
    if (!(await isGoodByeOn(id))) return;

    let groupMetadata = null;
    try {
        groupMetadata = await sock.groupMetadata(id);
    } catch { /* on continue avec des valeurs par défaut */ }

    const groupName = groupMetadata?.subject || 'ce groupe';
    const template = await getGoodbye(id);

    for (const participant of participants || []) {
        const jid = participantJid(participant);
        try {
            const caption = buildGoodbye({
                jid,
                groupName,
                count: groupMetadata ? memberCountAfterLeave(groupMetadata.participants, jid) : '—',
                author,
                template
            });
            await sendMemberEvent(sock, id, jid, caption, author ? [author] : []);
        } catch (err) {
            console.error('[goodbye] Erreur :', err.message);
            try {
                await sock.sendMessage(id, {
                    text: `@${jid.split('@')[0]} a quitté le groupe.`,
                    mentions: [jid],
                    ...channelInfo()
                });
            } catch { /* rien */ }
        }
    }
}

module.exports = { goodbyeCommand, handleLeaveEvent };
