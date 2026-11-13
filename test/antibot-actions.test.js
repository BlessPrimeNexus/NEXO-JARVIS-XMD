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

test('wrapSock : une erreur garde la navigation seulement (pas les réglages)', async () => {
    const sent = [];
    const sock = { user: { id: '1:1@s.whatsapp.net' }, waUploadToServer: async () => ({}), relayMessage: async (j, m) => { sent.push(JSON.stringify(m)); return 'ok'; }, sendMessage: async () => ({}) };
    const wrapped = actions.wrapSock(sock, { chatId: GROUP, message: msg('X'), command: 'antibot' });
    await wrapped.sendMessage(GROUP, { text: '❌ Accès réservé aux administrateurs' });
    assert.equal(sent.length, 1);
    assert.match(sent[0], /Accès réservé/);
    assert.ok(!/antibot on/.test(sent[0]), 'pas d\'options de réglage sur un refus');
    assert.match(sent[0], /\.antimenu/);
    assert.equal(actions.specFor('ping'), null);
});

/* ── Boutons sur TOUTES les réponses ── */
const interactiveSock = () => {
    const out = []; let n = 0;
    return { out, user: { id: '1:1@s.whatsapp.net' }, waUploadToServer: async () => ({}),
        relayMessage: async (jid, m) => { out.push({ kind: 'relay', m }); return 'ok'; },
        sendMessage: async (jid, content) => { out.push({ kind: 'send', content }); return { key: { id: `K${++n}` } }; } };
};
const rowIds = entry => JSON.stringify(entry.m).match(/\.[a-z0-9]+(?: [a-z0-9]+)*(?=\\")/gi) || [];

test('toute commande a des actions : relancer + commandes de sa catégorie + menu de la catégorie + menu principal', () => {
    const joke = actions.optionsFor('joke', '');
    const cmds = joke.options.map(o => o.cmd);
    assert.ok(cmds.includes('joke'), 'relancer');
    assert.ok(cmds.includes('fact') && cmds.includes('quote'), 'commandes voisines (divertissement)');
    assert.ok(cmds.includes('funmenu'), 'menu de la catégorie');
    assert.equal(cmds.at(-1), 'menu');
    const weather = actions.optionsFor('weather', 'Kinshasa');
    assert.ok(weather.options.some(o => o.cmd === 'weather Kinshasa'), 'relance avec les mêmes arguments');
    assert.ok(weather.options.some(o => o.cmd === 'forecast'));
});

test('commandes sensibles : jamais de bouton « Relancer » (kick, ban, gamble…)', () => {
    for (const command of ['kick', 'ban', 'promote', 'gamble', 'transfer', 'restart', 'delete']) {
        const options = actions.optionsFor(command, '@user 100').options;
        assert.ok(!options.some(o => /Relancer/.test(o.label)), command);
    }
});

test('toute commande du menu obtient au moins 2 actions (menu catégorie + menu principal)', () => {
    const help = require('../commands/help');
    for (const menu of help.MENUS) for (const command of menu.commands) {
        const { options } = actions.optionsFor(command, '');
        assert.ok(options.length >= 2, command);
        assert.ok(options.every(o => !o.cmd.startsWith('.') && o.cmd.length < 190), command);
    }
});

test('réponse texte d\'une commande SANS réglage (ex. .joke) : message à boutons natifs', async () => {
    const sock = interactiveSock();
    const wrapped = actions.wrapSock(sock, { chatId: GROUP, message: msg('X'), command: 'joke', args: '' });
    await wrapped.sendMessage(GROUP, { text: 'Pourquoi les plongeurs plongent-ils en arrière ?' });
    const flow = JSON.stringify(sock.out[0].m);
    assert.equal(sock.out[0].kind, 'relay');
    assert.match(flow, /Pourquoi les plongeurs/);
    assert.match(flow, /\.fact/); assert.match(flow, /\.funmenu/); assert.match(flow, /\.menu/);
});

test('réponse photo / vidéo légendée : les boutons sont attachés au même message (en-tête média)', async () => {
    const sock = interactiveSock();
    const w1 = actions.wrapSock(sock, { chatId: GROUP, message: msg('X'), command: 'meme' });
    await w1.sendMessage(GROUP, { image: Buffer.alloc(3000, 1), caption: 'Voici un mème' });
    assert.match(JSON.stringify(sock.out[0].m), /Voici un mème/);
    assert.match(JSON.stringify(sock.out[0].m), /single_select/);
    const w2 = actions.wrapSock(sock, { chatId: GROUP, message: msg('X'), command: 'gif' });
    await w2.sendMessage(GROUP, { video: Buffer.alloc(3000, 1), caption: 'Un clip' });
    assert.equal(sock.out[1].kind, 'relay');
});

test('audio, sticker, document, réaction, suppression, modification : jamais transformés', async () => {
    const sock = interactiveSock();
    const w = actions.wrapSock(sock, { chatId: GROUP, message: msg('X'), command: 'joke' });
    for (const content of [{ audio: Buffer.alloc(10) }, { sticker: Buffer.alloc(10) }, { document: Buffer.alloc(10), caption: 'doc' },
        { react: { text: '👍', key: {} } }, { delete: { id: 'x' } }, { text: 'barre', edit: { id: 'y' } }, { text: 'progression', __edittext: true }]) {
        await w.sendMessage(GROUP, content);
    }
    assert.ok(sock.out.every(o => o.kind === 'send'), 'tout est parti normalement');
});

test('une seule réponse par commande reçoit les boutons ; les menus et la progression en sont exclus', async () => {
    const sock = interactiveSock();
    const w = actions.wrapSock(sock, { chatId: GROUP, message: msg('X'), command: 'joke' });
    await w.sendMessage(GROUP, { text: 'première' });
    await w.sendMessage(GROUP, { text: 'seconde' });
    assert.deepEqual(sock.out.map(o => o.kind), ['relay', 'send']);
    assert.equal(actions.wrapSock(sock, { chatId: GROUP, message: msg('X'), command: 'ytdl' }), sock);
    assert.equal(actions.wrapSock(sock, { chatId: GROUP, message: msg('X'), command: 'menu' }), sock);
});

test('une réponse d\'erreur garde seulement la navigation (pas les réglages de la commande)', () => {
    const { options } = actions.optionsFor('antilink', '', { denial: true });
    assert.deepEqual(options.map(o => o.cmd), ['antimenu', 'menu']);
});
