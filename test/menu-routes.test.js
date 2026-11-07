'use strict';
process.env.NEXO_FANCY_FONT = '0';   // les tests lisent le texte en lettres normales (la police monospace est testée à part)

// Le menu ne doit lister que des commandes réellement branchées dans main.js (ou groupExtras / utils).
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const help = require('../commands/help');
const { UTILS_COMMANDS } = require('../commands/utils');
const { parseMenuCommand } = require('../lib/menu-command');
const extraCommands = require('../lib/extraCommands');

const main = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
const groupExtras = fs.readFileSync(path.join(__dirname, '..', 'commands', 'groupExtras.js'), 'utf8');

test('chaque commande du menu existe dans le routeur', () => {
    const missing = [];
    for (const command of help.allCommands()) {
        if (UTILS_COMMANDS.includes(command) || extraCommands.has(command)) continue;
        const inMain = main.includes(`'.${command}'`) || main.includes(`'.${command} `) || main.includes(`startsWith('.${command}`);
        const inGroupExtras = new RegExp(`['"]${command}['"]`).test(groupExtras);
        if (!inMain && !inGroupExtras) missing.push(command);
    }
    assert.deepEqual(missing, []);
});

test('chaque catégorie a son raccourci .xxxmenu reconnu', () => {
    for (const menu of help.MENUS) {
        assert.deepEqual(parseMenuCommand(`.${menu.key}menu`, { prefixed: true }), { query: menu.key.toLowerCase() });
        assert.equal(help.findMenu(menu.key), menu);
    }
});

test('le menu principal : présentation « bot multi device » avec bloc INFORMATION BOT', () => {
    const text = help.overviewText({ user: 'tetsu', prefix: '.' });
    assert.match(text, /^🌐 \*BOT WHATSAPP MULTI-APPAREILS\*/);
    assert.match(text, /(Bonjour|Bon après-midi|Bonsoir|Bonne nuit) .+ \*tetsu\*, je m'appelle/);
    assert.match(text, /```INFORMATIONS DU BOT```/);
    assert.match(text, /\n> 🍵 \*Créateur :\*/);
    assert.match(text, /\n> 🕒 \*Heure :\*/);
    assert.ok(!/[╭╰╮╯│═]/.test(text), 'aucune bordure');
    assert.ok(!text.includes('catbox'));
});

test('la feuille de catégories : 31 lignes « icône clé Menu », même ordre que la capture', () => {
    const rows = help.listButtonRows('.');
    assert.equal(rows.length, 31);
    assert.deepEqual(rows.slice(0, 4).map(row => row.title), ['🤖 ai Menu', '🎨 aiImage Menu', '📥 download Menu', '📱 apk Menu']);
    assert.equal(rows.at(-1).title, '💎 premium Menu');
    assert.equal(rows[1].id, '.aiimagemenu');
});

test('chaque catégorie a son bloc « ◈ .commande » dans .allmenu', () => {
    const text = help.allMenuText({ user: 'x', prefix: '.' });
    for (const menu of help.MENUS) assert.ok(text.includes(`✦『 ${menu.icon} ${menu.label} 』✦`), menu.key);
    assert.match(text, /\n  ◈ \.ping/);
});

test('le menu n\'affiche chaque information qu\'une seule fois (pas de doublon bas de page)', () => {
    const text = help.overviewText({ user: 'tetsu', prefix: '.' });
    assert.ok(text.split('https://whatsapp.com/channel/').length - 1 <= 1, 'lien de la chaîne en double');
    assert.ok(!/Power by/i.test(text), 'le « Power by » est dans le pied du message, pas dans le corps');
});

test('un menu inconnu affiche un avertissement puis le menu principal (sans planter)', async () => {
    const sent = [];
    const sock = { sendMessage: async (jid, content) => { sent.push(content); return {}; } };
    await help(sock, '1@g.us', { key: { remoteJid: '1@g.us', participant: '2@s.whatsapp.net' }, pushName: 'x' }, 'nimportequoi');
    assert.match(sent[0].text, /Aucun menu ne correspond/);
    assert.match(sent[0].text, /INFORMATIONS DU BOT/);
});
