const isAdmin = require('../lib/isAdmin');

async function deleteCommand(sock, chatId, message, senderId) {
    // Utiliser le store de l'instance courante (défini par botInstance.js)
    const store = sock.store || { messages: {} };

    try {
        // Determine target user and count
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const parts = text.trim().split(/\s+/);
        let countArg = null;

        // Check if a number is provided
        if (parts.length > 1) {
            const maybeNum = parseInt(parts[1], 10);
            if (!isNaN(maybeNum) && maybeNum > 0) {
                countArg = Math.min(maybeNum, 50);
            }
        }

        // Check if user is replying to a message
        const ctxInfo = message.message?.extendedTextMessage?.contextInfo || {};
        const repliedParticipant = ctxInfo.participant || null;
        const mentioned = Array.isArray(ctxInfo.mentionedJid) && ctxInfo.mentionedJid.length > 0 ? ctxInfo.mentionedJid[0] : null;

        // If no number provided but replying to a message, default to 1
        if (countArg === null && repliedParticipant) {
            countArg = 1;
        }
        // If no number provided and not replying/mentioning, show usage message
        else if (countArg === null && !repliedParticipant && !mentioned) {
            await sock.sendMessage(chatId, {
                text: '❌ Précisez le nombre de messages à supprimer.\n\nUtilisation :\n• `.del 5` - Supprime les 5 derniers messages du groupe\n• `.del 3 @user` - Supprime les 3 derniers messages de @user\n• `.del 2` (reply to message) - Supprime les 2 derniers messages de l\'utilisateur cité'
            }, { quoted: message });
            return;
        }
        // If no number provided but mentioning a user, default to 1
        else if (countArg === null && mentioned) {
            countArg = 1;
        }

        // Determine target user
        let targetUser = null;
        let repliedMsgId = null;
        let deleteGroupMessages = false;

        if (repliedParticipant && ctxInfo.stanzaId) {
            targetUser = repliedParticipant;
            repliedMsgId = ctxInfo.stanzaId;
        } else if (mentioned) {
            targetUser = mentioned;
        } else {
            deleteGroupMessages = true;
        }

        // Gather last N messages from targetUser in this chat
        const chatMessages = Array.isArray(store.messages[chatId]) ? store.messages[chatId] : [];
        const toDelete = [];
        const seenIds = new Set();

        if (deleteGroupMessages) {
            for (let i = chatMessages.length - 1; i >= 0 && toDelete.length < countArg; i--) {
                const m = chatMessages[i];
                if (!seenIds.has(m.key.id)) {
                    if (!m.message?.protocolMessage && !m.key.fromMe && m.key.id !== message.key.id) {
                        toDelete.push(m);
                        seenIds.add(m.key.id);
                    }
                }
            }
        } else {
            if (repliedMsgId) {
                const repliedInStore = chatMessages.find(m => m.key.id === repliedMsgId && (m.key.participant || m.key.remoteJid) === targetUser);
                if (repliedInStore) {
                    toDelete.push(repliedInStore);
                    seenIds.add(repliedInStore.key.id);
                } else {
                    try {
                        await sock.sendMessage(chatId, {
                            delete: {
                                remoteJid: chatId,
                                fromMe: false,
                                id: repliedMsgId,
                                participant: repliedParticipant
                            }
                        });
                        countArg = Math.max(0, countArg - 1);
                    } catch {}
                }
            }
            for (let i = chatMessages.length - 1; i >= 0 && toDelete.length < countArg; i--) {
                const m = chatMessages[i];
                const participant = m.key.participant || m.key.remoteJid;
                if (participant === targetUser && !seenIds.has(m.key.id)) {
                    if (!m.message?.protocolMessage) {
                        toDelete.push(m);
                        seenIds.add(m.key.id);
                    }
                }
            }
        }

        if (toDelete.length === 0) {
            const errorMsg = deleteGroupMessages
                ? 'Aucun message récent à supprimer dans ce groupe.'
                : 'Aucun message récent trouvé pour cet utilisateur.';
            await sock.sendMessage(chatId, { text: errorMsg }, { quoted: message });
            return;
        }

        // Delete sequentially with small delay
        for (const m of toDelete) {
            try {
                const msgParticipant = deleteGroupMessages
                    ? (m.key.participant || m.key.remoteJid)
                    : (m.key.participant || targetUser);
                await sock.sendMessage(chatId, {
                    delete: {
                        remoteJid: chatId,
                        fromMe: false,
                        id: m.key.id,
                        participant: msgParticipant
                    }
                });
                await new Promise(r => setTimeout(r, 300));
            } catch (e) {
                // continue
            }
        }

    } catch (err) {
        await sock.sendMessage(chatId, { text: 'Échec de la suppression des messages.' }, { quoted: message });
    }
}

module.exports = deleteCommand;
