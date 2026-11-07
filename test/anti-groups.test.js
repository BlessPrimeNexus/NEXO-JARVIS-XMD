'use strict';
process.env.NEXO_FANCY_FONT = '0';
const os = require('node:os'); const path = require('node:path'); const fs = require('node:fs');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'anti-'));
process.env.GROUPANTI_FILE = path.join(dir, 'groupAnti.json');
const test = require('node:test'); const assert = require('node:assert/strict');
const { groupAntiCommand, handleGroupAnti } = require('../commands/groupanti');
const G = '120363000000000002@g.us'; const U = '333333@s.whatsapp.net';

function sock(botAdmin = true) {
    const sent = [];
    return { sent, sendMessage: async (j, c) => { sent.push(c); return {}; },
        groupMetadata: async () => ({ participants: [{ id: '111111@s.whatsapp.net', admin: botAdmin ? 'admin' : null }, { id: U }] }),
        user: { id: '111111:3@s.whatsapp.net' } };
}
const m = (content, id = 'A1') => ({ key: { id, remoteJid: G, participant: U, fromMe: false }, message: content });
const enable = async (s, feature) => groupAntiCommand(s, G, m({ conversation: '.x' }), ['on'], feature, true);

test('antisticker supprime un sticker, antimedia ne supprime pas un sticker', async () => {
    const s = sock(); await enable(s, 'antisticker');
    assert.equal(await handleGroupAnti(s, G, m({ stickerMessage: {} }), U), true);
    assert.ok(s.sent.some(x => x.delete));
});
test('antimedia supprime une image mais pas un message texte', async () => {
    const s = sock(); await enable(s, 'antimedia');
    assert.equal(await handleGroupAnti(s, G, m({ imageMessage: {} }), U), true);
    assert.equal(await handleGroupAnti(s, G, m({ conversation: 'salut' }), U), false);
});
test('antivoice supprime un vocal', async () => {
    const s = sock(); await enable(s, 'antivoice');
    assert.equal(await handleGroupAnti(s, G, m({ audioMessage: { ptt: true } }), U), true);
});
test('antiflood : au-delà de la limite le message est supprimé', async () => {
    const s = sock(); await enable(s, 'antiflood');
    let blocked = 0;
    for (let i = 0; i < 8; i++) if (await handleGroupAnti(s, G, m({ conversation: 'm' + i }, 'F' + i), U)) blocked++;
    assert.ok(blocked >= 1);
});
test('sans droits admin du bot : une alerte explicite, pas de silence', async () => {
    const s = sock(false);
    await handleGroupAnti(s, G, m({ stickerMessage: {} }), U);
    assert.ok(s.sent.some(x => /pas administrateur/.test(x.text || '')));
});
