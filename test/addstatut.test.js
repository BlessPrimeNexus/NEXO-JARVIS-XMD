'use strict';
process.env.NEXO_FANCY_FONT = '0';   // les tests lisent le texte en lettres normales (la police monospace est testée à part)

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

// Faux Baileys : on vérifie la construction du message, pas l'envoi réel.
let supported = true;
const fakeBaileys = {
    proto: { Message: { fromObject: (o) => (supported ? o : {}) } },
    generateWAMessageContent: async (content) => ({ extendedTextMessage: { text: content.text }, _content: content }),
    generateWAMessageFromContent: (jid, content) => ({ key: { id: 'WAID' }, message: content }),
    downloadContentFromMessage: async () => (async function* () { yield Buffer.from('abc'); })()
};
const baileysPath = path.join(__dirname, '..', 'node_modules', '@whiskeysockets', 'baileys');
require('node:module')._load; // (le faux module est injecté via le cache ci-dessous)
const Module = require('node:module');
const originalLoad = Module._load;
Module._load = function (request, ...rest) {
    if (request === '@whiskeysockets/baileys') return fakeBaileys;
    return originalLoad.call(this, request, ...rest);
};

const addStatut = require('../commands/addstatut');
const OWNER = '243802506198@s.whatsapp.net';
const G = '1@g.us';

function setup({ admin = false, owner = false } = {}) {
    const sent = [];
    const relayed = [];
    const sock = {
        user: { id: '243822993775:1@s.whatsapp.net' },
        waUploadToServer: async () => ({}),
        relayMessage: async (jid, message, opts) => { relayed.push({ jid, message, opts }); },
        sendMessage: async (jid, content) => { sent.push(content); return {}; },
        groupMetadata: async () => ({ participants: [{ id: '243111111111@s.whatsapp.net', admin: admin ? 'admin' : null }] })
    };
    const message = {
        key: { remoteJid: G, participant: owner ? OWNER : '243111111111@s.whatsapp.net', fromMe: false },
        message: { conversation: '.addstatut Bonjour' }
    };
    return { sock, sent, relayed, message };
}

test('refusé hors groupe', async () => {
    const { sock, sent, message } = setup();
    await addStatut(sock, '243111111111@s.whatsapp.net', message, 'Salut');
    assert.match(sent[0].text, /uniquement dans un groupe/);
});

test('refusé pour un membre qui n\'est pas admin', async () => {
    const { sock, sent, relayed, message } = setup({ admin: false });
    await addStatut(sock, G, message, 'Salut');
    assert.match(sent[0].text, /ACCÈS REFUSÉ/);
    assert.equal(relayed.length, 0);
});

test('un admin publie un statut texte (groupStatusMessageV2)', async () => {
    const { sock, sent, relayed, message } = setup({ admin: true });
    await addStatut(sock, G, message, 'Bonjour tout le monde');
    assert.equal(relayed.length, 1);
    const content = relayed[0].message;
    assert.ok(content.groupStatusMessageV2.message.extendedTextMessage);
    assert.equal(content.groupStatusMessageV2.message.extendedTextMessage.text, 'Bonjour tout le monde');
    assert.ok(Buffer.isBuffer(content.messageContextInfo.messageSecret));
    assert.match(sent[0].text, /STATUT PUBLIÉ/);
});

test('le propriétaire peut aussi publier', async () => {
    const { sock, relayed, message } = setup({ owner: true });
    await addStatut(sock, G, message, 'Hello');
    assert.equal(relayed.length, 1);
});

test('sans contenu : aide, rien n\'est publié', async () => {
    const { sock, sent, relayed, message } = setup({ admin: true });
    message.message = { conversation: '.addstatut' };
    await addStatut(sock, G, message, '');
    assert.match(sent[0].text, /\.addstatut/);
    assert.equal(relayed.length, 0);
});

test('une image citée est publiée avec la légende donnée', async () => {
    const { sock, relayed, message } = setup({ admin: true });
    message.message = { extendedTextMessage: { text: '.addstatut Ma légende', contextInfo: { quotedMessage: { imageMessage: { caption: 'ancienne' } } } } };
    await addStatut(sock, G, message, 'Ma légende');
    const inside = relayed[0].message.groupStatusMessageV2.message;
    assert.equal(inside._content.caption, 'Ma légende');
    assert.ok(Buffer.isBuffer(inside._content.image));
});

test('Baileys trop ancien : message clair, rien d\'envoyé', async () => {
    supported = false;
    try {
        const { sock, sent, relayed, message } = setup({ admin: true });
        await addStatut(sock, G, message, 'Salut');
        assert.match(sent[0].text, /NON SUPPORTÉ/);
        assert.equal(relayed.length, 0);
    } finally {
        supported = true;
    }
});

test('média : visible pour la détection de type de Baileys, invisible pour l\'encodage', () => {
    const inside = { imageMessage: { mimetype: 'image/jpeg' } };
    const message = { groupStatusMessageV2: { message: inside } };
    const proxied = addStatut.exposeMediaType(message, inside);

    function getMediaType(m) { return m.imageMessage ? 'image' : ''; }   // même nom que la fonction de Baileys
    function encode(m) { return m.imageMessage != null || Object.prototype.hasOwnProperty.call(m, 'imageMessage'); }

    assert.equal(getMediaType(proxied), 'image');
    assert.equal(encode(proxied), false, 'le média ne doit jamais partir à la racine');
    assert.equal(JSON.stringify(proxied).includes('imageMessage":{"mimetype'), true);   // contenu emballé conservé
    assert.deepEqual(Object.keys(proxied), ['groupStatusMessageV2']);
    assert.equal(addStatut.exposeMediaType(message, { extendedTextMessage: {} }), message, 'texte : message inchangé');
});

/* ── Suppression des messages de commande après publication ── */

function setupAdmin({ botAdmin = true, fromMe = false } = {}) {
    const sent = [];
    const relayed = [];
    const sock = {
        user: { id: '243822993775:1@s.whatsapp.net' },
        waUploadToServer: async () => ({}),
        relayMessage: async (jid, message) => { relayed.push(message); },
        sendMessage: async (jid, content) => { sent.push({ jid, content }); return {}; },
        groupMetadata: async () => ({ participants: [
            { id: '243111111111@s.whatsapp.net', admin: 'admin' },
            { id: '243444444444@s.whatsapp.net' },
            { id: '243822993775@s.whatsapp.net', admin: botAdmin ? 'admin' : null }
        ] }),
        newsletterMetadata: async () => ({ id: '120363555555555555@newsletter', viewer_metadata: { role: 'ADMIN' } })
    };
    const message = { key: { remoteJid: G, participant: fromMe ? undefined : '243111111111@s.whatsapp.net', id: 'CMDID', fromMe }, message: { conversation: '.addstatut NEXO-JARVIS is working' } };
    return { sock, sent, relayed, message };
}

test('après la publication : confirmation d\'abord, puis le message de commande est supprimé', async () => {
    const { sock, sent, message } = setupAdmin();
    await addStatut(sock, G, message, 'NEXO-JARVIS is working');
    assert.match(sent[0].content.text, /STATUT PUBLIÉ/);
    const deletion = sent.find(item => item.content.delete);
    assert.ok(deletion, 'la commande doit être supprimée');
    assert.equal(deletion.content.delete.id, 'CMDID');
    assert.ok(sent.indexOf(deletion) > 0, 'suppression APRÈS la confirmation');
});

test('vidéo + légende .addstatut : le message qui porte la vidéo disparaît (la vidéo ne reste pas dans la discussion)', async () => {
    const { sock, sent, relayed, message } = setupAdmin();
    message.message = { videoMessage: { caption: '.addstatut NEXO-JARVIS is working', mimetype: 'video/mp4' } };
    await addStatut(sock, G, message, 'NEXO-JARVIS is working');
    assert.equal(relayed.length, 1);
    assert.ok(sent.some(item => item.content.delete && item.content.delete.id === 'CMDID'));
});

test('réponse à une vidéo envoyée par la même personne : la vidéo aussi est supprimée ; celle d\'un autre membre non', async () => {
    const same = setupAdmin();
    same.message.message = { extendedTextMessage: { text: '.addstatut ok', contextInfo: { stanzaId: 'VID1', participant: '243111111111@s.whatsapp.net', quotedMessage: { videoMessage: { mimetype: 'video/mp4' } } } } };
    await addStatut(same.sock, G, same.message, 'ok');
    const ids = same.sent.filter(item => item.content.delete).map(item => item.content.delete.id);
    assert.deepEqual(ids.sort(), ['CMDID', 'VID1']);

    const other = setupAdmin();
    other.message.message = { extendedTextMessage: { text: '.addstatut ok', contextInfo: { stanzaId: 'VID2', participant: '243444444444@s.whatsapp.net', quotedMessage: { videoMessage: { mimetype: 'video/mp4' } } } } };
    await addStatut(other.sock, G, other.message, 'ok');
    const otherIds = other.sent.filter(item => item.content.delete).map(item => item.content.delete.id);
    assert.deepEqual(otherIds, ['CMDID'], 'le message d\'un autre membre n\'est pas touché');
});

test('bot pas admin : rien n\'est supprimé et le membre est prévenu', async () => {
    const { sock, sent, message } = setupAdmin({ botAdmin: false });
    await addStatut(sock, G, message, 'Salut');
    assert.equal(sent.some(item => item.content.delete), false);
    assert.ok(sent.some(item => /MÉDIA TOUJOURS VISIBLE/.test(item.content.text || '')));
});

test('commande envoyée depuis le compte du bot (fromMe) : suppression possible sans être admin', async () => {
    const { sock, sent, message } = setupAdmin({ botAdmin: false, fromMe: true });
    await addStatut(sock, G, message, 'Salut');
    assert.ok(sent.some(item => item.content.delete && item.content.delete.id === 'CMDID'));
});

test('échec de publication : la commande n\'est PAS supprimée', async () => {
    const { sock, sent, message } = setupAdmin();
    sock.relayMessage = async () => { throw new Error('refusé'); };
    await addStatut(sock, G, message, 'Salut');
    assert.equal(sent.some(item => item.content.delete), false);
    assert.ok(sent.some(item => /ÉCHEC/.test(item.content.text || '')));
});



