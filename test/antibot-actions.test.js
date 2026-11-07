'use strict';
process.env.NEXO_FANCY_FONT = '0';
const os = require('node:os'); const path = require('node:path'); const fs = require('node:fs');
process.env.ANTIBOT_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'antibot-')), 'antibot.json');
const test = require('node:test'); const assert = require('node:assert/strict');

const engine = require('../lib/antibot');
const actions = require('../lib/actions');
const GROUP = '120363000000000001@g.us';

function fakeSock({ botAdmin = true, senderAdmin = false } = {}) {
    const sent = []; const kicked = [];
    return {
        sent, kicked,
        user: { id: '111111:5@s.whatsapp.net' },
        sendMessage: async (jid, content, opts) => { sent.push({ jid, content, opts }); return {}; },
        groupParticipantsUpdate: async (jid, list, act) => { kicked.push({ list, act }); },
        groupMetadata: async () => ({ participants: [
            { id: '111111@s.whatsapp.net', admin: botAdmin ? 'admin' : null },
            { id: '222222@s.whatsapp.net', admin: senderAdmin ? 'admin' : null }
        ] })
    };
}
const msg = (id, content = { conversation: 'salut' }, extra = {}) => ({ key: { id, remoteJid: GROUP, participant: '222222@s.whatsapp.net', fromMe: false, ...extra }, message: content });

test('détection : ID Baileys, boutons natifs, humain', () => {
    assert.ok(engine.detectBotMessage(msg('BAE5ABCDEF123456')));
    assert.ok(engine.detectBotMessage(msg('3EB0ABCD1234', { conversation: 'x' })));
    assert.ok(engine.detectBotMessage(msg('ABCDEF', { interactiveMessage: {} })));
    assert.equal(engine.detectBotMessage(msg('3EB0A1B2C3D4E5F6A7B8C9', { conversation: 'hello' })), '');
    assert.equal(engine.detectBotMessage(msg('BAE5ABCDEF123456', {}, { fromMe: true })), '');
});

test('antibot désactivé : rien ne se passe ; activé : le message du bot est supprimé', async () => {
    const sock = fakeSock();
    const m = msg('BAE5ABCDEF123456');
    assert.equal(await engine.handleAntibot(sock, GROUP, m, m.key.participant), false);
    engine.setConfig(GROUP, { enabled: true });
    assert.equal(await engine.handleAntibot(sock, GROUP, m, m.key.participant), true);
    assert.ok(sock.sent.some(s => s.content.delete && s.content.delete.id === 'BAE5ABCDEF123456'));
});

test('antibot : un bot connu est bloqué même en texte simple ; le propriétaire jamais', async () => {
    const sock = fakeSock();
    const plain = msg('3EB0A1B2C3D4E5F6A7B8C9');
    assert.equal(await engine.handleAntibot(sock, GROUP, plain, plain.key.participant), true, 'appris au premier message');
    assert.equal(await engine.handleAntibot(sock, GROUP, plain, plain.key.participant, { senderIsOwnerOrSudo: true }), false);
});

test('antibot mode kick : retire le bot', async () => {
    const sock = fakeSock();
    engine.setConfig(GROUP, { enabled: true, action: 'kick' });
    const m = msg('BAE5ABCDEF123456');
    await engine.handleAntibot(sock, GROUP, m, m.key.participant);
    assert.deepEqual(sock.kicked[0], { list: ['222222@s.whatsapp.net'], act: 'remove' });
});

test('antibot sans droits admin : prévient une fois au lieu de ne rien dire', async () => {
    const sock = fakeSock({ botAdmin: false });
    engine.setConfig(GROUP, { enabled: true, action: 'delete' });
    const m = msg('BAE5ABCDEF123456');
    assert.equal(await engine.handleAntibot(sock, GROUP, m, m.key.participant), true);
    assert.ok(sock.sent.some(s => /pas administrateur/.test(s.content.text)));
    assert.ok(!sock.sent.some(s => s.content.delete));
});

test('ID Baileys étranger : jamais traité comme commande', () => {
    assert.equal(engine.isForeignBaileysId(msg('BAE5ABCDEF123456')), true);
    assert.equal(engine.isForeignBaileysId(msg('BAE5ABCDEF123456', {}, { fromMe: true })), false);
});

test('boutons d\'action : spec, refus sans boutons, liste en lignes', () => {
    assert.ok(actions.specFor('antilink').options.length >= 2);
    for (const [name, spec] of Object.entries(actions.SPECS)) assert.ok(spec.options.length >= 2, name);
    assert.equal(actions.isDenial('❌ Accès réservé aux administrateurs'), true);
    assert.equal(actions.isDenial('📊 Statut : activé'), false);
    const [button] = actions.buildButtons(actions.specFor('antibot'), '.');
    assert.equal(button.name, 'single_select');
    assert.equal(button.params.sections[0].rows[0].id, '.antibot on');
});

test('wrapSock : le texte d\'une commande à options part avec le bouton Actions, une erreur reste un texte', async () => {
    const sent = [];
    const sock = { sendMessage: async (jid, content) => { sent.push(content); return {}; }, relayMessage: async () => ({}) };
    const wrapped = actions.wrapSock(sock, { chatId: GROUP, message: msg('X'), command: 'antibot' });
    await wrapped.sendMessage(GROUP, { text: '❌ Accès réservé aux administrateurs' });
    assert.equal(sent.length, 1);
    assert.equal(sent[0].text, '❌ Accès réservé aux administrateurs');
    assert.equal(actions.specFor('ping'), null);
});
