'use strict';

// Exécuté dans un processus séparé par test/menu.test.js :
// simule le choix d'une catégorie dans la liste du menu et affiche le résultat en JSON.
process.env.NEXO_NO_THUMBNAIL_FETCH = '1';
process.env.PREVIEW_IMAGES = 'https://files.catbox.moe/aaa111.jpg';

const { wrapSocket } = require('../../lib/presentation');
const { handleMessages } = require('../../main');

const choice = (fromMe, remoteJid, participant) => ({
    key: { id: '3A' + Math.random().toString(16).slice(2, 10).toUpperCase(), remoteJid, fromMe, participant },
    messageTimestamp: Math.floor(Date.now() / 1000),
    message: {
        interactiveResponseMessage: {
            body: { text: '🧠 Intelligence artificielle\n5 commandes' },
            contextInfo: { stanzaId: 'MENU', participant: '243822993775@s.whatsapp.net' },
            nativeFlowResponseMessage: { name: 'single_select', paramsJson: '{"id":".menu 6"}', version: 3 }
        }
    }
});

(async () => {
    const results = [];
    const cases = [
        ['dm', false, '243802506198@s.whatsapp.net', undefined],
        ['auto-conversation', true, '243822993775@s.whatsapp.net', undefined],
        ['groupe', false, '120363000000000000@g.us', '243802506198@s.whatsapp.net']
    ];
    for (const [label, fromMe, jid, participant] of cases) {
        const relayed = [];
        const sent = [];
        const sock = wrapSocket({
            user: { id: '243822993775:5@s.whatsapp.net' },
            public: true,
            sendMessage: async (to, content) => { sent.push(content); return {}; },
            relayMessage: async (to, message) => { relayed.push(message); return 'ok'; },
            groupMetadata: async () => ({ participants: [] }),
            readMessages: async () => {},
            sendPresenceUpdate: async () => {}
        });
        await handleMessages(sock, { type: 'notify', messages: [choice(fromMe, jid, participant)] }, true);
        const interactive = relayed[0]?.viewOnceMessage?.message?.interactiveMessage;
        results.push({ label, replies: relayed.length + sent.length, body: sent.map(c => c.text || '').join('\n') + '\n' + (interactive?.body?.text || '') });
    }
    process.stdout.write('RESULT:' + JSON.stringify(results));
    process.exit(0);
})().catch(error => { console.error('ÉCHEC', error); process.exit(1); });
