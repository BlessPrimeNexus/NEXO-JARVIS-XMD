'use strict';

const displayFlags = require('../lib/displayFlags');

const MENU_STYLES = {
    complet: 'complet', full: 'complet', boutons: 'complet', bouton: 'complet', buttons: 'complet', mixte: 'complet',
    texte: 'texte', text: 'texte'
};
const MENU_LABELS = {
    complet: 'menu *complet* (un seul message : menu + boutons)',
    texte: 'menu en *texte* seul (un seul message, sans boutons)'
};
const ON = ['on', 'oui', 'actif', 'active', 'activer', 'activé'];
const OFF = ['off', 'non', 'inactif', 'desactive', 'désactive', 'desactiver', 'désactiver', 'désactivé'];
const CARD_STYLES = { universal: 'universal', universelle: 'universal', business: 'business', commande: 'business' };

// .menustyle [complet|texte]   .quotecard [on|off|universal|business]   .preview [on|off]   (propriétaire uniquement)
async function displayCommand(sock, chatId, message, flag, argument, allowed) {
    const reply = (text) => sock.sendMessage(chatId, { text }, { quoted: message });
    if (!allowed) return reply('⛔ Accès réservé au propriétaire du système, Monsieur.');

    const word = String(argument || '').trim().toLowerCase();

    if (flag === 'menuStyle') {
        const current = MENU_STYLES[displayFlags.getValue('menuStyle')] || 'complet';
        if (!word) {
            return reply(`ℹ️ Réglage actuel : ${MENU_LABELS[current]}.\nUtilisez *.menustyle complet* ou *.menustyle texte*.`);
        }
        const style = MENU_STYLES[word];
        if (!style) return reply('❌ Option invalide. Utilisez *.menustyle complet* ou *.menustyle texte*.');
        displayFlags.setValue('menuStyle', style);
        const advice = style === 'complet'
            ? '\n⚠️ Un téléphone qui ne gère pas les messages à boutons ne verra pas le menu : vérifiez avec .viewtest, ou passez à *.menustyle texte*.'
            : '';
        return reply(`✅ Réglage enregistré : ${MENU_LABELS[style]}, Monsieur.${advice}`);
    }

    const TOGGLES = {
        previewImage: { cmd: '.preview', label: "Aperçu de lien (externalAdReply)", note: '\n⚠️ Cet aperçu rend les messages INVISIBLES chez certains téléphones (voir .viewtest, test 3). Déconseillé.' },
        imageReply: { cmd: '.imagemode', label: 'Vraie image avec chaque réponse', note: '\n⚠️ Les photos peuvent s\'enregistrer dans la galerie des membres (téléchargement automatique de WhatsApp).' },
        replyFrame: { cmd: '.replystyle', label: 'Cadre automatique des réponses', note: '' }
    };
    if (TOGGLES[flag]) {
        const { cmd, label, note } = TOGGLES[flag];
        const enabled = displayFlags.get(flag);
        if (!word) {
            return reply(`ℹ️ ${label} : *${enabled ? 'activé' : 'désactivé'}*.\nUtilisez *${cmd} on* ou *${cmd} off*.`);
        }
        if (ON.includes(word)) displayFlags.set(flag, true);
        else if (OFF.includes(word)) displayFlags.set(flag, false);
        else return reply(`❌ Option invalide. Utilisez *${cmd} on* ou *${cmd} off*.`);
        const now = displayFlags.get(flag);
        return reply(`✅ ${label} : *${now ? 'activé' : 'désactivé'}*, Monsieur.${now ? note : ''}`);
    }

    // quoteCard
    const enabled = displayFlags.get('quoteCard');
    const style = displayFlags.getValue('quoteCardStyle') || 'universal';
    const describe = () => `fausse citation *${enabled ? 'activée' : 'désactivée'}*, présentation *${style === 'business' ? 'business (carte de commande)' : 'universelle'}*`;
    if (!word) {
        return reply(`ℹ️ Réglage actuel : ${describe()}.\nUtilisez *.quotecard on*, *.quotecard off*, *.quotecard universal* ou *.quotecard business*.`);
    }
    if (ON.includes(word)) {
        displayFlags.set('quoteCard', true);
    } else if (OFF.includes(word)) {
        displayFlags.set('quoteCard', false);
    } else if (CARD_STYLES[word]) {
        displayFlags.set('quoteCard', true);
        displayFlags.setValue('quoteCardStyle', CARD_STYLES[word]);
    } else {
        return reply('❌ Option invalide. Utilisez *.quotecard on*, *.quotecard off*, *.quotecard universal* ou *.quotecard business*.');
    }
    const advice = CARD_STYLES[word] === 'business'
        ? '\n⚠️ Ce format est réservé à WhatsApp Business : WhatsApp Messenger peut ne rien afficher. Vérifiez avec .viewtest.'
        : '';
    const enabledNow = displayFlags.get('quoteCard');
    const styleNow = displayFlags.getValue('quoteCardStyle') || 'universal';
    return reply(`✅ Réglage enregistré : fausse citation *${enabledNow ? 'activée' : 'désactivée'}*, présentation *${styleNow === 'business' ? 'business' : 'universelle'}*, Monsieur.${advice}`);
}

module.exports = displayCommand;
