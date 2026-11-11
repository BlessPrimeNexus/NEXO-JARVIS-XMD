'use strict';

/*
 * .spotify <titre> — fiche du morceau (pochette, titre, artiste, durée) avec boutons, barre de progression,
 * puis le fichier audio. Le message de progression est supprimé une fois l'audio livré.
 */

const axios = require('axios');
const { report } = require('../lib/style');
const { createProgress } = require('../lib/mediaProgress');
const { commandInput, safeFileName } = require('../lib/downloadUtils');

const deps = { axios };   // remplaçable dans les tests

async function fetchCover(result) {
    const url = result.thumbnail || result.image || result.cover || result.thumb || result.album_cover;
    if (!url || !/^https?:\/\//i.test(url)) return null;
    try {
        const response = await deps.axios.get(url, { responseType: 'arraybuffer', timeout: 8000, maxContentLength: 3 * 1024 * 1024 });
        const buffer = Buffer.from(response.data);
        return buffer.length > 2000 ? buffer : null;
    } catch { return null; }
}

function trackCard(result) {
    const rows = [['🎵 Titre', result.title || result.name || 'Titre inconnu']];
    if (result.artist) rows.push(['👤 Artiste', result.artist]);
    if (result.duration) rows.push(['⏱️ Durée', String(result.duration)]);
    return report('🎧 Spotify', [], [{ title: '📋 Détails', rows }]);
}

async function spotifyCommand(sock, chatId, message) {
    const query = commandInput(message);
    if (!query) {
        await sock.sendMessage(chatId, { text: 'Utilisation : *.spotify <titre ou artiste>*\nExemple : *.spotify con calma*' }, { quoted: message });
        return;
    }

    const progress = createProgress(sock, chatId, message, { icon: '🎧', title: query });
    let delivered = false;
    try {
        await progress.start('Recherche du morceau…');
        progress.step(10, 'Recherche du morceau…', 35);

        const apiUrl = `https://okatsu-rolezapiiz.vercel.app/search/spotify?q=${encodeURIComponent(query)}`;
        const { data } = await deps.axios.get(apiUrl, { timeout: 20000, headers: { 'user-agent': 'Mozilla/5.0' } });
        if (!data?.status || !data?.result) throw new Error('aucun résultat');

        const result = data.result;
        const audioUrl = result.audio || result.audio_url || result.download || result.downloadUrl;
        if (!audioUrl) {
            await progress.remove();
            await sock.sendMessage(chatId, { text: '❌ Aucun audio téléchargeable pour cette requête.' }, { quoted: message });
            return;
        }

        progress.step(40, 'Récupération de la pochette…', 60);
        const cover = await fetchCover(result);

        // Fiche du morceau : pochette + boutons d'action (ouvrir / copier le lien Spotify)
        const link = result.url && /^https?:\/\//i.test(result.url) ? result.url : '';
        try {
            const { sendInteractiveMessage } = require('../lib/interactiveButtons');
            const buttons = link ? [
                { name: 'cta_url', params: { display_text: 'Ouvrir sur Spotify', url: link, merchant_url: link } },
                { name: 'cta_copy', params: { display_text: 'Copier le lien', copy_code: link } }
            ] : [];
            if (buttons.length || cover) {
                await sendInteractiveMessage(sock, chatId, { title: cover ? '' : (result.title || ''), body: trackCard(result), buttons, image: cover, preview: false, quoted: message });
            } else {
                await sock.sendMessage(chatId, { text: trackCard(result) }, { quoted: message });
            }
        } catch (error) {
            console.warn('[SPOTIFY] fiche sans boutons :', error.message);
            await sock.sendMessage(chatId, { text: trackCard(result) }, { quoted: message });
        }

        progress.step(70, 'Envoi du fichier audio…', 98);
        await sock.sendMessage(chatId, {
            audio: { url: audioUrl },
            mimetype: 'audio/mpeg',
            fileName: `${safeFileName(result.title || result.name, 'morceau')}.mp3`
        }, { quoted: message });
        delivered = true;
    } catch (error) {
        console.error('[SPOTIFY] erreur :', error?.message || error);
        await progress.remove();
        await sock.sendMessage(chatId, { text: '❌ La récupération de l\'audio Spotify a échoué. Essayez une autre requête dans un instant.' }, { quoted: message });
        return;
    }
    if (delivered) await progress.finish();
}

module.exports = spotifyCommand;
module.exports._deps = deps;
