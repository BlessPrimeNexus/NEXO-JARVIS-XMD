'use strict';
process.env.NEXO_FANCY_FONT = '0';   // les tests lisent le texte en lettres normales (la police monospace est testée à part)

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const registry = require('../lib/buttonRegistry');
const { selectedInteractiveId } = require('../lib/interactiveReply');
const help = require('../commands/help');
const { parseMenuCommand } = require('../lib/menu-command');

const main = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
const CHAT = '1@g.us';
const flow = (body, params = '{}', stanzaId) => ({ message: { interactiveResponseMessage: { body: { text: body }, nativeFlowResponseMessage: { name: 'quick_reply', paramsJson: params }, contextInfo: stanzaId ? { stanzaId } : undefined } } });

test('clic normal : la commande vient de l\'identifiant du bouton', () => {
    assert.equal(selectedInteractiveId(flow('x', JSON.stringify({ id: '.sessions' }))), '.sessions');
});

test('clic sans identifiant (texte du bouton seul) : retrouvé par les boutons fixes', () => {
    registry._reset();
    assert.equal(registry.resolve(flow('🔄 Actualiser'), CHAT), '.sessions');
    assert.equal(registry.resolve(flow('📜 Tous les menus'), CHAT), '.allmenu');
    assert.equal(registry.resolve({ message: { conversation: '📜 Tous les menus' } }, CHAT), '.allmenu');
});

test('boutons dynamiques : retrouvés par le message cité, puis par la discussion', () => {
    registry._reset();
    registry.register(CHAT, 'MSG1', [{ name: 'quick_reply', params: { display_text: '🗑️ Supprimer', id: '.sessions remove 243111111111' } }]);
    registry.register(CHAT, 'MSG2', [{ name: 'quick_reply', params: { display_text: '🗑️ Supprimer', id: '.sessions remove 243222222222' } }]);
    assert.equal(registry.resolve(flow('🗑️ Supprimer', '{}', 'MSG1'), CHAT), '.sessions remove 243111111111');
    assert.equal(registry.resolve(flow('🗑️ Supprimer', '{}', 'MSG2'), CHAT), '.sessions remove 243222222222');
    assert.equal(registry.resolve(flow('🗑️ Supprimer'), CHAT), '.sessions remove 243222222222');
});

test('lignes de liste : mémorisées par titre', () => {
    registry._reset();
    registry.register(CHAT, 'L1', [{ name: 'single_select', params: { title: 'Ouvrir', sections: [{ rows: [{ title: '👥 GROUPE', id: '.groupmenu' }] }] } }]);
    assert.equal(registry.resolve(flow('👥 GROUPE', '{}', 'L1'), CHAT), '.groupmenu');
});

test('un texte quelconque n\'est jamais pris pour un bouton', () => {
    registry._reset();
    assert.equal(registry.resolve({ message: { conversation: 'salut tout le monde' } }, CHAT), '');
});

test('chaque bouton fixe pointe vers une commande réellement routée', () => {
    for (const command of Object.values(registry.STATIC)) {
        const name = command.split(/\s+/)[0];
        const routed = main.includes(`'${name}'`) || main.includes(`'${name} `) || parseMenuCommand(name, { prefixed: true });
        assert.ok(routed, `${command} n'est pas routée`);
    }
});

test('chaque ligne de liste du menu envoie une commande de menu reconnue', () => {
    for (const menu of help.MENUS) {
        assert.ok(parseMenuCommand(`.${menu.key}menu`, { prefixed: true }), menu.key);
    }
    assert.ok(parseMenuCommand('.allmenu', { prefixed: true }));
    assert.ok(parseMenuCommand('.menu', { prefixed: true }));
});
