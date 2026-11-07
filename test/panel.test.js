'use strict';
process.env.NEXO_FANCY_FONT = '0';   // les tests lisent le texte en lettres normales (la police monospace est testée à part)

const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexo-panel-'));
process.env.PANEL_CONFIG_FILE = path.join(tmp, 'panel-config.json');
process.env.OWNERS_FILE = path.join(tmp, 'owners.json');
process.env.LANG_FILE = path.join(tmp, 'lang.json');
process.env.SESSION_DIR = path.join(tmp, 'sessions');
fs.mkdirSync(process.env.SESSION_DIR, { recursive: true });

const test = require('node:test');
const assert = require('node:assert/strict');

const settings = require('../settings');
const { panelCommand, duration } = require('../commands/panel');
const i18n = require('../lib/i18n');
const logBuffer = require('../lib/logBuffer');
const ownerAuth = require('../lib/ownerAuth');
const memoryGuard = require('../lib/memoryGuard');

const presentation = require('../lib/presentation');
const OWNER = '243802506198@s.whatsapp.net';
function setup(fromOwner = true) {
    const sent = [];
    // Même enveloppe que dans le bot : c'est elle qui traduit et habille les messages.
    const sock = presentation.wrapSocket({ user: { id: '243822993775:1@s.whatsapp.net' }, sendMessage: async (jid, content) => { sent.push(content); return { key: { id: 'T', remoteJid: jid, fromMe: true }, message: {} }; }, relayMessage: async () => ({}) });
    const message = { key: { remoteJid: '1@g.us', participant: fromOwner ? OWNER : '243999999999@s.whatsapp.net', fromMe: false } };
    return { sock, sent, message };
}
// Les cadres coupent les lignes longues (« │ ») : on les recolle pour tester le contenu.
const textOf = (sent) => sent.map(item => item.text || item.caption || '').join('\n').replace(/\n\s*/g, ' ').replace(/ {2,}/g, ' ');

test('un non-propriétaire est refusé par chaque commande du panel', async () => {
    for (const name of ['panel', 'ram', 'gc', 'logs', 'disk', 'restart', 'config', 'owners', 'lang']) {
        const { sock, sent, message } = setup(false);
        await panelCommand(sock, '1@g.us', message, name, name === 'restart' ? 'oui' : '');
        assert.match(textOf(sent), /réservé au propriétaire/, name);
    }
});

test('.panel : tableau de bord avec sessions, RAM et langue', async () => {
    const { sock, sent, message } = setup();
    await panelCommand(sock, '1@g.us', message, 'panel', '');
    const text = textOf(sent);
    assert.match(text, /Panel de contrôle/);
    assert.match(text, /RAM/);
    assert.match(text, /Langue/);
});

test('.ram et .gc : mesures réelles et nettoyage', async () => {
    const { sock, sent, message } = setup();
    await panelCommand(sock, '1@g.us', message, 'ram', '');
    assert.match(textOf(sent), /Mémoire du bot[\s\S]*RAM \(RSS\)/);
    sent.length = 0;
    await panelCommand(sock, '1@g.us', message, 'gc', '');
    assert.match(textOf(sent), /NETTOYAGE TERMINÉ/);
});

test('.logs : montre les dernières lignes de la console', async () => {
    logBuffer.install();
    console.log('ligne-test-visible');
    console.error('erreur-test-visible');
    const { sock, sent, message } = setup();
    await panelCommand(sock, '1@g.us', message, 'logs', '');
    assert.match(textOf(sent), /ligne-test-visible/);
    sent.length = 0;
    await panelCommand(sock, '1@g.us', message, 'logs', 'err');
    assert.match(textOf(sent), /erreur-test-visible/);
    assert.ok(!/ligne-test-visible/.test(textOf(sent)));
});

test('.disk : tailles des dossiers', async () => {
    fs.writeFileSync(path.join(process.env.SESSION_DIR, 'x.bin'), Buffer.alloc(2048));
    const { sock, sent, message } = setup();
    await panelCommand(sock, '1@g.us', message, 'disk', '');
    assert.match(textOf(sent), /Espace disque[\s\S]*Sessions/);
});

test('.config : set / get / reset réellement appliqués et conservés', async () => {
    const original = settings.ownerRole;
    const { sock, sent, message } = setup();
    await panelCommand(sock, '1@g.us', message, 'config', 'set ownerRole Chef du projet');
    assert.equal(settings.ownerRole, 'Chef du projet');
    assert.equal(JSON.parse(fs.readFileSync(process.env.PANEL_CONFIG_FILE, 'utf8')).ownerRole, 'Chef du projet');
    await panelCommand(sock, '1@g.us', message, 'config', 'set cleSecrete valeur');
    assert.match(textOf(sent), /RÉGLAGE REFUSÉ/);
    await panelCommand(sock, '1@g.us', message, 'config', 'reset ownerRole');
    assert.equal(settings.ownerRole, original);
    await panelCommand(sock, '1@g.us', message, 'config', 'set ownerSendContact oui');
    assert.equal(settings.ownerSendContact, true);
    await panelCommand(sock, '1@g.us', message, 'config', 'reset ownerSendContact');
});

test('.owners : ajout réel d\'un propriétaire, qui peut alors utiliser les commandes strictes', async () => {
    const { sock, sent, message } = setup();
    await panelCommand(sock, '1@g.us', message, 'owners', 'add +243 811 222 333');
    assert.ok(ownerAuth.ownerNumbers().has('243811222333'));
    const msg2 = { key: { remoteJid: '1@g.us', participant: '243811222333@s.whatsapp.net', fromMe: false } };
    assert.equal(await ownerAuth.isOwnerMessage(sock, msg2, '1@g.us'), true);
    await panelCommand(sock, '1@g.us', message, 'owners', 'remove 243811222333');
    assert.equal(ownerAuth.ownerNumbers().has('243811222333'), false);
    sent.length = 0;
    await panelCommand(sock, '1@g.us', message, 'owners', 'remove 243802506198');
    assert.match(textOf(sent), /non supprimable/);
    assert.ok(ownerAuth.ownerNumbers().has('243802506198'));
});

test('.restart : sans « oui » il demande confirmation et ne coupe rien', async () => {
    const { sock, sent, message } = setup();
    await panelCommand(sock, '1@g.us', message, 'restart', '');
    assert.match(textOf(sent), /REDÉMARRER LE BOT \?/);
});

test('.lang : bascule réellement anglais / français', async () => {
    const { sock, sent, message } = setup();
    await panelCommand(sock, '1@g.us', message, 'lang', 'en');
    assert.equal(i18n.getLang(), 'en');
    assert.match(textOf(sent), /LANGUAGE CHANGED/);
    assert.equal(JSON.parse(fs.readFileSync(process.env.LANG_FILE, 'utf8')).lang, 'en');
    sent.length = 0;
    await panelCommand(sock, '1@g.us', message, 'panel', '');
    assert.match(textOf(sent), /Control Panel/);
    await panelCommand(sock, '1@g.us', message, 'lang', 'fr');
    assert.equal(i18n.getLang(), 'fr');
});

test('traduction : menus, ping et boutons ; texte IA intact', () => {
    i18n.setLang('en');
    try {
        assert.match(i18n.translate('│ 🏓 Latence : *10 ms*'), /Latency/);
        assert.match(i18n.translate('⛔ Accès réservé au propriétaire du système, Monsieur.'), /Access restricted to the system owner, Sir\./);
        assert.equal(i18n.translate('1 commande'), '1 command');
        const [button] = i18n.translateButtons([{ name: 'quick_reply', params: { display_text: '↩️ Menu principal', id: '.menu' } }]);
        assert.equal(button.params.display_text, '↩️ Main menu');
        assert.equal(button.params.id, '.menu');
    } finally {
        i18n.setLang('fr');
    }
    assert.equal(i18n.translate('Monsieur'), 'Monsieur');
});

test('protection mémoire : le nettoyage exécute tous les nettoyeurs enregistrés', () => {
    let called = 0;
    memoryGuard.registerTrimmer('test', () => { called += 1; });
    const result = memoryGuard.trim('quiet');
    assert.equal(called, 1);
    assert.ok(result.cleared.includes('test'));
    assert.ok(memoryGuard.snapshot().rss > 0);
});

test('durée lisible', () => {
    assert.equal(duration(45), '45 s');
    assert.equal(duration(3700), '1 h 1 min');
});
