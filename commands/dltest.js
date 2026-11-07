'use strict';

/*
 * .dltest [titre | lien YouTube] — teste TOUTES les sources de téléchargement une par une et affiche la vraie cause de chaque échec
 * (propriétaire uniquement). À lancer sur le serveur quand .song / .play / .video ne répondent plus : on voit tout de suite si
 * YouTube bloque l'adresse (→ fournir YT_COOKIES), si yt-dlp n'est pas installé, ou si seules les API gratuites sont tombées.
 */

const { panel, report } = require('../lib/style');
const health = require('../lib/downloadHealth');

const SAMPLE = { url: 'https://youtu.be/dQw4w9WgXcQ', query: 'Rick Astley Never Gonna Give You Up' };

async function dlTestCommand(sock, chatId, message, args = '') {
    const ownerAuth = require('../lib/ownerAuth');
    if (!(await ownerAuth.isOwnerMessage(sock, message, chatId))) {
        return sock.sendMessage(chatId, { text: '⛔ Accès réservé au propriétaire du système, Monsieur.' }, { quoted: message });
    }
    const reply = (title, rows, note) => sock.sendMessage(chatId, { text: panel(title, rows, note) }, { quoted: message });
    const song = require('./song');
    const ytdlp = require('../lib/ytdlp');

    let url = SAMPLE.url;
    let query = SAMPLE.query;
    const input = String(args).trim();
    if (/^https?:\/\//i.test(input)) url = input;
    else if (input) {
        try {
            const found = (await require('yt-search')(input)).videos[0];
            if (found) { url = found.url; query = found.title; }
        } catch { /* on garde l'exemple */ }
    }

    await reply('🧪 TEST DES SOURCES', ['Test en cours (1 à 3 minutes)…', url], 'Je vous envoie le détail dès que c’est fini.');
    let binary = 'prêt';
    try { await ytdlp.ensureBinary(); } catch (error) { binary = `INDISPONIBLE : ${ytdlp.explain(error)}`; }

    const results = await song.diagnose(url, query);
    const good = results.filter(item => item.ok);
    const bad = results.filter(item => !item.ok);
    const blocked = bad.some(item => /bloque cette adresse/.test(item.detail));
    const note = good.length
        ? 'Au moins une source fonctionne : .song / .play utiliseront la première disponible.'
        : blocked
            ? 'YouTube bloque l’adresse du serveur : ajoutez la variable YT_COOKIES_B64 (cookies d’un compte YouTube) sur Railway.'
            : 'Aucune source ne répond : vérifiez le réseau du serveur et relancez .dltest.';
    const report_ = report('🧪 Test des sources', [['Sources OK', `${good.length} / ${results.length}`]], [
        { title: '⚙️ Environnement', rows: [['🧰 yt-dlp', binary], ['🍪 Cookies', ytdlp.cookiesPath() ? 'fournis' : 'non fournis']] },
        { title: '✅ Fonctionnent', rows: good.map(item => `${item.name} — ${item.detail}, ${(item.ms / 1000).toFixed(1)} s`) },
        { title: '❌ En échec', rows: bad.map(item => `${item.name} — ${item.detail}`) },
        { title: '💡 Conseil', rows: [note] }
    ]);
    return sock.sendMessage(chatId, { text: report_ }, { quoted: message });
}

module.exports = dlTestCommand;
module.exports.health = health;
