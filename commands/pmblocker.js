const fs = require('fs');
const isOwnerOrSudo = require('../lib/isOwner');

const PMBLOCKER_PATH = './data/pmblocker.json';

function readState() {
    try {
        if (!fs.existsSync(PMBLOCKER_PATH)) return { activé: false, message: '⚠️ Les messages privés sont désactivés pour cette fonction, Monsieur.\nVous ne pouvez pas m\'écrire en privé. Veuillez contacter le propriétaire dans un groupe.' };
        const raw = fs.readFileSync(PMBLOCKER_PATH, 'utf8');
        const data = JSON.parse(raw || '{}');
        return {
            activé: !!data.activé,
            message: typeof data.message === 'string' && data.message.trim() ? data.message : '⚠️ Les messages privés sont désactivés pour cette fonction, Monsieur.\nVous ne pouvez pas m\'écrire en privé. Veuillez contacter le propriétaire dans un groupe.'
        };
    } catch {
        return { activé: false, message: '⚠️ Les messages privés sont désactivés pour cette fonction, Monsieur.\nVous ne pouvez pas m\'écrire en privé. Veuillez contacter le propriétaire dans un groupe.' };
    }
}

function writeState(activé, message) {
    try {
        if (!fs.existsSync('./data')) fs.mkdirSync('./data', { recursive: true });
        const current = readState();
        const payload = {
            activé: !!activé,
            message: typeof message === 'string' && message.trim() ? message : current.message
        };
        fs.writeFileSync(PMBLOCKER_PATH, JSON.stringify(payload, null, 2));
    } catch {}
}

async function pmblockerCommand(sock, chatId, message, args) {
    const senderId = message.key.participant || message.key.remoteJid;
    const isOwner = await isOwnerOrSudo(senderId, sock, chatId);
    
    if (!message.key.fromMe && !isOwner) {
        await sock.sendMessage(chatId, { text: 'Seul le propriétaire du bot peut utiliser cette commande !' }, { quoted: message });
        return;
    }
    
    const argStr = (args || '').trim();
    const [sub, ...rest] = argStr.split(' ');
    const state = readState();

    if (!sub || !['on', 'off', 'status', 'setmsg'].includes(sub.toLowerCase())) {
        await sock.sendMessage(chatId, { text: '*PMBLOCKER (propriétaire uniquement)*\n\n.pmblocker on - Activer le blocage automatique des messages privés\n.pmblocker off - Désactiver le blocage\n.pmblocker status - Afficher l\'état actuel\n.pmblocker setmsg <texte> - Définir le message d\'avertissement' }, { quoted: message });
        return;
    }

    if (sub.toLowerCase() === 'status') {
        await sock.sendMessage(chatId, { text: `Blocage des messages privés : *${state.activé ? 'ACTIF' : 'INACTIF'}*\nMessage : ${state.message}` }, { quoted: message });
        return;
    }

    if (sub.toLowerCase() === 'setmsg') {
        const newMsg = rest.join(' ').trim();
        if (!newMsg) {
            await sock.sendMessage(chatId, { text: 'Utilisation : .pmblocker setmsg <message>' }, { quoted: message });
            return;
        }
        writeState(state.activé, newMsg);
        await sock.sendMessage(chatId, { text: 'Message de blocage mis à jour, Monsieur.' }, { quoted: message });
        return;
    }

    const enable = sub.toLowerCase() === 'on';
    writeState(enable);
    await sock.sendMessage(chatId, { text: `Blocage des messages privés : *${enable ? 'ACTIVÉ' : 'DÉSACTIVÉ'}*.` }, { quoted: message });
}

module.exports = { pmblockerCommand, readState };


