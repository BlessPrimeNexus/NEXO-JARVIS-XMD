'use strict';
process.env.NEXO_FANCY_FONT = '0';
const fs = require('node:fs'); const path = require('node:path');
const sessionContext = require('../lib/sessionContext');
sessionContext.install();
const test = require('node:test'); const assert = require('node:assert/strict');
const theme = require('../lib/theme');
const presentation = require('../lib/presentation');
const themeCommand = require('../commands/theme');
const actions = require('../lib/actions');

const A = '990000000311'; const B = '990000000322';
const as = (number, fn) => sessionContext.runWithSession(number, fn);
test.after(() => { for (const n of [A, B]) fs.rmSync(path.join(sessionContext.SESSIONS_ROOT, n), { recursive: true, force: true }); });

test('thèmes intégrés : chacun a au moins 5 images', () => {
    const ids = theme.list().map(t => t.id);
    for (const id of ['jarvis', 'escanor', 'jinwoo', 'spiderman', 'zerotwo', 'gojo', 'sakura']) assert.ok(ids.includes(id), id);
    for (const t of theme.list()) {
        const count = fs.readdirSync(t.dir).filter(f => /\.(jpe?g|png)$/i.test(f)).length;
        assert.ok(count >= (t.id === 'jarvis' ? 10 : 5), `${t.id} : ${count} images`);
    }
});

test('le thème est propre à chaque session', () => {
    as(A, () => theme.set('escanor'));
    assert.equal(as(A, () => theme.currentId()), 'escanor');
    assert.equal(as(B, () => theme.currentId()), 'jarvis', 'B garde le thème par défaut');
    as(A, () => theme.set('jarvis'));
});

test('les images suivent le thème actif', () => {
    as(A, () => theme.set('spiderman'));
    const spider = as(A, () => presentation.localImages());
    const jarvis = as(B, () => presentation.localImages());
    assert.ok(spider.length >= 5 && spider.every(f => f.includes(`${path.sep}spiderman${path.sep}`)));
    assert.ok(jarvis.every(f => f.includes('jarvis-images')));
    as(A, () => theme.set('jarvis'));
});

test('le style change : cadres, puces et séparateur du thème', () => {
    const base = '✦『 Titre 』✦\n  ◇ Libellé → valeur\n  ◈ .commande\n  ✦ ──────────────── ✦';
    assert.equal(as(B, () => theme.restyle(base)), base, 'thème par défaut : inchangé');
    as(A, () => theme.set('escanor'));
    const out = as(A, () => theme.restyle(base));
    assert.match(out, /^☀『 Titre 』☀/); assert.match(out, /\n  ✺ Libellé/); assert.match(out, /\n  ✹ \.commande/); assert.match(out, /☀ ─{16} ☀$/);
    as(A, () => theme.set('zerotwo'));
    assert.match(as(A, () => theme.restyle(base)), /^💗『 Titre 』💗/);
    as(A, () => theme.set('jarvis'));
});

test('le texte réellement envoyé porte le style du thème', async () => {
    as(A, () => theme.set('jinwoo'));
    const out = await as(A, () => presentation.decorate('1@g.us', { text: '✦『 Test 』✦\n  ◇ A → b\n  ✦ ──────────────── ✦', __noframe: true }));
    assert.match(out.text ?? out.caption, /⟡『 Test 』⟡/);
    as(A, () => theme.set('jarvis'));
});

test('.theme : liste, activation (image du thème + légende), thème inconnu', async () => {
    const sent = [];
    const sock = { sendMessage: async (jid, content) => { sent.push(content); return {}; } };
    const message = { key: {}, message: {} };
    await as(A, () => themeCommand(sock, '1@g.us', message, ''));
    assert.match(sent[0].text, /Escanor/); assert.match(sent[0].text, /Zero Two/); assert.match(sent[0].text, /Sung Jin-woo/);
    await as(A, () => themeCommand(sock, '1@g.us', message, 'escanor'));
    assert.match(sent[1].caption || sent[1].text, /Escanor/);
    assert.equal(as(A, () => theme.currentId()), 'escanor');
    await as(A, () => themeCommand(sock, '1@g.us', message, 'inexistant'));
    assert.match(sent[2].text, /inconnu/);
    as(A, () => theme.set('jarvis'));
});

test('.theme : un bouton par thème dans les actions', () => {
    const { options } = actions.optionsFor('theme', '');
    assert.ok(options.length >= 7);
    assert.ok(options.some(o => o.cmd === 'theme escanor'));
});

test('un dossier themes/<nom>/ ajouté par l\'utilisateur devient un thème', () => {
    const dir = path.join(theme.THEMES_DIR, 'montheme');
    fs.mkdirSync(dir, { recursive: true });
    try {
        fs.writeFileSync(path.join(dir, 'a.jpg'), Buffer.alloc(100));
        assert.ok(theme.list().some(t => t.id === 'montheme' && t.name === 'Montheme'));
        assert.ok(theme.find('MonTheme'));
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
