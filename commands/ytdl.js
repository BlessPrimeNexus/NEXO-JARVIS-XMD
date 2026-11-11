'use strict';

/*
 * TÉLÉCHARGEMENTS YOUTUBE — aperçu, choix du format, barre de progression.
 *
 *   .song / .play / .mp3 / .ytmp3 / .video / .ytmp4 <titre ou lien>
 *      └─ sendPreview : miniature de la vidéo trouvée + fiche (titre, chaîne, durée, vues)
 *         + boutons d'action : Audio MP3, Audio en document, Vidéo 360p / 480p / 720p, Vidéo en document,
 *           ouvrir / copier le lien
 *
 *   .ytdl <format> <idVidéo>       (déclenché par les boutons)
 *      └─ un message de progression qui se modifie (██████░░░░ 61 %), puis le média,
 *         puis le message de progression est supprimé.
 */

const axios = require('axios');
const yts = require('yt-search');
const { report } = require('../lib/style');
const { createProgress } = require('../lib/mediaProgress');
const { commandInput, isHttpUrl, safeFileName } = require('../lib/downloadUtils');

const deps = { yts, axios };   // remplaçables dans les tests
const YT_HOST = /(?:youtube\.com|youtu\.be)/i;
const YT_ID = /(?:youtu\.be\/|[?&]v=|shorts\/|embed\/|live\/)([A-Za-z0-9_-]{11})/;
const ID_ONLY = /^[A-Za-z0-9_-]{11}$/;

const watchUrl = id => `https://www.youtube.com/watch?v=${id}`;
const idOf = value => (String(value || '').match(YT_ID) || [])[1] || '';

// format demandé → ce que fait le téléchargement
const FORMATS = {
    audio:    { label: 'Audio MP3',            kind: 'audio', asDocument: false },
    audiodoc: { label: 'Audio en document',    kind: 'audio', asDocument: true },
    v360:     { label: 'Vidéo 360p',           kind: 'video', height: 360, asDocument: false },
    v480:     { label: 'Vidéo 480p',           kind: 'video', height: 480, asDocument: false },
    v720:     { label: 'Vidéo 720p (HD)',      kind: 'video', height: 720, asDocument: false },
    vdoc:     { label: 'Vidéo en document',    kind: 'video', height: 720, asDocument: true }
};

const running = new Set();   // un même téléchargement ne démarre pas deux fois (double clic)

function compact(number) {
    const n = Number(number) || 0;
    if (n >= 1e9) return `${(n / 1e9).toFixed(1)} Md`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)} M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)} k`;
    return String(n);
}

async function resolveVideo(query) {
    if (isHttpUrl(query) && YT_HOST.test(query)) {
        const id = idOf(query);
        if (!id) return null;
        try { const video = await deps.yts({ videoId: id }); if (video && video.title) return { ...video, videoId: id, url: watchUrl(id) }; } catch { /* métadonnées facultatives */ }
        return { videoId: id, url: watchUrl(id), title: '' };
    }
    if (ID_ONLY.test(query)) return { videoId: query, url: watchUrl(query), title: '' };
    const search = await deps.yts(query);
    const video = search && search.videos && search.videos[0];
    return video ? { ...video, videoId: video.videoId || idOf(video.url), url: video.url || watchUrl(video.videoId) } : null;
}

async function fetchThumbnail(video) {
    const id = video.videoId;
    const candidates = [video.thumbnail, video.image, id && `https://i.ytimg.com/vi/${id}/hqdefault.jpg`].filter(Boolean);
    for (const url of candidates) {
        try {
            const response = await deps.axios.get(url, { responseType: 'arraybuffer', timeout: 8000, maxContentLength: 3 * 1024 * 1024 });
            const buffer = Buffer.from(response.data);
            if (buffer.length > 2000) return buffer;
        } catch { /* miniature suivante */ }
    }
    return null;
}

function previewCard(video, mode) {
    const rows = [['🎞️ Titre', video.title || 'Titre indisponible']];
    if (video.author && video.author.name) rows.push(['👤 Chaîne', video.author.name]);
    if (video.timestamp) rows.push(['⏱️ Durée', video.timestamp]);
    if (video.views) rows.push(['👁️ Vues', compact(video.views)]);
    if (video.ago) rows.push(['📅 Publié', video.ago]);
    return report(mode === 'video' ? '🎬 Vidéo trouvée' : '🎵 Musique trouvée', [], [{ title: '📋 Détails', rows }]);
}

function previewButtons(video, mode, prefix) {
    const row = (key, description) => ({ header: '', title: FORMATS[key].label, description, id: `${prefix}ytdl ${key} ${video.videoId}` });
    const audio = { title: '🎵 Audio', highlight_label: mode === 'audio' ? 'Conseillé' : '', rows: [row('audio', 'Fichier MP3 lisible directement'), row('audiodoc', 'MP3 envoyé comme document')] };
    const clip = { title: '🎬 Vidéo', highlight_label: mode === 'video' ? 'Conseillé' : '', rows: [row('v360', 'Léger, rapide'), row('v480', 'Qualité standard'), row('v720', 'Haute définition'), row('vdoc', 'Vidéo envoyée comme document')] };
    const sections = mode === 'video' ? [clip, audio] : [audio, clip];
    const link = video.url || watchUrl(video.videoId);
    return [
        { name: 'single_select', params: { title: 'Choisir le format', sections } },
        { name: 'cta_url', params: { display_text: 'Ouvrir sur YouTube', url: link, merchant_url: link } },
        { name: 'cta_copy', params: { display_text: 'Copier le lien', copy_code: link } }
    ];
}

/** Étape 1 : aperçu de ce que la personne cherche + boutons de format. */
async function sendPreview(sock, chatId, message, { query, mode = 'audio' }) {
    let video;
    try {
        video = await resolveVideo(query);
    } catch (error) {
        console.error('[ytdl] recherche impossible :', error.message);
        await sock.sendMessage(chatId, { text: '❌ La recherche a échoué. Réessayez dans un instant.' }, { quoted: message });
        return;
    }
    if (!video || !video.videoId) {
        await sock.sendMessage(chatId, { text: `❌ Aucun résultat pour « ${query} ».\nEssayez un autre titre ou collez le lien YouTube.` }, { quoted: message });
        return;
    }

    let prefix = '.';
    try { prefix = require('../lib/prefix').getPrefix(chatId) || '.'; } catch { /* préfixe par défaut */ }
    const thumbnail = await fetchThumbnail(video);

    try {
        const { sendInteractiveMessage } = require('../lib/interactiveButtons');
        await sendInteractiveMessage(sock, chatId, {
            title: thumbnail ? '' : (video.title || 'Résultat'),
            body: previewCard(video, mode),
            buttons: previewButtons(video, mode, prefix),
            image: thumbnail,
            preview: false,
            quoted: message
        });
    } catch (error) {
        // Vieux WhatsApp / boutons refusés : l'aperçu part quand même, avec les commandes à taper.
        console.warn('[ytdl] boutons indisponibles :', error.message);
        const lines = Object.entries(FORMATS).map(([key, format]) => `• ${prefix}ytdl ${key} ${video.videoId} — ${format.label}`);
        const text = `${previewCard(video, mode)}\n\n*Formats*\n${lines.join('\n')}`;
        if (thumbnail) await sock.sendMessage(chatId, { image: thumbnail, caption: text }, { quoted: message });
        else await sock.sendMessage(chatId, { text }, { quoted: message });
    }
}

/** Étape 2 : téléchargement avec barre de progression ; le message de progression disparaît à la fin. */
async function download(sock, chatId, message, formatKey, videoId) {
    const format = FORMATS[formatKey];
    if (!format || !ID_ONLY.test(videoId || '')) {
        await sock.sendMessage(chatId, { text: '❌ Format ou vidéo invalide. Relancez la recherche.' }, { quoted: message });
        return;
    }
    const lock = `${chatId}|${formatKey}|${videoId}`;
    if (running.has(lock)) return;   // déjà en cours : on ignore le second clic
    running.add(lock);

    const url = watchUrl(videoId);
    const icon = format.kind === 'audio' ? '🎵' : '🎬';
    let progress;
    try {
        let meta = {};
        try { meta = await deps.yts({ videoId }) || {}; } catch { /* titre facultatif */ }
        const title = meta.title || '';

        progress = createProgress(sock, chatId, message, { icon, title });
        await progress.start('Recherche de la meilleure source…');
        progress.step(10, 'Recherche de la meilleure source…', 24);

        if (format.kind === 'audio') {
            const song = require('./song');
            const { toAudio } = require('../lib/converter');
            let tries = 0;
            const result = await song.fetchChain(url, title, {
                onTry: () => { tries += 1; progress.step(tries === 1 ? 25 : progress.percent, 'Téléchargement du fichier…', 78); }
            });
            if (!result) throw new Error('ALL_SOURCES_FAILED');

            progress.step(80, 'Préparation du fichier audio…', 92);
            const detected = song.detectFormat(result.buffer);
            let buffer = result.buffer; let mime = detected.mime; let ext = detected.ext;
            if (detected.ext !== 'mp3') {
                try {
                    const converted = await toAudio(result.buffer, detected.ext);
                    if (converted && converted.length) { buffer = converted; mime = 'audio/mpeg'; ext = 'mp3'; }
                } catch (error) { console.warn(`[ytdl] conversion ignorée : ${error.message}`); }
            }
            progress.step(94, 'Envoi du fichier…', 99);
            const fileName = `${safeFileName(result.title || title, 'musique')}.${ext}`;
            if (format.asDocument) await sock.sendMessage(chatId, { document: buffer, mimetype: mime, fileName }, { quoted: message });
            else await sock.sendMessage(chatId, { audio: buffer, mimetype: mime, fileName, ptt: false }, { quoted: message });
        } else {
            const { fetchVideo } = require('./video');
            let tries = 0;
            const result = await fetchVideo(url, {
                height: format.height,
                onTry: () => { tries += 1; progress.step(tries === 1 ? 25 : progress.percent, 'Téléchargement de la vidéo…', 80); }
            });
            progress.step(88, 'Envoi de la vidéo…', 99);
            const label = result.title || title || 'Vidéo';
            const fileName = `${safeFileName(label, 'video')}.mp4`;
            const source = result.buffer ? result.buffer : { url: result.url };
            if (format.asDocument) await sock.sendMessage(chatId, { document: source, mimetype: 'video/mp4', fileName, caption: `*${label}*` }, { quoted: message });
            else await sock.sendMessage(chatId, { video: source, mimetype: 'video/mp4', fileName, caption: `*${label}*` }, { quoted: message });
        }
        await progress.finish();          // 100 % puis suppression du message d'attente
    } catch (error) {
        console.error('[ytdl] erreur :', error.message);
        if (progress) await progress.remove();
        const text = error.message === 'ALL_SOURCES_FAILED'
            ? '❌ Aucune source n\'a pu livrer ce titre pour le moment. Réessayez dans quelques instants.'
            : `❌ Le téléchargement a échoué : ${String(error.message || 'erreur inconnue').slice(0, 160)}`;
        await sock.sendMessage(chatId, { text }, { quoted: message });
    } finally {
        running.delete(lock);
    }
}

/** .ytdl <format> <id> — point d'entrée des boutons. */
async function ytdlCommand(sock, chatId, message) {
    const [formatKey, videoId] = commandInput(message).split(/\s+/);
    return download(sock, chatId, message, String(formatKey || '').toLowerCase(), videoId);
}

module.exports = ytdlCommand;
module.exports.sendPreview = sendPreview;
module.exports.download = download;
module.exports.previewButtons = previewButtons;
module.exports.previewCard = previewCard;
module.exports.FORMATS = FORMATS;
module.exports.idOf = idOf;
module.exports._deps = deps;
