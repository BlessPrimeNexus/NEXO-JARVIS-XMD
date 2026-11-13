'use strict';

/*
 * .theme            → liste des thèmes + boutons pour choisir
 * .theme <nom>      → active le thème (images + style des réponses) pour CETTE session
 * Les thèmes sont : Jarvis (défaut), Escanor, Sung Jin-woo, Spider-Man, Zero Two, Gojo, Sakura,
 * plus tout dossier themes/<nom>/ contenant des images.
 */

const { report } = require('../lib/style');
const themes = require('../lib/theme');

async function themeCommand(sock, chatId, message, query = '') {
    const wanted = String(query || '').trim();
    const available = themes.list();
    const active = themes.current();

    if (!wanted || /^(list|liste|themes?)$/i.test(wanted)) {
        const rows = available.map(theme => [`${theme.icon} ${theme.name}`, theme.id === active.id ? 'actif' : `.theme ${theme.id}`]);
        const text = report('🎨 Thèmes', [['Thème actuel', `${active.icon} ${active.name}`]], [{ title: '🖌️ Disponibles', rows }]);
        return sock.sendMessage(chatId, { text }, { quoted: message });
    }

    const chosen = themes.set(wanted);
    if (!chosen) {
        return sock.sendMessage(chatId, {
            text: `❌ Thème inconnu : « ${wanted} ».\nThèmes disponibles : ${available.map(theme => theme.name).join(', ')}.`
        }, { quoted: message });
    }

    const caption = report('🎨 Thème activé', [['Thème', `${chosen.icon} ${chosen.name}`]], []);
    let photo = null;
    try { photo = await require('../lib/presentation').nextPhoto(); } catch { /* texte seul */ }
    if (photo) return sock.sendMessage(chatId, { image: photo, caption }, { quoted: message });
    return sock.sendMessage(chatId, { text: caption }, { quoted: message });
}

module.exports = themeCommand;
