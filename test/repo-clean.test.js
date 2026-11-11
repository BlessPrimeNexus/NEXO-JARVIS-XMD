'use strict';
process.env.NEXO_FANCY_FONT = '0';
const fs = require('node:fs'); const path = require('node:path');
const test = require('node:test'); const assert = require('node:assert/strict');
const settings = require('../settings');
const repo = require('../commands/repo');

test('URLs officielles : dépôt GitHub et panneau de connexion', () => {
    assert.equal(settings.repoUrl, 'https://github.com/BlessPrimeNexus/NEXO-JARVIS-XMD');
    assert.equal(settings.panelUrl, 'https://nexo-jarvis-xmd-production.up.railway.app');
});

test('.repo : fiche au style .owner, sans signature, liens dans les boutons', () => {
    const text = repo.repoCardText({ stargazers_count: 12, forks_count: 3 });
    assert.match(text, /Dépôt/); assert.match(text, /Étoiles/);
    assert.ok(!/©|Power|ᴄᴏɴçᴜ|Website disponible/i.test(text));
    const buttons = repo.repoButtons('.');
    const urls = buttons.filter(b => b.name === 'cta_url').map(b => b.params.url);
    assert.deepEqual(urls, ['https://github.com/BlessPrimeNexus/NEXO-JARVIS-XMD', 'https://nexo-jarvis-xmd-production.up.railway.app']);
    assert.ok(buttons.some(b => b.name === 'cta_copy'));
});

test('plus aucune signature ni ancienne URL dans le code', () => {
    const bad = [/© 20\d\d/, /©Power by/i, /POWERED BY NEXO/i, /ᴄᴏɴçᴜ ᴘᴀʀ/, /BlessPrimeNexusDev/, /nexo-jarvis-xmd\.onrender\.com/, /DOWNLOADED BY|𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗗/];
    const hits = [];
    for (const dir of ['commands', 'lib', 'public']) {
        for (const file of fs.readdirSync(path.join(__dirname, '..', dir))) {
            if (!/\.(js|html)$/.test(file)) continue;
            const text = fs.readFileSync(path.join(__dirname, '..', dir, file), 'utf8');
            for (const pattern of bad) if (pattern.test(text)) hits.push(`${dir}/${file} : ${pattern}`);
        }
    }
    for (const file of ['main.js', 'settings.js', 'web.js']) {
        const text = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
        for (const pattern of bad) if (pattern.test(text)) hits.push(`${file} : ${pattern}`);
    }
    assert.deepEqual(hits, []);
});
