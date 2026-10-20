'use strict';

/*
 * .pair <numéro>[, <numéro>…] — lie d'autres numéros WhatsApp à ce bot.
 *
 * Le jumelage utilise le moteur multi-sessions de web.js, démarré dans ce même
 * processus à la première demande (pas de panneau externe, aucun port public
 * nécessaire) : le code d'appairage est renvoyé directement dans la discussion.
 */

const axios = require('axios');
const { sleep } = require('../lib/myfunc');

const MAX_NUMBERS_PER_REQUEST = 3;
const SERVER_START_TIMEOUT_MS = 25000;

const deps = { axios, sleep, ensureServer };

function localPort() {
    return process.env.PORT || process.env.SERVER_PORT || 3000;
}

// Démarre le serveur de jumelage (web.js) dans ce processus s'il ne tourne pas encore.
async function ensureServer() {
    const base = `http://127.0.0.1:${localPort()}`;
    const alive = async () => {
        try {
            const res = await deps.axios.get(`${base}/ping`, { timeout: 2500 });
            return res.data && res.data.pong === true;
        } catch {
            return false;
        }
    };
    if (await alive()) return base;

    require('../web');   // met en route le moteur de jumelage (mis en cache ensuite)
    const deadline = Date.now() + SERVER_START_TIMEOUT_MS;
    while (Date.now() < deadline) {
        if (await alive()) return base;
        await deps.sleep(800);
    }
    throw new Error('le moteur de jumelage ne répond pas');
}

function botNumber(sock) {
    return String(sock.user?.id || '').split(':')[0].split('@')[0].replace(/\D/g, '');
}

function usageText() {
    return (
        '📱 *NEXO-JARVIS XMD — Liaison d\'appareil*\n\n' +
        'Indiquez le numéro à connecter, avec l\'indicatif du pays et sans « + » :\n' +
        '*.pair 243800000000*\n\n' +
        'Plusieurs numéros possibles, séparés par une virgule (3 maximum).'
    );
}

function instructions(code) {
    return (
        '✅ *Liaison prête, Monsieur*\n\n' +
        `🔑 Code : *${code}*\n\n` +
        '📱 Marche à suivre :\n' +
        '1. Ouvrez WhatsApp sur le téléphone concerné\n' +
        '2. Paramètres → Appareils connectés\n' +
        '3. Lier un appareil → *Lier avec un numéro de téléphone*\n' +
        '4. Saisissez le code ci-dessous\n\n' +
        '⚠️ Ce code expire dans quelques minutes.'
    );
}

async function pairCommand(sock, chatId, message, query = '') {
    const reply = (text) => sock.sendMessage(chatId, { text }, { quoted: message });
    try {
        const raw = String(query || '').trim();
        if (!raw) return await reply(usageText());

        const numbers = [...new Set(raw.split(/[,;\n]+/)
            .map(value => value.replace(/\D/g, ''))
            .filter(value => value.length >= 7 && value.length <= 15))];

        if (!numbers.length) {
            return await reply('❌ Ce numéro ne semble pas valide, Monsieur. Format attendu : *.pair 243800000000*');
        }
        if (numbers.length > MAX_NUMBERS_PER_REQUEST) {
            return await reply(`❌ ${MAX_NUMBERS_PER_REQUEST} numéros au maximum par demande, Monsieur.`);
        }

        let base;
        try {
            base = await deps.ensureServer();
        } catch (error) {
            console.error('[pair] moteur indisponible :', error.message);
            return await reply('❌ Le moteur de jumelage est indisponible pour le moment, Monsieur. Réessayez dans un instant.');
        }

        for (const number of numbers) {
            if (number === botNumber(sock)) {
                await reply(`ℹ️ Le numéro *${number}* est déjà celui de mon système principal, Monsieur.`);
                continue;
            }

            await reply(`⏳ Génération du code de liaison pour *${number}*.\nPatientez environ 10 secondes.`);
            try {
                const response = await deps.axios.get(`${base}/code`, {
                    params: { number },
                    timeout: 70000,
                    validateStatus: status => status >= 200 && status < 600
                });
                const data = response.data || {};

                if (data.already) {
                    await reply(`✅ Le numéro *${number}* est déjà connecté à mes systèmes, Monsieur.`);
                } else if (data.code && !data.error) {
                    await reply(instructions(data.code));
                    await deps.sleep(800);
                    // Code seul dans un second message : un appui suffit pour le copier.
                    await sock.sendMessage(chatId, { text: String(data.code) });
                } else {
                    throw new Error(data.message || `HTTP ${response.status}`);
                }
            } catch (error) {
                console.error(`[pair] ${number} :`, error.message);
                await reply(`❌ La liaison de *${number}* a échoué : ${error.message}`);
            }
        }
    } catch (error) {
        console.error('[pair] erreur générale :', error);
        try {
            await reply('❌ Une anomalie est survenue lors de la liaison, Monsieur. Réessayez dans un instant.');
        } catch { /* conversation indisponible */ }
    }
}

module.exports = pairCommand;
module.exports.deps = deps;
