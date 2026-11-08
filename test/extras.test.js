'use strict';
const os = require('node:os'); const path = require('node:path'); const fs = require('node:fs');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'extras-'));
process.env.ECONOMY_FILE = path.join(dir, 'eco.json'); process.env.NOTES_FILE = path.join(dir, 'notes.json');
const test = require('node:test'); const assert = require('node:assert/strict');
const extras = require('../lib/extraCommands');
const U = '666666@s.whatsapp.net';
async function call(name, args, isOwner = false) {
    const out = [];
    const sock = { sendMessage: async (j, c) => { out.push(c.text || c); return {}; }, groupFetchAllParticipating: async () => ({}) };
    await extras.run(name, { sock, chatId: U, message: { key: {}, message: {} }, args, senderId: U, isOwner });
    return out.join('\n');
}
test('chaque commande extra a un gestionnaire', () => { assert.ok(extras.NAMES.length >= 40); for (const n of extras.NAMES) assert.equal(typeof extras.HANDLERS[n], 'function'); });
test('économie : daily puis solde, dépôt, jackpot refusé si fonds insuffisants', async () => {
    assert.match(await call('daily', []), /Récompense quotidienne/);
    assert.match(await call('daily', []), /déjà prise/);
    assert.match(await call('balance', []), /Portefeuille/);
    assert.match(await call('deposit', ['999999']), /insuffisant/);
});
test('santé : imc, eau, sommeil', async () => {
    assert.match(await call('bmi', ['70', '175']), /IMC : 22\.9/);
    assert.match(await call('water', ['70']), /2\.3 L/);
    assert.match(await call('sleep', ['06:30']), /21:15/);
});
test('cyber : hash, base64 aller-retour, mot de passe', async () => {
    assert.match(await call('hash', ['abc']), /900150983cd24fb0d6963f7d28e17f72/);
    assert.equal(await call('b64', ['bonjour']), 'Ym9uam91cg==');
    assert.equal(await call('unb64', ['Ym9uam91cg==']), 'bonjour');
    assert.match(await call('genpass', ['20']), /🔐 \S{20}/);
});
test('notes : ajout, liste, suppression', async () => {
    await call('addnote', ['acheter', 'du', 'pain']);
    assert.match(await call('notes', []), /1\. acheter du pain/);
    await call('delnote', ['1']);
    assert.match(await call('notes', []), /Aucune note/);
});
test('diffusion réservée au propriétaire', async () => {
    assert.match(await call('broadcast', ['salut']), /réservée au propriétaire/);
});

test('sendall : réservé à la plateforme, envoie à chaque compte connecté dans SON contexte', async () => {
    process.env.SENDALL_DELAY_MS = '0';
    const sessionContext = require('../lib/sessionContext');
    const botInstance = require('../lib/botInstance');
    const seen = [];
    const fake = number => ({ number, connected: true, sock: { sendMessage: async (jid, content) => { seen.push({ jid, text: content.text, ctx: sessionContext.currentNumber() }); return {}; } } });
    const original = botInstance.getConnectedBots;
    botInstance.getConnectedBots = () => [fake('243111111111'), fake('243222222222'), fake('243333333333')];
    try {
        const out = [];
        const sock = { sendMessage: async (j, c) => { out.push(c.text); return {}; } };
        const base = { sock, chatId: U, message: { key: {}, message: {} }, senderId: U };

        await extras.run('sendall', { ...base, args: ['Bonjour', 'à', 'tous'], isOwner: true, isPlatformOwner: false });
        assert.match(out.join('\n'), /réservée à l'administrateur de la plateforme/);
        assert.equal(seen.length, 0, 'un propriétaire de session ne peut pas diffuser');

        out.length = 0;
        await extras.run('sendall', { ...base, args: ['Bonjour', 'à', 'tous'], isOwner: true, isPlatformOwner: true });
        assert.equal(seen.length, 3);
        assert.deepEqual(seen.map(s => s.jid), ['243111111111@s.whatsapp.net', '243222222222@s.whatsapp.net', '243333333333@s.whatsapp.net']);
        assert.deepEqual(seen.map(s => s.ctx), ['243111111111', '243222222222', '243333333333']);
        assert.ok(seen.every(s => /Bonjour à tous/.test(s.text)));
        assert.match(out.join('\n'), /3\/3/);

        out.length = 0; await extras.run('sendall', { ...base, args: [], isOwner: true, isPlatformOwner: true });
        assert.match(out.join('\n'), /Utilisation/);
    } finally { botInstance.getConnectedBots = original; }
});
