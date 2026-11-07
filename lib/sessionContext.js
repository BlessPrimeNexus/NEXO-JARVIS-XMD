'use strict';

/*
 * ISOLATION DES SESSIONS — chaque numéro connecté a ses PROPRES réglages.
 *
 * Le bug d'origine : tous les réglages (mode, préfixe, protections de groupe, antidelete, autoread, langue,
 * sudo, bannis, économie…) étaient écrits dans des fichiers uniques de data/. Deux numéros connectés au bot
 * partageaient donc la même configuration : régler l'un modifiait l'autre.
 *
 * Fonctionnement :
 *   1. chaque événement d'une session WhatsApp s'exécute dans un « contexte » (AsyncLocalStorage) portant
 *      le numéro de cette session (voir lib/botInstance.js) ;
 *   2. tout accès au dossier data/ fait pendant ce contexte est redirigé vers data/sessions/<numéro>/…
 *      (lecture, écriture, existence, renommage, suppression…). Les modules n'ont rien à changer ;
 *   3. seuls quelques fichiers restent communs à toute la plateforme (cache de traduction, cookies yt-dlp,
 *      cache de la chaîne, configuration du panneau, réglages de commandes par session, propriétaire du site) ;
 *   4. hors contexte (site web, démarrage), les chemins ne sont pas modifiés.
 *
 * Migration : les anciens fichiers globaux sont recopiés UNE fois vers la session du propriétaire principal
 * (settings.ownerNumber, ou la variable LEGACY_DATA_SESSION). Toutes les autres sessions démarrent à neuf.
 */

const { AsyncLocalStorage } = require('async_hooks');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(process.env.DATA_ROOT || path.join(__dirname, '..', 'data'));
const SESSIONS_ROOT = path.join(ROOT, 'sessions');
const SHARED = new Set([
    'translations.json', 'yt-cookies.txt', 'channel.json', 'panel-config.json', 'sessionSettings.json', 'owner.json',
    'messageLog.json'
]);

// Contenu initial d'une session NEUVE (jamais copié depuis les réglages d'un autre numéro).
const DEFAULTS = {"banned.json": [], "muted.json": {}, "warnings.json": {}, "messageCount.json": {"isPublic": true, "messageCount": {}}, "group-extras.json": {}, "hijack.json": {}, "groupAnti.json": {}, "sticker-commands.json": {}, "userGroupData.json": {"users": [], "groups": [], "antilink": {}, "antibadword": {}, "warnings": {}, "sudo": [], "welcome": {}, "goodbye": {}, "chatbot": {}, "autoReaction": false}, "fakeract.json": {"channels": {}}, "premium.json": [], "antibot.json": {}, "prefixes.json": {"default": ".", "scopes": {}}};

const als = new AsyncLocalStorage();
const digits = value => String(value || '').split('@')[0].split(':')[0].replace(/\D/g, '');

// Fonctions d'origine, capturées AVANT le patch (le module doit être chargé en premier).
const original = {
    mkdirSync: fs.mkdirSync.bind(fs),
    existsSync: fs.existsSync.bind(fs),
    copyFileSync: fs.copyFileSync.bind(fs),
    statSync: fs.statSync.bind(fs)
};

function runWithSession(number, fn) {
    const clean = digits(number);
    return als.run(clean ? { number: clean } : null, fn);
}
function withoutSession(fn) { return als.run(null, fn); }
function currentNumber() { const store = als.getStore(); return (store && store.number) || ''; }

/** Préfixe une clé mémoire (compteurs, minuteries…) avec le numéro de session courant. */
function scoped(key) {
    const number = currentNumber();
    return number ? `${number}|${key}` : String(key);
}

function legacySession() {
    if (process.env.LEGACY_DATA_SESSION) return digits(process.env.LEGACY_DATA_SESSION);
    try { return digits(require('../settings').ownerNumber); } catch { return ''; }
}

function topLevelName(relative) {
    return relative.split(path.sep)[0].replace(/(\.\d+)?\.tmp$/, '');
}

/** Chemin réel pour la session courante (ou le chemin d'origine s'il n'est pas concerné). */
function scopePath(target) {
    if (typeof target !== 'string') return target;
    const number = currentNumber();
    if (!number) return target;
    const absolute = path.resolve(target);
    if (absolute === ROOT || !absolute.startsWith(ROOT + path.sep)) return target;
    if (absolute === SESSIONS_ROOT || absolute.startsWith(SESSIONS_ROOT + path.sep)) return target;
    const relative = path.relative(ROOT, absolute);
    if (SHARED.has(topLevelName(relative))) return target;

    const mapped = path.join(SESSIONS_ROOT, number, relative);
    try { original.mkdirSync(path.dirname(mapped), { recursive: true }); } catch { /* sera signalé à l'écriture */ }

    // Session neuve : fichier de départ propre (liste de bannis vide, mode public…), jamais les réglages d'un autre numéro.
    const top = topLevelName(relative);
    if (relative === top && DEFAULTS[top] !== undefined && !original.existsSync(mapped) &&
        !(number === legacySession() && original.existsSync(absolute))) {
        try { fs.writeFileSync(mapped, JSON.stringify(DEFAULTS[top], null, 2)); } catch { /* sans conséquence */ }
    }

    // Migration unique des anciens réglages globaux vers la session du propriétaire principal.
    if (number === legacySession() && !original.existsSync(mapped) && original.existsSync(absolute)) {
        try {
            if (original.statSync(absolute).isFile() && !/\.tmp$/.test(absolute)) original.copyFileSync(absolute, mapped);
        } catch { /* pas de migration pour ce fichier */ }
    }
    return mapped;
}

function patch(owner, name, pathArgs = 1) {
    const fn = owner[name];
    if (typeof fn !== 'function' || fn.__sessionScoped) return;
    const wrapped = function (...args) {
        for (let i = 0; i < pathArgs && i < args.length; i++) args[i] = scopePath(args[i]);
        return fn.apply(this, args);
    };
    wrapped.__sessionScoped = true;
    try { Object.defineProperty(wrapped, 'name', { value: fn.name }); } catch { /* sans importance */ }
    owner[name] = wrapped;
}

/** Map dont les clés sont automatiquement propres à la session courante (compteurs, minuteries, mémoires). */
class ScopedMap extends Map {
    get(key) { return super.get(scoped(key)); }
    set(key, value) { return super.set(scoped(key), value); }
    has(key) { return super.has(scoped(key)); }
    delete(key) { return super.delete(scoped(key)); }
}

let installed = false;
function install() {
    if (installed) return;
    installed = true;
    for (const name of ['readFileSync', 'writeFileSync', 'appendFileSync', 'existsSync', 'statSync', 'lstatSync',
        'unlinkSync', 'accessSync', 'readFile', 'writeFile', 'appendFile', 'unlink', 'access', 'stat']) patch(fs, name, 1);
    for (const name of ['renameSync', 'copyFileSync', 'rename', 'copyFile']) patch(fs, name, 2);
    for (const name of ['readFile', 'writeFile', 'appendFile', 'unlink', 'access', 'stat']) patch(fs.promises, name, 1);
    for (const name of ['rename', 'copyFile']) patch(fs.promises, name, 2);
}

module.exports = {
    ROOT, SESSIONS_ROOT, SHARED, ScopedMap, install, runWithSession, withoutSession, currentNumber, scoped, scopePath, digits
};
