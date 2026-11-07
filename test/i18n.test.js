'use strict';
process.env.NEXO_FANCY_FONT = '0';   // les tests lisent le texte en lettres normales (la police monospace est testée à part)

const os = require('node:os');
const path = require('node:path');
process.env.LANG_FILE = path.join(os.tmpdir(), `nexo-lang-${process.pid}.json`);
process.env.TRANSLATION_CACHE_FILE = path.join(os.tmpdir(), `nexo-tr-${process.pid}.json`);

// Faux Baileys : on ne teste ici que la fusion des boutons, pas l'envoi.
const Module = require('node:module');
const originalLoad = Module._load;
Module._load = function (request, ...rest) {
    if (request === '@whiskeysockets/baileys') return { proto: {}, generateWAMessageFromContent: () => ({}), prepareWAMessageMedia: async () => ({}) };
    return originalLoad.call(this, request, ...rest);
};

const test = require('node:test');
const assert = require('node:assert/strict');
const i18n = require('../lib/i18n');
const { mergeQuickReplies } = require('../lib/interactiveButtons');

// Faux service de traduction : marque chaque segment traduit pour vérifier ce qui est envoyé / conservé.
let calls = [];
const fake = async (segments) => { calls.push(segments); return segments.map(segment => `EN(${segment})`); };

test.beforeEach(() => { calls = []; i18n._clearCache(); i18n._setFetcher(fake); i18n.setLang('en'); });
test.after(() => i18n.setLang('fr'));

test('le français restant est traduit ; commandes, liens, mentions, <paramètres> et décorations intacts', async () => {
    const input = '*╭─❏ RÉSULTAT ❏*\n│ Aucun résultat trouvé pour .menu sur https://x.test/a?b=1 avec @243802506198 <n°>\n*╰──────*';
    const [out] = await i18n.translateMany([input]);
    assert.ok(out.includes('.menu'));
    assert.ok(out.includes('https://x.test/a?b=1'));
    assert.ok(out.includes('@243802506198'));
    assert.ok(out.includes('<n°>'));
    assert.ok(out.startsWith('*╭─❏'));
    assert.ok(out.endsWith('*╰──────*'));
    assert.match(out, /EN\(/);
    assert.equal(calls.length, 1, 'une seule requête pour tout le message');
    assert.ok(!calls[0].some(segment => /\.menu|https?:|@\d|<n°>/.test(segment)), 'aucune partie protégée n\'est envoyée au service');
});

test('un bloc ``` (journaux, mots de passe) n\'est jamais traduit', async () => {
    const [out] = await i18n.translateMany(['Voici le résultat obtenu :\n```Erreur: connexion refusée à la base```']);
    assert.ok(out.includes('```Erreur: connexion refusée à la base```'));
});

test('le texte déjà en anglais, les termes du dictionnaire traduits et les textes sans lettres ne sont pas envoyés', async () => {
    await i18n.translateMany(['Hello world, this is fine', '*10 ms*', '│ 🏓 : 5', '│ 🏓 Latence : *10 ms*']);
    assert.equal(calls.length, 0);
});

test('un mot français sans accent ni mot-outil (ex. « Disque ») est quand même traduit', async () => {
    const [out] = await i18n.translateMany(['│ 💽 Disque : *3 Mo*']);
    assert.match(out, /EN\(.*Disque/);
});

test('cache : un même texte n\'est demandé qu\'une fois', async () => {
    await i18n.translateAsync('Bienvenue dans le groupe');
    await i18n.translateAsync('Bienvenue dans le groupe');
    assert.equal(calls.length, 1);
});

test('service en panne : le message part quand même, avec le dictionnaire', async () => {
    i18n._setFetcher(async () => { throw new Error('réseau coupé'); });
    const out = await i18n.translateAsync('│ Latence : *10 ms*\n│ Phrase absente du dictionnaire pour tester');
    assert.match(out, /Latency/);
    assert.match(out, /Phrase absente du dictionnaire/);
});

test('en français : aucun appel, texte inchangé', async () => {
    i18n.setLang('fr');
    assert.equal(await i18n.translateAsync('Bonjour à tous'), 'Bonjour à tous');
    assert.equal(calls.length, 0);
});

test('boutons et listes : textes traduits en une requête, identifiants intacts', async () => {
    const buttons = [{ name: 'single_select', params: { title: '📂 Ouvrir une zone inconnue', sections: [{ title: 'Zone étrange', rows: [{ header: '', title: '👥 Bidule spécial', description: 'Une description très particulière', id: '.zone1' }] }] } },
        { name: 'cta_url', params: { display_text: 'Voir la page', url: 'https://x.test', merchant_url: 'https://x.test' } }];
    const out = await i18n.translateButtonsAsync(buttons);
    assert.equal(out[0].params.sections[0].rows[0].id, '.zone1');
    assert.equal(out[1].params.url, 'https://x.test');
    assert.match(out[0].params.sections[0].rows[0].description, /EN\(/);
    assert.equal(calls.length, 1);
    assert.equal(buttons[0].params.sections[0].rows[0].description, 'Une description très particulière', 'l\'original n\'est pas modifié');
});

test('les boutons de réponse rapide deviennent des lignes de liste (grisés sur le téléphone du bot)', () => {
    const merged = mergeQuickReplies([
        { name: 'quick_reply', params: { display_text: '🔄 Actualiser', id: '.sessions' } },
        { name: 'quick_reply', params: { display_text: '🗑️ Supprimer', id: '.sessions ask 1' } },
        { name: 'cta_url', params: { display_text: 'Chaîne', url: 'https://x.test' } }
    ]);
    assert.equal(merged.some(button => button.name === 'quick_reply'), false);
    assert.equal(merged[0].name, 'single_select');
    assert.deepEqual(merged[0].params.sections[0].rows.map(row => row.id), ['.sessions', '.sessions ask 1']);
    assert.equal(merged[1].name, 'cta_url');
});

test('avec une liste existante : section « Actions » ajoutée, sans doublon', () => {
    const merged = mergeQuickReplies([
        { name: 'single_select', params: { title: 'Menus', sections: [{ title: 'Menus', rows: [{ title: 'Tous', id: '.allmenu' }] }] } },
        { name: 'quick_reply', params: { display_text: '📜 Tous les menus', id: '.allmenu' } },
        { name: 'quick_reply', params: { display_text: '↩️ Retour', id: '.menu' } }
    ]);
    assert.equal(merged.length, 1);
    const actions = merged[0].params.sections[merged[0].params.sections.length - 1];
    assert.deepEqual(actions.rows.map(row => row.id), ['.menu']);
});
