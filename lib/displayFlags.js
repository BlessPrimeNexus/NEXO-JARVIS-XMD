'use strict';

/*
 * Réglages d'affichage modifiables sans redéployer (commandes du propriétaire) :
 *   menuStyle      : mixte (texte + barre de boutons, défaut) | complet (un seul message à boutons) | texte
 *   quoteCard      : fausse citation « WhatsApp ✓ • Statut » sur chaque réponse (activée / désactivée)
 *   quoteCardStyle : universal (défaut, lue partout) | business (carte de commande, WhatsApp Business)
 * Ordre de lecture : valeur forcée (tests) > data/display.json > settings.js.
 * Par défaut les deux sont activés (valeurs de settings.js) ; ils se coupent en une commande
 * si un format se révèle invisible pour certains membres (voir .viewtest).
 */

const fs = require('fs');
const path = require('path');
const settings = require('../settings');

const FILE = process.env.DISPLAY_FLAGS_FILE || path.join(__dirname, '..', 'data', 'display.json');
const overrides = new Map();
let stored = null;

function load() {
    if (stored) return stored;
    try {
        stored = JSON.parse(fs.readFileSync(FILE, 'utf8')) || {};
    } catch {
        stored = {};
    }
    return stored;
}

function get(name) {
    if (overrides.has(name)) return overrides.get(name) === true;
    const value = load()[name];
    if (typeof value === 'boolean') return value;
    return settings[name] === true;
}

function set(name, value) {
    const data = load();
    data[name] = Boolean(value);
    try {
        fs.mkdirSync(path.dirname(FILE), { recursive: true });
        fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.warn('[display] réglage non enregistré sur disque :', error.message);
    }
    return data[name];
}

// Réglages à valeur texte : menuStyle (mixte | complet | texte), quoteCardStyle (universal | business).
function getValue(name) {
    if (overrides.has(name)) return overrides.get(name);
    const value = load()[name];
    if (typeof value === 'string' && value) return value;
    return settings[name];
}

function setValue(name, value) {
    const data = load();
    data[name] = String(value);
    try {
        fs.mkdirSync(path.dirname(FILE), { recursive: true });
        fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.warn('[display] réglage non enregistré sur disque :', error.message);
    }
    return data[name];
}

// Réservé aux tests : valeur forcée en mémoire, jamais écrite sur disque.
function override(name, value) {
    if (value === undefined) overrides.delete(name);
    else overrides.set(name, value);
}

module.exports = { get, set, getValue, setValue, override };
