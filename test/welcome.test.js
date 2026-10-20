'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

// Faux stockage en mémoire : le test ne touche jamais aux vraies données.
const store = { welcome: {}, goodbye: {} };
const indexPath = require.resolve('../lib/index');
require.cache[indexPath] = {
    id: indexPath, filename: indexPath, loaded: true,
    exports: {
        addWelcome: async (jid, enabled, message) => { store.welcome[jid] = { enabled, message }; return true; },
        delWelcome: async (jid) => { delete store.welcome[jid]; return true; },
        isWelcomeOn: async (jid) => Boolean(store.welcome[jid]?.enabled),
        getWelcome: async (jid) => store.welcome[jid]?.message || null,
        addGoodbye: async (jid, enabled, message) => { store.goodbye[jid] = { enabled, message }; return true; },
        delGoodBye: async (jid) => { delete store.goodbye[jid]; return true; },
        isGoodByeOn: async (jid) => Boolean(store.goodbye[jid]?.enabled),
        getGoodbye: async (jid) => store.goodbye[jid]?.message || null
    }
};

const { buildWelcome, buildGoodbye, isDefaultTemplate } = require('../lib/memberEvent');
const { welcomeCommand, handleJoinEvent } = require('../commands/welcome');
const { goodbyeCommand, handleLeaveEvent } = require('../commands/goodbye');

const GROUP = '120363000000000000@g.us';
const NEW_MEMBER = '243700000001@s.whatsapp.net';
const ADMIN = '243802506198@s.whatsapp.net';
const NOW = new Date('2026-10-12T21:14:00Z');

function makeSock() {
    const sent = [];
    return {
        sent,
        groupMetadata: async () => ({ subject: 'PRIMEEE CORE', desc: 'Règle 1 : respect.\nRègle 2 : pas de spam.', participants: [{ id: ADMIN }, { id: NEW_MEMBER }, { id: 'c@s.whatsapp.net' }] }),
        sendMessage: async (jid, content, options) => { sent.push({ jid, content, options }); return {}; }
    };
}
const msg = (text) => ({ key: { id: 'A', remoteJid: GROUP, participant: ADMIN }, message: { conversation: text } });

test('bienvenue par défaut : design JARVIS avec groupe, rang, date, auteur et description', () => {
    const text = buildWelcome({ jid: NEW_MEMBER, groupName: 'PRIMEEE CORE', count: 3, description: 'Respect avant tout.', author: ADMIN, template: null, now: NOW });
    assert.match(text, /𝗡𝗘𝗫𝗢-𝗝𝗔𝗥𝗩𝗜𝗦 𝗫𝗠𝗗/);
    assert.match(text, /Bienvenue parmi nous, @243700000001/);
    assert.match(text, /ɢʀᴏᴜᴘᴇ : PRIMEEE CORE/);
    assert.match(text, /ᴍᴇᴍʙʀᴇ ɴ° : 3/);
    assert.match(text, /ᴀᴊᴏᴜᴛé ᴘᴀʀ : @243802506198/);
    assert.match(text, /📜 Respect avant tout\./);
    assert.match(text, /\*\.menu\*/);
    assert.match(text, /12\/10\/2026 • 22:14/, 'heure de Kinshasa (UTC+1)');
});

test('un membre qui rejoint seul n\'affiche pas « ajouté par » ; description longue raccourcie', () => {
    const text = buildWelcome({ jid: NEW_MEMBER, groupName: 'G', count: 2, description: 'x'.repeat(500), author: NEW_MEMBER, now: NOW });
    assert.ok(!/ᴀᴊᴏᴜᴛé ᴘᴀʀ/.test(text));
    assert.ok(text.split('\n').find(line => line.startsWith('📜')).length <= 185);
});

test('départ : quitté ou retiré par un admin, avec le nombre de membres restants', () => {
    const left = buildGoodbye({ jid: NEW_MEMBER, groupName: 'G', count: 41, author: NEW_MEMBER, now: NOW });
    assert.match(left, /a quitté le groupe/);
    assert.match(left, /ᴍᴇᴍʙʀᴇs ʀᴇsᴛᴀɴᴛs : 41/);
    const kicked = buildGoodbye({ jid: NEW_MEMBER, groupName: 'G', count: 41, author: ADMIN, now: NOW });
    assert.match(kicked, /a été retiré du groupe par @243802506198/);
});

test('modèle personnalisé : variables remplacées ; anciens modèles par défaut reconnus', () => {
    const custom = buildWelcome({ jid: NEW_MEMBER, groupName: 'Mon Groupe', count: 9, description: 'desc', template: 'Salut {user} ! {group} compte {count} membres ({date} {time}).', now: NOW });
    assert.equal(custom, 'Salut @243700000001 ! Mon Groupe compte 9 membres (12/10/2026 22:14).');
    assert.equal(isDefaultTemplate('__JARVIS_DEFAULT__'), true);
    assert.equal(isDefaultTemplate('╔═⚔️ BIENVENUE ⚔️═╗ …'), true);
    assert.equal(isDefaultTemplate('Bienvenue {user} dans *{group}* ! 🎉'), true);
    assert.equal(isDefaultTemplate('Mon message'), false);
});

test('.welcome on / test / set / reset / off', async () => {
    const sock = makeSock();
    await welcomeCommand(sock, GROUP, msg('.welcome on'));
    assert.match(sock.sent.at(-1).content.text, /activés/);
    await welcomeCommand(sock, GROUP, msg('.welcome test'));
    assert.match(sock.sent.at(-1).content.text, /Bienvenue parmi nous/);
    await welcomeCommand(sock, GROUP, msg('.welcome set Bienvenue {user} chez {group} !'));
    assert.equal(store.welcome[GROUP].message, 'Bienvenue {user} chez {group} !');
    await welcomeCommand(sock, GROUP, msg('.welcome test'));
    assert.match(sock.sent.at(-1).content.text, /^Bienvenue @243802506198 chez PRIMEEE CORE !/);
    await welcomeCommand(sock, GROUP, msg('.welcome set'));
    assert.match(sock.sent.at(-1).content.text, /Indiquez le texte/);
    await welcomeCommand(sock, GROUP, msg('.welcome reset'));
    assert.equal(store.welcome[GROUP].message, '__JARVIS_DEFAULT__');
    await welcomeCommand(sock, GROUP, msg('.welcome off'));
    assert.equal(store.welcome[GROUP], undefined);
    await welcomeCommand(sock, GROUP, msg('.welcome'));
    assert.match(sock.sent.at(-1).content.text, /Variables : \{user\}/);
});

test('arrivée d\'un membre : message envoyé avec mentions et bouton chaîne', async () => {
    const sock = makeSock();
    store.welcome[GROUP] = { enabled: true, message: '__JARVIS_DEFAULT__' };
    await handleJoinEvent(sock, GROUP, [{ id: NEW_MEMBER }], ADMIN);
    const { content } = sock.sent[0];
    assert.match(content.text, /Bienvenue parmi nous, @243700000001/);
    assert.deepEqual(content.mentions.sort(), [ADMIN, NEW_MEMBER].sort());
    assert.ok(content.contextInfo.forwardedNewsletterMessageInfo);
    assert.match(content.text, /ᴍᴇᴍʙʀᴇ ɴ° : 3/);
    delete store.welcome[GROUP];
    const silent = makeSock();
    await handleJoinEvent(silent, GROUP, [{ id: NEW_MEMBER }], ADMIN);
    assert.equal(silent.sent.length, 0, 'rien si le welcome est désactivé');
});

test('départ d\'un membre : le compteur exclut la personne qui part', async () => {
    const sock = makeSock();
    store.goodbye[GROUP] = { enabled: true, message: null };
    await handleLeaveEvent(sock, GROUP, [NEW_MEMBER], ADMIN);
    assert.match(sock.sent[0].content.text, /ᴍᴇᴍʙʀᴇs ʀᴇsᴛᴀɴᴛs : 2/);
    assert.match(sock.sent[0].content.text, /retiré du groupe par/);
    await goodbyeCommand(sock, GROUP, msg('.goodbye test'));
    assert.match(sock.sent.at(-1).content.text, /Déconnexion enregistrée/);
});
