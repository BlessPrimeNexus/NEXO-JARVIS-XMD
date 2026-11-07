'use strict';
process.env.NEXO_FANCY_FONT = '0';   // les tests lisent le texte en lettres normales (la police monospace est testée à part)

const Module = require('node:module');
const originalLoad = Module._load;
const apiCalls = [];
Module._load = function (request, ...rest) {
    if (request === 'axios') {
        const answer = async (url) => { apiCalls.push(url); return { data: {}, headers: {} }; };   // les API gratuites ne livrent rien
        return { get: answer, post: answer };
    }
    if (request === 'yt-search') return async () => ({ videos: [] });
    return originalLoad.call(this, request, ...rest);
};

const test = require('node:test');
const assert = require('node:assert/strict');
const health = require('../lib/downloadHealth');
const ytdlp = require('../lib/ytdlp');
const song = require('../commands/song');

const AUDIO = Buffer.concat([Buffer.from('ID3'), Buffer.alloc(40 * 1024, 1)]);
const URL_YT = 'https://youtu.be/dQw4w9WgXcQ';

test.beforeEach(() => { health.reset(); apiCalls.length = 0; });

function fakeYtdlp(handler) {
    const calls = [];
    const original = ytdlp.downloadMedia;
    ytdlp.downloadMedia = async (target, options) => { calls.push({ target, ...options }); return handler(target, options); };
    return { calls, restore: () => { ytdlp.downloadMedia = original; } };
}

test('arguments yt-dlp : client tv sans cookies, pas de client tv avec cookies, jamais d\'extractor-args hors YouTube', () => {
    const base = { kind: 'audio', outTemplate: '/tmp/x.%(ext)s' };
    const plain = ytdlp.buildArgs({ ...base, target: URL_YT, client: 'tv' });
    assert.ok(plain.join(' ').includes('youtube:player_client=tv'));
    assert.ok(plain.includes('--js-runtimes'));
    assert.ok(!plain.includes('--cookies'));
    assert.equal(ytdlp.clientsFor(false)[0], 'mweb');
    assert.ok(!ytdlp.clientsFor(true).includes('tv'));
    const soundcloud = ytdlp.buildArgs({ ...base, target: 'scsearch1:titre', client: 'tv' });
    assert.ok(!soundcloud.join(' ').includes('player_client'));
    const withCookies = ytdlp.buildArgs({ ...base, target: URL_YT, client: 'web_safari', cookies: '/c.txt' });
    assert.deepEqual(withCookies.slice(withCookies.indexOf('--cookies'), withCookies.indexOf('--cookies') + 2), ['--cookies', '/c.txt']);
    const video = ytdlp.buildArgs({ ...base, kind: 'video', target: URL_YT, client: 'tv' });
    assert.ok(video.join(' ').includes('height<=480'));
});

test('YouTube bloque le serveur : le bot passe aux autres sources et finit par SoundCloud', async () => {
    const fake = fakeYtdlp(async (target) => {
        if (target.startsWith('scsearch1:')) return { buffer: AUDIO, title: 'Savage', ext: 'm4a' };
        throw new Error("ERROR: [youtube] Sign in to confirm you're not a bot");
    });
    try {
        const result = await song.fetchChain(URL_YT, 'Tiakola Savage');
        assert.equal(result.source, 'SoundCloud');
        assert.equal(result.title, 'Savage');
        assert.equal(fake.calls[0].client, 'mweb', 'yt-dlp est tenté en premier');
        assert.ok(apiCalls.length > 0, 'les API gratuites ont été essayées entre-temps');
    } finally { fake.restore(); }
});

test('une source en échec répété est mise de côté (plus de 9 × 20 s d\'attente à chaque commande)', async () => {
    const fake = fakeYtdlp(async () => { throw new Error('bloqué'); });
    try {
        await song.fetchChain(URL_YT, 'x');
        await song.fetchChain(URL_YT, 'x');
        const before = fake.calls.filter(call => call.client === 'mweb').length;
        assert.equal(before, 2);
        await song.fetchChain(URL_YT, 'x');
        assert.equal(fake.calls.filter(call => call.client === 'mweb').length, 2, 'yt-dlp (mweb) n\'est plus rappelé : il est en pause');
        assert.equal(health.snapshot().find(item => item.name === 'yt-dlp (mweb)').paused, true);
    } finally { fake.restore(); }
});

test('un succès remet immédiatement la source en service', () => {
    health.fail('Vreden', 'x'); health.fail('Vreden', 'x');
    assert.equal(health.usable('Vreden'), false);
    health.ok('Vreden', 120);
    assert.equal(health.usable('Vreden'), true);
});

test('un fichier trop petit n\'est pas accepté comme un titre', async () => {
    const fake = fakeYtdlp(async () => ({ buffer: Buffer.alloc(100), title: 'vide' }));
    try { assert.equal(await song.fetchChain(URL_YT, ''), null); } finally { fake.restore(); }
});

test('.dltest : chaque source est testée et la cause réelle est rapportée', async () => {
    const fake = fakeYtdlp(async (target, options) => {
        if (options.client === 'web_safari') return { buffer: AUDIO, title: 't' };
        throw new Error("Sign in to confirm you're not a bot");
    });
    try {
        const results = await song.diagnose(URL_YT, 'titre');
        const tv = results.find(item => item.name === 'yt-dlp (tv)');
        assert.equal(tv.ok, false);
        assert.match(tv.detail, /bloque cette adresse/);
        assert.equal(results.find(item => item.name === 'yt-dlp (web_safari)').ok, true);
        assert.ok(results.some(item => item.name === 'Vreden v1' && item.ok === false));
        assert.ok(results.length >= 12);
    } finally { fake.restore(); }
});

test('.dltest : réservé au propriétaire, affiche chaque source et conseille YT_COOKIES quand YouTube bloque', async () => {
    const dlTest = require('../commands/dltest');
    const originalDiagnose = song.diagnose;
    const originalEnsure = ytdlp.ensureBinary;
    song.diagnose = async () => [
        { name: 'yt-dlp (tv)', ok: false, ms: 900, detail: 'YouTube bloque cette adresse (« confirmez que vous n’êtes pas un robot ») → fournir YT_COOKIES' },
        { name: 'Vreden', ok: false, ms: 300, detail: 'HTTP 404' }
    ];
    ytdlp.ensureBinary = async () => '/bin/yt-dlp';
    const sent = [];
    const sock = { user: { id: '243822993775:1@s.whatsapp.net' }, sendMessage: async (jid, content) => { sent.push(content.text); return {}; } };
    try {
        await dlTest(sock, '1@g.us', { key: { remoteJid: '1@g.us', participant: '243999999999@s.whatsapp.net' } }, '');
        assert.match(sent[0], /réservé au propriétaire/);
        sent.length = 0;
        await dlTest(sock, '1@g.us', { key: { remoteJid: '1@g.us', participant: '243802506198@s.whatsapp.net' } }, '');
        const report = sent[sent.length - 1].replace(/\n│ ?/g, ' ');
        assert.match(report, /En échec/);
        assert.match(report, /yt-dlp \(tv\) — YouTube bloque/);
        assert.match(report, /Vreden — HTTP 404/);
        assert.match(report, /YT_COOKIES/);
    } finally { song.diagnose = originalDiagnose; ytdlp.ensureBinary = originalEnsure; }
});
