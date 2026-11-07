'use strict';

/*
 * .del — supprime des messages du groupe (admins du groupe et propriétaire ; le bot doit être admin)
 *
 *   .del                    en répondant à un message → supprime CE message précis
 *   .del 4                  les 4 derniers messages du groupe
 *   .del @membre            TOUS les messages vus de ce membre
 *   .del @membre 8          ses 8 derniers messages          (aussi : .del 8 @membre)
 *   .del 8   (en réponse)   les 8 derniers messages de l'auteur du message cité
 *   .del all (en réponse)   tous les messages de l'auteur du message cité
 *
 * Alias : .delete. Limite : 100 messages par commande. Le bot ne peut supprimer que les messages qu'il a vus
 * passer (WhatsApp ne lui donne pas l'historique).
 */

const isAdmin = require('../lib/isAdmin');
const messageLog = require('../lib/messageLog');
const ownerAuth = require('../lib/ownerAuth');
const { panel } = require('../lib/style');

const LIMIT = 100;
const DELAY_MS = 350;
const ALL_WORDS = new Set(['all', 'tout', 'tous', 'toutes']);

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function textOf(message) {
    const content = message.message || {};
    return content.conversation || content.extendedTextMessage?.text || content.imageMessage?.caption || content.videoMessage?.caption || '';
}

function parseArgs(text) {
    const tokens = String(text).trim().split(/\s+/).slice(1);
    let count = null;
    let all = false;
    for (const token of tokens) {
        if (/^\d{1,3}$/.test(token) && count === null) count = Math.min(parseInt(token, 10), LIMIT);
        else if (ALL_WORDS.has(token.toLowerCase())) all = true;
    }
    return { count: count && count > 0 ? count : null, all };
}

// Tous les identifiants possibles d'un membre (numéro, LID…) d'après la liste des participants du groupe.
async function identitiesOf(sock, chatId, jid) {
    const wanted = new Set(isAdmin.identityVariants(jid));
    try {
        const metadata = await sock.groupMetadata(chatId);
        for (const participant of metadata.participants || []) {
            const variants = isAdmin.participantVariants(participant);
            if (variants.some(value => wanted.has(value))) variants.forEach(value => wanted.add(value));
        }
    } catch { /* métadonnées indisponibles : on garde l'identifiant donné */ }
    return wanted;
}

const entryBelongsTo = (entry, identities) =>
    [...isAdmin.identityVariants(entry.participant), ...isAdmin.identityVariants(entry.alt)].some(value => identities.has(value));

async function deleteCommand(sock, chatId, message, senderId) {
    const reply = (title, rows, note) => sock.sendMessage(chatId, { text: panel(title, rows, note) }, { quoted: message });

    if (!String(chatId).endsWith('@g.us')) {
        return reply('🗑️ SUPPRESSION', ['Cette commande fonctionne uniquement dans un groupe.']);
    }

    const sender = senderId || message.key.participant || message.key.remoteJid;
    const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, sender);
    const allowed = isSenderAdmin || await ownerAuth.isOwnerOrSudoMessage(sock, message, chatId);
    if (!allowed) return reply('⛔ ACCÈS REFUSÉ', ['Seuls les admins du groupe peuvent supprimer des messages.']);
    if (!isBotAdmin) return reply('⚠️ JE DOIS ÊTRE ADMIN', ['Rendez-moi admin du groupe pour supprimer les messages des autres.']);

    const ctx = message.message?.extendedTextMessage?.contextInfo || {};
    const quotedId = ctx.stanzaId || '';
    const quotedAuthor = ctx.participant || '';
    const mentioned = Array.isArray(ctx.mentionedJid) && ctx.mentionedJid.length ? ctx.mentionedJid[0] : '';
    const { count, all } = parseArgs(textOf(message));
    const commandId = message.key.id;

    let targets = [];            // [{ id, participant }]
    let scope = '';

    if (quotedId && !mentioned && count === null && !all) {
        // 1) Un message précis (celui auquel on répond)
        targets = [{ id: quotedId, participant: quotedAuthor }];
        scope = 'Message précis';
    } else if (mentioned || (quotedId && (count !== null || all))) {
        // 2) Les messages d'un membre : tous, ou les N derniers
        const member = mentioned || quotedAuthor;
        const identities = await identitiesOf(sock, chatId, member);
        let list = messageLog.recent(chatId).filter(entry => entry.id !== commandId && entryBelongsTo(entry, identities));
        const wanted = all || (count === null && mentioned) ? LIMIT : Math.min(count ?? 1, LIMIT);
        if (quotedId && !mentioned) {
            // le message cité passe en premier, même s'il n'est pas dans le journal
            list = [{ id: quotedId, participant: quotedAuthor }, ...list.filter(entry => entry.id !== quotedId)];
        }
        targets = list.slice(0, wanted);
        scope = all || (count === null && mentioned) ? `Tous les messages de @${member.split('@')[0].split(':')[0]}` : `${targets.length} dernier(s) de @${member.split('@')[0].split(':')[0]}`;
    } else if (count !== null) {
        // 3) Les N derniers messages du groupe
        targets = messageLog.recent(chatId).filter(entry => entry.id !== commandId).slice(0, count);
        scope = `${count} dernier(s) du groupe`;
    } else {
        return reply('🗑️ SUPPRIMER DES MESSAGES', [
            '.del — en réponse : ce message',
            '.del 4 — les 4 derniers',
            '.del @membre — tous les siens',
            '.del @membre 8 — ses 8 derniers',
            '.del 8 — en réponse : 8 derniers de l’auteur'
        ], 'Pour tout vider : .deleteall');
    }

    if (!targets.length) {
        return reply('ℹ️ RIEN À SUPPRIMER', ['Je n’ai vu aucun message correspondant.'], 'Je ne peux supprimer que les messages reçus depuis mon dernier démarrage.');
    }

    let deleted = 0;
    let failed = 0;
    const done = [];
    for (const target of targets) {
        try {
            await sock.sendMessage(chatId, {
                delete: { remoteJid: chatId, fromMe: false, id: target.id, participant: target.participant || undefined }
            });
            deleted += 1;
            done.push(target.id);
        } catch (error) {
            failed += 1;
            console.warn('[del] suppression refusée :', error.message);
        }
        await sleep(DELAY_MS);
    }
    messageLog.forget(chatId, done);

    // La commande elle-même disparaît aussi (le groupe reste propre).
    try {
        await sock.sendMessage(chatId, { delete: { remoteJid: chatId, fromMe: false, id: commandId, participant: sender } });
    } catch { /* sans conséquence */ }

    const rows = [['🎯 Cible', scope], ['🗑️ Supprimés', deleted]];
    if (failed) rows.push(['❌ Échecs', failed]);
    const mentions = mentioned ? [mentioned] : (quotedAuthor && count !== null ? [quotedAuthor] : []);
    return sock.sendMessage(chatId, { text: panel('🗑️ SUPPRESSION TERMINÉE', rows), mentions });
}

module.exports = deleteCommand;
module.exports.parseArgs = parseArgs;
