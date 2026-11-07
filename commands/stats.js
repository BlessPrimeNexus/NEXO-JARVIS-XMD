'use strict';
const settings = require('../settings');
const { report } = require('../lib/style');
const { getAllInstances } = require('../lib/botInstance');
function numberOf(value) { return String(value || '').split('@')[0].split(':')[0].replace(/\D/g, ''); }
async function statsCommand(sock, chatId, message) {
    if (!(await require('../lib/ownerAuth').isPlatformOwnerMessage(sock, message, chatId))) {
        await sock.sendMessage(chatId, { text: 'Accès restreint, Monsieur : seul le propriétaire configuré peut consulter ces données.' }, { quoted: message });
        return;
    }
    const instances = getAllInstances();
    const connected = instances.filter(instance => instance.connected);
    const rows = instances.map(instance => `${instance.connected ? '✅' : '⚪'} +${instance.number} — ${instance.connected ? 'en ligne' : 'hors ligne'}`);
    const lines = [report('📊 État des sessions', [['En ligne', connected.length], ['Recensées', instances.length]], [{ title: '🔌 Sessions', rows: rows.length ? rows : ['Aucune session.'] }])];
    await sock.sendMessage(chatId, { text: lines.join('\n') }, { quoted: message });
}
module.exports = statsCommand;
