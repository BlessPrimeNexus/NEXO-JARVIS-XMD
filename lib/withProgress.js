'use strict';

/*
 * Enveloppe « barre de progression » pour les commandes de téléchargement qui envoient directement le média
 * (TikTok, Instagram, Facebook, stories…) : un message ██████░░░░ 61 % se modifie pendant le travail, puis il est
 * supprimé dès que le média est livré (ou en cas d'échec — l'erreur de la commande reste affichée).
 */

const { createProgress } = require('./mediaProgress');
const { commandInput } = require('./downloadUtils');

const MEDIA_KEYS = ['video', 'audio', 'image', 'document', 'sticker'];

function withProgress(handler, { icon = '⬇️', label = 'Analyse du lien…' } = {}) {
    return async function wrapped(sock, chatId, message, ...rest) {
        // Rien à télécharger (commande sans lien) : la commande répond elle-même, pas de barre.
        let hasInput = false;
        try { hasInput = Boolean(commandInput(message)); } catch { /* texte introuvable */ }
        const quotedLink = message?.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (!hasInput && !quotedLink) return handler(sock, chatId, message, ...rest);

        const progress = createProgress(sock, chatId, message, { icon });
        await progress.start(label);
        progress.step(12, label, 40);
        let delivered = false;

        const proxy = new Proxy(sock, {
            get(target, property) {
                if (property === 'sendMessage') {
                    return async (jid, content, options) => {
                        if (jid === chatId && content && MEDIA_KEYS.some(key => content[key] !== undefined)) {
                            delivered = true;
                            progress.step(Math.max(progress.percent, 85), 'Envoi du média…', 99);
                        }
                        return target.sendMessage(jid, content, options);
                    };
                }
                const value = Reflect.get(target, property, target);
                return typeof value === 'function' ? value.bind(target) : value;
            }
        });

        try {
            return await handler(proxy, chatId, message, ...rest);
        } finally {
            if (delivered) await progress.finish(); else await progress.remove();
        }
    };
}

module.exports = { withProgress };
