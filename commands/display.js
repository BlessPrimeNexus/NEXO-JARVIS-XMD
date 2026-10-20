'use strict';

const displayFlags = require('../lib/displayFlags');

const MENU_STYLES = {
    mixte: 'mixte', boutons: 'mixte', bouton: 'mixte', buttons: 'mixte',
    complet: 'complet', full: 'complet',
    texte: 'texte', text: 'texte'
};
const MENU_LABELS = {
    mixte: 'menu *mixte* (texte visible partout + barre de boutons)',
    complet: 'menu *complet* (un seul message à boutons)',
    texte: 'menu en *texte* seul'
};
const CARD_ON = ['on', 'oui', 'actif', 'active', 'activer'];
const CARD_OFF = ['off', 'non', 'inactif', 'desactive', 'désactive', 'desactiver', 'désactiver'];
const CARD_STYLES = { universal: 'universal', universelle: 'universal', business: 'business', commande: 'business' };

// .menustyle [mixte|complet|texte]   et   .quotecard [on|off|universal|business]   (propriétaire uniquement)
async function displayCommand(sock, chatId, message, flag, argument, allowed) {
    const reply = (text) => sock.sendMessage(chatId, { text }, { quoted: message });
    if (!allowed) return reply('Accès réservé au propriétaire du système, Monsieur.');

    const word = String(argument || '').trim().toLowerCase();

    if (flag === 'menuStyle') {
        const current = displayFlags.getValue('menuStyle') || 'mixte';
        if (!word) {
            return reply(`ℹ️ Réglage actuel : ${MENU_LABELS[current] || current}.\nUtilisez *.menustyle mixte*, *.menustyle complet* ou *.menustyle texte*.`);
        }
        const style = MENU_STYLES[word];
        if (!style) return reply('❌ Option invalide. Utilisez *.menustyle mixte*, *.menustyle complet* ou *.menustyle texte*.');
        displayFlags.setValue('menuStyle', style);
        const advice = style === 'complet'
            ? '\n⚠️ Un téléphone qui ne gère pas les messages à boutons ne verra pas le menu : vérifiez avec .viewtest.'
            : '';
        return reply(`✅ Réglage enregistré : ${MENU_LABELS[style]}, Monsieur.${advice}`);
    }

    // quoteCard
    const enabled = displayFlags.get('quoteCard');
    const style = displayFlags.getValue('quoteCardStyle') || 'universal';
    const describe = () => `fausse citation *${enabled ? 'activée' : 'désactivée'}*, présentation *${style === 'business' ? 'business (carte de commande)' : 'universelle'}*`;
    if (!word) {
        return reply(`ℹ️ Réglage actuel : ${describe()}.\nUtilisez *.quotecard on*, *.quotecard off*, *.quotecard universal* ou *.quotecard business*.`);
    }
    if (CARD_ON.includes(word)) {
        displayFlags.set('quoteCard', true);
    } else if (CARD_OFF.includes(word)) {
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
