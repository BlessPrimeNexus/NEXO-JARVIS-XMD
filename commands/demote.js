const isAdmin = require('../lib/isAdmin');
const { identityVariants, participantVariants } = isAdmin;

const isAdminRole = (participant) => participant && (participant.admin === 'admin' || participant.admin === 'superadmin');

// Retrouve un participant du groupe à partir d'un JID (numéro, LID ou appareil).
function findParticipant(participants, jid) {
    const wanted = identityVariants(jid);
    return participants.find(p => participantVariants(p).some(value => wanted.includes(value)));
}

async function demoteCommand(sock, chatId, mentionedJids, message) {
    try {
        if (!chatId.endsWith('@g.us')) {
            await sock.sendMessage(chatId, {
                text: 'Cette fonction n\'est disponible qu\'en groupe, Monsieur.'
            }, { quoted: message });
            return;
        }

        let userToDemote = [];
        if (mentionedJids && mentionedJids.length > 0) {
            userToDemote = mentionedJids;
        } else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
            userToDemote = [message.message.extendedTextMessage.contextInfo.participant];
        }

        if (userToDemote.length === 0) {
            await sock.sendMessage(chatId, {
                text: '❌ Mentionnez l\'utilisateur ou répondez à l\'un de ses messages pour le rétrograder.'
            }, { quoted: message });
            return;
        }

        const senderId = message.key.participant || message.key.remoteJid;
        const metadata = await sock.groupMetadata(chatId);
        const participants = metadata.participants || [];

        const { isBotAdmin } = await isAdmin(sock, chatId, senderId);
        if (!isBotAdmin) {
            await sock.sendMessage(chatId, {
                text: '❌ Je dois être administrateur du groupe pour rétrograder un membre, Monsieur.'
            }, { quoted: message });
            return;
        }

        // On travaille avec l'identifiant exact du groupe (LID ou numéro selon le groupe).
        const targets = [];
        for (const jid of userToDemote) {
            const participant = findParticipant(participants, jid);
            if (participant && isAdminRole(participant) && !targets.some(t => t.id === participant.id)) {
                targets.push(participant);
            }
        }
        if (!targets.length) {
            await sock.sendMessage(chatId, { text: 'ℹ️ Les membres indiqués ne sont pas administrateurs.' }, { quoted: message });
            return;
        }

        const creators = targets.filter(t => t.admin === 'superadmin');
        const demotable = targets.filter(t => t.admin !== 'superadmin');
        if (!demotable.length) {
            await sock.sendMessage(chatId, {
                text: '❌ Le créateur du groupe ne peut pas être rétrogradé, Monsieur : WhatsApp l\'interdit.'
            }, { quoted: message });
            return;
        }

        const results = await sock.groupParticipantsUpdate(chatId, demotable.map(t => t.id), 'demote');
        const failed = Array.isArray(results)
            ? results.filter(r => r && r.status && String(r.status) !== '200')
            : [];
        if (Array.isArray(results) && failed.length === results.length) {
            await sock.sendMessage(chatId, {
                text: `❌ WhatsApp a refusé la rétrogradation (code ${failed[0].status}). Vérifiez que je suis bien administrateur, Monsieur.`
            }, { quoted: message });
            return;
        }

        const done = demotable.filter(t => !failed.some(r => identityVariants(r.jid).some(v => participantVariants(t).includes(v))));
        const label = (participant) => {
            const phone = participantVariants(participant).find(v => /^\d{7,15}$/.test(v));
            return `@${phone || String(participant.id).split('@')[0]}`;
        };

        await new Promise(resolve => setTimeout(resolve, 1000));

        const author = senderId;
        const authorLabel = `@${String(author).split('@')[0].split(':')[0]}`;
        const lines = [
            '*『 RÉTROGRADATION 』*',
            '',
            '👤 *Membre(s) rétrogradé(s) :*',
            ...done.map(t => `• ${label(t)}`),
            ''
        ];
        if (creators.length) lines.push('ℹ️ Le créateur du groupe n\'a pas été modifié.', '');
        lines.push(`👑 *Rétrogradé par :* ${authorLabel}`, '', `📅 *Date :* ${new Date().toLocaleString('fr-FR', { timeZone: 'Africa/Kinshasa' })}`);

        await sock.sendMessage(chatId, {
            text: lines.join('\n'),
            mentions: [...done.map(t => t.id), author]
        }, { quoted: message });
    } catch (error) {
        console.error('Error in demote command:', error);
        const rateLimited = error.data === 429;
        try {
            await sock.sendMessage(chatId, {
                text: rateLimited
                    ? '❌ Trop de requêtes pour le moment. Une pause de quelques secondes s\'impose.'
                    : '❌ Je n\'ai pas pu rétrograder le ou les membres. Vérifiez que je dispose des droits administrateur nécessaires.'
            }, { quoted: message });
        } catch (sendError) {
            console.error('Error sending error message:', sendError);
        }
    }
}

module.exports = demoteCommand;
