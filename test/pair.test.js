'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const pairCommand = require('../commands/pair');

const GROUP = '120363000000000000@g.us';
const message = { key: { id: 'A', remoteJid: GROUP, participant: '243802506198@s.whatsapp.net' }, message: { conversation: '.pair' } };

function setup({ codeResponse, ensureServer } = {}) {
    const sent = [];
    const calls = [];
    const sock = { user: { id: '243822993775:5@s.whatsapp.net' }, sendMessage: async (jid, content) => { sent.push(content.text); return {}; } };
    const original = { ...pairCommand.deps };
    pairCommand.deps.sleep = async () => {};
    pairCommand.deps.ensureServer = ensureServer || (async () => 'http://127.0.0.1:9');
    pairCommand.deps.axios = { get: async (url, options) => { calls.push({ url, options }); return codeResponse ? codeResponse(options) : { status: 200, data: { code: 'ABCD-1234' } }; } };
    return { sock, sent, calls, restore: () => Object.assign(pairCommand.deps, original) };
}

test('.pair sans numéro affiche l\'aide', async () => {
    const t = setup();
    try {
        await pairCommand(t.sock, GROUP, message, '');
        assert.match(t.sent[0], /Liaison d'appareil/);
        assert.equal(t.calls.length, 0);
    } finally { t.restore(); }
});

test('.pair génère le code et l\'envoie seul dans un second message', async () => {
    const t = setup();
    try {
        await pairCommand(t.sock, GROUP, message, '+243 700 000 001');
        assert.equal(t.calls[0].options.params.number, '243700000001');
        assert.ok(t.sent.some(text => /Liaison prête/.test(text) && /ABCD-1234/.test(text)));
        assert.equal(t.sent.at(-1), 'ABCD-1234');
    } finally { t.restore(); }
});

test('.pair refuse un numéro invalide et plus de 3 numéros', async () => {
    const t = setup();
    try {
        await pairCommand(t.sock, GROUP, message, 'abc');
        assert.match(t.sent.at(-1), /ne semble pas valide/);
        await pairCommand(t.sock, GROUP, message, '243700000001,243700000002,243700000003,243700000004');
        assert.match(t.sent.at(-1), /3 numéros au maximum/);
        assert.equal(t.calls.length, 0);
    } finally { t.restore(); }
});

test('.pair ne touche jamais au numéro du système principal', async () => {
    const t = setup();
    try {
        await pairCommand(t.sock, GROUP, message, '243822993775');
        assert.match(t.sent.at(-1), /système principal/);
        assert.equal(t.calls.length, 0);
    } finally { t.restore(); }
});

test('.pair : numéro déjà connecté et erreur du moteur sont expliqués', async () => {
    let t = setup({ codeResponse: () => ({ status: 200, data: { already: true } }) });
    try {
        await pairCommand(t.sock, GROUP, message, '243700000001');
        assert.match(t.sent.at(-1), /déjà connecté/);
    } finally { t.restore(); }

    t = setup({ codeResponse: () => ({ status: 429, data: { error: true, message: 'Trop de demandes pour ce numéro.' } }) });
    try {
        await pairCommand(t.sock, GROUP, message, '243700000001');
        assert.match(t.sent.at(-1), /a échoué : Trop de demandes/);
    } finally { t.restore(); }
});

test('.pair : moteur indisponible = message clair, pas de silence', async () => {
    const t = setup({ ensureServer: async () => { throw new Error('hors ligne'); } });
    try {
        await pairCommand(t.sock, GROUP, message, '243700000001');
        assert.match(t.sent.at(-1), /moteur de jumelage est indisponible/);
    } finally { t.restore(); }
});
