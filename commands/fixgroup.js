'use strict';

/*
 * .fixgroup — répare l'affichage des réponses du bot pour les membres qui ne les voient pas
 * (admins du groupe et propriétaire). Efface la mémoire des clés de chiffrement du groupe : la clé est renvoyée à tous les
 * appareils au prochain message. Voir lib/presentation.js (healSenderKeys) pour l'explication du bug de Baileys.
 */

const { panel } = require('../lib/style');

async function fixGroupCommand(sock, chatId, message) {
    const reply = (title, rows, note) => sock.sendMessage(chatId, { text: panel(title, rows, note) }, { quoted: message });

    if (!String(chatId).endsWith('@g.us')) {
        return reply('🔧 RÉPARATION', ['Cette commande fonctionne uniquement dans un groupe.']);
    }

    const ownerAuth = require('../lib/ownerAuth');
    const isAdmin = require('../lib/isAdmin');
    const sender = message.key.participant || message.key.remoteJid;
    let allowed = await ownerAuth.isOwnerOrSudoMessage(sock, message, chatId);
    if (!allowed) allowed = Boolean((await isAdmin(sock, chatId, sender)).isSenderAdmin);
    if (!allowed) return reply('⛔ ACCÈS REFUSÉ', ['Réservé aux admins du groupe.']);

    const done = await require('../lib/presentation').healSenderKeys(sock, chatId, { force: true });
    if (!done) return reply('❌ ÉCHEC', ['Je n’ai pas pu réinitialiser les clés de ce groupe.'], 'Réessayez dans un instant.');

    return reply('✅ CLÉS RÉINITIALISÉES', [
        'Je renvoie ma clé de chiffrement à tous les membres.',
        '',
        'Ceux qui ne voyaient pas mes réponses les recevront dès mon prochain message.'
    ], 'Si un membre ne voit toujours rien : qu’il mette WhatsApp à jour.');
}

module.exports = fixGroupCommand;
