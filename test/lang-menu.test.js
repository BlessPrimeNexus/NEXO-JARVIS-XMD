'use strict';
const os = require('node:os'); const path = require('node:path'); const fs = require('node:fs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lang-'));
process.env.LANG_FILE = path.join(tmp, 'lang.json'); process.env.TRANSLATION_CACHE_FILE = path.join(tmp, 'tr.json');
process.env.NEXO_FANCY_FONT = '0';
const test = require('node:test'); const assert = require('node:assert/strict');
const i18n = require('../lib/i18n'); const help = require('../commands/help');

test('français : le menu et ses boutons ne contiennent aucun texte anglais', async () => {
    i18n.setLang('fr');
    const text = help.overviewText({ user: 'tetsu', prefix: '.' });
    for (const english of ['Good ', 'Creator', 'Please select', 'Visit My', 'Use responsibly', 'INFORMATION BOT', 'Uptime']) assert.ok(!text.includes(english), english);
    const buttons = JSON.stringify(help.listButtonRows('.')) + JSON.stringify([help.listButtonRows]);
    assert.ok(!/Please select|Visit My/.test(buttons));
});

test('anglais : texte ET boutons du menu sont traduits (dictionnaire, sans réseau)', async () => {
    i18n._setFetcher(async segments => segments);   // service de traduction « muet » : le dictionnaire doit suffire
    i18n.setLang('en');
    try {
        const [text] = await i18n.translateMany([help.overviewText({ user: 'tetsu', prefix: '.' })]);
        assert.match(text, /WHATSAPP BOT MULTI DEVICE/);
        assert.match(text, /BOT INFORMATION/);
        assert.match(text, /Creator/);
        const buttons = await i18n.translateButtonsAsync([
            { name: 'cta_url', params: { display_text: 'Visiter mon créateur', url: 'https://wa.me/1' } },
            { name: 'single_select', params: { title: 'Veuillez choisir une catégorie', sections: [] } }
        ]);
        assert.equal(buttons[0].params.display_text, 'Visit My Creator');
        assert.equal(buttons[1].params.title, 'Please select any category');
        assert.equal(buttons[0].params.url, 'https://wa.me/1');
    } finally { i18n.setLang('fr'); }
});
