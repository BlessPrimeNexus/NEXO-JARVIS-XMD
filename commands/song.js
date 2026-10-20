'use strict';

/*
 * .song / .play — téléchargement audio YouTube
 * Cascade de fournisseurs : chacun est tenté une fois (20 s max), le premier
 * qui livre un vrai fichier audio gagne. Si tous échouent, repli local via
 * @distube/ytdl-core (s'il est installé), puis message d'erreur JARVIS.
 * Chaque échec est écrit dans la console pour faciliter le diagnostic.
 */

const axios = require('axios');
const yts = require('yt-search');
const fs = require('fs');
const path = require('path');
const { toAudio } = require('../lib/converter');
const { commandInput, isHttpUrl, safeFileName } = require('../lib/downloadUtils');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const API_TIMEOUT = 20000;
const FILE_TIMEOUT = 90000;
const MIN_AUDIO_BYTES = 30 * 1024;
const MAX_AUDIO_BYTES = 40 * 1024 * 1024;
const MAX_LOCAL_SECONDS = 20 * 60;

const apiHeaders = { 'User-Agent': UA, Accept: 'application/json, text/plain, */*' };
const YT_HOST = /(?:youtube\.com|youtu\.be)/i;

/* ─── Lecture tolérante des réponses d'API ─────────────────── */

function findDownloadUrl(node, depth = 0) {
    if (node == null || depth > 5) return null;
    if (typeof node === 'string') {
        return /^https?:\/\//i.test(node) && !YT_HOST.test(node) ? node : null;
    }
    if (Array.isArray(node)) {
        for (const item of node) {
            const found = findDownloadUrl(item, depth + 1);
            if (found) return found;
        }
        return null;
    }
    if (typeof node === 'object') {
        const preferred = ['downloadUrl', 'download_url', 'downloadURL', 'dl', 'download', 'audio', 'mp3', 'link', 'url'];
        for (const key of preferred) {
            if (key in node) {
                const found = findDownloadUrl(node[key], depth + 1);
                if (found) return found;
            }
        }
        for (const [key, value] of Object.entries(node)) {
            if (/thumb|image|cover|poster|avatar|icon/i.test(key)) continue;
            const found = findDownloadUrl(value, depth + 1);
            if (found) return found;
        }
    }
    return null;
}

function findTitle(node, depth = 0) {
    if (!node || typeof node !== 'object' || depth > 4) return '';
    if (typeof node.title === 'string' && node.title.trim()) return node.title.trim();
    for (const value of Object.values(node)) {
        const found = findTitle(value, depth + 1);
        if (found) return found;
    }
    return '';
}

function fromResponse(data, base) {
    let url = findDownloadUrl(data);
    if (!url && data && typeof data === 'object') {
        const relative = data.downloadUrl || data.download_url || data.dl;
        if (typeof relative === 'string' && relative.startsWith('/') && base) url = base + relative;
    }
    if (!url) throw new Error('aucun lien de téléchargement dans la réponse');
    return { url, title: findTitle(data) };
}

/* ─── Fournisseurs ─────────────────────────────────────────── */

const enc = encodeURIComponent;
const getJson = (url) => axios.get(url, { timeout: API_TIMEOUT, headers: apiHeaders }).then(r => r.data);

const PROVIDERS = [
    {
        name: 'ytmp3.ge',
        run: async (yt) => fromResponse(
            (await axios.post('https://ytmp3.ge/api/convert', { youtube_url: yt, quality: '128' },
                { timeout: API_TIMEOUT, headers: { ...apiHeaders, 'Content-Type': 'application/json' } })).data,
            'https://ytmp3.ge')
    },
    { name: 'Vreden v1', run: async (yt) => fromResponse(await getJson(`https://api.vreden.my.id/api/v1/download/youtube/audio?url=${enc(yt)}&quality=128`)) },
    { name: 'Vreden', run: async (yt) => fromResponse(await getJson(`https://api.vreden.my.id/api/ytmp3?url=${enc(yt)}`)) },
    { name: 'Siputzx', run: async (yt) => fromResponse(await getJson(`https://api.siputzx.my.id/api/d/ytmp3?url=${enc(yt)}`)) },
    { name: 'Ryzumi', run: async (yt) => fromResponse(await getJson(`https://api.ryzumi.vip/api/downloader/ytmp3?url=${enc(yt)}`)) },
    { name: 'Nekolabs', run: async (yt) => fromResponse(await getJson(`https://api.nekolabs.web.id/downloader/youtube/v1?url=${enc(yt)}&format=mp3`)) },
    { name: 'EliteProTech', run: async (yt) => fromResponse(await getJson(`https://eliteprotech-apis.zone.id/ytdown?url=${enc(yt)}&format=mp3`)) },
    { name: 'Yupra', run: async (yt) => fromResponse(await getJson(`https://api.yupra.my.id/api/downloader/ytmp3?url=${enc(yt)}`)) },
    { name: 'Okatsu', run: async (yt) => fromResponse(await getJson(`https://okatsu-rolezapiiz.vercel.app/downloader/ytmp3?url=${enc(yt)}`)) }
];

/* ─── Téléchargement et contrôle du fichier ────────────────── */

async function downloadAudio(url) {
    const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: FILE_TIMEOUT,
        maxContentLength: MAX_AUDIO_BYTES,
        maxBodyLength: MAX_AUDIO_BYTES,
        decompress: true,
        validateStatus: status => status >= 200 && status < 400,
        headers: { 'User-Agent': UA, Accept: '*/*', 'Accept-Encoding': 'identity' }
    });
    const buffer = Buffer.from(response.data);
    const type = String(response.headers?.['content-type'] || '').toLowerCase();
    const head = buffer.toString('utf8', 0, 40).trimStart().toLowerCase();
    if (type.includes('text/html') || type.includes('json') || head.startsWith('<') || head.startsWith('{')) {
        throw new Error('le fournisseur a renvoyé une page ou du JSON au lieu du fichier audio');
    }
    if (buffer.length < MIN_AUDIO_BYTES) throw new Error(`fichier trop petit (${buffer.length} octets)`);
    return buffer;
}

function detectFormat(buffer) {
    const ascii = (from, to) => buffer.toString('ascii', from, to);
    if (ascii(0, 3) === 'ID3' || (buffer[0] === 0xFF && (buffer[1] & 0xE0) === 0xE0)) return { ext: 'mp3', mime: 'audio/mpeg' };
    if (ascii(4, 8) === 'ftyp') return { ext: 'm4a', mime: 'audio/mp4' };
    if (ascii(0, 4) === 'OggS') return { ext: 'ogg', mime: 'audio/ogg; codecs=opus' };
    if (ascii(0, 4) === 'RIFF') return { ext: 'wav', mime: 'audio/wav' };
    if (buffer[0] === 0x1A && buffer[1] === 0x45 && buffer[2] === 0xDF && buffer[3] === 0xA3) return { ext: 'webm', mime: 'audio/webm' };
    return { ext: 'm4a', mime: 'audio/mp4' };
}

async function fetchFromProviders(youtubeUrl) {
    for (const provider of PROVIDERS) {
        try {
            const info = await provider.run(youtubeUrl);
            const buffer = await downloadAudio(info.url);
            console.log(`[song] ${provider.name} : OK (${Math.round(buffer.length / 1024)} Ko)`);
            return { buffer, title: info.title };
        } catch (error) {
            const status = error.response?.status ? ` HTTP ${error.response.status}` : '';
            console.warn(`[song] ${provider.name} : échec${status} — ${error.message}`);
        }
    }
    return null;
}

// Repli local : lecture directe depuis YouTube (peut être bloquée selon l'hébergeur).
async function fetchLocal(youtubeUrl) {
    let ytdl;
    process.env.YTDL_NO_UPDATE = process.env.YTDL_NO_UPDATE || '1';
    try { ytdl = require('@distube/ytdl-core'); } catch { return null; }
    try {
        const info = await ytdl.getInfo(youtubeUrl);
        if (Number(info.videoDetails?.lengthSeconds) > MAX_LOCAL_SECONDS) throw new Error('vidéo trop longue pour le mode local');
        const format = ytdl.chooseFormat(info.formats, { quality: 'highestaudio', filter: 'audioonly' });
        const chunks = [];
        let size = 0;
        await new Promise((resolve, reject) => {
            const stream = ytdl.downloadFromInfo(info, { format });
            stream.on('data', chunk => {
                size += chunk.length;
                if (size > MAX_AUDIO_BYTES) { stream.destroy(); reject(new Error('fichier trop volumineux')); return; }
                chunks.push(chunk);
            });
            stream.on('end', resolve);
            stream.on('error', reject);
        });
        const buffer = Buffer.concat(chunks);
        if (buffer.length < MIN_AUDIO_BYTES) throw new Error('fichier vide');
        console.log(`[song] repli local : OK (${Math.round(buffer.length / 1024)} Ko)`);
        return { buffer, title: info.videoDetails?.title || '' };
    } catch (error) {
        console.warn(`[song] repli local : échec — ${error.message}`);
        return null;
    }
}

function cleanTempFiles() {
    try {
        const tempDir = path.join(__dirname, '../temp');
        if (!fs.existsSync(tempDir)) return;
        const now = Date.now();
        for (const file of fs.readdirSync(tempDir)) {
            if (!/\.(mp3|m4a)$/.test(file)) continue;
            const filePath = path.join(tempDir, file);
            try { if (now - fs.statSync(filePath).mtimeMs > 10000) fs.unlinkSync(filePath); } catch { /* ignoré */ }
        }
    } catch { /* ignoré */ }
}

/* ─── Commande ─────────────────────────────────────────────── */

async function songCommand(sock, chatId, message) {
    try {
        const query = commandInput(message);
        if (!query) {
            await sock.sendMessage(chatId, {
                text: 'Précisez le titre ou le lien YouTube, Monsieur.\nExemple : *.song Imagine Dragons Believer*'
            }, { quoted: message });
            return;
        }

        let video;
        if (isHttpUrl(query) && YT_HOST.test(query)) {
            video = { url: query };
        } else {
            const search = await yts(query);
            if (!search || !search.videos || !search.videos.length) {
                await sock.sendMessage(chatId, {
                    text: `Aucun résultat pour « ${query} », Monsieur. Souhaitez-vous reformuler la requête ?`
                }, { quoted: message });
                return;
            }
            video = search.videos[0];
        }

        const label = video.title || query;
        await sock.sendMessage(chatId, {
            text: `Téléchargement lancé. Je vous informerai une fois l'opération terminée.\n\n🎵 *${label}*` +
                  (video.timestamp ? `\n⏱ Durée : ${video.timestamp}` : '')
        }, { quoted: message });

        const result = (await fetchFromProviders(video.url)) || (await fetchLocal(video.url));
        if (!result) {
            throw new Error('ALL_SOURCES_FAILED');
        }

        const detected = detectFormat(result.buffer);
        let finalBuffer = result.buffer;
        let finalMime = detected.mime;
        let finalExt = detected.ext;

        if (detected.ext !== 'mp3') {
            try {
                const converted = await toAudio(result.buffer, detected.ext);
                if (converted && converted.length) {
                    finalBuffer = converted;
                    finalMime = 'audio/mpeg';
                    finalExt = 'mp3';
                }
            } catch (conversionError) {
                // On envoie le fichier d'origine plutôt que d'échouer si ffmpeg est absent.
                console.warn(`[song] conversion ignorée (${detected.ext}) : ${conversionError.message}`);
            }
        }

        await sock.sendMessage(chatId, {
            audio: finalBuffer,
            mimetype: finalMime,
            fileName: `${safeFileName(result.title || video.title, 'song')}.${finalExt}`,
            ptt: false
        }, { quoted: message });

        cleanTempFiles();
    } catch (error) {
        console.error('[song] erreur :', error.message);
        const text = error.message === 'ALL_SOURCES_FAILED'
            ? 'Une anomalie a été détectée. Aucune source de téléchargement n\'a pu livrer ce titre, Monsieur. Je vous suggère de réessayer dans quelques instants, ou avec un autre titre.'
            : 'Une anomalie a été détectée. L\'opération n\'a pas pu aboutir, Monsieur.';
        await sock.sendMessage(chatId, { text }, { quoted: message });
    }
}

module.exports = songCommand;
module.exports.findDownloadUrl = findDownloadUrl;
module.exports.detectFormat = detectFormat;
