const axios = require('axios');
const yts = require('yt-search');
const { commandInput, isHttpUrl, safeFileName } = require('../lib/downloadUtils');

const AXIOS_DEFAULTS = {
    timeout: 60000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
    }
};

async function tryRequest(getter, attempts = 3) {
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            return await getter();
        } catch (err) {
            lastError = err;
            if (attempt < attempts) {
                await new Promise(r => setTimeout(r, 1000 * attempt));
            }
        }
    }
    throw lastError;
}

// EliteProTech API - Primary
async function getEliteProTechVideoByUrl(youtubeUrl) {
    const apiUrl = `https://eliteprotech-apis.zone.id/ytdown?url=${encodeURIComponent(youtubeUrl)}&format=mp4`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    if (res?.data?.success && res?.data?.downloadURL) {
        return {
            download: res.data.downloadURL,
            title: res.data.title
        };
    }
    throw new Error('EliteProTech ytdown returned no download');
}

async function getYupraVideoByUrl(youtubeUrl) {
    const apiUrl = `https://api.yupra.my.id/api/downloader/ytmp4?url=${encodeURIComponent(youtubeUrl)}`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    if (res?.data?.success && res?.data?.data?.download_url) {
        return {
            download: res.data.data.download_url,
            title: res.data.data.title,
            thumbnail: res.data.data.thumbnail
        };
    }
    throw new Error('Yupra returned no download');
}

async function getOkatsuVideoByUrl(youtubeUrl) {
    const apiUrl = `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp4?url=${encodeURIComponent(youtubeUrl)}`;
    const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
    // shape: { status, creator, url, result: { status, title, mp4 } }
    if (res?.data?.result?.mp4) {
        return { download: res.data.result.mp4, title: res.data.result.title };
    }
    throw new Error('Okatsu ytmp4 returned no mp4');
}

// yt-dlp d'abord (client tv, autres clients, cookies si fournis) ; une source en échec répété est mise de côté (downloadHealth).
async function fetchVideoWithYtdlp(videoUrl, { height = 480, onTry } = {}) {
    const ytdlp = require('../lib/ytdlp');
    const health = require('../lib/downloadHealth');
    for (const client of ytdlp.clientsFor(Boolean(ytdlp.cookiesPath()))) {
        const name = `yt-dlp vidéo (${client})`;
        if (!health.usable(name)) continue;
        const started = Date.now();
        try {
            if (onTry) onTry(name);
            const result = await ytdlp.downloadMedia(videoUrl, { kind: 'video', client, timeout: 110000, height });
            health.ok(name, Date.now() - started);
            return result;
        } catch (error) {
            health.fail(name, ytdlp.explain(error), Date.now() - started);
            console.warn(`[VIDEO] ${name} : échec — ${ytdlp.explain(error)}`);
        }
    }
    return null;
}

/**
 * Télécharge une vidéo YouTube à la qualité demandée.
 * Retourne { buffer, title } (yt-dlp) ou { url, title } (API de secours, qualité fixe) ; lève une erreur si tout échoue.
 */
async function fetchVideo(videoUrl, { height = 480, onTry } = {}) {
    const local = await fetchVideoWithYtdlp(videoUrl, { height, onTry });
    if (local) return { buffer: local.buffer, title: local.title };

    const apiMethods = [
        { name: 'EliteProTech', method: () => getEliteProTechVideoByUrl(videoUrl) },
        { name: 'Yupra', method: () => getYupraVideoByUrl(videoUrl) },
        { name: 'Okatsu', method: () => getOkatsuVideoByUrl(videoUrl) }
    ];
    for (const apiMethod of apiMethods) {
        try {
            if (onTry) onTry(apiMethod.name);
            const data = await apiMethod.method();
            const link = data.download || data.dl || data.url;
            if (link) return { url: link, title: data.title };
        } catch (apiErr) {
            console.log(`${apiMethod.name} API failed:`, apiErr.message);
        }
    }
    throw new Error('Toutes les sources de téléchargement ont échoué. Ce contenu est peut-être indisponible ou bloqué.');
}

/* .video / .ytmp4 : aperçu (miniature, titre, chaîne, durée) + boutons de qualité ; téléchargement dans commands/ytdl.js */
async function videoCommand(sock, chatId, message) {
    const searchQuery = commandInput(message);
    if (!searchQuery) {
        await sock.sendMessage(chatId, { text: 'Quelle vidéo souhaitez-vous télécharger ?\nExemple : *.video Imagine Dragons Believer*' }, { quoted: message });
        return;
    }
    return require('./ytdl').sendPreview(sock, chatId, message, { query: searchQuery, mode: 'video' });
}

module.exports = videoCommand;
module.exports.fetchVideo = fetchVideo;

