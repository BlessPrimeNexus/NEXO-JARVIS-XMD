'use strict';

/*
 * Mémoire des messages envoyés par le bot.
 *
 * Quand un téléphone n'arrive pas à déchiffrer un message (nouvelle session, appareil
 * récemment ajouté, mauvaise synchro…), WhatsApp demande à l'expéditeur de le renvoyer.
 * Baileys s'appuie pour cela sur `getMessage(key)`. Si le bot ne retrouve pas le message,
 * le destinataire reste sur « En attente du message » et NE VOIT JAMAIS la réponse,
 * alors que d'autres membres du groupe la voient très bien.
 *
 * Le store d'origine ne gardait que les 20 derniers messages par discussion (et jamais
 * les menus à boutons, envoyés autrement) : dans un groupe actif, le message était déjà
 * oublié quand la demande arrivait. Ce module garde chaque message envoyé pendant 2 h.
 */

const MAX_ENTRIES = Math.max(100, Number(process.env.SENT_CACHE_MAX || 1500));
const TTL_MS = Math.max(60 * 1000, Number(process.env.SENT_CACHE_TTL_MS || 2 * 60 * 60 * 1000));

const cache = new Map();   // id du message -> { message, at }
let inserts = 0;

function sweep(now = Date.now()) {
    for (const [id, entry] of cache) {
        if (now - entry.at > TTL_MS) cache.delete(id);
        else break;   // Map conservée dans l'ordre d'insertion : le reste est plus récent
    }
}

// `sent` = message renvoyé par sendMessage : { key, message }
function remember(sent) {
    const id = sent && sent.key && sent.key.id;
    const message = sent && sent.message;
    if (!id || !message) return false;
    cache.delete(id);
    cache.set(id, { message, at: Date.now() });
    while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value);
    inserts += 1;
    if (inserts % 100 === 0) sweep();
    return true;
}

// Utilisé par getMessage : renvoie le contenu du message, ou undefined.
function recall(key) {
    const id = key && key.id;
    if (!id) return undefined;
    const entry = cache.get(id);
    if (!entry) return undefined;
    if (Date.now() - entry.at > TTL_MS) {
        cache.delete(id);
        return undefined;
    }
    return entry.message;
}

const size = () => cache.size;
const clear = () => cache.clear();

module.exports = { remember, recall, size, clear, MAX_ENTRIES, TTL_MS };
