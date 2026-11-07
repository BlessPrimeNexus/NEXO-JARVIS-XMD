'use strict';
process.env.NEXO_FANCY_FONT = '0';   // les tests lisent le texte en lettres normales (la police monospace est testée à part)

process.env.MESSAGE_LOG_FILE = require('node:path').join(require('node:os').tmpdir(), `nexo-log-${process.pid}.json`);

const test = require('node:test');
const assert = require('node:assert/strict');
const messageLog = require('../lib/messageLog');
const deleteCommand = require('../commands/delete');

const G = '1@g.us';
const ADMIN = '243111111111@s.whatsapp.net';
const MEMBER_A = '243222222222@s.whatsapp.net';
const MEMBER_B = '243333333333@s.whatsapp.net';

function seed() {
    messageLog._reset();
    // du plus ancien au plus récent : A1 B1 A2 B2 A3 B3 A4
    ['A1', 'B1', 'A2', 'B2', 'A3', 'B3', 'A4'].forEach((id, index) => {
        messageLog.record(G, { key: { id, remoteJid: G, participant: id[0] === 'A' ? MEMBER_A : MEMBER_B, fromMe: false }, message: { conversation: id }, messageTimestamp: 100 + index });
    });
}

function setup({ admin = true, botAdmin = true, text, ctx } = {}) {
    const deleted = [];
    const sent = [];
    const sock = {
        user: { id: '243822993775:1@s.whatsapp.net' },
        groupMetadata: async () => ({ participants: [
            { id: ADMIN, admin: admin ? 'admin' : null },
            { id: MEMBER_A }, { id: MEMBER_B },
            { id: '243822993775@s.whatsapp.net', admin: botAdmin ? 'admin' : null }
        ] }),
        sendMessage: async (jid, content) => { if (content.delete) deleted.push(content.delete.id); else sent.push(content); return {}; }
    };
    const message = {
        key: { remoteJid: G, participant: ADMIN, id: 'CMD', fromMe: false },
        message: { extendedTextMessage: { text, contextInfo: ctx } }
    };
    return { sock, deleted, sent, message };
}

test('refusé pour un non-admin, sans rien supprimer', async () => {
    seed();
    const { sock, deleted, sent, message } = setup({ admin: false, text: '.del 3' });
    await deleteCommand(sock, G, message, ADMIN);
    assert.match(sent[0].text, /ACCÈS REFUSÉ/);
    assert.equal(deleted.length, 0);
});

test('le bot doit être admin', async () => {
    seed();
    const { sock, deleted, sent, message } = setup({ botAdmin: false, text: '.del 3' });
    await deleteCommand(sock, G, message, ADMIN);
    assert.match(sent[0].text, /ADMIN/);
    assert.equal(deleted.length, 0);
});

test('.del 3 : les 3 derniers messages du groupe', async () => {
    seed();
    const { sock, deleted, message } = setup({ text: '.del 3' });
    await deleteCommand(sock, G, message, ADMIN);
    assert.deepEqual(deleted.filter(id => id !== 'CMD'), ['A4', 'B3', 'A3']);
});

test('en réponse à un message : supprime ce message précis', async () => {
    seed();
    const { sock, deleted, message } = setup({ text: '.del', ctx: { stanzaId: 'B2', participant: MEMBER_B } });
    await deleteCommand(sock, G, message, ADMIN);
    assert.deepEqual(deleted.filter(id => id !== 'CMD'), ['B2']);
});

test('.del @membre : tous ses messages (et seulement les siens)', async () => {
    seed();
    const { sock, deleted, message } = setup({ text: '.del @243222222222', ctx: { mentionedJid: [MEMBER_A] } });
    await deleteCommand(sock, G, message, ADMIN);
    assert.deepEqual(deleted.filter(id => id !== 'CMD').sort(), ['A1', 'A2', 'A3', 'A4']);
});

test('.del @membre 2 : ses 2 derniers messages', async () => {
    seed();
    const { sock, deleted, message } = setup({ text: '.del @243222222222 2', ctx: { mentionedJid: [MEMBER_A] } });
    await deleteCommand(sock, G, message, ADMIN);
    assert.deepEqual(deleted.filter(id => id !== 'CMD'), ['A4', 'A3']);
});

test('.del 2 en réponse : les 2 derniers de l\'auteur cité, le message cité en premier', async () => {
    seed();
    const { sock, deleted, message } = setup({ text: '.del 2', ctx: { stanzaId: 'B1', participant: MEMBER_B } });
    await deleteCommand(sock, G, message, ADMIN);
    assert.deepEqual(deleted.filter(id => id !== 'CMD'), ['B1', 'B3']);
});

test('identifiant LID : retrouvé grâce à la liste des participants', async () => {
    messageLog._reset();
    messageLog.record(G, { key: { id: 'L1', remoteJid: G, participant: '77777@lid', fromMe: false }, message: { conversation: 'x' } });
    const { sock, deleted, message } = setup({ text: '.del @243222222222', ctx: { mentionedJid: [MEMBER_A] } });
    const original = sock.groupMetadata;
    sock.groupMetadata = async () => { const m = await original(); m.participants[1] = { id: '77777@lid', phoneNumber: MEMBER_A }; return m; };
    await deleteCommand(sock, G, message, ADMIN);
    assert.deepEqual(deleted.filter(id => id !== 'CMD'), ['L1']);
});

test('aucun message vu : message clair', async () => {
    messageLog._reset();
    const { sock, sent, message } = setup({ text: '.del 5' });
    await deleteCommand(sock, G, message, ADMIN);
    assert.match(sent[0].text, /RIEN À SUPPRIMER/);
});
