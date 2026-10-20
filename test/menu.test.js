'use strict';

process.env.NEXO_NO_THUMBNAIL_FETCH = '1';
process.env.PREVIEW_IMAGES = 'https://files.catbox.moe/aaa111.jpg,https://files.catbox.moe/bbb222.jpg';
process.env.DISPLAY_FLAGS_FILE = require('node:path').join(require('node:os').tmpdir(), `nexo-display-${process.pid}.json`);

const test = require('node:test');
const assert = require('node:assert/strict');
const { generateWAMessageFromContent, proto } = require('@whiskeysockets/baileys');

const displayFlags = require('../lib/displayFlags');
const { wrapSocket } = require('../lib/presentation');
const quoteCard = require('../lib/quoteCard');
const { selectedInteractiveId, isInteractiveResponse } = require('../lib/interactiveReply');
const { bizNodes } = require('../lib/interactiveButtons');
const settings = require('../settings');
const helpCommand = require('../commands/help');

const GROUP = '120363000000000000@g.us';
const DM = '243802506198@s.whatsapp.net';

function makeSock(options = {}) {
    const sent = [];
    const relayed = [];
    const sock = wrapSocket({
        user: { id: '243822993775:5@s.whatsapp.net' },
        sendMessage: async (jid, content, opts) => { sent.push({ jid, content, opts }); return {}; },
        relayMessage: async (jid, message, opts) => {
            if (options.failRelay) throw new Error('relay refusé');
            relayed.push({ jid, message, opts });
            return 'ok';
        }
    });
    return { sock, sent, relayed };
}
const command = (text, jid = GROUP) => ({
    key: { id: 'ABC', remoteJid: jid, participant: '243802506198@s.whatsapp.net' },
    message: { conversation: text }
});
const withStyle = async (style, fn) => {
    displayFlags.override('menuStyle', style);
    try { return await fn(); } finally { displayFlags.override('menuStyle', undefined); }
};
const barOf = (relayed, index = 0) => relayed[index].message.viewOnceMessage.message.interactiveMessage;

/* ─── Fausse citation « WhatsApp ✓ • Statut » sur CHAQUE réponse ─── */

test('une commande est citée sous forme de fausse citation avec demandeur et commande', () => {
    const card = quoteCard.applyQuoteCard(command('.menu 2'), GROUP);
    assert.equal(card.key.remoteJid, 'status@broadcast');
    assert.equal(card.key.participant, '0@s.whatsapp.net');
    const image = card.message.imageMessage;
    assert.match(image.caption, /^🛒 1000 articles/);
    assert.match(image.caption, /Demandeur : @243802506198/);
    assert.match(image.caption, /Commande : menu$/);
    assert.ok(image.jpegThumbnail.length > 1000, 'miniature du logo embarquée');
});

test('tous les messages reçoivent la carte : conversation, média, et même sans rien citer', () => {
    const chat = quoteCard.applyQuoteCard(command('bonjour tout le monde'), GROUP);
    assert.match(chat.message.imageMessage.caption, /Commande : conversation/);
    const sticker = quoteCard.applyQuoteCard({ key: { id: 'S', participant: '1@s.whatsapp.net' }, message: { stickerMessage: {} } }, GROUP);
    assert.match(sticker.message.imageMessage.caption, /Commande : média/);
    const spontaneous = quoteCard.applyQuoteCard(undefined, GROUP);
    assert.match(spontaneous.message.imageMessage.caption, /Commande : automatique/);
});

test('pas de carte vers les chaînes, les statuts, ni quand elle est désactivée', () => {
    const original = command('.ping');
    assert.equal(quoteCard.applyQuoteCard(original, '1@newsletter'), original);
    assert.equal(quoteCard.applyQuoteCard(original, 'status@broadcast'), original);
    displayFlags.override('quoteCard', false);
    try { assert.equal(quoteCard.applyQuoteCard(original, GROUP), original); } finally { displayFlags.override('quoteCard', undefined); }
});

test('chaque réponse du bot porte la carte, le bouton chaîne et l\'aperçu — avec ou sans citation', async () => {
    const { sock, sent } = makeSock();
    await sock.sendMessage(GROUP, { text: 'Opération terminée, Monsieur.' }, { quoted: command('.ping') });
    await sock.sendMessage(GROUP, { text: 'Message spontané (bienvenue, alerte…).' });
    await sock.sendMessage(GROUP, { audio: Buffer.from('ID3'), mimetype: 'audio/mpeg' }, { quoted: command('.song x') });
    await sock.sendMessage(GROUP, { react: { text: '👍', key: {} } });

    for (const reply of sent.slice(0, 3)) {
        assert.ok(reply.opts.quoted.message.imageMessage, 'fausse citation');
        assert.ok(reply.content.contextInfo.forwardedNewsletterMessageInfo, 'bouton chaîne');
    }
    assert.ok(sent[0].content.contextInfo.externalAdReply && sent[1].content.contextInfo.externalAdReply, 'aperçu sur les textes');
    assert.equal(sent[2].content.contextInfo.externalAdReply, undefined, 'un audio ne peut pas porter d\'aperçu de lien');
    assert.equal(sent[3].opts, undefined, 'une réaction n\'est jamais modifiée');
});

test('Baileys encode un message avec la fausse citation sans erreur', async () => {
    for (const style of ['universal', 'business']) {
        const quoted = quoteCard.buildQuoteCard(command('.alive'), style);
        const generated = generateWAMessageFromContent(GROUP, { extendedTextMessage: { text: 'ok' } }, { quoted, userJid: '1@s.whatsapp.net' });
        const ctx = generated.message.extendedTextMessage.contextInfo;
        assert.equal(ctx.participant, '0@s.whatsapp.net');
        assert.equal(ctx.remoteJid, 'status@broadcast');
        assert.ok(style === 'universal' ? ctx.quotedMessage.imageMessage : ctx.quotedMessage.orderMessage);
        assert.ok(proto.Message.encode(generated.message).finish().length > 0);
    }
});

/* ─── Réponses de boutons ─── */

test('un choix de liste ou un bouton rapide est lu comme une commande', () => {
    const listChoice = { message: { interactiveResponseMessage: { nativeFlowResponseMessage: { name: 'single_select', paramsJson: '{"title":"Groupe","id":".menu 5"}' } } } };
    const quick = { message: { interactiveResponseMessage: { nativeFlowResponseMessage: { name: 'quick_reply', paramsJson: '{"display_text":"Menu complet","id":".allmenu"}' } } } };
    const oldList = { message: { listResponseMessage: { singleSelectReply: { selectedRowId: '.menu 3' } } } };
    assert.equal(selectedInteractiveId(listChoice), '.menu 5');
    assert.equal(selectedInteractiveId(quick), '.allmenu');
    assert.equal(selectedInteractiveId(oldList), '.menu 3');
    assert.equal(selectedInteractiveId({ message: { conversation: 'salut' } }), '');
    assert.equal(selectedInteractiveId({ message: { interactiveResponseMessage: { nativeFlowResponseMessage: { name: 'single_select', paramsJson: '{pas du json' } } } }), '');
    assert.equal(selectedInteractiveId(null), '');
});

const listChoice = (paramsJson, extra = {}) => ({
    key: { id: '3A' + Math.random().toString(16).slice(2, 10).toUpperCase(), remoteJid: DM, fromMe: extra.fromMe === true },
    messageTimestamp: Math.floor(Date.now() / 1000),
    message: {
        interactiveResponseMessage: {
            body: { text: extra.body || '🧠 Intelligence artificielle\n5 commandes' },
            contextInfo: { stanzaId: 'MENU', participant: '243822993775@s.whatsapp.net' },
            nativeFlowResponseMessage: { name: extra.name || 'single_select', paramsJson, version: 3 }
        }
    }
});

test('le nom du bouton n\'a pas d\'importance : toute réponse avec un id est lue', () => {
    assert.equal(selectedInteractiveId(listChoice('{"id":".menu 6"}', { name: 'autre_nom' })), '.menu 6');
    assert.equal(selectedInteractiveId(listChoice('{"selectedRowId":".menu 7"}')), '.menu 7');
    assert.equal(selectedInteractiveId(listChoice('{"id":"https://x.test"}', { name: 'cta_url' })), '');
});

test('sans identifiant, le titre de la ligne choisie retrouve la catégorie', () => {
    const resolve = (title) => helpCommand.resolveMenuChoice(title, '.');
    const noId = listChoice('{}');
    assert.equal(selectedInteractiveId(noId, resolve), '.menu 6');
    assert.equal(selectedInteractiveId(listChoice('', { body: 'Menu complet\nToutes les commandes' }), resolve), '.allmenu');
    assert.equal(selectedInteractiveId(listChoice('{}', { body: '🔐 Confidentialité\n5 commandes' }), resolve), '.menu 1');
    assert.equal(selectedInteractiveId(listChoice('{}', { body: 'Inconnu\nx' }), resolve), '');
    assert.equal(isInteractiveResponse(noId), true);
    assert.equal(isInteractiveResponse({ message: { conversation: 'a' } }), false);
});

test('répondre à un choix de liste cite la carte « commande », pas la réponse brute', async () => {
    const choice = listChoice('{"id":".menu 6"}');
    const card = quoteCard.applyQuoteCard(choice, DM);
    assert.match(card.message.imageMessage.caption, /Commande : menu$/);
    const { sock, sent } = makeSock();
    await helpCommand(sock, DM, choice, '6');
    assert.ok(sent[0].opts.quoted.message.imageMessage);
});

/* ─── Menu : mixte (défaut), complet, texte ─── */

test('.menu (mixte, défaut) : menu texte visible partout PUIS barre de boutons', async () => {
    const { sock, sent, relayed } = makeSock();
    await helpCommand(sock, GROUP, command('.menu'), '');
    assert.equal(sent.length, 1);
    assert.match(sent[0].content.text, /𝗡𝗘𝗫𝗢-𝗝𝗔𝗥𝗩𝗜𝗦 𝗫𝗠𝗗/);
    assert.match(sent[0].content.text, /ᴄᴀᴛéɢᴏʀɪᴇs/);
    assert.ok(sent[0].content.contextInfo.forwardedNewsletterMessageInfo, 'bouton chaîne sur le menu texte');
    assert.ok(sent[0].content.contextInfo.externalAdReply, 'aperçu sur le menu texte');
    assert.ok(sent[0].opts.quoted.message.imageMessage, 'fausse citation sur le menu texte');
    assert.deepEqual(sent[0].content.mentions, ['243802506198@s.whatsapp.net']);

    assert.equal(relayed.length, 1);
    const bar = barOf(relayed);
    assert.deepEqual(bar.nativeFlowMessage.buttons.map(b => b.name), ['single_select', 'quick_reply', 'cta_url']);
    assert.match(bar.body.text, /Choisissez une catégorie/);
    assert.ok(bar.contextInfo.forwardedNewsletterMessageInfo, 'bouton chaîne sur la barre');
    assert.ok(bar.contextInfo.externalAdReply, 'aperçu sur la barre');
    assert.ok(bar.contextInfo.quotedMessage.imageMessage, 'fausse citation sur la barre');
});

test('la liste de la barre contient les 17 catégories avec des identifiants de commande valides', async () => {
    const { sock, relayed } = makeSock();
    await helpCommand(sock, GROUP, command('.menu'), '');
    const buttons = barOf(relayed).nativeFlowMessage.buttons;
    const list = JSON.parse(buttons[0].buttonParamsJson);
    const ids = list.sections.flatMap(section => section.rows.map(row => row.id));
    assert.ok(list.sections.every(section => section.rows.length <= 10));
    assert.ok(ids.includes('.menu 1') && ids.includes('.menu 17'));
    assert.ok(ids.includes('.allmenu') && ids.includes('.ping'));
    assert.equal(new Set(ids).size, ids.length, 'identifiants uniques');
    const cta = JSON.parse(buttons[2].buttonParamsJson);
    assert.equal(cta.display_text, 'CHAÎNE');
    assert.match(cta.url, /^https:\/\/whatsapp\.com\/channel\//);
});

test('une catégorie : commandes en texte, puis barre avec bouton retour', async () => {
    const { sock, sent, relayed } = makeSock();
    await helpCommand(sock, GROUP, command('.menu 5'), '5');
    assert.match(sent[0].content.text, /┃ ➠ 01 • \./);
    assert.match(sent[0].content.text, /Catégorie 5\/17/);
    const back = JSON.parse(barOf(relayed).nativeFlowMessage.buttons[1].buttonParamsJson);
    assert.equal(back.id, '.menu');
});

test('.allmenu : texte complet puis barre de boutons', async () => {
    const { sock, sent, relayed } = makeSock();
    await helpCommand(sock, GROUP, command('.allmenu'), 'allmenu');
    assert.ok(sent[0].content.text.length > 3000);
    assert.equal(relayed.length, 1);
});

test('le menu texte est livré même si la barre de boutons échoue', async () => {
    const { sock, sent, relayed } = makeSock({ failRelay: true });
    await helpCommand(sock, GROUP, command('.menu'), '');
    assert.equal(relayed.length, 0);
    assert.equal(sent.length, 1);
    assert.match(sent[0].content.text, /ᴄᴀᴛéɢᴏʀɪᴇs/);
});

test('style « complet » : un seul message à boutons (comme avant) ; repli texte si refusé', async () => {
    await withStyle('complet', async () => {
        const { sock, sent, relayed } = makeSock();
        await helpCommand(sock, GROUP, command('.menu'), '');
        assert.equal(sent.length, 0);
        assert.equal(relayed.length, 1);
        const interactive = barOf(relayed);
        assert.match(interactive.body.text, /𝗡𝗘𝗫𝗢-𝗝𝗔𝗥𝗩𝗜𝗦/);
        assert.match(interactive.footer.text, /À votre service/);
        assert.ok(interactive.contextInfo.quotedMessage.imageMessage);
        assert.deepEqual(interactive.contextInfo.mentionedJid, ['243802506198@s.whatsapp.net']);

        const failing = makeSock({ failRelay: true });
        await helpCommand(failing.sock, GROUP, command('.menu'), '');
        assert.equal(failing.sent.length, 1);
    });
});

test('style « texte » : aucun message à boutons', async () => {
    await withStyle('texte', async () => {
        const { sock, sent, relayed } = makeSock();
        await helpCommand(sock, GROUP, command('.menu'), '');
        assert.equal(relayed.length, 0);
        assert.equal(sent.length, 1);
    });
});

test('nœuds biz : groupe = biz, conversation privée = biz + bot', () => {
    assert.deepEqual(bizNodes(GROUP).map(n => n.tag), ['biz']);
    assert.deepEqual(bizNodes(DM).map(n => n.tag), ['biz', 'bot']);
    settings.interactiveBizNodes = false;
    try { assert.equal(bizNodes(GROUP), null); } finally { delete settings.interactiveBizNodes; }
});

test('catégorie inconnue : le menu principal est renvoyé avec un message JARVIS', async () => {
    const { sock, sent } = makeSock();
    await helpCommand(sock, GROUP, command('.menu zzz'), 'zzz');
    assert.match(sent[0].content.text, /aucune catégorie correspondant à \*zzz\*/);
});

test('main.js : choisir une catégorie dans la liste affiche le menu de cette catégorie', () => {
    // Processus séparé : main.js démarre des minuteries qui bloqueraient le lanceur de tests.
    const { spawnSync } = require('node:child_process');
    const run = spawnSync(process.execPath, [require('node:path').join(__dirname, 'helpers', 'menu-flow.js')], { encoding: 'utf8', timeout: 60000 });
    assert.equal(run.status, 0, run.stderr);
    const line = run.stdout.split('\n').find(l => l.includes('RESULT:'));
    assert.ok(line, 'le script de simulation doit afficher son résultat');
    const results = JSON.parse(line.slice(line.indexOf('RESULT:') + 7));
    assert.equal(results.length, 3);
    for (const result of results) {
        assert.ok(result.replies >= 1, `aucune réponse (${result.label})`);
        assert.match(result.body, /Catégorie 6\/17/, `mauvais menu (${result.label})`);
    }
});
