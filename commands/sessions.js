'use strict';

/*
 * .sessions — gestion des sessions connectées au bot (propriétaire uniquement)
 *
 *   .sessions                     liste de toutes les sessions (✅ en ligne, ⚪ hors ligne, ⏳ couplage)
 *   .sessions info <n°|numéro>    détails d'une session
 *   .sessions remove <n°|numéro>  supprime une session (demande une confirmation par bouton)
 *   .sessions restart <n°|numéro> relance la connexion d'une session
 *   .sessions purge               supprime toutes les sessions hors ligne (confirmation)
 *
 * Alias : .session, .sessionlist, .listsessions, .delsession <n°|numéro>
 * « n° » = le numéro d'ordre affiché dans la liste.
 */

const fs = require('fs');
const path = require('path');
const settings = require('../settings');
const { panel, report } = require('../lib/style');
const { sessionManager, maskPhoneNumber } = require('../lib/session-manager');

const digits = (value) => String(value || '').split('@')[0].split(':')[0].replace(/\D/g, '');

function isMainOwner(sock, message, chatId) {
    return require('../lib/ownerAuth').isPlatformOwnerMessage(sock, message, chatId);
}

function botControl() {
    return require('../lib/botInstance');
}

// Fusionne le registre (sessions enregistrées) et les instances en cours.
function collectSessions() {
    const registry = new Map(sessionManager.listSessions().map(session => [session.phoneNumber, session]));
    const running = new Map(botControl().getAllInstances().map(instance => [String(instance.number), instance]));
    const numbers = new Set([...registry.keys(), ...running.keys()]);
    return [...numbers].map(number => {
        const record = registry.get(number) || {};
        const instance = running.get(number) || null;
        let state = 'offline';
        if (instance?.connected) state = 'online';
        else if (record.status === 'PAIRING') state = 'pairing';
        return {
            number,
            state,
            record,
            instance,
            sessionDir: record.sessionDir || instance?.sessionDir || null
        };
    }).sort((a, b) => (a.state === b.state ? a.number.localeCompare(b.number) : a.state === 'online' ? -1 : 1));
}

const ICON = { online: '✅', offline: '⚪', pairing: '⏳' };
const LABEL = { online: 'en ligne', offline: 'hors ligne', pairing: 'couplage en cours' };

function resolveTarget(list, token) {
    const value = String(token || '').trim();
    if (!value) return null;
    if (/^\d{1,3}$/.test(value)) return list[Number(value) - 1] || null;
    const number = digits(value);
    return list.find(item => item.number === number) || null;
}

function ago(value) {
    if (!value) return 'jamais';
    const time = typeof value === 'number' ? (value < 1e12 ? value * 1000 : value) : new Date(value).getTime();
    if (!Number.isFinite(time) || time <= 0) return 'jamais';
    const seconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
    if (seconds < 60) return `il y a ${seconds} s`;
    if (seconds < 3600) return `il y a ${Math.floor(seconds / 60)} min`;
    if (seconds < 86400) return `il y a ${Math.floor(seconds / 3600)} h`;
    return `il y a ${Math.floor(seconds / 86400)} j`;
}

function listText(list, currentNumber) {
    const online = list.filter(item => item.state === 'online').length;
    const rows = list.map((item, index) => `${index + 1}. ${ICON[item.state]} +${item.number}${item.number === currentNumber ? ' 📍' : ''}`);
    return report('🔌 Sessions du bot', [['En ligne', online], ['Hors ligne', list.length - online], ['Total', list.length]], [
        { title: '📋 Liste', rows: rows.length ? rows : ['Aucune session enregistrée.'] },
        { title: '🛠️ Actions', rows: ['.sessions info <n°>', '.sessions remove <n°>', '.sessions restart <n°>', '.sessions purge'] }
    ]);
}

function infoText(item, position) {
    const { record, instance } = item;
    return report(`🔌 Session ${position}`, [['Numéro', `+${item.number}`], ['État', LABEL[item.state]]], [
        { title: '📊 Activité', rows: [
            ['🔁 Reconnexions', instance?.restartAttempts ?? record.reconnectAttempts ?? 0],
            ['🕒 Dernière activité', ago(record.lastSeen)],
            ['🔌 Dernière coupure', record.lastDisconnect ? ago(record.lastDisconnect) : 'aucune'],
            ['📥 Messages en attente', instance?.queuedMessages ?? 0],
            ['🗓️ Créée', record.createdAt ? ago(record.createdAt) : 'inconnue']
        ] }
    ]);
}

async function removeSession(item) {
    return require('../lib/sessionControl').removeSession(item.number);
}

async function sessionsCommand(sock, chatId, message, argument = '') {
    const reply = (text, buttons) => replyWithButtons(sock, chatId, message, text, buttons);

    if (!(await isMainOwner(sock, message, chatId))) {
        return sock.sendMessage(chatId, { text: '⛔ Accès réservé au propriétaire du système, Monsieur.' }, { quoted: message });
    }

    const [action = '', target = '', confirm = ''] = String(argument).trim().split(/\s+/);
    const verb = action.toLowerCase();
    const list = collectSessions();
    const currentNumber = digits(sock.user?.id);
    const refresh = { name: 'quick_reply', params: { display_text: '🔄 Actualiser', id: '.sessions' } };

    if (!verb || ['list', 'liste', 'all'].includes(verb)) {
        const buttons = [refresh];
        if (list.some(item => item.state !== 'online')) buttons.push({ name: 'quick_reply', params: { display_text: '🧹 Purger les hors ligne', id: '.sessions purge' } });
        return reply(listText(list, currentNumber), buttons);
    }

    if (verb === 'purge') {
        const offline = list.filter(item => item.state === 'offline' && item.number !== currentNumber);
        if (!offline.length) return reply(panel('🧹 PURGE', ['Aucune session hors ligne à supprimer.']), [refresh]);
        if (!['oui', 'yes', 'confirm'].includes(String(target).toLowerCase())) {
            return reply(
                panel('🧹 PURGE DES SESSIONS', [`${offline.length} session(s) hors ligne seront supprimées :`, ...offline.map(item => `• +${item.number}`)], 'Action définitive : ces numéros devront se re-coupler.'),
                [{ name: 'quick_reply', params: { display_text: '✅ Confirmer la purge', id: '.sessions purge oui' } }, refresh]
            );
        }
        let removed = 0;
        for (const item of offline) { if ((await removeSession(item)).ok) removed += 1; }
        return reply(panel('🧹 PURGE TERMINÉE', [['🗑️ Supprimées', removed], ...(removed < offline.length ? [['⚠️ Échecs', offline.length - removed]] : [])]), [refresh]);
    }

    const item = resolveTarget(list, target);
    if (['info', 'ask', 'remove', 'delete', 'del', 'supprimer', 'restart', 'relancer'].includes(verb) && !item) {
        return reply(panel('❓ SESSION INTROUVABLE', [`« ${target || '—'} » ne correspond à aucune session.`], 'Utilisez .sessions pour voir la liste.'), [refresh]);
    }
    const position = item ? list.indexOf(item) + 1 : 0;

    if (verb === 'info') {
        return reply(infoText(item, position), [
            { name: 'quick_reply', params: { display_text: '🔁 Relancer', id: `.sessions restart ${item.number}` } },
            { name: 'quick_reply', params: { display_text: '🗑️ Supprimer', id: `.sessions ask ${item.number}` } },
            refresh
        ]);
    }

    if (verb === 'ask') {
        // Étape de confirmation des boutons : un appui accidentel ne supprime rien.
        const isCurrent = item.number === currentNumber;
        return reply(
            panel('🗑️ SUPPRIMER ?', [
                ['📞 Numéro', `+${item.number}`],
                ['📡 État', LABEL[item.state]],
                ...(isCurrent ? ['', '⚠️ C’est la session que vous utilisez : le bot s’arrêtera pour ce numéro.'] : [])
            ], 'Action définitive : appareil déconnecté et fichiers effacés.'),
            [{ name: 'quick_reply', params: { display_text: '✅ Oui, supprimer', id: `.sessions remove ${item.number}` } }, refresh]
        );
    }

    if (['remove', 'delete', 'del', 'supprimer'].includes(verb)) {
        // Commande tapée = décision claire : suppression immédiate (le bouton « Supprimer » passe par `ask`).
        const isCurrent = item.number === currentNumber;
        if (isCurrent) await reply(panel('🗑️ SUPPRESSION', [['📞 Numéro', `+${item.number}`], 'Session en cours : le bot va s’arrêter pour ce numéro.']));
        const result = await removeSession(item);
        if (isCurrent) return undefined;      // cette session n'existe plus : impossible de répondre
        if (!result.ok) {
            return reply(panel('❌ SUPPRESSION INCOMPLÈTE', [['📞 Numéro', `+${item.number}`], ...result.leftovers.slice(0, 3).map(text => `• ${text}`)], 'Réessayez, ou utilisez .restart puis .sessions.'), [refresh]);
        }
        return reply(panel('🗑️ SESSION SUPPRIMÉE', [['📞 Numéro', `+${item.number}`], ['📁 Fichiers effacés', result.removedDirs.length || 0]], 'Ce numéro devra se re-coupler pour réutiliser le bot.'), [refresh]);
    }

    if (['restart', 'relancer'].includes(verb)) {
        if (!item.sessionDir || !fs.existsSync(item.sessionDir)) {
            return reply(panel('❌ RELANCE IMPOSSIBLE', ['Les fichiers de cette session sont introuvables.'], 'Le numéro doit se re-coupler.'), [refresh]);
        }
        await reply(panel('🔁 RELANCE', [['📞 Numéro', `+${item.number}`], 'Reconnexion en cours…']), undefined);
        const control = botControl();
        try {
            control.stopBotInstance(item.number);
            await control.createBotInstance(item.sessionDir, item.number, {});
        } catch (error) {
            console.error('[sessions] relance échouée :', error.message);
            return sock.sendMessage(chatId, { text: `❌ La relance de +${item.number} a échoué : ${error.message}` }, { quoted: message });
        }
        return undefined;
    }

    return reply(panel('🔌 AIDE — SESSIONS', [
        '.sessions — liste',
        '.sessions info <n°>',
        '.sessions remove <n°> (immédiat)',
        '.sessions restart <n°>',
        '.sessions purge'
    ], '« n° » = numéro d’ordre dans la liste (ou le numéro complet).'), [refresh]);
}

async function replyWithButtons(sock, chatId, message, text, buttons) {
    if (buttons && buttons.length) {
        try {
            const { sendInteractiveMessage } = require('../lib/interactiveButtons');
            await sendInteractiveMessage(sock, chatId, {
                title: '',
                body: text,
                footer: `©Power by ${settings.botName || 'NEXO-JARVIS XMD'}`,
                buttons,
                quoted: message
            });
            return;
        } catch (error) {
            console.warn('[sessions] Boutons indisponibles, réponse en texte :', error.message);
        }
    }
    await sock.sendMessage(chatId, { text }, { quoted: message });
}

module.exports = sessionsCommand;
module.exports.collectSessions = collectSessions;
module.exports.resolveTarget = resolveTarget;
module.exports.listText = listText;
module.exports.maskPhoneNumber = maskPhoneNumber;
