'use strict';
process.env.NEXO_FANCY_FONT = '0';   // les tests lisent le texte en lettres normales (la police monospace est testée à part)

const test = require('node:test');
const assert = require('node:assert/strict');
const idch = require('../commands/idch');

const LINK = 'https://whatsapp.com/channel/0029Vb78ycrInlqYocbYLX0P';
const msg = { key: { remoteJid: '1@g.us' } };

function fakeSock(result) {
    const calls = [];
    const sent = [];
    return {
        calls, sent,
        newsletterMetadata: async (type, key) => { calls.push([type, key]); if (result instanceof Error) throw result; return result; },
        sendMessage: async (jid, content) => { sent.push(content); return {}; }
    };
}

test('le code est extrait du lien en gardant la casse', () => {
    assert.deepEqual(idch.extractCode(LINK), { type: 'invite', key: '0029Vb78ycrInlqYocbYLX0P' });
    assert.deepEqual(idch.extractCode('whatsapp.com/channel/0029Vb78ycrInlqYocbYLX0P?x=1'), { type: 'invite', key: '0029Vb78ycrInlqYocbYLX0P' });
    assert.deepEqual(idch.extractCode('120363999999999999@newsletter'), { type: 'jid', key: '120363999999999999@newsletter' });
    assert.equal(idch.extractCode('bonjour'), null);
});

test('renvoie le JID, le nom et les abonnés', async () => {
    const sock = fakeSock({ id: '120363999999999999@newsletter', name: 'NEXO', subscribers: 1234, verification: 'VERIFIED', creation_time: 1700000000, description: 'Ma chaîne' });
    await idch(sock, '1@g.us', msg, LINK);
    assert.deepEqual(sock.calls[0], ['invite', '0029Vb78ycrInlqYocbYLX0P']);
    const text = sock.sent[0].text;
    assert.match(text, /120363999999999999@newsletter/);
    assert.match(text, /NEXO/);
    assert.match(text, /1\s?234/);
});

test('accepte la forme imbriquée (thread_metadata)', async () => {
    const sock = fakeSock({ id: '120363111111111111@newsletter', thread_metadata: { name: { text: 'Autre' }, subscribers_count: '5', creation_time: '1700000000' } });
    await idch(sock, '1@g.us', msg, LINK);
    assert.match(sock.sent[0].text, /Autre/);
    assert.match(sock.sent[0].text, /120363111111111111@newsletter/);
});

test('lien dans le message cité', async () => {
    const sock = fakeSock({ id: '120363222222222222@newsletter', name: 'Q' });
    const message = { key: msg.key, message: { extendedTextMessage: { contextInfo: { quotedMessage: { conversation: `voici ${LINK}` } } } } };
    await idch(sock, '1@g.us', message, '');
    assert.match(sock.sent[0].text, /120363222222222222@newsletter/);
});

test('sans lien : aide ; chaîne introuvable : message clair', async () => {
    const none = fakeSock({});
    await idch(none, '1@g.us', msg, '');
    assert.match(none.sent[0].text, /\.idch/);
    assert.equal(none.calls.length, 0);
    const bad = fakeSock(new Error('not found'));
    await idch(bad, '1@g.us', msg, LINK);
    assert.match(bad.sent[0].text, /INTROUVABLE/);
});
