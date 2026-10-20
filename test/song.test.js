'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const axios = require('axios');

// Faux yt-search : aucun accès réseau.
const ytsPath = require.resolve('yt-search');
require.cache[ytsPath] = {
    id: ytsPath, filename: ytsPath, loaded: true,
    exports: async () => ({ videos: [{ title: 'Titre Test', url: 'https://www.youtube.com/watch?v=abc123', timestamp: '3:21' }] })
};
// Faux convertisseur : renvoie le fichier tel quel.
const convPath = require.resolve('../lib/converter');
require.cache[convPath] = { id: convPath, filename: convPath, loaded: true, exports: { toAudio: async (buffer) => buffer } };

const songCommand = require('../commands/song');

const MP3 = Buffer.concat([Buffer.from('ID3\x03\x00\x00\x00\x00\x00\x00'), Buffer.alloc(60 * 1024, 1)]);

function fakeSock() {
    const sent = [];
    return { sent, sendMessage: async (jid, content, options) => { sent.push({ jid, content, options }); } };
}
function fakeMessage(text) {
    return { key: { id: 'X', remoteJid: 'g@g.us' }, message: { conversation: text } };
}

test('.song : un fournisseur en panne est contourné, le suivant livre le fichier', async () => {
    const realGet = axios.get, realPost = axios.post;
    const asked = [];
    axios.post = async () => { throw new Error('ytmp3.ge hors service'); };
    axios.get = async (url, options = {}) => {
        asked.push(url);
        if (url.includes('api/v1/download/youtube/audio')) throw new Error('HTTP 502');
        if (url.includes('api.vreden.my.id/api/ytmp3')) return { data: { status: true, result: { title: 'Titre Fournisseur', download: { url: 'https://cdn.test/fichier.mp3' } } } };
        if (url === 'https://cdn.test/fichier.mp3') return { data: MP3, headers: { 'content-type': 'audio/mpeg' } };
        throw new Error('URL inattendue ' + url);
    };
    try {
        const sock = fakeSock();
        await songCommand(sock, 'g@g.us', fakeMessage('.song believer'));
        const audio = sock.sent.find(m => m.content.audio);
        assert.ok(audio, 'un message audio doit être envoyé');
        assert.equal(audio.content.mimetype, 'audio/mpeg');
        assert.match(audio.content.fileName, /Titre Fournisseur\.mp3$/);
        assert.match(sock.sent[0].content.text, /Téléchargement lancé/);
    } finally { axios.get = realGet; axios.post = realPost; }
});

test('.song : une page HTML renvoyée par un fournisseur est rejetée', async () => {
    const realGet = axios.get, realPost = axios.post;
    axios.post = async () => ({ data: { downloadUrl: 'https://cdn.test/page' } });
    axios.get = async (url) => {
        if (url === 'https://cdn.test/page') return { data: Buffer.from('<html>' + 'x'.repeat(70000)), headers: { 'content-type': 'text/html' } };
        throw new Error('HTTP 500');
    };
    try {
        const sock = fakeSock();
        await songCommand(sock, 'g@g.us', fakeMessage('.song believer'));
        assert.ok(!sock.sent.some(m => m.content.audio), 'aucun audio ne doit partir');
        const last = sock.sent.at(-1).content.text;
        assert.match(last, /anomalie/i);
    } finally { axios.get = realGet; axios.post = realPost; }
});

test('.song sans titre : message d\'aide JARVIS', async () => {
    const sock = fakeSock();
    await songCommand(sock, 'g@g.us', fakeMessage('.song'));
    assert.match(sock.sent[0].content.text, /Précisez/);
});
