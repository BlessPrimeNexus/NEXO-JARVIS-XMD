'use strict';
process.env.NEXO_FANCY_FONT = '0';   // les tests lisent le texte en lettres normales (la police monospace est testée à part)

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

// Faux gestionnaire de sessions et faux contrôleur d'instances (aucun vrai WhatsApp).
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexo-sess-'));
process.env.SESSION_DIR = tmp;
const dirA = path.join(tmp, 'user_243111111111');
const dirB = path.join(tmp, 'user_243222222222');
fs.mkdirSync(dirA); fs.mkdirSync(dirB);

const registry = new Map([
    ['243111111111', { sessionId: 's1', phoneNumber: '243111111111', status: 'CONNECTED', sessionDir: dirA, lastSeen: new Date().toISOString(), createdAt: new Date().toISOString() }],
    ['243222222222', { sessionId: 's2', phoneNumber: '243222222222', status: 'DISCONNECTED', sessionDir: dirB, lastSeen: null, createdAt: new Date().toISOString() }]
]);
const stopped = [];
const fakeManager = {
    sessionManager: {
        listSessions: () => [...registry.values()],
        getByPhone: (number) => registry.get(String(number)) || null,
        releaseSession: (number) => registry.delete(number)
    },
    maskPhoneNumber: (n) => n,
    logSessionEvent: () => {}
};
const fakeControl = {
    getAllInstances: () => [{ number: '243111111111', connected: true, restartAttempts: 0, queuedMessages: 0, sessionDir: dirA }],
    getBotInstance: () => null,
    stopBotInstance: (n) => stopped.push(n),
    createBotInstance: async () => {}
};
require.cache[require.resolve('../lib/session-manager')] = { id: 'x', filename: 'x', loaded: true, exports: fakeManager };
require.cache[require.resolve('../lib/botInstance')] = { id: 'y', filename: 'y', loaded: true, exports: fakeControl };

const settings = require('../settings');
const sessionsCommand = require('../commands/sessions');

const OWNER = String(settings.ownerNumber);
const BOT_MAIN = '243822993775';
function setup(fromOwner = true) {
    const sent = [];
    const sock = {
        user: { id: '243111111111:1@s.whatsapp.net' },
        sendMessage: async (jid, content) => { sent.push(content); return {}; }
    };
    const message = { key: { remoteJid: '1@g.us', participant: `${fromOwner ? OWNER : '243999999999'}@s.whatsapp.net`, fromMe: false } };
    return { sock, sent, message };
}

test('un non-propriétaire est refusé', async () => {
    const { sock, sent, message } = setup(false);
    await sessionsCommand(sock, '1@g.us', message, '');
    assert.match(sent[0].text, /réservé au propriétaire/);
});

test('la liste montre les sessions, leur état et le total', async () => {
    const { sock, sent, message } = setup();
    await sessionsCommand(sock, '1@g.us', message, '');
    const text = sent[0].text;
    assert.match(text, /Sessions du bot/);
    assert.match(text, /1\. ✅ \+243111111111 📍/);
    assert.match(text, /2\. ⚪ \+243222222222/);
});

test('le bouton Supprimer (ask) demande une confirmation et ne supprime rien', async () => {
    const { sock, sent, message } = setup();
    await sessionsCommand(sock, '1@g.us', message, 'ask 2');
    assert.match(sent[0].text, /SUPPRIMER \?/);
    assert.ok(fs.existsSync(dirB));
    assert.ok(registry.has('243222222222'));
});

test('remove <n°> tapé : suppression immédiate, vérifiée (dossier, registre, instance)', async () => {
    const { sock, sent, message } = setup();
    await sessionsCommand(sock, '1@g.us', message, 'remove 243222222222');
    assert.match(sent[sent.length - 1].text, /SESSION SUPPRIMÉE/);
    assert.ok(!fs.existsSync(dirB));
    assert.ok(!registry.has('243222222222'));
    assert.ok(stopped.includes('243222222222'));
    assert.ok(fs.existsSync(dirA), 'les autres sessions restent intactes');
});

test('un numéro inconnu est signalé', async () => {
    const { sock, sent, message } = setup();
    await sessionsCommand(sock, '1@g.us', message, 'info 9');
    assert.match(sent[0].text, /INTROUVABLE/);
});

test('le numéro du bot principal (fromMe) peut gérer les sessions', async () => {
    const sent = [];
    const sock = { user: { id: `${BOT_MAIN}:3@s.whatsapp.net` }, sendMessage: async (jid, content) => { sent.push(content); return {}; } };
    await sessionsCommand(sock, '1@g.us', { key: { remoteJid: '1@g.us', fromMe: true } }, '');
    assert.match(sent[0].text, /Sessions du bot/);
});

test('un propriétaire identifié par LID (groupe) peut gérer les sessions', async () => {
    const sent = [];
    const sock = {
        user: { id: `${BOT_MAIN}:3@s.whatsapp.net` },
        signalRepository: { lidMapping: { getPNForLID: async () => `${OWNER}:0@s.whatsapp.net` } },
        sendMessage: async (jid, content) => { sent.push(content); return {}; }
    };
    await sessionsCommand(sock, '1@g.us', { key: { remoteJid: '1@g.us', participant: '5555@lid', fromMe: false } }, '');
    assert.match(sent[0].text, /Sessions du bot/);
});

test('fromMe d\'une autre session connectée : refusé', async () => {
    const sent = [];
    const sock = { user: { id: '243777777777:1@s.whatsapp.net' }, sendMessage: async (jid, content) => { sent.push(content); return {}; } };
    await sessionsCommand(sock, '1@g.us', { key: { remoteJid: '1@g.us', fromMe: true } }, '');
    assert.match(sent[0].text, /réservé au propriétaire/);
});
