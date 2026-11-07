'use strict';
process.env.NEXO_FANCY_FONT = '0';   // les tests lisent le texte en lettres normales (la police monospace est testée à part)

const test = require('node:test');
const assert = require('node:assert/strict');
const { isOwnerMessage, isPlatformOwnerMessage, ownerNumbers } = require('../lib/ownerAuth');

const OWNER = '243802506198';
const BOT = '243822993775';
const sockOf = (number, extra = {}) => ({ user: { id: `${number}:7@s.whatsapp.net` }, ...extra });

test('les deux numéros configurés sont propriétaires', () => {
    const set = ownerNumbers();
    assert.ok(set.has(OWNER) && set.has(BOT));
});

test('le propriétaire écrit en privé (numéro classique)', async () => {
    const message = { key: { remoteJid: `${OWNER}@s.whatsapp.net`, fromMe: false } };
    assert.equal(await isOwnerMessage(sockOf(BOT), message, message.key.remoteJid), true);
});

test('le propriétaire écrit en groupe', async () => {
    const message = { key: { remoteJid: '1@g.us', participant: `${OWNER}@s.whatsapp.net`, fromMe: false } };
    assert.equal(await isOwnerMessage(sockOf(BOT), message, '1@g.us'), true);
});

test('le numéro du bot connecté écrit depuis son propre compte (fromMe)', async () => {
    const message = { key: { remoteJid: '1@g.us', fromMe: true } };
    assert.equal(await isOwnerMessage(sockOf(BOT), message, '1@g.us'), true);
});

test('LID en groupe : traduit via participantAlt', async () => {
    const message = { key: { remoteJid: '1@g.us', participant: '99999999@lid', participantAlt: `${OWNER}@s.whatsapp.net`, fromMe: false } };
    assert.equal(await isOwnerMessage(sockOf(BOT), message, '1@g.us'), true);
});

test('LID en groupe : traduit via la table de correspondance de Baileys', async () => {
    const sock = sockOf(BOT, { signalRepository: { lidMapping: { getPNForLID: async () => `${OWNER}:0@s.whatsapp.net` } } });
    const message = { key: { remoteJid: '1@g.us', participant: '99999999@lid', fromMe: false } };
    assert.equal(await isOwnerMessage(sock, message, '1@g.us'), true);
});

test('LID en groupe : traduit via la liste des participants', async () => {
    const sock = sockOf(BOT, { groupMetadata: async () => ({ participants: [{ id: '99999999@lid', phoneNumber: `${OWNER}@s.whatsapp.net` }] }) });
    const message = { key: { remoteJid: '1@g.us', participant: '99999999@lid', fromMe: false } };
    assert.equal(await isOwnerMessage(sock, message, '1@g.us'), true);
});

test('un inconnu est refusé, même avec un LID', async () => {
    const message = { key: { remoteJid: '1@g.us', participant: '12345678@lid', fromMe: false } };
    assert.equal(await isOwnerMessage(sockOf(BOT), message, '1@g.us'), false);
    const dm = { key: { remoteJid: '243999999999@s.whatsapp.net', fromMe: false } };
    assert.equal(await isOwnerMessage(sockOf(BOT), dm, dm.key.remoteJid), false);
});

test('le compte d\'une AUTRE session connectée (fromMe) est propriétaire de SON bot, pas de la plateforme', async () => {
    const message = { key: { remoteJid: '1@g.us', fromMe: true } };
    assert.equal(await isOwnerMessage(sockOf('243777777777'), message, '1@g.us'), true);
    assert.equal(await isPlatformOwnerMessage(sockOf('243777777777'), message, '1@g.us'), false);
});

test('un numéro qui ressemble au propriétaire mais n\'est pas le même est refusé', async () => {
    const message = { key: { remoteJid: '1@g.us', participant: '2438025061980@s.whatsapp.net', fromMe: false } };
    assert.equal(await isOwnerMessage(sockOf(BOT), message, '1@g.us'), false);
});
