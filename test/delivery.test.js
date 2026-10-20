'use strict';

process.env.NEXO_NO_THUMBNAIL_FETCH = '1';
process.env.PREVIEW_IMAGES = 'https://files.catbox.moe/aaa111.jpg';
process.env.SENT_CACHE_MAX = '100';
process.env.DISPLAY_FLAGS_FILE = require('node:path').join(require('node:os').tmpdir(), `nexo-delivery-${process.pid}.json`);

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const sentMessages = require('../lib/sentMessages');
const displayFlags = require('../lib/displayFlags');
const { wrapSocket } = require('../lib/presentation');
const quoteCard = require('../lib/quoteCard');
const settings = require('../settings');
const displayCommand = require('../commands/display');
const helpCommand = require('../commands/help');

const GROUP = '120363000000000000@g.us';
const msg = (text) => ({ key: { id: 'A', remoteJid: GROUP, participant: '243802506198@s.whatsapp.net' }, message: { conversation: text } });

test('défauts : menu mixte (texte visible partout + boutons), fausse citation universelle sur toutes les réponses', () => {
    assert.equal(settings.menuStyle, 'mixte');
    assert.equal(settings.quoteCard, true);
    assert.equal(settings.quoteCardStyle, 'universal');
    assert.equal(displayFlags.getValue('menuStyle'), 'mixte');
    assert.equal(displayFlags.get('quoteCard'), true);
    assert.equal(displayFlags.getValue('quoteCardStyle'), 'universal');
});

/* ─── Mémoire des messages envoyés (renvoi à un téléphone qui n'a pas déchiffré) ─── */

test('un message envoyé est retrouvé par son identifiant', () => {
    sentMessages.clear();
    assert.equal(sentMessages.remember({ key: { id: 'ABC' }, message: { conversation: 'Bonjour' } }), true);
    assert.deepEqual(sentMessages.recall({ id: 'ABC', remoteJid: GROUP }), { conversation: 'Bonjour' });
    assert.equal(sentMessages.recall({ id: 'INCONNU' }), undefined);
    assert.equal(sentMessages.remember(null), false);
    assert.equal(sentMessages.remember({ key: {}, message: {} }), false);
    assert.equal(sentMessages.remember('ok'), false);
});

test('la mémoire est bornée : les plus anciens messages sont oubliés en premier', () => {
    sentMessages.clear();
    for (let i = 0; i < sentMessages.MAX_ENTRIES + 25; i += 1) {
        sentMessages.remember({ key: { id: `M${i}` }, message: { conversation: `m${i}` } });
    }
    assert.equal(sentMessages.size(), sentMessages.MAX_ENTRIES);
    assert.equal(sentMessages.recall({ id: 'M0' }), undefined);
    assert.ok(sentMessages.recall({ id: `M${sentMessages.MAX_ENTRIES + 24}` }));
});

test('un message plus vieux que la durée de conservation n\'est plus renvoyé', (t) => {
    sentMessages.clear();
    t.mock.timers.enable({ apis: ['Date'], now: Date.now() });
    sentMessages.remember({ key: { id: 'VIEUX' }, message: { conversation: 'x' } });
    assert.ok(sentMessages.recall({ id: 'VIEUX' }));
    t.mock.timers.tick(sentMessages.TTL_MS + 1000);
    assert.equal(sentMessages.recall({ id: 'VIEUX' }), undefined);
});

test('chaque réponse (sendMessage) et chaque menu à boutons (relayMessage) sont mémorisés', async () => {
    sentMessages.clear();
    const sock = wrapSocket({
        sendMessage: async (jid, content) => ({ key: { id: 'TEXTE1', remoteJid: jid, fromMe: true }, message: { extendedTextMessage: { text: content.text } } }),
        relayMessage: async () => 'ok'
    });
    await sock.sendMessage(GROUP, { text: 'Opération terminée, Monsieur.' });
    assert.equal(sentMessages.recall({ id: 'TEXTE1' }).extendedTextMessage.text, 'Opération terminée, Monsieur.');

    const interactive = { viewOnceMessage: { message: { interactiveMessage: { body: { text: 'menu' } } } } };
    assert.equal(await sock.relayMessage(GROUP, interactive, { messageId: 'MENU1' }), 'ok');
    assert.equal(sentMessages.recall({ id: 'MENU1' }), interactive);

    await sock.relayMessage(GROUP, interactive, {});   // sans identifiant : rien à mémoriser, aucune erreur
});

test('les trois sockets utilisent la mémoire d\'envoi dans getMessage (garde-fou de non-régression)', () => {
    const read = (file) => fs.readFileSync(require('node:path').join(__dirname, '..', file), 'utf8');
    assert.match(read('index.js'), /sentMessages'\)\.recall\(key\)/);
    assert.match(read('lib/botInstance.js'), /sentMessages'\)\.recall\(k\)/);
    assert.ok(!/return msg\?\.message \|\| ""/.test(read('index.js')), 'getMessage ne doit plus renvoyer une chaîne vide');
});

/* ─── Réglages d'affichage ─── */

test('displayFlags : valeur forcée, enregistrement sur disque, lecture', () => {
    displayFlags.override('quoteCard', false);
    assert.equal(displayFlags.get('quoteCard'), false);
    displayFlags.override('quoteCard', undefined);
    assert.equal(displayFlags.set('quoteCard', false), false);
    assert.equal(displayFlags.get('quoteCard'), false);
    assert.equal(displayFlags.setValue('menuStyle', 'texte'), 'texte');
    assert.equal(displayFlags.getValue('menuStyle'), 'texte');
    const saved = JSON.parse(fs.readFileSync(process.env.DISPLAY_FLAGS_FILE, 'utf8'));
    assert.equal(saved.quoteCard, false);
    assert.equal(saved.menuStyle, 'texte');
    displayFlags.set('quoteCard', true);
    displayFlags.setValue('menuStyle', 'mixte');
});

function makeSock() {
    const sent = [];
    const relayed = [];
    const sock = wrapSocket({
        user: { id: '243822993775:5@s.whatsapp.net' },
        sendMessage: async (jid, content, opts) => { sent.push({ jid, content, opts }); return {}; },
        relayMessage: async (jid, message) => { relayed.push(message); return 'ok'; }
    });
    return { sock, sent, relayed };
}

test('.menustyle et .quotecard : réservés au propriétaire, avec avertissements', async () => {
    const { sock, sent } = makeSock();
    await displayCommand(sock, GROUP, msg('.menustyle texte'), 'menuStyle', 'texte', false);
    assert.match(sent.at(-1).content.text, /Accès réservé au propriétaire/);
    assert.equal(displayFlags.getValue('menuStyle'), 'mixte', 'un non-propriétaire ne change rien');

    await displayCommand(sock, GROUP, msg('.menustyle'), 'menuStyle', '', true);
    assert.match(sent.at(-1).content.text, /menu \*mixte\*/);

    await displayCommand(sock, GROUP, msg('.menustyle complet'), 'menuStyle', 'complet', true);
    assert.equal(displayFlags.getValue('menuStyle'), 'complet');
    assert.match(sent.at(-1).content.text, /ne gère pas les messages à boutons/);

    await displayCommand(sock, GROUP, msg('.menustyle texte'), 'menuStyle', 'texte', true);
    assert.equal(displayFlags.getValue('menuStyle'), 'texte');
    await displayCommand(sock, GROUP, msg('.menustyle boutons'), 'menuStyle', 'boutons', true);
    assert.equal(displayFlags.getValue('menuStyle'), 'mixte', '« boutons » = menu mixte');
    await displayCommand(sock, GROUP, msg('.menustyle zzz'), 'menuStyle', 'zzz', true);
    assert.match(sent.at(-1).content.text, /Option invalide/);

    await displayCommand(sock, GROUP, msg('.quotecard off'), 'quoteCard', 'off', true);
    assert.equal(displayFlags.get('quoteCard'), false);
    await displayCommand(sock, GROUP, msg('.quotecard business'), 'quoteCard', 'business', true);
    assert.equal(displayFlags.get('quoteCard'), true, 'choisir une présentation réactive la carte');
    assert.equal(displayFlags.getValue('quoteCardStyle'), 'business');
    assert.match(sent.at(-1).content.text, /réservé à WhatsApp Business/);
    await displayCommand(sock, GROUP, msg('.quotecard universal'), 'quoteCard', 'universal', true);
    assert.equal(displayFlags.getValue('quoteCardStyle'), 'universal');
    assert.ok(!/réservé à WhatsApp Business/.test(sent.at(-1).content.text));
    await displayCommand(sock, GROUP, msg('.quotecard'), 'quoteCard', '', true);
    assert.match(sent.at(-1).content.text, /universelle/);
});

test('.menu par défaut : menu TEXTE visible partout, puis barre de boutons ; styles réglables', async () => {
    let t = makeSock();
    await helpCommand(t.sock, GROUP, msg('.menu'), '');
    assert.equal(t.sent.length, 1, 'le menu texte est envoyé en premier');
    assert.match(t.sent[0].content.text, /ᴄᴀᴛéɢᴏʀɪᴇs/);
    assert.equal(t.relayed.length, 1, 'puis la barre de boutons');
    const bar = t.relayed[0].viewOnceMessage.message.interactiveMessage;
    assert.deepEqual(bar.nativeFlowMessage.buttons.map(b => b.name), ['single_select', 'quick_reply', 'cta_url']);
    assert.ok(t.sent[0].opts.quoted.message.imageMessage, 'fausse citation sur le menu texte');
    assert.ok(bar.contextInfo.quotedMessage.imageMessage, 'fausse citation sur la barre de boutons');
    assert.ok(t.sent[0].content.contextInfo.forwardedNewsletterMessageInfo && t.sent[0].content.contextInfo.externalAdReply);

    await displayCommand(t.sock, GROUP, msg('.menustyle texte'), 'menuStyle', 'texte', true);
    t = makeSock();
    await helpCommand(t.sock, GROUP, msg('.menu'), '');
    assert.equal(t.relayed.length, 0, 'style texte : aucun bouton');
    assert.equal(t.sent.length, 1);

    await displayCommand(t.sock, GROUP, msg('.menustyle complet'), 'menuStyle', 'complet', true);
    t = makeSock();
    await helpCommand(t.sock, GROUP, msg('.menu'), '');
    assert.equal(t.sent.length, 0, 'style complet : un seul message à boutons');
    assert.equal(t.relayed.length, 1);
    assert.match(t.relayed[0].viewOnceMessage.message.interactiveMessage.body.text, /ᴄᴀᴛéɢᴏʀɪᴇs/);

    displayFlags.setValue('menuStyle', 'mixte');
});

/* ─── Structure standard des messages (affichage sur tous les téléphones) ─── */

test('message à boutons : structure standard avec messageContextInfo (deviceListMetadata v2)', async () => {
    const { sendInteractiveMessage } = require('../lib/interactiveButtons');
    const relayed = [];
    const sock = { user: { id: '243822993775:5@s.whatsapp.net' }, relayMessage: async (jid, message, opts) => { relayed.push({ message, opts }); } };
    await sendInteractiveMessage(sock, GROUP, {
        body: 'Menu', footer: 'f', title: 't', quoted: msg('.menu'),
        buttons: [{ name: 'quick_reply', params: { display_text: 'A', id: '.a' } }]
    });
    const wrapper = relayed[0].message.viewOnceMessage.message;
    assert.equal(wrapper.messageContextInfo.deviceListMetadataVersion, 2);
    assert.ok(wrapper.messageContextInfo.deviceListMetadata);
    assert.ok(wrapper.interactiveMessage.nativeFlowMessage.buttons.length === 1);
    assert.equal(wrapper.interactiveMessage.nativeFlowMessage.messageVersion, 1);
    assert.ok(relayed[0].opts.additionalNodes.some(node => node.tag === 'biz'));
});

test('fausse citation : structures standard (universelle et business)', () => {
    const universal = quoteCard.buildQuoteCard(msg('.menu'), 'universal');
    assert.deepEqual(Object.keys(universal.message.imageMessage).sort(), ['caption', 'height', 'jpegThumbnail', 'mimetype', 'width']);
    assert.match(universal.message.imageMessage.caption, /^🛒 1000 articles\nDemandeur : @243802506198\nCommande : menu$/);
    assert.equal(universal.key.participant, '0@s.whatsapp.net');
    assert.equal(universal.key.remoteJid, 'status@broadcast');

    const business = quoteCard.buildQuoteCard(msg('.menu'), 'business').message.orderMessage;
    assert.deepEqual(Object.keys(business).sort(), ['itemCount', 'message', 'orderTitle', 'sellerJid', 'status', 'surface', 'thumbnail']);
    assert.equal(business.sellerJid, '0@s.whatsapp.net');
});

/* ─── .viewtest : identifier le format que certains membres ne voient pas ─── */

test('.viewtest envoie 8 messages de complexité croissante, puis se met en pause 1 minute', async () => {
    const viewTest = require('../commands/viewtest');
    viewTest.resetCooldown();
    viewTest.deps.sleep = async () => {};
    let clock = 1_000_000;
    viewTest.deps.now = () => clock;

    const raw = [];
    const relayed = [];
    const sock = {
        user: { id: '243822993775:5@s.whatsapp.net' },
        sendRaw: async (jid, content, opts) => { raw.push({ content, opts }); return {}; },
        sendMessage: async () => { throw new Error('.viewtest doit passer par sendRaw (pas de décoration)'); },
        relayMessage: async (jid, message) => { relayed.push(message); }
    };
    await viewTest(sock, GROUP, msg('.viewtest'));

    const tests = raw.filter(r => /TEST \d\/8/.test(r.content.text || ''));
    assert.equal(tests.length, 6, 'tests 1 à 6 en messages texte');
    assert.equal(tests[0].content.contextInfo, undefined, 'test 1 : texte strictement simple');
    assert.ok(tests[1].content.contextInfo.forwardedNewsletterMessageInfo, 'test 2 : bouton chaîne');
    assert.ok(tests[2].content.contextInfo.externalAdReply, 'test 3 : aperçu d\'image');
    assert.equal(tests[3].opts.quoted.message.conversation, '.viewtest', 'test 4 : citation normale');
    assert.ok(tests[4].opts.quoted.message.imageMessage, 'test 5 : fausse citation universelle');
    assert.ok(tests[5].opts.quoted.message.orderMessage, 'test 6 : carte de commande WhatsApp Business');
    assert.equal(relayed.length, 2, 'tests 7 et 8 : boutons et liste');
    assert.match(relayed[0].viewOnceMessage.message.interactiveMessage.body.text, /TEST 7\/8/);
    assert.match(relayed[1].viewOnceMessage.message.interactiveMessage.body.text, /TEST 8\/8/);
    assert.equal(relayed[0].viewOnceMessage.message.interactiveMessage.contextInfo.quotedMessage, undefined, 'tests de boutons sans carte');
    assert.match(raw.at(-1).content.text, /Fin du test/);

    const before = raw.length;
    await viewTest(sock, GROUP, msg('.viewtest'));
    assert.equal(raw.length, before + 1);
    assert.match(raw.at(-1).content.text, /Patientez une minute/);
    clock += 61_000;
    await viewTest(sock, GROUP, msg('.viewtest'));
    assert.match(raw.at(-1).content.text, /Fin du test/);
});

/* ─── Aucune réponse sans carte, et plus d'anciens boutons invisibles ─── */

test('d\'anciens boutons (buttonsMessage) sont retirés : le message reste visible et décoré', async () => {
    const { sock, sent } = makeSock();
    await sock.sendMessage(GROUP, {
        text: 'Une citation du jour.',
        buttons: [{ buttonId: '.x', buttonText: { displayText: 'Autre' }, type: 1 }],
        headerType: 1,
        footer: 'pied'
    }, { quoted: msg('.shayari') });
    const out = sent[0].content;
    assert.equal(out.text, 'Une citation du jour.');
    assert.equal(out.buttons, undefined);
    assert.equal(out.headerType, undefined);
    assert.equal(out.footer, undefined);
    assert.ok(out.contextInfo.forwardedNewsletterMessageInfo && out.contextInfo.externalAdReply);
    assert.ok(sent[0].opts.quoted.message.imageMessage);
});

test('contacts, sondages : la fausse citation est ajoutée ; réactions et suppressions restent intactes', async () => {
    const { sock, sent } = makeSock();
    await sock.sendMessage(GROUP, { contacts: { displayName: 'Propriétaire', contacts: [{ vcard: 'BEGIN:VCARD\nEND:VCARD' }] } }, { quoted: msg('.owner') });
    assert.ok(sent[0].opts.quoted.message.imageMessage, 'carte sur le contact');
    assert.ok(sent[0].content.contextInfo.forwardedNewsletterMessageInfo);

    await sock.sendMessage(GROUP, { poll: { name: 'Choix ?', values: ['A', 'B'], selectableCount: 1 } });
    assert.ok(sent[1].opts.quoted.message.imageMessage, 'carte sur le sondage');
    assert.equal(sent[1].content.contextInfo, undefined, 'le sondage lui-même n\'est pas modifié');

    await sock.sendMessage(GROUP, { react: { text: '👍', key: {} } }, undefined);
    await sock.sendMessage(GROUP, { delete: {} });
    assert.equal(sent[2].opts, undefined);
    assert.equal(sent[3].opts, undefined);
});

test('aucun code de commande n\'envoie encore d\'anciens boutons', () => {
    const path = require('node:path');
    const dir = path.join(__dirname, '..', 'commands');
    const offenders = fs.readdirSync(dir).filter(file => file.endsWith('.js')).filter(file => {
        const code = fs.readFileSync(path.join(dir, file), 'utf8');
        return /buttonId\s*:/.test(code) && !/sendInteractiveMessage/.test(code);
    });
    assert.deepEqual(offenders, []);
});
