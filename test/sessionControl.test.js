'use strict';
process.env.NEXO_FANCY_FONT = '0';   // les tests lisent le texte en lettres normales (la police monospace est testée à part)

// Suppression RÉELLE sur disque : dossier effacé, fiche libérée, instance arrêtée, et rapport honnête en cas d'échec.
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nexo-sc-'));
process.env.SESSION_DIR = path.join(root, 'sessions');
fs.mkdirSync(process.env.SESSION_DIR, { recursive: true });

const test = require('node:test');
const assert = require('node:assert/strict');

const registry = new Map();
const stopped = [];
const instances = new Map();
require.cache[require.resolve('../lib/session-manager')] = { id: 'a', filename: 'a', loaded: true, exports: {
    sessionManager: { getByPhone: (n) => registry.get(String(n)) || null, releaseSession: (n) => registry.delete(String(n)), listSessions: () => [...registry.values()] },
    maskPhoneNumber: (n) => n, logSessionEvent: () => {}
} };
require.cache[require.resolve('../lib/botInstance')] = { id: 'b', filename: 'b', loaded: true, exports: {
    getBotInstance: (n) => instances.get(String(n)) || null,
    stopBotInstance: (n) => { stopped.push(n); instances.delete(String(n)); },
    getAllInstances: () => [], createBotInstance: async () => {}
} };

const { removeSession, onRemoved } = require('../lib/sessionControl');

test('supprime vraiment le dossier, la fiche et l\'instance, et prévient web.js', async () => {
    const dir = path.join(process.env.SESSION_DIR, 'user_243111111111');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'creds.json'), '{}');
    registry.set('243111111111', { sessionId: 's1', phoneNumber: '243111111111', sessionDir: dir });
    const logout = { called: false };
    instances.set('243111111111', { stopping: false, connected: true, sock: { logout: async () => { logout.called = true; } } });
    const notified = [];
    onRemoved(number => notified.push(number));

    const result = await removeSession('243111111111');
    assert.equal(result.ok, true, JSON.stringify(result));
    assert.equal(fs.existsSync(dir), false);
    assert.equal(registry.has('243111111111'), false);
    assert.ok(stopped.includes('243111111111'));
    assert.equal(logout.called, true, 'l\'appareil lié est déconnecté');
    assert.deepEqual(notified, ['243111111111']);
});

test('dossier absent de la fiche : retrouvé via user_<numéro>', async () => {
    const dir = path.join(process.env.SESSION_DIR, 'user_243222222222');
    fs.mkdirSync(dir, { recursive: true });
    registry.set('243222222222', { sessionId: 's2', phoneNumber: '243222222222', sessionDir: null });
    const result = await removeSession('243222222222');
    assert.equal(result.ok, true);
    assert.equal(fs.existsSync(dir), false);
});

test('jamais de suppression hors des dossiers de sessions, et l\'échec est signalé', async () => {
    const outside = path.join(root, 'important');
    fs.mkdirSync(outside, { recursive: true });
    registry.set('243333333333', { sessionId: 's3', phoneNumber: '243333333333', sessionDir: outside });
    const result = await removeSession('243333333333');
    assert.equal(result.ok, false);
    assert.equal(fs.existsSync(outside), true, 'le dossier hors zone est intact');
    assert.ok(result.leftovers.length > 0);
});
