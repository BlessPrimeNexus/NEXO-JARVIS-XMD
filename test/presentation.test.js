'use strict';
process.env.NEXO_FANCY_FONT = '0';   // les tests lisent le texte en lettres normales (la police monospace est testée à part)

process.env.DISPLAY_FLAGS_FILE = require('node:path').join(require('node:os').tmpdir(), `nexo-display-${process.pid}.json`);
process.env.CHANNEL_CACHE_FILE = require('node:path').join(require('node:os').tmpdir(), `nexo-channel-${process.pid}.json`);

const test = require('node:test');
const assert = require('node:assert/strict');

const channel = require('../lib/channel');
const presentation = require('../lib/presentation');
const displayFlags = require('../lib/displayFlags');

const GROUP = '120363000000000000@g.us';
const NEW_JID = '120363999999999999@newsletter';
const OLD_JID = '120363426264191950@newsletter';

// Les tests d'aperçu partent du mode « aperçu » ; le mode vraie image a ses propres tests plus bas.
displayFlags.override('imageReply', false);
displayFlags.override('previewImage', false);   // défaut du bot : aperçu coupé (cause d'invisibilité)

function makeSock() {
    const sent = [];
    const sock = presentation.wrapSocket({
        user: { id: '243822993775:5@s.whatsapp.net' },
        sendMessage: async (jid, content, options) => { sent.push({ jid, content, options }); return { key: { id: `ID${sent.length}`, remoteJid: jid, fromMe: true }, message: {} }; },
        relayMessage: async () => ({})
    });
    return { sock, sent };
}

test('la chaîne officielle pointe vers le nouveau lien', () => {
    assert.equal(channel.link(), 'https://whatsapp.com/channel/0029Vb78ycrInlqYocbYLX0P');
    assert.equal(channel.validJid(NEW_JID), true);
    assert.equal(channel.validJid('abc'), false);
});

test('tant que le JID est inconnu, aucun bloc « Voir la chaîne » ne pointe vers l\'ancienne chaîne', async () => {
    channel._reset({});
    const { sock, sent } = makeSock();
    await sock.sendMessage(GROUP, { text: 'a', contextInfo: { forwardedNewsletterMessageInfo: { newsletterJid: OLD_JID } } });
    assert.equal(sent[0].content.contextInfo.forwardedNewsletterMessageInfo, undefined);
});

test('chaque réponse texte reçoit bouton chaîne (JID courant), aperçu intégré et fausse citation', async () => {
    displayFlags.override('previewImage', true);
    channel._reset({ jid: NEW_JID, name: 'NEXO' });
    const { sock, sent } = makeSock();
    await sock.sendMessage(GROUP, { text: 'bonjour', contextInfo: { forwardedNewsletterMessageInfo: { newsletterJid: OLD_JID } } });
    const { contextInfo } = sent[0].content;
    assert.equal(contextInfo.forwardedNewsletterMessageInfo.newsletterJid, NEW_JID);
    assert.equal(contextInfo.isForwarded, true);
    const ad = contextInfo.externalAdReply;
    assert.ok(ad, 'aperçu présent');
    assert.ok(Buffer.isBuffer(ad.thumbnail) && ad.thumbnail.length > 0 && ad.thumbnail.length <= presentation.THUMB_MAX_BYTES);
    assert.equal(ad.thumbnailUrl, undefined, 'aucun lien distant à télécharger côté membre');
    assert.equal(ad.mediaUrl, undefined);
    assert.equal(ad.sourceUrl, channel.link());
    assert.ok(sent[0].options && sent[0].options.quoted, 'fausse citation');
    displayFlags.override('previewImage', false);
});

test('un aperçu fourni par une commande perd son lien distant', async () => {
    displayFlags.override('previewImage', true);
    channel._reset({ jid: NEW_JID });
    const { sock, sent } = makeSock();
    await sock.sendMessage(GROUP, { text: 'x', contextInfo: { externalAdReply: { title: 'Perso', thumbnailUrl: 'https://files.catbox.moe/a.jpg', mediaUrl: 'https://x.test' } } });
    const ad = sent[0].content.contextInfo.externalAdReply;
    assert.equal(ad.title, 'Perso');
    assert.equal(ad.thumbnailUrl, undefined);
    assert.equal(ad.mediaUrl, undefined);
    assert.ok(ad.thumbnail);
    displayFlags.override('previewImage', false);
});

test('.preview off retire l\'aperçu mais garde chaîne et citation', async () => {
    channel._reset({ jid: NEW_JID });
    displayFlags.override('previewImage', false);
    const { sock, sent } = makeSock();
    await sock.sendMessage(GROUP, { text: 'x' });
    assert.equal(sent[0].content.contextInfo.externalAdReply, undefined);
    assert.equal(sent[0].content.contextInfo.forwardedNewsletterMessageInfo.newsletterJid, NEW_JID);
    assert.ok(sent[0].options.quoted);
});

test('réactions, statuts et chaînes ne sont jamais décorés', async () => {
    const { sock, sent } = makeSock();
    await sock.sendMessage(GROUP, { react: { text: '✅', key: {} } });
    await sock.sendMessage('status@broadcast', { text: 'x' });
    assert.equal(sent[0].content.contextInfo, undefined);
    assert.equal(sent[1].content.contextInfo, undefined);
});

test('les anciens boutons WhatsApp sont retirés (messages invisibles sur beaucoup de téléphones)', async () => {
    const { sock, sent } = makeSock();
    await sock.sendMessage(GROUP, { text: 'x', buttons: [{ buttonId: '1' }], headerType: 1 });
    assert.equal(sent[0].content.buttons, undefined);
});

test('la rotation d\'images ne répète jamais la même image deux fois de suite', () => {
    const items = ['a', 'b', 'c', 'd'];
    const rotator = presentation.createRotator(items);
    let previous = null;
    for (let i = 0; i < 200; i += 1) {
        const value = rotator.next();
        assert.notEqual(value, previous);
        previous = value;
    }
});

test('toutes les images du dossier donnent une miniature légère', async () => {
    for (const file of presentation.localImages()) {
        const thumb = await presentation.loadThumbnail(file);
        assert.ok(thumb.length <= presentation.THUMB_MAX_BYTES, `${file} : ${thumb.length} octets`);
    }
});

test('mode vraie image : la réponse part comme photo + légende encadrée', async () => {
    channel._reset({ jid: NEW_JID });
    displayFlags.override('imageReply', true);
    try {
        const { sock, sent } = makeSock();
        await sock.sendMessage(GROUP, { text: 'bonjour' });
        const content = sent[0].content;
        assert.ok(Buffer.isBuffer(content.image) && content.image.length > 1000);
        assert.equal(content.text, undefined);
        assert.match(content.caption, /✦『 🤖 .+ 』✦/);
        assert.match(content.caption, /\n  bonjour\n/);
        assert.equal(content.contextInfo.forwardedNewsletterMessageInfo.newsletterJid, NEW_JID);
        assert.ok(sent[0].options.quoted);
    } finally {
        displayFlags.override('imageReply', false);
    }
});

test('mode vraie image : un message « modifiable » (barre de progression) reste un VRAI texte, et sa modification a le même style', async () => {
    displayFlags.override('imageReply', true);
    try {
        const { sock, sent } = makeSock();
        await sock.sendMessage(GROUP, { text: 'Téléchargement', __edittext: true, __noframe: true });
        const content = sent[0].content;
        assert.equal(content.image, undefined, 'jamais converti en photo : WhatsApp ne peut pas modifier une photo avec du texte');
        assert.equal(typeof content.text, 'string');
        assert.equal(content.contextInfo.externalAdReply, undefined);
        assert.equal(content.__edittext, undefined, 'le drapeau interne n\'est jamais envoyé');
        const edited = await presentation.formatEditText('Téléchargement');
        assert.equal(edited, content.text, 'même traduction et même police que le message d\'origine');
    } finally {
        displayFlags.override('imageReply', false);
    }
});

test('mode vraie image : un texte trop long reste un texte (légende limitée)', async () => {
    displayFlags.override('imageReply', true);
    try {
        const { sock, sent } = makeSock();
        await sock.sendMessage(GROUP, { text: 'x'.repeat(1500) });
        assert.equal(sent[0].content.image, undefined);
        assert.equal(typeof sent[0].content.text, 'string');
    } finally {
        displayFlags.override('imageReply', false);
    }
});

test('cadre automatique : texte brut encadré, texte déjà mis en forme / à copier / conversationnel intact', async () => {
    const { sock, sent } = makeSock();
    await sock.sendMessage(GROUP, { text: '❌ Erreur\nRéessayez.' });
    await sock.sendMessage(GROUP, { text: '✦『 DÉJÀ 』✦\n  ◇ ok → oui\n  ✦ ──────────────── ✦' });
    await sock.sendMessage(GROUP, { text: '```secret```' });
    await sock.sendMessage(GROUP, { text: 'réponse IA', __plain: true });
    assert.match(sent[0].content.text, /^✦『 🤖 .+ 』✦\n  ❌ Erreur\n  Réessayez\.\n  ✦ ─+ ✦$/);
    assert.equal(sent[1].content.text, '✦『 DÉJÀ 』✦\n  ◇ ok → oui\n  ✦ ──────────────── ✦');
    assert.equal(sent[2].content.text, '```secret```');
    assert.equal(sent[3].content.text, 'réponse IA');
    assert.equal(sent[3].content.__plain, undefined);
});

test('les anciens cadres (┃⌬┃, ╭━⌜…⌟) sont convertis dans le design unique', async () => {
    const { sock, sent } = makeSock();
    await sock.sendMessage(GROUP, { text: '╭━━━━⌜SUDO⌟\n┃⌬┃ 👑 Gestion\n┃⌬┃\n┃⌬┃ ➕ ajouter\n╰━━━━━━━━❍' });
    assert.equal(sent[0].content.text, '✦『 SUDO 』✦\n  👑 Gestion\n\n  ➕ ajouter\n  ✦ ──────────────── ✦');
});

test('filet de sécurité : si l\'image est refusée (ex. groupe), la réponse repart en texte', async () => {
    displayFlags.override('imageReply', true);
    const calls = [];
    const sock = presentation.wrapSocket({
        user: { id: '1:1@s.whatsapp.net' },
        sendMessage: async (jid, content, options) => {
            calls.push(content);
            if (content.image) throw new Error('upload refusé');
            return { key: { id: 'OK', remoteJid: jid, fromMe: true }, message: {} };
        }
    });
    try {
        const result = await sock.sendMessage(GROUP, { text: 'ping' });
        assert.equal(result.key.id, 'OK');
        assert.equal(calls.length, 2);
        assert.equal(calls[1].image, undefined);
        assert.match(calls[1].text, /ping/);
        assert.equal(calls[1].contextInfo.externalAdReply, undefined);
    } finally {
        displayFlags.override('imageReply', false);
    }
});

test('par défaut : AUCUN aperçu (externalAdReply), même si une commande en fournit un', async () => {
    channel._reset({ jid: NEW_JID });
    const { sock, sent } = makeSock();
    await sock.sendMessage(GROUP, { text: 'x', contextInfo: { externalAdReply: { title: 'Perso', thumbnailUrl: 'https://x.test/a.jpg' } } });
    assert.equal(sent[0].content.contextInfo.externalAdReply, undefined);
    assert.equal(sent[0].content.contextInfo.forwardedNewsletterMessageInfo.newsletterJid, NEW_JID);
    assert.equal(presentation.decorateContextInfo({ externalAdReply: { title: 'x' } }).externalAdReply, undefined);
});

test('clés de groupe : réinitialisées au premier envoi puis au plus une fois par heure', async () => {
    const writes = [];
    const sock = presentation.wrapSocket({
        user: { id: '243822993775:5@s.whatsapp.net' },
        authState: { keys: { set: async (data) => { writes.push(data); } } },
        sendMessage: async (jid) => ({ key: { id: 'X', remoteJid: jid, fromMe: true }, message: {} }),
        relayMessage: async () => ({})
    });
    await sock.sendMessage('777@g.us', { text: 'a' });
    await sock.sendMessage('777@g.us', { text: 'b' });
    await sock.sendMessage('888@g.us', { text: 'c' });
    await sock.sendMessage('243900000000@s.whatsapp.net', { text: 'privé : jamais' });
    assert.deepEqual(writes, [{ 'sender-key-memory': { '777@g.us': null } }, { 'sender-key-memory': { '888@g.us': null } }]);
    assert.equal(await presentation.healSenderKeys(sock, '777@g.us', { force: true }), true);
    assert.equal(writes.length, 3);
});

test('vers une chaîne (@newsletter) : le message part tel quel, sans citation, transfert, aperçu ni traduction', async () => {
    const { sock, sent } = makeSock();
    await sock.sendMessage('120363555555555555@newsletter', { text: 'Publication propre' });
    assert.deepEqual(sent[0].content, { text: 'Publication propre' });
    assert.equal(sent[0].options, undefined);
});
