'use strict';

/*
 * Demande du code de jumelage (pairing code) au démarrage.
 * Le code ne peut être demandé que lorsque la connexion WebSocket vers WhatsApp est
 * ouverte : on attend donc qu'elle le soit, puis on réessaie automatiquement si
 * WhatsApp répond « Connection Closed » (428), au lieu d'échouer au premier essai.
 */

const RETRYABLE = /Connection Closed|428|Precondition|timed? ?out|socket|ECONNRESET/i;
const defaultSleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function formatCode(code) {
    const text = String(code || '').trim();
    return text.match(/.{1,4}/g)?.join('-') || text;
}

async function requestPairingCodeWhenReady(sock, phoneNumber, options = {}) {
    const {
        attempts = 6,
        openTimeoutMs = 20000,
        firstDelayMs = 2500,
        retryDelayMs = 3000,
        isCurrent = () => true,
        sleep = defaultSleep,
        onRetry = () => {}
    } = options;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        if (!isCurrent() || sock.authState?.creds?.registered) return null;

        // Attendre que la connexion WebSocket soit ouverte.
        const deadline = Date.now() + openTimeoutMs;
        while (sock.ws && sock.ws.isOpen === false && Date.now() < deadline) {
            await sleep(500);
        }
        await sleep(attempt === 1 ? firstDelayMs : retryDelayMs);   // poignée de main avec WhatsApp
        if (!isCurrent() || sock.authState?.creds?.registered) return null;

        try {
            return formatCode(await sock.requestPairingCode(phoneNumber));
        } catch (error) {
            const retryable = RETRYABLE.test(String(error?.message || error)) || error?.output?.statusCode === 428;
            if (!retryable || attempt === attempts) throw error;
            onRetry(attempt, attempts, error);
        }
    }
    return null;
}

module.exports = { requestPairingCodeWhenReady, formatCode };
