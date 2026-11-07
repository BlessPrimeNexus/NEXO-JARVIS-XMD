'use strict';
process.env.NEXO_FANCY_FONT = '0';

const test = require('node:test');
const assert = require('node:assert/strict');
const style = require('../lib/style');
const presentation = require('../lib/presentation');
const displayFlags = require('../lib/displayFlags');

test.afterEach(() => style.setFancy(false));

test('police monospace : titres, libellés, commandes uniquement', () => {
    style.setFancy(true);
    const raw = [
        '✦『 👥 GROUPE 』✦', '  ◈ .ping', '  ◇ Utilisateur → tetsu', '  texte libre .ping', '  ✦ ──────────────── ✦'
    ].join('\n');
    const out = style.stylize(raw);
    assert.ok(out.includes('✦『 👥 𝙶𝚛𝚘𝚞𝚙𝚎 』✦'), 'titre en Titre + monospace');
    assert.ok(out.includes('  ◈ .𝙿𝚒𝚗𝚐'));
    assert.ok(out.includes('  ◇ 𝚄𝚝𝚒𝚕𝚒𝚜𝚊𝚝𝚎𝚞𝚛 → tetsu'), 'libellé monospace, valeur intacte');
    assert.ok(out.includes('  texte libre .ping'), 'le texte libre n\'est pas modifié');
    assert.equal(style.unmono(out.split('\n')[0]), '✦『 👥 Groupe 』✦');
    assert.equal(style.stylize(out), out, 'idempotent');
});

test('police monospace : les accents passent à la lettre de base (police homogène dans les titres)', () => {
    style.setFancy(true);
    assert.equal(style.mono('Système Été ça'), '𝚂𝚢𝚜𝚝𝚎𝚖𝚎 𝙴𝚝𝚎 𝚌𝚊');
});

test('police désactivée : texte inchangé', () => {
    style.setFancy(false);
    const raw = '✦『 GROUPE 』✦\n  ◈ .ping\n  ✦ ──────────────── ✦';
    assert.equal(style.stylize(raw), raw);
});

test('titres : MAJUSCULES → Titre, mots courts en minuscules, casse mixte conservée', () => {
    assert.equal(style.niceTitle('DIAGNOSTIC SYSTÈME'), 'Diagnostic Système');
    assert.equal(style.niceTitle('SESSIONS DU BOT'), 'Sessions du Bot');
    assert.equal(style.niceTitle('Panel de contrôle'), 'Panel de contrôle');
});

test('blocs : titre, ◇ / ◈, trait de fin ; aucune bordure ; longues valeurs sur leurs lignes', () => {
    const text = style.box('⚙️ Test', [['🏓 Latence', '10 ms'], '.menu', 'phrase normale', ['Nom', 'x'.repeat(60)]]);
    const lines = text.split('\n');
    assert.equal(lines[0], '✦『 ⚙️ Test 』✦');
    assert.ok(lines.includes('  ◇ Latence → 10 ms'), 'l\'emoji du libellé est retiré');
    assert.ok(lines.includes('  ◈ .menu'));
    assert.ok(lines.includes('  phrase normale'));
    assert.equal(lines[lines.length - 1], '  ✦ ──────────────── ✦');
    assert.ok(!/[╭╰╮╯│═]/.test(text), 'aucune bordure');
    assert.ok(lines.some(line => line === '  ◇ Nom →'), 'longue valeur : libellé seul puis valeur en dessous');
});

test('en-tête : longue valeur renvoyée à la ligne au lieu de déborder', () => {
    const text = style.header('🤖 Test', [['Propriétaire', '✘🦠𝗕𝗟𝗘𝗦𝗦 | 𝗗𝗘𝗩🧬»𝟰𝟬𝟰. ✘ et encore un long nom']]);
    assert.ok(text.split('\n').every(line => style.cells(line) <= style.WIDTH + 6), text);
});

test('de bout en bout : le message envoyé porte la police monospace, la fausse citation et le reste', async () => {
    style.setFancy(true);
    displayFlags.override('imageReply', false);
    displayFlags.override('previewImage', false);
    const sent = [];
    const sock = presentation.wrapSocket({
        user: { id: '1:1@s.whatsapp.net' },
        sendMessage: async (jid, content, options) => { sent.push({ content, options }); return { key: { id: 'X', remoteJid: jid, fromMe: true }, message: {} }; },
        relayMessage: async () => ({})
    });
    await sock.sendMessage('1@g.us', { text: style.panel('⚡ DIAGNOSTIC SYSTÈME', [['Latence', '10 ms']], 'Tout va bien.') });
    assert.match(sent[0].content.text, /✦『 ⚡ 𝙳𝚒𝚊𝚐𝚗𝚘𝚜𝚝𝚒𝚌 𝚂𝚢𝚜𝚝𝚎𝚖𝚎 』✦/);
    assert.ok(sent[0].options.quoted);
    // texte brut → habillé dans le même design
    await sock.sendMessage('1@g.us', { text: '❌ Aucun résultat.' });
    assert.match(sent[1].content.text, /^✦『 🤖 .+ 』✦\n  ❌ Aucun résultat\.\n  ✦ ─+ ✦$/);
    // réponse libre (IA) : jamais touchée
    await sock.sendMessage('1@g.us', { text: '✦『 x 』✦ ceci reste', __plain: true });
    assert.equal(sent[2].content.text, '✦『 x 』✦ ceci reste');
});

test('traits : le trait de fin est celui de l\'exemple et tient sur une ligne', () => {
    assert.ok(style.cells('  ✦ ──────────────── ✦') <= 26);
    assert.equal(style.box('Titre', ['x']).split('\n').pop(), '  ✦ ──────────────── ✦');
});

test('plus de signature ni de phrase d\'accompagnement par défaut', () => {
    const settings = require('../settings');
    const report = style.report('🟢 Test', [['A', '1']], [{ title: 'Boîte', rows: ['ligne'] }], 'Je suis à votre disposition, Monsieur.');
    assert.ok(!report.includes('⛨') && !/disposition|Monsieur/.test(report));
    assert.ok(!/[╭╰╮╯│═]/.test(report));
    assert.ok(!style.panel('Titre', ['x'], 'Une note.').includes('Une note.'));
    settings.replyNotes = true;
    try { assert.ok(style.panel('Titre', ['x'], 'Une note.').includes('Une note.')); } finally { settings.replyNotes = false; }
});

test('formules de politesse en fin de phrase retirées (« …, Monsieur. »)', () => {
    assert.equal(style.cleanup('❌ Impossible de continuer, Monsieur.'), '❌ Impossible de continuer.');
    assert.equal(style.cleanup('Voilà, Monsieur !'), 'Voilà !');
    assert.equal(style.cleanup('Monsieur, bonjour'), 'bonjour');
    assert.equal(style.cleanup('Bien reçu, Monsieur\nSuite'), 'Bien reçu\nSuite');
    assert.equal(style.cleanup('Aucun changement'), 'Aucun changement');
});

test('de bout en bout : « Monsieur » retiré des messages envoyés, sans pied de page', async () => {
    const sent = [];
    const sock = presentation.wrapSocket({
        user: { id: '1:1@s.whatsapp.net' },
        sendMessage: async (jid, content, options) => { sent.push(content); return { key: { id: 'X', remoteJid: jid, fromMe: true }, message: {} }; },
        relayMessage: async () => ({})
    });
    displayFlags.override('imageReply', false);
    await sock.sendMessage('1@g.us', { text: '✅ Réglage enregistré, Monsieur.' });
    assert.ok(!/Monsieur/.test(sent[0].text));
    assert.match(sent[0].text, /Réglage enregistré\./);
});
