'use strict';
process.env.NEXO_FANCY_FONT = '0';
process.env.PROGRESS_EDIT_GAP_MS = '0';
process.env.PROGRESS_TICK_MS = '15';
const test = require('node:test'); const assert = require('node:assert/strict');
const ytdl = require('../commands/ytdl');
const song = require('../commands/song');
const video = require('../commands/video');
const { bar } = require('../lib/mediaProgress');

const CHAT = '243999@s.whatsapp.net';
const VIDEO = { videoId: 'dQw4w9WgXcQ', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title: 'Never Gonna Give You Up', timestamp: '3:33', views: 1500000000, ago: '14 years ago', author: { name: 'Rick Astley' }, thumbnail: 'https://i.ytimg.com/vi/x/hq.jpg' };

function fakeSock() {
    const calls = []; let n = 0;
    return {
        calls, user: { id: '111:1@s.whatsapp.net' },
        waUploadToServer: async () => ({}),
        relayMessage: async (jid, m) => { calls.push({ type: 'relay', m }); return 'ok'; },
        sendMessage: async (jid, content, opts) => { const key = { id: `K${++n}`, remoteJid: jid }; calls.push({ type: 'send', content, opts, key }); return { key }; }
    };
}
const msg = text => ({ key: { id: 'M1', remoteJid: CHAT }, message: { extendedTextMessage: { text } } });
const png = Buffer.alloc(5000, 1);

test('barre : ██████░░░░ 61%', () => {
    assert.equal(bar(61), '██████░░░░ 61%');
    assert.equal(bar(0), '░░░░░░░░░░ 0%');
    assert.equal(bar(100), '██████████ 100%');
});

test('.song : aperçu avec la MINIATURE de la vidéo et les boutons de format (pas l\'image du bot)', async () => {
    ytdl._deps.yts = async () => ({ videos: [VIDEO] });
    ytdl._deps.axios = { get: async () => ({ data: png }) };
    const sock = fakeSock();
    await song(sock, CHAT, msg('.song never gonna give you up'));
    const relayed = sock.calls.filter(c => c.type === 'relay');
    assert.equal(relayed.length, 1, 'un seul message d\'aperçu');
    const flow = JSON.stringify(relayed[0].m);
    assert.match(flow, /dQw4w9WgXcQ/);
    for (const key of ['audio', 'audiodoc', 'v360', 'v480', 'v720', 'vdoc']) assert.match(flow, new RegExp(`ytdl ${key} dQw4w9WgXcQ`), key);
    assert.match(flow, /Never Gonna Give You Up/);
    assert.match(flow, /Rick Astley/);
    assert.match(flow, /imageMessage/, 'la miniature est jointe');
    assert.ok(!sock.calls.some(c => c.type === 'send' && /Téléchargement lancé/.test(c.content.text || '')));
});

test('.video : mêmes boutons, vidéo proposée en premier', async () => {
    ytdl._deps.yts = async () => ({ videos: [VIDEO] });
    const sock = fakeSock();
    await video(sock, CHAT, msg('.video never gonna'));
    const flow = JSON.stringify(sock.calls.find(c => c.type === 'relay').m);
    assert.ok(flow.indexOf('Vidéo 360p') < flow.indexOf('Audio MP3'));
});

test('.ytdl audio : message de progression modifié, audio livré, puis message supprimé', async () => {
    ytdl._deps.yts = async () => VIDEO;
    song.fetchChain = async (url, title, hooks) => { hooks.onTry('test'); await new Promise(r => setTimeout(r, 120)); return { buffer: Buffer.concat([Buffer.from('ID3'), Buffer.alloc(40000)]), title: 'Never Gonna Give You Up', source: 'test' }; };
    const sock = fakeSock();
    await ytdl(sock, CHAT, msg('.ytdl audio dQw4w9WgXcQ'));
    const sends = sock.calls.filter(c => c.type === 'send');
    const first = sends[0];
    assert.match(first.content.text, /Téléchargement en cours/);
    assert.match(first.content.text, /░░░░░░░░░░ 0%/);
    const edits = sends.filter(c => c.content.edit);
    assert.ok(edits.length >= 3, `la barre se met à jour (${edits.length} modifications)`);
    assert.ok(edits.every(c => c.content.edit.id === first.key.id), 'toutes les modifications visent le même message');
    const percents = edits.map(c => Number((c.content.text.match(/(\d+)%/) || [])[1]));
    assert.deepEqual(percents, [...percents].sort((a, b) => a - b), 'la barre ne recule jamais');
    const audioIndex = sends.findIndex(c => c.content.audio);
    const deleteIndex = sends.findIndex(c => c.content.delete);
    assert.ok(audioIndex > 0, 'audio livré');
    assert.ok(deleteIndex > audioIndex, 'le message d\'attente est supprimé APRÈS la livraison');
    assert.equal(sends[deleteIndex].content.delete.id, first.key.id);
});

test('.ytdl v720 : la qualité choisie est transmise, la vidéo est envoyée puis le message supprimé', async () => {
    ytdl._deps.yts = async () => VIDEO;
    let asked = null;
    video.fetchVideo = async (url, { height, onTry }) => { asked = height; onTry('x'); return { buffer: Buffer.alloc(50000, 2), title: 'Clip' }; };
    const sock = fakeSock();
    await ytdl(sock, CHAT, msg('.ytdl v720 dQw4w9WgXcQ'));
    assert.equal(asked, 720);
    const sends = sock.calls.filter(c => c.type === 'send');
    assert.ok(sends.some(c => c.content.video));
    assert.ok(sends.some(c => c.content.delete));
});

test('échec de tous les fournisseurs : le message de progression est supprimé et une erreur claire est envoyée', async () => {
    ytdl._deps.yts = async () => VIDEO;
    song.fetchChain = async () => null;
    const sock = fakeSock();
    await ytdl(sock, CHAT, msg('.ytdl audio dQw4w9WgXcQ'));
    const sends = sock.calls.filter(c => c.type === 'send');
    assert.ok(sends.some(c => c.content.delete), 'la barre disparaît');
    assert.match(sends.at(-1).content.text, /Aucune source/);
});

test('format inconnu ou identifiant invalide : refus propre', async () => {
    const sock = fakeSock();
    await ytdl(sock, CHAT, msg('.ytdl zzz nope'));
    assert.match(sock.calls.at(-1).content.text, /invalide/);
});

test('.spotify : fiche avec pochette + boutons, barre de progression, audio, puis suppression du message d\'attente', async () => {
    const spotify = require('../commands/spotify');
    spotify._deps.axios = { get: async (url) => url.includes('okatsu')
        ? { data: { status: true, result: { title: 'Con Calma', artist: 'Daddy Yankee', duration: '3:13', audio: 'https://cdn.test/a.mp3', thumbnail: 'https://i.test/c.jpg', url: 'https://open.spotify.com/track/1' } } }
        : { data: png } };
    const sock = fakeSock();
    await spotify(sock, CHAT, msg('.spotify con calma'));
    const relay = sock.calls.find(c => c.type === 'relay');
    assert.ok(relay, 'fiche interactive envoyée');
    const flow = JSON.stringify(relay.m);
    assert.match(flow, /Con Calma/); assert.match(flow, /Daddy Yankee/); assert.match(flow, /open\.spotify\.com/); assert.match(flow, /imageMessage/);
    const sends = sock.calls.filter(c => c.type === 'send');
    assert.match(sends[0].content.text, /Téléchargement en cours/);
    const audio = sends.findIndex(c => c.content.audio); const del = sends.findIndex(c => c.content.delete);
    assert.ok(audio > 0 && del > audio, 'suppression après livraison');
});

test('withProgress : la barre apparaît, se modifie, puis est supprimée une fois le média livré (TikTok, Instagram…)', async () => {
    const { withProgress } = require('../lib/withProgress');
    const handler = async (sock, chatId, message) => { await new Promise(r => setTimeout(r, 80)); await sock.sendMessage(chatId, { video: Buffer.alloc(10), caption: 'ok' }, { quoted: message }); };
    const sock = fakeSock();
    await withProgress(handler, { icon: '🎵' })(sock, CHAT, msg('.tiktok https://vm.tiktok.com/x'));
    const sends = sock.calls.filter(c => c.type === 'send');
    assert.match(sends[0].content.text, /Téléchargement en cours/);
    const video = sends.findIndex(c => c.content.video); const del = sends.findIndex(c => c.content.delete);
    assert.ok(video > 0 && del > video);
});

test('withProgress : sans lien, aucune barre (la commande répond seule)', async () => {
    const { withProgress } = require('../lib/withProgress');
    const sock = fakeSock();
    await withProgress(async (s, chatId) => { await s.sendMessage(chatId, { text: 'Fournissez un lien' }); })(sock, CHAT, msg('.tiktok'));
    const sends = sock.calls.filter(c => c.type === 'send');
    assert.equal(sends.length, 1);
    assert.equal(sends[0].content.text, 'Fournissez un lien');
});
