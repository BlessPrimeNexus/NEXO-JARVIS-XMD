'use strict';

/*
 * BARRE DE PROGRESSION — un seul message qui se modifie à chaque avancement :
 *
 *   ⬇️ Téléchargement en cours
 *   *Titre*
 *
 *   ██████░░░░ 61%
 *   Téléchargement du fichier…
 *
 * L'avancement suit les vraies étapes (recherche, source, fichier, conversion, envoi). Entre deux étapes, la
 * barre progresse doucement toute seule (simulation) pour rester vivante pendant les téléchargements dont la
 * taille n'est pas connue. À la fin, le message est SUPPRIMÉ : il ne reste que le média livré.
 */

const BLOCKS = 10;
const MIN_EDIT_GAP_MS = Number(process.env.PROGRESS_EDIT_GAP_MS ?? 1300);   // évite de saturer WhatsApp avec les modifications
const TICK_MS = Number(process.env.PROGRESS_TICK_MS ?? 900);

function bar(percent) {
    const value = Math.max(0, Math.min(100, Math.round(percent)));
    const filled = Math.round(value / 100 * BLOCKS);
    return `${'█'.repeat(filled)}${'░'.repeat(BLOCKS - filled)} ${value}%`;
}

function createProgress(sock, chatId, quoted, { icon = '⬇️', title = '', heading = 'Téléchargement en cours' } = {}) {
    let key = null;
    let percent = 0;
    let ceiling = 90;
    let stage = 'Préparation…';
    let lastText = '';
    let lastEdit = 0;
    let timer = null;
    let closed = false;
    let sending = Promise.resolve();

    const render = () => [
        `${icon} *${heading}*`,
        title ? `*${String(title).slice(0, 90)}*` : '',
        '',
        bar(percent),
        stage
    ].filter((line, index) => index !== 1 || line).join('\n');

    async function translate(text) {
        try {
            const i18n = require('./i18n');
            return i18n.isEnglish() ? await i18n.translateAsync(text) : text;
        } catch { return text; }
    }

    function push(force = false) {
        if (!key || closed) return sending;
        const now = Date.now();
        const text = render();
        if (text === lastText || (!force && now - lastEdit < MIN_EDIT_GAP_MS)) return sending;
        lastText = text; lastEdit = now;
        sending = sending.then(async () => {
            try { await sock.sendMessage(chatId, { text: await translate(text), edit: key }); } catch { /* la barre est un confort */ }
        });
        return sending;
    }

    return {
        get key() { return key; },
        get percent() { return percent; },

        async start(firstStage = 'Préparation…') {
            stage = firstStage;
            lastText = render();
            try {
                const sent = await sock.sendMessage(chatId, { text: lastText, __noframe: true }, quoted ? { quoted } : undefined);
                key = sent?.key || null;
            } catch { key = null; }
            lastEdit = Date.now();
            // Simulation : la barre avance seule vers le plafond de l'étape en cours.
            timer = setInterval(() => {
                if (closed || percent >= ceiling) return;
                percent = Math.min(ceiling, percent + Math.max(0.6, (ceiling - percent) * 0.09));
                push();
            }, TICK_MS);
            timer.unref?.();
            return this;
        },

        /** Passe à une étape : la barre saute à `at` % et progresse jusqu'à `upTo` % en attendant la suivante. */
        step(at, text, upTo = at + 20) {
            if (closed) return;
            percent = Math.max(percent, at);
            ceiling = Math.min(98, Math.max(percent, upTo));
            if (text) stage = text;
            return push(true);
        },

        /** Avancement réel (octets reçus / total) pour une plage de la barre. */
        real(received, total, from = 30, to = 85) {
            if (closed || !(total > 0)) return;
            percent = Math.max(percent, from + (to - from) * Math.min(1, received / total));
            push();
        },

        async finish() {
            if (closed) return;
            percent = 100; stage = 'Terminé ✅';
            await push(true);
            await this.remove();
        },

        /** Supprime le message de progression (succès ou échec : il ne doit pas rester). */
        async remove() {
            closed = true;
            if (timer) { clearInterval(timer); timer = null; }
            try { await sending; } catch { /* sans importance */ }
            if (key) {
                try { await sock.sendMessage(chatId, { delete: key }); } catch { /* déjà supprimé */ }
            }
        }
    };
}

module.exports = { createProgress, bar };
