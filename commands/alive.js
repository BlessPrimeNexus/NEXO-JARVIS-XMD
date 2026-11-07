const settings = require('../settings');
const { report } = require('../lib/style');

async function aliveCommand(sock, chatId, message) {
    const sender = message.key.participant || message.key.remoteJid;
    const senderNumber = sender ? sender.split('@')[0] : 'User';
    try {
        const aliveMsg = report('🟢 Systèmes en ligne', [['Utilisateur', `@${senderNumber}`], ['Statut', '🟢 Opérationnel']], [
            { title: '🤖 Bot', rows: [['♻️ Version', `v${settings.version}`], ['🌍 Accès', 'Public'], ['👑 Propriétaire', settings.menuOwner || settings.botOwner]] }
        ], 'Je suis à votre disposition, Monsieur.');

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
