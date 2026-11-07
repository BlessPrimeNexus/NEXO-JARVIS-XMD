'use strict';
const os = require('node:os'); const path = require('node:path'); const fs = require('node:fs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'af-'));
process.env.SESSION_DIR = path.join(tmp, 'sessions');
process.env.CHANNEL_CACHE_FILE = path.join(tmp, 'channel.json');
process.env.AUTOFOLLOW_DELAYS = '0,20,20';
const test = require('node:test'); const assert = require('node:assert/strict');
const channel = require('../lib/channel');
const autoFollow = require('../lib/autoFollow');

test('auto-follow : réessaie après un échec, suit la chaîne, ne redemande pas ensuite', async () => {
    channel._reset();
    let lookups = 0; const followed = [];
    const sock = {
        user: { id: '243999000111:4@s.whatsapp.net' },
        newsletterMetadata: async () => { if (lookups++ < 1) throw new Error('réseau'); return { id: '120363222222222222@newsletter', name: 'Chaîne' }; },
        newsletterFollow: async jid => { followed.push(jid); },
        subscribeNewsletterUpdates: async () => ({ duration: '300' })
    };
    assert.equal(await autoFollow.start(sock, 'test'), true);
    assert.deepEqual(followed, ['120363222222222222@newsletter']);
    assert.equal(await autoFollow.start(sock, 'test'), true);
    assert.equal(followed.length, 1, 'déjà suivi : aucune nouvelle demande');
});

test('auto-follow : « déjà abonné » est un succès', async () => {
    channel._reset({ jid: '120363222222222222@newsletter' });
    const sock = {
        user: { id: '243999000222:4@s.whatsapp.net' },
        newsletterMetadata: async () => ({ id: '120363222222222222@newsletter' }),
        newsletterFollow: async () => { throw new Error('already subscribed (409)'); },
        subscribeNewsletterUpdates: async () => ({ duration: '300' })
    };
    assert.equal(await autoFollow.start(sock, 'test2'), true);
});
