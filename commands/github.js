'use strict';

/*
 * .github — statistiques du dépôt officiel (même présentation que .repo et .owner).
 * Les chiffres viennent de l'API GitHub ; le lien est dans les boutons.
 */

const axios = require('axios');
const moment = require('moment-timezone');
const settings = require('../settings');
const { report } = require('../lib/style');

const REPO_URL = () => settings.repoUrl || 'https://github.com/BlessPrimeNexus/NEXO-JARVIS-XMD';
const repoSlug = () => REPO_URL().replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '');

function githubCardText(json, { withLink = false } = {}) {
    const rows = [
        ['📦 Dépôt', json.name],
        ['⭐ Étoiles', String(json.stargazers_count)],
        ['🔀 Forks', String(json.forks_count)],
        ['👁️ Suiveurs', String(json.watchers_count)],
        ['💾 Taille', `${(json.size / 1024).toFixed(2)} Mo`],
        ['🕐 Mise à jour', moment(json.updated_at).tz('Africa/Kinshasa').format('DD/MM/YY HH:mm')]
    ];
    if (withLink) rows.push(['🔗 Lien', json.html_url || REPO_URL()]);
    return report('💻 GitHub', [], [{ title: '📊 Statistiques', rows }]);
}

async function githubCommand(sock, chatId, message) {
    let json;
    try {
        const res = await axios.get(`https://api.github.com/repos/${repoSlug()}`, {
            headers: { 'User-Agent': 'NEXO-JARVIS-XMD-Bot' }, timeout: 8000
        });
        json = res.data;
    } catch (error) {
        console.error('[github] Erreur :', error.message);
        return sock.sendMessage(chatId, { text: '❌ Impossible de récupérer les infos GitHub pour le moment.' }, { quoted: message });
    }

    try {
        const { sendInteractiveMessage } = require('../lib/interactiveButtons');
        const presentation = require('../lib/presentation');
        const photo = presentation.imageReplyEnabled() ? await presentation.nextPhoto() : null;
        const link = json.html_url || REPO_URL();
        await sendInteractiveMessage(sock, chatId, {
            title: photo ? '' : (settings.botName || 'NEXO-JARVIS XMD'),
            body: githubCardText(json),
            buttons: [
                { name: 'cta_url', params: { display_text: '💻 Ouvrir sur GitHub', url: link, merchant_url: link } },
                { name: 'cta_copy', params: { display_text: '📋 Copier le lien', copy_code: link } }
            ],
            image: photo,
            preview: !photo,
            quoted: message
        });
    } catch (error) {
        console.warn('[github] Boutons indisponibles :', error.message);
        await sock.sendMessage(chatId, { text: githubCardText(json, { withLink: true }) }, { quoted: message });
    }
}

module.exports = githubCommand;
module.exports.githubCardText = githubCardText;
