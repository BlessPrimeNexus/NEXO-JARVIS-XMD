'use strict';
process.env.NEXO_FANCY_FONT = '0';
const fs = require('node:fs'); const path = require('node:path');
const sessionContext = require('../lib/sessionContext');
sessionContext.install();                      // comme index.js : avant tout le reste
const test = require('node:test'); const assert = require('node:assert/strict');

const A = '990000000011'; const B = '990000000022';
const G = '120363000000000077@g.us';
const as = (number, fn) => sessionContext.runWithSession(number, fn);

test.after(() => { for (const n of [A, B]) fs.rmSync(path.join(sessionContext.SESSIONS_ROOT, n), { recursive: true, force: true }); });

test('antilink : régler la session A ne change rien pour la session B', async () => {
    const lib = require('../lib/index');
    await as(A, () => lib.setAntilink(G, 'on', 'kick'));
    const a = await as(A, () => lib.getAntilink(G, 'on'));
    const b = await as(B, () => lib.getAntilink(G, 'on'));
    assert.ok(a && a.enabled, 'A est réglé');
    assert.ok(!b || !b.enabled, 'B n\'est pas touché');
});

test('langue : A en anglais, B reste en français', () => {
    const i18n = require('../lib/i18n');
    as(A, () => i18n.setLang('en'));
    assert.equal(as(A, () => i18n.getLang()), 'en');
    assert.equal(as(B, () => i18n.getLang()), 'fr');
    as(A, () => i18n.setLang('fr'));
});

test('antibot : activé dans A seulement', () => {
    const antibot = require('../lib/antibot');
    // le moteur antibot lit/écrit data/antibot.json : redirigé vers data/sessions/<n>/antibot.json
    as(A, () => antibot.setConfig(G, { enabled: true }));
    assert.equal(as(A, () => antibot.isAntibotEnabled(G)), true);
    assert.equal(as(B, () => antibot.isAntibotEnabled(G)), false);
});

test('fichiers : chaque session écrit dans son propre dossier, les fichiers communs restent communs', () => {
    as(A, () => fs.writeFileSync(path.join(sessionContext.ROOT, 'banned.json'), '["a"]'));
    as(B, () => fs.writeFileSync(path.join(sessionContext.ROOT, 'banned.json'), '["b"]'));
    assert.equal(as(A, () => fs.readFileSync(path.join(sessionContext.ROOT, 'banned.json'), 'utf8')), '["a"]');
    assert.equal(as(B, () => fs.readFileSync(path.join(sessionContext.ROOT, 'banned.json'), 'utf8')), '["b"]');
    assert.ok(fs.existsSync(path.join(sessionContext.SESSIONS_ROOT, A, 'banned.json')));
    assert.ok(fs.existsSync(path.join(sessionContext.SESSIONS_ROOT, B, 'banned.json')));
    // fichier commun : même chemin pour tout le monde
    assert.equal(sessionContext.scopePath(path.join(sessionContext.ROOT, 'translations.json')), path.join(sessionContext.ROOT, 'translations.json'));
    // hors contexte (site web) : chemin inchangé
    assert.equal(sessionContext.scopePath(path.join(sessionContext.ROOT, 'banned.json')), path.join(sessionContext.ROOT, 'banned.json'));
});

test('renommage atomique (fichier .tmp) et chemins relatifs ./data/… suivent la session', () => {
    as(A, () => { fs.writeFileSync('./data/muted.json.tmp', '{"x":1}'); fs.renameSync('./data/muted.json.tmp', './data/muted.json'); });
    assert.equal(as(A, () => fs.readFileSync('./data/muted.json', 'utf8')), '{"x":1}');
    // B démarre à neuf (contenu par défaut), jamais avec les données de A
    assert.equal(as(B, () => JSON.parse(fs.readFileSync('./data/muted.json', 'utf8'))).x, undefined);
});

test('mémoire : compteurs et minuteries séparés par session', () => {
    const map = new sessionContext.ScopedMap();
    as(A, () => map.set('chat', 1)); as(B, () => map.set('chat', 2));
    assert.equal(as(A, () => map.get('chat')), 1);
    assert.equal(as(B, () => map.get('chat')), 2);
});

test('droits : le compte connecté est propriétaire de SA session, pas de la plateforme', async () => {
    const ownerAuth = require('../lib/ownerAuth');
    const sockA = { user: { id: `${A}:3@s.whatsapp.net` } };
    const own = { key: { fromMe: true, remoteJid: G } };
    assert.equal(await as(A, () => ownerAuth.isOwnerMessage(sockA, own, G)), true);
    assert.equal(await as(A, () => ownerAuth.isPlatformOwnerMessage(sockA, own, G)), false);
    const stranger = { key: { fromMe: false, remoteJid: G, participant: '990000000099@s.whatsapp.net' } };
    assert.equal(await as(A, () => ownerAuth.isOwnerMessage(sockA, stranger, G)), false);
});
