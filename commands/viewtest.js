'use strict';

/*
 * .viewtest — identifie le format de message qu'un membre ne reçoit pas.
 *
 * Quand une réponse du bot est invisible pour certains (ni message ni notification) alors
 * que la réaction emoji arrive, le message est bien livré mais le téléphone ne sait pas
 * l'afficher. Cette commande envoie 10 messages, du plus simple au plus riche. Le membre
 * indique les numéros qu'il voit : le premier qui manque désigne le format fautif.
 */

const { sendInteractiveMessage } = require('../lib/interactiveButtons');
const { previewAdReply, decorateContextInfo, nextPhoto } = require('../lib/presentation');
const { buildQuoteCard } = require('../lib/quoteCard');
const channel = require('../lib/channel');

const COOLDOWN_MS = 60 * 1000;
const lastRun = new Map();
const deps = { sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)), now: () => Date.now() };

function channelLink() {
    return channel.link();
}

async function viewTestCommand(sock, chatId, message) {
    const send = sock.sendRaw || sock.sendMessage.bind(sock);
    const now = deps.now();
    if (now - (lastRun.get(chatId) || 0) < COOLDOWN_MS) {
        await send(chatId, { text: 'Un test d\'affichage vient d\'être lancé ici, Monsieur. Patientez une minute avant d\'en relancer un.' }, { quoted: message });
        return;
    }
    lastRun.set(chatId, now);

    const total = 10;
    const title = (n, label) => `🧪 TEST ${n}/${total} — ${label}`;
    const pause = () => deps.sleep(1500);

    await send(chatId, {
        text: '🧪 *Test d\'affichage*\n\nJe vais envoyer 10 messages, du plus simple au plus riche. ' +
            'Notez les numéros que vous *voyez* et envoyez-les moi (exemple : « 1, 2, 3 »).'
    }, { quoted: message });
    await pause();

    const steps = [
        () => send(chatId, { text: title(1, 'Texte simple') }),
        () => send(chatId, { text: title(2, 'Texte avec bouton « Voir la chaîne »'), contextInfo: decorateContextInfo({}) }),
        async () => {
            // Aperçu d'image à miniature intégrée (aucun lien distant à télécharger côté téléphone).
            const preview = await previewAdReply();
            return send(chatId, { text: title(3, 'Aperçu de lien (désactivé dans le bot : peut manquer)'), contextInfo: preview ? { externalAdReply: preview } : {} });
        },
        () => send(chatId, { text: title(4, 'Texte qui cite votre message (citation normale)') }, { quoted: message }),
        () => send(chatId, { text: title(5, 'Texte avec la fausse citation universelle') }, { quoted: buildQuoteCard(message, 'universal') }),
        () => send(chatId, { text: title(6, 'Texte avec la carte de commande « WhatsApp Business »') }, { quoted: buildQuoteCard(message, 'business') }),
        () => sendInteractiveMessage(sock, chatId, {
            title: 'TEST 7',
            body: title(7, 'Boutons (bouton rapide + chaîne)'),
            buttons: [
                { name: 'quick_reply', params: { display_text: 'Bouton rapide', id: '.ping' } },
                { name: 'cta_url', params: { display_text: 'CHAÎNE', url: channelLink(), merchant_url: channelLink() } }
            ],
            preview: false,
            card: false
        }),
        () => sendInteractiveMessage(sock, chatId, {
            title: 'TEST 8',
            body: title(8, 'Liste déroulante'),
            buttons: [{
                name: 'single_select',
                params: { title: 'Ouvrir la liste', sections: [{ title: 'Test', rows: [{ header: '', title: 'Ligne 1', description: 'Test', id: '.ping' }] }] }
            }],
            preview: false,
            card: false
        }),
        // 9 : exactement le format du vrai menu (boutons + aperçu + fausse citation + bouton chaîne).
        () => sendInteractiveMessage(sock, chatId, {
            title: 'TEST 9',
            body: title(9, 'Menu réel : boutons + aperçu + citation + chaîne'),
            buttons: [
                { name: 'quick_reply', params: { display_text: 'Menu', id: '.menu' } },
                { name: 'cta_url', params: { display_text: '📢 Voir la chaîne', url: channelLink(), merchant_url: channelLink() } }
            ],
            quoted: message
        }),
        // 10 : vraie image + légende (mode .imagemode on).
        async () => {
            const photo = await nextPhoto();
            if (!photo) return send(chatId, { text: title(10, 'Image réelle indisponible (dossier jarvis-images vide)') });
            return send(chatId, { image: photo, caption: title(10, 'Vraie image + légende'), contextInfo: decorateContextInfo({}) }, { quoted: buildQuoteCard(message, 'universal') });
        }
    ];

    for (let index = 0; index < steps.length; index += 1) {
        try {
            await steps[index]();
        } catch (error) {
            console.warn(`[viewtest] message ${index + 1} non envoyé :`, error.message);
        }
        await pause();
    }

    await send(chatId, {
        text: '✅ Fin du test. Envoyez-moi les numéros que vous avez vus.\n' +
            'Le premier numéro qui manque désigne le format que votre téléphone n\'affiche pas.\n\n' +
            '• Le 3 (aperçu de lien) manquant est NORMAL : ce format est désactivé dans le bot (il rend les messages invisibles).\n' +
            '• Si TOUS les messages manquent chez un membre : .fixgroup (réinitialise les clés de chiffrement du groupe), ' +
            'puis relancer .viewtest.'
    });
}

module.exports = viewTestCommand;
module.exports.deps = deps;
module.exports.resetCooldown = () => lastRun.clear();
