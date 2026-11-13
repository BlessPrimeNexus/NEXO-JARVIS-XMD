'use strict';

/*
 * THÈMES DU BOT — chaque session (chaque numéro connecté) choisit le sien avec .theme.
 *
 * Un thème change :
 *   • les IMAGES des réponses : dossier themes/<id>/ (ou jarvis-images/ pour le thème par défaut) ;
 *   • le STYLE des réponses : cadres des titres, puces et séparateurs (restyle, appliqué au texte final).
 *
 * Ajouter un thème : créer un dossier themes/<nom>/ et y déposer des images .jpg/.png — il apparaît
 * automatiquement dans .theme. (Les thèmes intégrés ont aussi leurs propres symboles.)
 */

const fs = require('fs');
const path = require('path');
const sessionContext = require('./sessionContext');

const ROOT = path.join(__dirname, '..');
const THEMES_DIR = process.env.THEMES_DIR ? path.resolve(process.env.THEMES_DIR) : path.join(ROOT, 'themes');
const DEFAULT_DIR = path.join(ROOT, 'jarvis-images');
const FILE = process.env.THEME_FILE || path.join(ROOT, 'data', 'theme.json');
const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;

// open/close : cadre des titres · b1 : puce des libellés · b2 : puce des commandes · rule : séparateur
const BUILTIN = {
    jarvis:    { name: 'Jarvis',        icon: '🤖', glyphs: null },
    escanor:   { name: 'Escanor',       icon: '☀️', glyphs: { open: '☀『', close: '』☀', b1: '✺', b2: '✹', rule: '☀' } },
    jinwoo:    { name: 'Sung Jin-woo',  icon: '🗡️', glyphs: { open: '⟡『', close: '』⟡', b1: '❖', b2: '✧', rule: '⟡' } },
    spiderman: { name: 'Spider-Man',    icon: '🕸️', glyphs: { open: '🕸『', close: '』🕸', b1: '✳', b2: '✴', rule: '🕸' } },
    zerotwo:   { name: 'Zero Two',      icon: '💗', glyphs: { open: '💗『', close: '』💗', b1: '♡', b2: '❥', rule: '🌸' } },
    gojo:      { name: 'Gojo',          icon: '♾️', glyphs: { open: '♾『', close: '』♾', b1: '❂', b2: '✧', rule: '♾' } },
    sakura:    { name: 'Sakura',        icon: '🌸', glyphs: { open: '🌸『', close: '』🌸', b1: '❀', b2: '✿', rule: '🌸' } }
};

const DEFAULT_ID = 'jarvis';
const slug = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');

function hasImages(dir) {
    try { return fs.readdirSync(dir).some(file => IMAGE_EXT.test(file)); } catch { return false; }
}

/** Thèmes disponibles : les intégrés + tout dossier themes/<nom>/ contenant des images. */
function list() {
    const result = [];
    for (const [id, theme] of Object.entries(BUILTIN)) {
        const dir = id === DEFAULT_ID ? DEFAULT_DIR : path.join(THEMES_DIR, id);
        if (id === DEFAULT_ID || hasImages(dir)) result.push({ id, ...theme, dir });
    }
    try {
        for (const entry of fs.readdirSync(THEMES_DIR, { withFileTypes: true })) {
            if (!entry.isDirectory() || BUILTIN[entry.name.toLowerCase()]) continue;
            const dir = path.join(THEMES_DIR, entry.name);
            if (!hasImages(dir)) continue;
            const id = slug(entry.name);
            if (!id || result.some(item => item.id === id)) continue;
            result.push({ id, name: entry.name.charAt(0).toUpperCase() + entry.name.slice(1), icon: '🎨', glyphs: null, dir });
        }
    } catch { /* pas de dossier themes/ */ }
    return result;
}

function find(query) {
    const wanted = slug(query);
    if (!wanted) return null;
    return list().find(theme => theme.id === wanted || slug(theme.name) === wanted) || null;
}

/* ─── Réglage par session ─── */

const chosen = new Map();   // numéro de session → id du thème

function currentId() {
    const number = sessionContext.currentNumber();
    if (!chosen.has(number)) {
        let id = DEFAULT_ID;
        try { id = String(JSON.parse(fs.readFileSync(FILE, 'utf8')).theme || DEFAULT_ID); } catch { /* thème par défaut */ }
        chosen.set(number, id);
    }
    return chosen.get(number);
}

function current() {
    return list().find(theme => theme.id === currentId()) || list().find(theme => theme.id === DEFAULT_ID);
}

function set(id) {
    const theme = find(id);
    if (!theme) return null;
    chosen.set(sessionContext.currentNumber(), theme.id);
    try {
        fs.mkdirSync(path.dirname(FILE), { recursive: true });
        fs.writeFileSync(FILE, JSON.stringify({ theme: theme.id }));
    } catch { /* actif en mémoire */ }
    return theme;
}

/** Dossier d'images du thème actif (repli : images par défaut). */
function imagesDir() {
    const theme = current();
    return theme && hasImages(theme.dir) ? theme.dir : DEFAULT_DIR;
}

/* ─── Style : symboles du thème appliqués au texte final ─── */

const DEFAULT_RULE = '  ✦ ──────────────── ✦';

function restyle(text) {
    if (typeof text !== 'string' || !text) return text;
    const glyphs = (current() || {}).glyphs;
    if (!glyphs) return text;
    return text
        .split(DEFAULT_RULE).join(`  ${glyphs.rule} ──────────────── ${glyphs.rule}`)
        .replace(/(^|\n)✦『 /g, `$1${glyphs.open} `)
        .replace(/ 』✦(?=\n|$)/g, ` ${glyphs.close}`)
        .replace(/(^|\n)(\s*)◇ /g, `$1$2${glyphs.b1} `)
        .replace(/(^|\n)(\s*)◈ /g, `$1$2${glyphs.b2} `);
}

module.exports = { list, find, current, currentId, set, imagesDir, restyle, DEFAULT_ID, THEMES_DIR, BUILTIN };
