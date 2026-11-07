'use strict';
process.env.NEXO_FANCY_FONT = '0';   // les tests lisent le texte en lettres normales (la police monospace est testée à part)

const test = require('node:test');
const assert = require('node:assert/strict');
const fixGroup = require('../commands/fixgroup');
const presentation = require('../lib/presentation');

const G = '55@g.us';
function setup(admin) {
    const sent = [];
    const writes = [];
    const sock = presentation.wrapSocket({
        user: { id: '243822993775:1@s.whatsapp.net' },
        authState: { keys: { set: async (data) => { writes.push(data); } } },
        groupMetadata: async () => ({ participants: [{ id: '243111111111@s.whatsapp.net', admin: admin ? 'admin' : null }, { id: '243822993775@s.whatsapp.net', admin: 'admin' }] }),
        sendMessage: async (jid, content) => { sent.push(content); return { key: { id: 'Z', remoteJid: jid, fromMe: true }, message: {} }; },
        relayMessage: async () => ({})
    });
    const message = { key: { remoteJid: G, participant: '243111111111@s.whatsapp.net', fromMe: false } };
    return { sock, sent, writes, message };
}

test('un membre simple est refusé', async () => {
    const { sock, sent, writes, message } = setup(false);
    await fixGroup(sock, G, message);
    assert.match(sent[0].text || sent[0].caption, /ACCÈS REFUSÉ/);
    assert.equal(writes.length, 1, 'seule la réinitialisation automatique du premier envoi a eu lieu');
});

test('un admin force la réinitialisation des clés du groupe', async () => {
    const { sock, sent, writes, message } = setup(true);
    await fixGroup(sock, G, message);
    const resets = writes.filter(w => w['sender-key-memory'] && w['sender-key-memory'][G] === null);
    assert.ok(resets.length >= 1);
    assert.match(sent[sent.length - 1].text || sent[sent.length - 1].caption, /CLÉS RÉINITIALISÉES/);
});
