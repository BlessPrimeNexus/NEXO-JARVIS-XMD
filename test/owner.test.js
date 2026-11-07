'use strict';
process.env.NEXO_FANCY_FONT = '0';   // les tests lisent le texte en lettres normales (la police monospace est testée à part)

const test = require('node:test');
const assert = require('node:assert/strict');
const settings = require('../settings');
const owner = require('../commands/owner');
const { cells, WIDTH } = require('../lib/style');

test('la carte du développeur est courte : nom, rôle, contact (liens dans les boutons)', () => {
    const text = owner.ownerCardText();
    assert.match(text, /Développeur/);
    assert.match(text, /\+243 802 506 198/);
    assert.ok(!/https?:\/\//.test(text), 'aucun lien long dans le texte');
    assert.ok(text.split('\n').length <= 14, 'carte courte');
    assert.ok(owner.ownerCardText({ withLinks: true }).includes(`https://wa.me/${settings.ownerNumber}`));
});

test('aucune ligne de la carte ne dépasse la largeur', () => {
    for (const line of owner.ownerCardText().split('\n')) {
        assert.ok(cells(line) <= WIDTH + 4, `ligne trop large (${cells(line)}) : ${line}`);
    }
});

test('la vCard est complète et valide', () => {
    const vcard = owner.ownerVcard();
    assert.match(vcard, /^BEGIN:VCARD\nVERSION:3\.0/);
    assert.match(vcard, new RegExp(`waid=${settings.ownerNumber}:\\+${settings.ownerNumber}`));
    assert.match(vcard, /ORG:/);
    assert.match(vcard, /TITLE:/);
    assert.match(vcard, /END:VCARD$/);
});

test('4 boutons : contacter, chaîne, site, menu', () => {
    const names = owner.ownerButtons().map(b => b.params.display_text);
    assert.equal(names.length, 4);
    assert.ok(names[0].includes('Contacter'));
});

test('.owner n\'envoie QU\'UN message : la carte (texte si boutons indisponibles)', async () => {
    const sent = [];
    const sock = { sendMessage: async (jid, content) => { sent.push(content); return {}; } };
    await owner(sock, '1@g.us', { key: { remoteJid: '1@g.us' } });
    assert.equal(sent.length, 1);
    assert.match(sent[0].text, /Développeur/);
});
