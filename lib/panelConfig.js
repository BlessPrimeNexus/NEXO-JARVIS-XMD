'use strict';

/*
 * Réglages modifiables depuis WhatsApp (.config) sans toucher au code ni redéployer.
 * Seules les clés listées dans ALLOWED sont modifiables ; les valeurs sont gardées dans data/panel-config.json
 * et réappliquées à chaque démarrage (settings.js appelle applyTo).
 */

const fs = require('fs');
const path = require('path');

const FILE = process.env.PANEL_CONFIG_FILE || path.join(__dirname, '..', 'data', 'panel-config.json');

const ALLOWED = {
    botName: 'string',
    menuOwner: 'string',
    botOwner: 'string',
    ownerRole: 'string',
    ownerBio: 'string',
    ownerWebsite: 'string',
    ownerSendContact: 'boolean',
    botLink: 'string',
    previewTitle: 'string',
    previewBody: 'string',
    replyNotes: 'boolean',
    maxStoreMessages: 'number'
};

const defaults = {};   // valeurs d'origine (settings.js), pour .config reset
let overrides = {};

function load() {
    try {
        const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
        overrides = Object.fromEntries(Object.entries(data).filter(([key]) => ALLOWED[key]));
    } catch { overrides = {}; }
}

function save() {
    try {
        fs.mkdirSync(path.dirname(FILE), { recursive: true });
        fs.writeFileSync(FILE, JSON.stringify(overrides, null, 2));
        return true;
    } catch { return false; }
}

function coerce(key, raw) {
    const type = ALLOWED[key];
    const text = String(raw).trim();
    if (type === 'boolean') {
        if (/^(true|on|oui|yes|1)$/i.test(text)) return true;
        if (/^(false|off|non|no|0)$/i.test(text)) return false;
        throw new Error('valeur attendue : on ou off');
    }
    if (type === 'number') {
        const value = Number(text);
        if (!Number.isFinite(value) || value < 0 || value > 100000) throw new Error('nombre invalide');
        return value;
    }
    if (!text) throw new Error('valeur vide');
    if (text.length > 200) throw new Error('valeur trop longue (200 caractères max)');
    return text;
}

function applyTo(settings) {
    load();
    for (const key of Object.keys(ALLOWED)) if (!(key in defaults)) defaults[key] = settings[key];
    for (const [key, value] of Object.entries(overrides)) settings[key] = value;
}

function list(settings) {
    return Object.keys(ALLOWED).map(key => ({ key, type: ALLOWED[key], value: settings[key], changed: key in overrides }));
}

function set(settings, key, raw) {
    if (!ALLOWED[key]) throw new Error('clé inconnue');
    const value = coerce(key, raw);
    if (!(key in defaults)) defaults[key] = settings[key];
    settings[key] = value;
    overrides[key] = value;
    if (!save()) throw new Error('enregistrement impossible sur le disque');
    return value;
}

function reset(settings, key) {
    if (!ALLOWED[key]) throw new Error('clé inconnue');
    if (key in defaults) settings[key] = defaults[key];
    delete overrides[key];
    save();
    return settings[key];
}

module.exports = { ALLOWED, applyTo, list, set, reset, load };
