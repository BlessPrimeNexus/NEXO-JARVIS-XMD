'use strict';

/*
 * yt-dlp — téléchargeur local, maintenu en continu (les bibliothèques JS comme ytdl-core sont mortes à chaque changement de YouTube,
 * et les API gratuites tombent régulièrement). Le binaire autonome est téléchargé automatiquement au premier usage dans bin/
 * (aucune installation Python, aucun changement de build Railway), puis mis à jour une fois par jour.
 *
 * Réalité à connaître : YouTube bloque beaucoup d'adresses d'hébergeurs (Railway, AWS…) avec « Sign in to confirm you're not a bot ».
 * Parades utilisées ici, dans l'ordre : (1) autre « client » YouTube (tv, web_safari, mweb…), (2) cookies d'un compte YouTube si fournis
 * (variable YT_COOKIES ou YT_COOKIES_B64, format Netscape), (3) SoundCloud (jamais bloqué) avec la même recherche.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const BIN_DIR = process.env.YT_DLP_DIR || path.join(__dirname, '..', 'bin');
const COOKIES_FILE = process.env.YT_COOKIES_FILE || path.join(__dirname, '..', 'data', 'yt-cookies.txt');
const WORK_DIR = path.join(os.tmpdir(), 'nexo-ytdlp');
const RELEASE = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/';
const DAY_MS = 24 * 60 * 60 * 1000;

let installTask = null;
let installFailedAt = 0;
let lastUpdateAt = 0;
let cookiesReady = null;

/* ─── Binaire ───────────────────────────────────────────────── */

function platformAsset() {
    if (process.platform === 'win32') return 'yt-dlp.exe';
    if (process.platform === 'darwin') return 'yt-dlp_macos';
    return process.arch === 'arm64' ? 'yt-dlp_linux_aarch64' : 'yt-dlp_linux';
}

const binaryPath = () => process.env.YT_DLP_PATH || path.join(BIN_DIR, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp');

function exec(file, args, { timeout = 60000 } = {}) {
    return new Promise((resolve, reject) => {
        execFile(file, args, { timeout, maxBuffer: 8 * 1024 * 1024, windowsHide: true }, (error, stdout, stderr) => {
            if (error) {
                const detail = String(stderr || error.message || '').trim().split('\n').filter(Boolean).slice(-2).join(' | ');
                const failure = new Error(error.killed ? `délai dépassé (${Math.round(timeout / 1000)} s)` : detail || error.message);
                failure.stderr = String(stderr || '');
                reject(failure);
                return;
            }
            resolve({ stdout: String(stdout), stderr: String(stderr) });
        });
    });
}

async function installBinary() {
    const axios = require('axios');
    fs.mkdirSync(BIN_DIR, { recursive: true });
    const target = binaryPath();
    const response = await axios.get(`${RELEASE}${platformAsset()}`, { responseType: 'arraybuffer', timeout: 180000, maxContentLength: 200 * 1024 * 1024, maxRedirects: 8 });
    const temp = `${target}.download`;
    fs.writeFileSync(temp, Buffer.from(response.data));
    fs.chmodSync(temp, 0o755);
    fs.renameSync(temp, target);
    await exec(target, ['--version'], { timeout: 20000 });   // refuse un fichier corrompu
    lastUpdateAt = Date.now();
    console.log('[yt-dlp] binaire installé :', target);
}

/** Chemin d'un yt-dlp utilisable (téléchargé si besoin). Lève une erreur claire sinon. */
async function ensureBinary() {
    const target = binaryPath();
    if (fs.existsSync(target)) {
        if (Date.now() - lastUpdateAt > DAY_MS) {
            lastUpdateAt = Date.now();
            exec(target, ['-U'], { timeout: 90000 }).catch(() => {});   // mise à jour quotidienne, sans bloquer
        }
        return target;
    }
    if (Date.now() - installFailedAt < 10 * 60 * 1000) throw new Error('yt-dlp indisponible (installation échouée récemment)');
    if (!installTask) {
        installTask = installBinary().catch(error => { installFailedAt = Date.now(); throw error; }).finally(() => { installTask = null; });
    }
    await installTask;
    return target;
}

/* ─── Cookies (facultatifs) ─────────────────────────────────── */

function cookiesPath() {
    if (cookiesReady !== null) return cookiesReady;
    cookiesReady = '';
    try {
        const raw = process.env.YT_COOKIES_B64 ? Buffer.from(process.env.YT_COOKIES_B64, 'base64').toString('utf8') : process.env.YT_COOKIES || '';
        if (raw.trim()) {
            fs.mkdirSync(path.dirname(COOKIES_FILE), { recursive: true });
            fs.writeFileSync(COOKIES_FILE, raw.replace(/\\n/g, '\n'), { mode: 0o600 });
            cookiesReady = COOKIES_FILE;
        } else if (fs.existsSync(COOKIES_FILE)) {
            cookiesReady = COOKIES_FILE;
        }
    } catch { cookiesReady = ''; }
    return cookiesReady;
}

/* ─── Construction de la commande ───────────────────────────── */

// Clients YouTube à essayer (« mweb » a fonctionné sur Railway au test .dltest). Avec cookies : pas de client « tv » (il invalide la session).
function clientsFor(hasCookies) {
    return hasCookies ? ['mweb', 'web_safari', 'default'] : ['mweb', 'web_safari', 'tv', 'android_vr'];
}

function buildArgs({ target, kind, client, outTemplate, cookies, height = 480 }) {
    const args = ['--no-playlist', '--no-warnings', '--no-progress', '--no-colors', '--no-mtime', '-4', '--socket-timeout', '15', '--retries', '2'];
    if (kind === 'video') {
        const h = Math.max(144, Math.min(1080, Number(height) || 480));
        args.push('-f', `best[ext=mp4][height<=${h}]/best[height<=${h}]/best[ext=mp4]/best`, '--max-filesize', h > 480 ? '90M' : '60M');
    }
    else args.push('-f', 'bestaudio[ext=m4a][abr<=160]/bestaudio[abr<=160]/bestaudio[ext=m4a]/bestaudio/best', '--max-filesize', '40M');
    if (client && /youtu/i.test(target)) args.push('--extractor-args', `youtube:player_client=${client}`);
    if (cookies) args.push('--cookies', cookies);
    args.push('--js-runtimes', 'node');   // yt-dlp récent : exécution des défis YouTube avec Node (déjà présent)
    args.push('-o', outTemplate, '--print', 'after_move:%(title)s\t%(filepath)s');
    args.push(target);
    return args;
}

/**
 * Télécharge un média. target = URL, ou « scsearch1:titre » (SoundCloud).
 * Retourne { buffer, title, ext }. Lève une erreur avec la vraie cause (ex. « Sign in to confirm you're not a bot »).
 */
async function downloadMedia(target, { kind = 'audio', client = '', timeout = 75000, height = 480 } = {}) {
    const binary = await ensureBinary();
    fs.mkdirSync(WORK_DIR, { recursive: true });
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const cookies = /youtu/i.test(target) ? cookiesPath() : '';
    const args = buildArgs({ target, kind, client, outTemplate: path.join(WORK_DIR, `${stamp}.%(ext)s`), cookies, height });
    let result;
    try {
        result = await exec(binary, args, { timeout });
    } finally {
        // ménage : quoi qu'il arrive, aucun fichier ne traîne
        setTimeout(() => {
            try { for (const file of fs.readdirSync(WORK_DIR)) if (file.startsWith(stamp)) fs.rmSync(path.join(WORK_DIR, file), { force: true }); } catch { /* déjà supprimé */ }
        }, 5000).unref?.();
    }
    const line = result.stdout.trim().split('\n').filter(Boolean).pop() || '';
    const [title, filepath] = line.split('\t');
    if (!filepath || !fs.existsSync(filepath)) throw new Error('yt-dlp n’a produit aucun fichier');
    const buffer = fs.readFileSync(filepath);
    if (!buffer.length) throw new Error('fichier vide');
    return { buffer, title: title || '', ext: path.extname(filepath).slice(1) };
}

// Message utile pour le diagnostic (.dltest) : la cause réelle, raccourcie.
function explain(error) {
    const text = String(error && error.message || error);
    if (/not a bot|Sign in to confirm/i.test(text)) return 'YouTube bloque cette adresse (« confirmez que vous n’êtes pas un robot ») → fournir YT_COOKIES';
    if (/429|Too Many Requests/i.test(text)) return 'trop de requêtes (429)';
    if (/Video unavailable|private|removed/i.test(text)) return 'vidéo indisponible';
    if (/Requested format is not available/i.test(text)) return 'format indisponible pour ce client';
    if (/ENOTFOUND|ECONNRESET|ETIMEDOUT|getaddrinfo/i.test(text)) return 'réseau injoignable';
    return text.slice(0, 120);
}

module.exports = { ensureBinary, downloadMedia, clientsFor, buildArgs, platformAsset, cookiesPath, explain, binaryPath };
