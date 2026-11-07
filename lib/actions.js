'use strict';

/*
 * BOUTONS D'ACTION — toutes les commandes qui ont 2 options ou plus.
 *
 * Principe : chaque commande à options est décrite ci-dessous (SPECS). Quand elle répond par un texte
 * (statut, aide, confirmation), main.js remplace ce texte par UN message à boutons natifs :
 *   corps = le texte de la réponse, bouton « ⚡ Actions » = liste de toutes les options de la commande.
 * Toucher une ligne exécute la commande correspondante comme si la personne l'avait tapée (mêmes droits :
 * un membre qui touche « Désactiver » sur .antilink est refusé comme s'il avait écrit .antilink off).
 *
 * Les réponses d'erreur / de refus (❌, ⛔, « réservé aux admins »…) ne reçoivent pas de boutons.
 * Si l'envoi du message à boutons échoue, le texte part normalement avec les options écrites en clair.
 */

const { getPrefix } = require('./prefix');

const ON = { label: '✅ Activer', desc: 'Active la fonction' };
const OFF = { label: '❌ Désactiver', desc: 'Désactive la fonction' };

function toggle(command, extra = []) {
    return [
        { label: ON.label, cmd: `${command} on`, desc: ON.desc },
        { label: OFF.label, cmd: `${command} off`, desc: OFF.desc },
        ...extra,
        { label: '📊 Voir le statut', cmd: `${command} status`, desc: 'État actuel' }
    ];
}

const SPECS = {
    // ── Protections de groupe ──────────────────────────────────────────────
    antilink: { title: '🔗 Antilink', options: [
        { label: '✅ Activer', cmd: 'antilink on', desc: 'Supprime les liens' },
        { label: '❌ Désactiver', cmd: 'antilink off', desc: 'Désactive la protection' },
        { label: '🗑️ Action : supprimer', cmd: 'antilink set delete', desc: 'Supprime le message' },
        { label: '⚠️ Action : avertir', cmd: 'antilink set warn', desc: 'Supprime + avertissement' },
        { label: '🚫 Action : expulser', cmd: 'antilink set kick', desc: 'Supprime + retire le membre' },
        { label: '📊 Voir le statut', cmd: 'antilink get', desc: 'État actuel' }
    ] },
    antitag: { title: '🏷️ Antitag', options: [
        { label: '✅ Activer', cmd: 'antitag on', desc: 'Bloque les tagall abusifs' },
        { label: '❌ Désactiver', cmd: 'antitag off', desc: 'Désactive la protection' },
        { label: '🗑️ Action : supprimer', cmd: 'antitag set delete', desc: 'Supprime le message' },
        { label: '🚫 Action : expulser', cmd: 'antitag set kick', desc: 'Supprime + retire le membre' },
        { label: '📊 Voir le statut', cmd: 'antitag get', desc: 'État actuel' }
    ] },
    antibot: { title: '🤖 Antibot', options: [
        { label: '✅ Activer', cmd: 'antibot on', desc: 'Bloque les autres bots' },
        { label: '❌ Désactiver', cmd: 'antibot off', desc: 'Désactive la protection' },
        { label: '🗑️ Mode : supprimer', cmd: 'antibot mode delete', desc: 'Supprime leurs messages' },
        { label: '🚫 Mode : retirer le bot', cmd: 'antibot mode kick', desc: 'Supprime + retire le bot' },
        { label: '📋 Bots connus', cmd: 'antibot list', desc: 'Liste des bots détectés' },
        { label: '📊 Voir le statut', cmd: 'antibot status', desc: 'État actuel' }
    ] },
    antibadword: { title: '🤬 Antibadword', options: [
        { label: '✅ Activer', cmd: 'antibadword on', desc: 'Filtre les insultes' },
        { label: '❌ Désactiver', cmd: 'antibadword off', desc: 'Désactive le filtre' },
        { label: '🗑️ Action : supprimer', cmd: 'antibadword set delete', desc: 'Supprime le message' },
        { label: '⚠️ Action : avertir', cmd: 'antibadword set warn', desc: '3 avertissements = retrait' },
        { label: '🚫 Action : expulser', cmd: 'antibadword set kick', desc: 'Retire le membre' },
        { label: '📋 Mots interdits', cmd: 'antibadword list', desc: 'Voir la liste' }
    ] },
    antipromote: { title: '👑 Antipromote', options: toggle('antipromote') },
    antimentiongc: { title: '📢 Antimentiongc', options: toggle('antimentiongc') },
    antiflood: { title: '🌊 Antiflood', options: [...toggle('antiflood'),
        { label: '⚙️ Limite : 5 messages', cmd: 'antiflood limit 5', desc: 'Sur 10 secondes' },
        { label: '⚙️ Limite : 8 messages', cmd: 'antiflood limit 8', desc: 'Sur 10 secondes' }] },
    antispam: { title: '📨 Antispam', options: toggle('antispam') },
    antimedia: { title: '🖼️ Antimedia', options: toggle('antimedia') },
    antisticker: { title: '🎭 Antisticker', options: toggle('antisticker') },
    antivoice: { title: '🎙️ Antivoice', options: toggle('antivoice') },
    antidelete: { title: '🗑️ Antidelete', options: [
        { label: '✅ Activer', cmd: 'antidelete on', desc: 'Récupère les messages supprimés' },
        { label: '❌ Désactiver', cmd: 'antidelete off', desc: 'Désactive la fonction' }
    ] },
    anticall: { title: '📵 Anticall', options: toggle('anticall') },
    pmblocker: { title: '🚷 PM Blocker', options: toggle('pmblocker') },

    // ── Accueil / départ ───────────────────────────────────────────────────
    welcome: { title: '📥 Bienvenue', options: [
        { label: '✅ Activer', cmd: 'welcome on', desc: 'Message à chaque arrivée' },
        { label: '❌ Désactiver', cmd: 'welcome off', desc: 'Plus de message' },
        { label: '🧪 Aperçu', cmd: 'welcome test', desc: 'Voir le message actuel' },
        { label: '♻️ Réinitialiser', cmd: 'welcome reset', desc: 'Style NEXO-JARVIS par défaut' }
    ] },
    goodbye: { title: '📤 Au revoir', options: [
        { label: '✅ Activer', cmd: 'goodbye on', desc: 'Message à chaque départ' },
        { label: '❌ Désactiver', cmd: 'goodbye off', desc: 'Plus de message' },
        { label: '🧪 Aperçu', cmd: 'goodbye test', desc: 'Voir le message actuel' },
        { label: '♻️ Réinitialiser', cmd: 'goodbye reset', desc: 'Style NEXO-JARVIS par défaut' }
    ] },

    // ── Automatismes du propriétaire ───────────────────────────────────────
    chatbot: { title: '💬 Chatbot', options: [
        { label: '✅ Activer ici', cmd: 'chatbot on', desc: 'Cette discussion' },
        { label: '❌ Désactiver ici', cmd: 'chatbot off', desc: 'Cette discussion' },
        { label: '👥 Tous les groupes : ON', cmd: 'chatbot group on', desc: 'Réglage global' },
        { label: '👥 Tous les groupes : OFF', cmd: 'chatbot group off', desc: 'Réglage global' },
        { label: '📩 Tous les privés : ON', cmd: 'chatbot dm on', desc: 'Réglage global' },
        { label: '📩 Tous les privés : OFF', cmd: 'chatbot dm off', desc: 'Réglage global' },
        { label: '📊 Voir le statut', cmd: 'chatbot status', desc: 'Configuration' }
    ] },
    autoread: { title: '👁️ Autoread', options: [
        { label: '✅ Activer', cmd: 'autoread on', desc: 'Lit tous les messages' },
        { label: '❌ Désactiver', cmd: 'autoread off', desc: 'Ne lit plus automatiquement' }
    ] },
    autotyping: { title: '⌨️ Autotyping', options: [
        { label: '✅ Activer', cmd: 'autotyping on', desc: '« écrit… » automatique' },
        { label: '❌ Désactiver', cmd: 'autotyping off', desc: 'Désactive' }
    ] },
    autostatus: { title: '📸 Autostatus', options: [
        { label: '✅ Voir les statuts : ON', cmd: 'autostatus on', desc: 'Visualisation automatique' },
        { label: '❌ Voir les statuts : OFF', cmd: 'autostatus off', desc: 'Désactive' },
        { label: '💫 Réactions : ON', cmd: 'autostatus react on', desc: 'Réagit aux statuts' },
        { label: '🚫 Réactions : OFF', cmd: 'autostatus react off', desc: 'Plus de réaction' }
    ] },
    areact: { title: '😀 Autoreact', options: [
        { label: '✅ Activer', cmd: 'areact on', desc: 'Réagit à tous les messages' },
        { label: '❌ Désactiver', cmd: 'areact off', desc: 'Désactive' }
    ] },
    mention: { title: '📣 Mention auto', options: [
        { label: '✅ Activer', cmd: 'mention on', desc: 'Répond quand on mentionne le bot' },
        { label: '❌ Désactiver', cmd: 'mention off', desc: 'Désactive' }
    ] },
    mode: { title: '🔐 Mode du bot', options: [
        { label: '🌐 Public', cmd: 'mode public', desc: 'Tout le monde peut utiliser le bot' },
        { label: '🔒 Privé', cmd: 'mode private', desc: 'Propriétaire et sudo seulement' }
    ] },

    // ── Affichage ──────────────────────────────────────────────────────────
    menustyle: { title: '🎨 Style du menu', options: [
        { label: '📋 Complet (boutons)', cmd: 'menustyle complet', desc: 'Menu + boutons' },
        { label: '📝 Texte seul', cmd: 'menustyle texte', desc: 'Sans boutons' }
    ] },
    imagemode: { title: '🖼️ Mode image', options: [
        { label: '✅ Activer', cmd: 'imagemode on', desc: 'Réponses avec photo' },
        { label: '❌ Désactiver', cmd: 'imagemode off', desc: 'Réponses sans photo' }
    ] },
    replystyle: { title: '🧩 Cadre des réponses', options: [
        { label: '✅ Activer', cmd: 'replystyle on', desc: 'Cadre autour des réponses' },
        { label: '❌ Désactiver', cmd: 'replystyle off', desc: 'Réponses sans cadre' }
    ] },
    preview: { title: '🔎 Aperçu du lien', options: [
        { label: '✅ Activer', cmd: 'preview on', desc: 'Aperçu d\'image' },
        { label: '❌ Désactiver', cmd: 'preview off', desc: 'Sans aperçu' }
    ] },
    quotecard: { title: '💳 Fausse citation', options: [
        { label: '✅ Activer', cmd: 'quotecard on', desc: 'Carte de citation' },
        { label: '❌ Désactiver', cmd: 'quotecard off', desc: 'Sans carte' }
    ] },
    lang: { title: '🌐 Langue', options: [
        { label: '🇫🇷 Français', cmd: 'lang fr', desc: 'Réponses en français' },
        { label: '🇬🇧 English', cmd: 'lang en', desc: 'Replies in English' }
    ] },

    // ── Groupe ─────────────────────────────────────────────────────────────
    hijack: { title: '🛑 Hijack', options: [
        { label: '🔒 Verrouiller', cmd: 'hijack', desc: 'Verrouille le groupe' },
        { label: '⏱️ Verrouiller 10 min', cmd: 'hijack 10m', desc: 'Temporaire' },
        { label: '⏱️ Verrouiller 1 h', cmd: 'hijack 1h', desc: 'Temporaire' },
        { label: '🔓 Déverrouiller', cmd: 'hijack off', desc: 'Désactive et ouvre' },
        { label: '📊 Voir le statut', cmd: 'hijack status', desc: 'État actuel' }
    ] },
    open: { title: '🔓 Groupe', options: [
        { label: '🔓 Ouvrir', cmd: 'open', desc: 'Tout le monde écrit' },
        { label: '🔒 Fermer', cmd: 'close', desc: 'Admins seulement' }
    ] },
    close: { title: '🔒 Groupe', options: [
        { label: '🔓 Ouvrir', cmd: 'open', desc: 'Tout le monde écrit' },
        { label: '🔒 Fermer', cmd: 'close', desc: 'Admins seulement' }
    ] },
    sudo: { title: '👑 Sudo', options: [
        { label: '➕ Ajouter', cmd: 'sudo add', desc: 'Répondre / mentionner' },
        { label: '➖ Retirer', cmd: 'sudo del', desc: 'Répondre / mentionner' },
        { label: '📋 Liste', cmd: 'sudo list', desc: 'Voir les sudo' }
    ] },
    slowmode: { title: '🐢 Mode lent', options: [
        { label: '⏱️ 10 secondes', cmd: 'slowmode 10', desc: 'Délai entre messages' },
        { label: '⏱️ 30 secondes', cmd: 'slowmode 30', desc: 'Délai entre messages' },
        { label: '⏱️ 60 secondes', cmd: 'slowmode 60', desc: 'Délai entre messages' },
        { label: '❌ Désactiver', cmd: 'slowmode off', desc: 'Retire le délai' }
    ] },
    lockchat: { title: '🔒 Discussion', options: [
        { label: '🔒 Verrouiller', cmd: 'lockchat', desc: 'Admins seulement' },
        { label: '🔓 Déverrouiller', cmd: 'unlockchat', desc: 'Tout le monde écrit' }
    ] },
    unlockchat: { title: '🔒 Discussion', options: [
        { label: '🔒 Verrouiller', cmd: 'lockchat', desc: 'Admins seulement' },
        { label: '🔓 Déverrouiller', cmd: 'unlockchat', desc: 'Tout le monde écrit' }
    ] },
    restrictchat: { title: '⚙️ Infos du groupe', options: [
        { label: '🔒 Admins seulement', cmd: 'restrictchat', desc: 'Modifier les infos' },
        { label: '🔓 Tous les membres', cmd: 'unrestrictchat', desc: 'Modifier les infos' }
    ] },
    unrestrictchat: { title: '⚙️ Infos du groupe', options: [
        { label: '🔒 Admins seulement', cmd: 'restrictchat', desc: 'Modifier les infos' },
        { label: '🔓 Tous les membres', cmd: 'unrestrictchat', desc: 'Modifier les infos' }
    ] }
};

// Alias de commandes → spec
const ALIASES = { autoreact: 'areact', autoreaction: 'areact' };

function specFor(command) {
    const key = ALIASES[command] || command;
    return SPECS[key] || null;
}

// Réponses qui ne doivent PAS recevoir de boutons : refus, erreurs, avertissements d'usage.
const DENIAL = /^[\s*_`~>]*(?:❌|⛔|🚫|🚷)|r[ée]serv[ée]|seuls? (?:les )?(?:admin|propri)|acc[èe]s r[ée]serv|n'est disponible qu'en groupe|doit [êe]tre admin|faites-moi d'abord admin|option invalide|invalid/i;

function isDenial(text) {
    return DENIAL.test(String(text || '').slice(0, 220));
}

function rowsFor(spec, prefix) {
    return spec.options.map(option => ({
        header: '',
        title: option.label,
        description: option.desc || '',
        id: `${prefix}${option.cmd}`
    }));
}

function buildButtons(spec, prefix) {
    const rows = rowsFor(spec, prefix);
    const sections = [];
    for (let index = 0; index < rows.length; index += 10) {
        sections.push({
            title: rows.length > 10 ? `${spec.title} ${Math.floor(index / 10) + 1}/${Math.ceil(rows.length / 10)}` : spec.title,
            highlight_label: '',
            rows: rows.slice(index, index + 10)
        });
    }
    return [{ name: 'single_select', params: { title: '⚡ Actions', sections } }];
}

// Texte de secours quand le message à boutons ne peut pas partir.
function plainOptions(spec, prefix) {
    return `\n\n⚡ *Actions*\n${spec.options.map(option => `• ${prefix}${option.cmd} — ${option.label.replace(/^\S+\s/, '')}`).join('\n')}`;
}

const MEDIA_KEYS = ['image', 'video', 'audio', 'sticker', 'document', 'contacts', 'location', 'poll', 'react', 'delete', 'forward', 'viewOnce', 'buttons', 'templateButtons', 'sections', 'listMessage'];

function wrapSock(sock, { chatId, message, command }) {
    const spec = specFor(command);
    if (!spec || !sock || typeof sock.sendMessage !== 'function') return sock;
    const prefix = getPrefix(chatId);
    let busy = false;

    return new Proxy(sock, {
        get(target, property, receiver) {
            if (property !== 'sendMessage') {
                const value = Reflect.get(target, property, target);
                return typeof value === 'function' ? value.bind(target) : value;
            }
            return async (jid, content, options) => {
                const eligible = !busy && jid === chatId && content && typeof content === 'object' &&
                    typeof content.text === 'string' && content.text.trim() &&
                    !MEDIA_KEYS.some(key => content[key] !== undefined) &&
                    !isDenial(content.text);
                if (!eligible) return target.sendMessage(jid, content, options);

                busy = true;
                try {
                    const { sendInteractiveMessage } = require('./interactiveButtons');
                    const mentions = Array.isArray(content.mentions) ? content.mentions : [];
                    const contextInfo = { ...(content.contextInfo || {}) };
                    if (mentions.length) contextInfo.mentionedJid = mentions;
                    delete contextInfo.externalAdReply;
                    return await sendInteractiveMessage(target, chatId, {
                        title: '',
                        body: content.text,
                        buttons: buildButtons(spec, prefix),
                        contextInfo,
                        preview: false,
                        quoted: (options && options.quoted) || message
                    });
                } catch (error) {
                    console.warn(`[actions] boutons indisponibles pour .${command} (${error.message}) : texte simple`);
                    return target.sendMessage(jid, { ...content, text: content.text + plainOptions(spec, prefix) }, options);
                } finally {
                    busy = false;
                }
            };
        }
    });
}

function commandNameOf(userMessage) {
    return String(userMessage || '').trim().split(/\s+/)[0].replace(/^\./, '').toLowerCase();
}

module.exports = {
    SPECS, specFor, wrapSock, buildButtons, plainOptions, isDenial, commandNameOf, rowsFor
};
