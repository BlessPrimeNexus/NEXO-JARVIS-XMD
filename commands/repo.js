'use strict';

/*
 * .repo — carte du projet (même présentation que .owner)
 *   un seul message : fiche (projet, dépôt, panneau, stats GitHub si disponibles) + boutons
 *   « GitHub », « Panneau de connexion », « Copier le lien », « Menu » ; les liens sont dans les boutons.
 */

const axios = require('axios');
const settings = require('../settings');
const { report } = require('../lib/style');

const REPO_URL = () => settings.repoUrl || 'https://github.com/BlessPrimeNexus/NEXO-JARVIS-XMD';
const PANEL_URL = () => settings.panelUrl || settings.pairApiUrl || 'https://nexo-jarvis-xmd-production.up.railway.app';
const repoSlug = () => REPO_URL().replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '');

async function fetchStats() {
    try {
        const { data } = await axios.get(`https://api.github.com/repos/${repoSlug()}`, {
            headers: { 'User-Agent': 'NEXO-JARVIS-XMD-Bot' }, timeout: 4000
        });
        return data;
    } catch {
        return null;   // hors ligne / limite de l'API : la fiche s'affiche sans les chiffres
    }
}

function repoCardText(stats, { withLinks = false } = {}) {
    const project = [['👤 Projet', settings.botName || 'NEXO-JARVIS XMD'], ['📂 Dépôt', repoSlug()]];
    if (stats) {
        project.push(['⭐ Étoiles', String(stats.stargazers_count)], ['🔀 Forks', String(stats.forks_count)]);
    }
    const sections = [{ title: '📦 Projet', rows: project }];
    sections.push({ title: '🌐 Connexion', rows: withLinks
        ? [['Panneau', PANEL_URL()], ['GitHub', REPO_URL()]]
        : [['Panneau', 'Connecter mon compte']] });
    return report('📦 Dépôt', [], sections);
}

function repoButtons(prefix = '.') {
    const url = (text, link) => ({ name: 'cta_url', params: { display_text: text, url: link, merchant_url: link } });
    return [
        url('💻 Code source GitHub', REPO_URL()),
        url('🌐 Panneau de connexion', PANEL_URL()),
        { name: 'cta_copy', params: { display_text: '📋 Copier le lien GitHub', copy_code: REPO_URL() } },
        { name: 'quick_reply', params: { display_text: '📜 Menu', id: `${prefix}menu` } }
    ];
}

async function repoCommand(sock, chatId, message) {
    const stats = await fetchStats();
    try {
        const { sendInteractiveMessage } = require('../lib/interactiveButtons');
        const presentation = require('../lib/presentation');
        const photo = presentation.imageReplyEnabled() ? await presentation.nextPhoto() : null;
        let prefix = '.';
        try { prefix = require('../lib/prefix').getPrefix(chatId) || '.'; } catch { /* préfixe par défaut */ }
        await sendInteractiveMessage(sock, chatId, {
            title: photo ? '' : (settings.botName || 'NEXO-JARVIS XMD'),
            body: repoCardText(stats),
            buttons: repoButtons(prefix),
            image: photo,
            preview: !photo,
            quoted: message
        });
    } catch (error) {
        // Les liens restent visibles si un vieux WhatsApp refuse les boutons natifs.
        console.warn('[repo] Boutons indisponibles :', error.message);
        await sock.sendMessage(chatId, { text: repoCardText(stats, { withLinks: true }) }, { quoted: message });
    }
}

module.exports = repoCommand;
module.exports.repoCardText = repoCardText;
module.exports.repoButtons = repoButtons;
