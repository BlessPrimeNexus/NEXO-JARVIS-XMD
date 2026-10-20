'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { requestPairingCodeWhenReady, formatCode } = require('../lib/pairingCode');

const noSleep = async () => {};
const closed = () => Object.assign(new Error('Connection Closed'), { output: { statusCode: 428 } });

test('le code est formaté par groupes de 4', () => {
    assert.equal(formatCode('ABCD1234'), 'ABCD-1234');
    assert.equal(formatCode(''), '');
});

test('428 « Connection Closed » : nouvel essai automatique jusqu\'au succès', async () => {
    let calls = 0;
    const retries = [];
    const sock = { authState: { creds: { registered: false } }, requestPairingCode: async () => { calls += 1; if (calls < 3) throw closed(); return 'WXYZ9876'; } };
    const code = await requestPairingCodeWhenReady(sock, '243822993775', { sleep: noSleep, onRetry: (n) => retries.push(n) });
    assert.equal(code, 'WXYZ-9876');
    assert.equal(calls, 3);
    assert.deepEqual(retries, [1, 2]);
});

test('on attend que la connexion WebSocket soit ouverte avant de demander le code', async () => {
    const order = [];
    const sock = {
        ws: { isOpen: false },
        authState: { creds: { registered: false } },
        requestPairingCode: async () => { order.push('code'); return 'AAAABBBB'; }
    };
    let waits = 0;
    const sleep = async () => { waits += 1; if (waits === 3) { sock.ws.isOpen = true; order.push('ouverte'); } };
    await requestPairingCodeWhenReady(sock, '243822993775', { sleep });
    assert.deepEqual(order, ['ouverte', 'code']);
});

test('erreur non récupérable ou essais épuisés : l\'erreur est remontée', async () => {
    const sock = { authState: { creds: {} }, requestPairingCode: async () => { throw new Error('Numéro refusé'); } };
    await assert.rejects(() => requestPairingCodeWhenReady(sock, '1', { sleep: noSleep }), /Numéro refusé/);
    let calls = 0;
    const stubborn = { authState: { creds: {} }, requestPairingCode: async () => { calls += 1; throw closed(); } };
    await assert.rejects(() => requestPairingCodeWhenReady(stubborn, '1', { sleep: noSleep, attempts: 3 }), /Connection Closed/);
    assert.equal(calls, 3);
});

test('arrêt silencieux si la session est déjà liée ou si un nouveau socket a pris le relais', async () => {
    let called = 0;
    const registered = { authState: { creds: { registered: true } }, requestPairingCode: async () => { called += 1; return 'X'; } };
    assert.equal(await requestPairingCodeWhenReady(registered, '1', { sleep: noSleep }), null);
    const stale = { authState: { creds: {} }, requestPairingCode: async () => { called += 1; return 'X'; } };
    assert.equal(await requestPairingCodeWhenReady(stale, '1', { sleep: noSleep, isCurrent: () => false }), null);
    assert.equal(called, 0);
});
