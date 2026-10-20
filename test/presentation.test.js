'use strict';

process.env.NEXO_NO_THUMBNAIL_FETCH = '1';
process.env.PREVIEW_IMAGES = [
    'https://files.catbox.moe/aaa111.jpg',
    'https://files.catbox.moe/bbb222.jpg',
    'https://files.catbox.moe/ccc333.jpg',
    'https://files.catbox.moe/REMPLACE_04.jpg'
].join(',');

const test = require('node:test');
const assert = require('node:assert/strict');

const presentation = require('../lib/presentation');
const song = require('../commands/song');

const GROUP = '120363000000000000@g.us';

test('les liens "REMPLACE" sont ignorés, les vrais liens sont gardés', () => {
    const list = presentation.configuredImages();
    assert.equal(list.length, 3);
    assert.ok(list.every(url => url.startsWith('https://files.catbox.moe/')));
    assert.ok(!list.some(url => /REMPLACE/.test(url)));
});

test('la rotation utilise chaque image une fois par cycle sans répétition immédiate', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];
    const rotator = presentation.createRotator(items, Math.random);
    let previous = null;
    for (let cycle = 0; cycle < 50; cycle += 1) {
        const seen = [];
        for (let i = 0; i < items.length; i += 1) {
            const value = rotator.next();
            assert.notEqual(value, previous, 'même image deux fois de suite');
            previous = value;
            seen.push(value);
        }
        assert.deepEqual([...seen].sort(), items);
    }
});

test('une seule image configurée : elle est renvoyée à chaque fois', () => {
    const rotator = presentation.createRotator(['seule']);
    assert.equal(rotator.next(), 'seule');
    assert.equal(rotator.next(), 'seule');
});

test('liste vide : aucun aperçu et aucune erreur', () => {
    assert.equal(presentation.createRotator([]).next(), null);
});

test('un message texte reçoit le bouton chaîne et un aperçu image', () => {
    const out = presentation.decorate(GROUP, { text: 'Bonjour' });
    const ctx = out.contextInfo;
    assert.equal(out.text, 'Bonjour');
    assert.equal(ctx.isForwarded, true);
    assert.ok(ctx.forwardedNewsletterMessageInfo.newsletterJid.endsWith('@newsletter'));
    assert.equal(ctx.externalAdReply.mediaType, 1);
    assert.equal(ctx.externalAdReply.renderLargerThumbnail, true);
    assert.match(ctx.externalAdReply.thumbnailUrl, /^https:\/\/files\.catbox\.moe\//);
});

test('les images défilent à chaque message texte', () => {
    const urls = new Set();
    for (let i = 0; i < 9; i += 1) {
        urls.add(presentation.decorate(GROUP, { text: 'x' }).contextInfo.externalAdReply.thumbnailUrl);
    }
    assert.equal(urls.size, 3);
});

test('les mentions et le contexte existant sont conservés', () => {
    const out = presentation.decorate(GROUP, {
        text: 'Salut @x',
        mentions: ['1@s.whatsapp.net'],
        contextInfo: { mentionedJid: ['1@s.whatsapp.net'], forwardingScore: 7 }
    });
    assert.deepEqual(out.mentions, ['1@s.whatsapp.net']);
    assert.deepEqual(out.contextInfo.mentionedJid, ['1@s.whatsapp.net']);
    assert.equal(out.contextInfo.forwardingScore, 7);
    assert.ok(out.contextInfo.forwardedNewsletterMessageInfo);
});

test('un aperçu déjà défini par la commande n\'est pas écrasé', () => {
    const custom = { title: 'Perso', body: 'x', thumbnailUrl: 'https://exemple.test/a.jpg' };
    const out = presentation.decorate(GROUP, { text: 'a', contextInfo: { externalAdReply: custom } });
    assert.equal(out.contextInfo.externalAdReply.title, 'Perso');
});

test('les médias reçoivent le bouton chaîne mais pas d\'aperçu', () => {
    for (const content of [{ image: Buffer.from('x'), caption: 'c' }, { audio: Buffer.from('x') }, { sticker: Buffer.from('x') }]) {
        const out = presentation.decorate(GROUP, content);
        assert.ok(out.contextInfo.forwardedNewsletterMessageInfo);
        assert.equal(out.contextInfo.externalAdReply, undefined);
    }
});

test('réactions, suppressions, sondages, statuts et chaînes ne sont pas modifiés', () => {
    const reaction = { react: { text: '👍', key: {} } };
    assert.equal(presentation.decorate(GROUP, reaction), reaction);
    const deletion = { delete: {} };
    assert.equal(presentation.decorate(GROUP, deletion), deletion);
    const poll = { poll: { name: 'q', values: ['a', 'b'] } };
    assert.equal(presentation.decorate(GROUP, poll), poll);
    const text = { text: 'hello' };
    assert.equal(presentation.decorate('status@broadcast', text), text);
    assert.equal(presentation.decorate('120363@newsletter', text), text);
});

test('wrapSocket enveloppe sendMessage une seule fois et transmet les options (citation remplacée par la carte)', async () => {
    const calls = [];
    const sock = { sendMessage: async (jid, content, options) => { calls.push({ jid, content, options }); return 'ok'; } };
    presentation.wrapSocket(sock);
    const wrapped = sock.sendMessage;
    presentation.wrapSocket(sock);
    assert.equal(sock.sendMessage, wrapped);

    const quoted = { key: { id: 'A' } };
    assert.equal(await sock.sendMessage(GROUP, { text: 'Opération terminée, Monsieur.' }, { quoted }), 'ok');
    assert.equal(calls.length, 1);
    // La citation d'origine est remplacée par la fausse citation « WhatsApp ✓ • Statut » (lib/quoteCard.js).
    assert.ok(calls[0].options.quoted.message.imageMessage);
    assert.match(calls[0].options.quoted.message.imageMessage.caption, /Commande : automatique|Commande : /);
    assert.ok(calls[0].content.contextInfo.externalAdReply);
});

test('decorateContextInfo ajoute le bouton chaîne sans perdre le contexte', () => {
    const ctx = presentation.decorateContextInfo({ mentionedJid: ['1@s.whatsapp.net'] });
    assert.deepEqual(ctx.mentionedJid, ['1@s.whatsapp.net']);
    assert.ok(ctx.forwardedNewsletterMessageInfo.newsletterJid);
});

/* ─── .song : lecture des réponses d'API ─── */

test('findDownloadUrl trouve le lien dans des formats d\'API variés', () => {
    const find = song.findDownloadUrl;
    assert.equal(find({ downloadUrl: 'https://cdn.test/a.mp3' }), 'https://cdn.test/a.mp3');
    assert.equal(find({ status: true, result: { download: { url: 'https://cdn.test/b.mp3' } } }), 'https://cdn.test/b.mp3');
    assert.equal(find({ data: { title: 'T', dl: 'https://cdn.test/c.mp3' } }), 'https://cdn.test/c.mp3');
    assert.equal(find({ result: [{ url: 'https://cdn.test/d.mp3' }] }), 'https://cdn.test/d.mp3');
});

test('findDownloadUrl ignore les liens YouTube et les miniatures', () => {
    const find = song.findDownloadUrl;
    assert.equal(find({ url: 'https://www.youtube.com/watch?v=abc' }), null);
    assert.equal(find({ thumbnail: 'https://i.ytimg.com/vi/x/hq.jpg' }), null);
    assert.equal(find({ thumbnail: 'https://img.test/t.jpg', url: 'https://cdn.test/e.mp3' }), 'https://cdn.test/e.mp3');
    assert.equal(find({ message: 'erreur' }), null);
});

test('detectFormat reconnaît mp3, m4a, ogg et wav', () => {
    const d = song.detectFormat;
    assert.equal(d(Buffer.from('ID3\x03\x00\x00\x00\x00\x00\x00')).ext, 'mp3');
    assert.equal(d(Buffer.from([0xFF, 0xFB, 0x90, 0x00, 0, 0, 0, 0])).ext, 'mp3');
    assert.equal(d(Buffer.from('\x00\x00\x00\x20ftypM4A ')).ext, 'm4a');
    assert.equal(d(Buffer.from('OggS\x00\x02\x00\x00')).ext, 'ogg');
    assert.equal(d(Buffer.from('RIFF\x00\x00\x00\x00WAVE')).ext, 'wav');
});
