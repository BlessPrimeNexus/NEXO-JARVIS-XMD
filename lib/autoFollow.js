'use strict';

/*
 * AUTO-FOLLOW — chaque compte qui se connecte au bot (site de connexion / code de couplage, commande .pair,
 * reconnexion automatique) suit automatiquement la chaîne WhatsApp officielle (newsletter).
 *
 * Le suivi est tenté dès la connexion, puis retenté avec un délai croissant tant qu'il n'est pas confirmé
 * (JID de la chaîne pas encore résolu, réseau lent…). Une fois confirmé, il est mémorisé par numéro et
 * n'est plus redemandé. Une seule boucle tourne à la fois par socket.
 */

const DELAYS = (process.env.AUTOFOLLOW_DELAYS || '2000,15000,60000,300000,900000').split(',').map(Number).filter(n => n >= 0);
const running = new WeakSet();

function isSocketClosed(sock) {
    const state = sock?.ws?.readyState;
    return state === 2 || state === 3;   // CLOSING / CLOSED
}

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function start(sock, label = '') {
    if (!sock || running.has(sock)) return null;
    running.add(sock);
    const fakeract = require('../commands/fakeract');
    return (async () => {
        for (let attempt = 0; attempt < DELAYS.length; attempt++) {
            await wait(DELAYS[attempt]);
            if (isSocketClosed(sock)) return false;
            try {
                const result = await fakeract.ensurePrimaryChannelFollow(sock);
                console.log(`[auto-follow] ✅ ${label} suit la chaîne officielle (${result.status})`);
                try { await fakeract.restorePrimaryChannel(sock); } catch { /* notifications en direct : facultatif */ }
                return true;
            } catch (error) {
                console.warn(`[auto-follow] tentative ${attempt + 1}/${DELAYS.length} ${label} : ${error.message}`);
            }
        }
        return false;
    })().finally(() => running.delete(sock));
}

module.exports = { start, DELAYS };
