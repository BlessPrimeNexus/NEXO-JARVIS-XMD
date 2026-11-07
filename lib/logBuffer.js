'use strict';

/*
 * Mémoire tampon des derniers journaux (console.log / warn / error) — alimente la commande .logs du panel.
 * Garde 400 lignes au plus, tronquées : coût mémoire négligeable.
 */

const util = require('util');

const MAX_LINES = 400;
const MAX_LENGTH = 300;
const lines = [];
let installed = false;

function push(level, args) {
    try {
        const text = util.format(...args).replace(/\x1b\[[0-9;]*m/g, '').replace(/\s+/g, ' ').trim();
        if (!text) return;
        const time = new Date().toLocaleTimeString('fr-FR', { timeZone: 'Africa/Kinshasa', hour12: false });
        lines.push({ level, line: `${time} ${text.slice(0, MAX_LENGTH)}` });
        if (lines.length > MAX_LINES) lines.splice(0, lines.length - MAX_LINES);
    } catch { /* le journal ne doit jamais faire planter le bot */ }
}

function install() {
    if (installed) return;
    installed = true;
    for (const [method, level] of [['log', 'info'], ['info', 'info'], ['warn', 'warn'], ['error', 'error']]) {
        const original = console[method].bind(console);
        console[method] = (...args) => { push(level, args); original(...args); };
    }
}

// Les n dernières lignes ; level = 'error' → erreurs seules, 'warn' → avertissements + erreurs.
function tail(count = 15, level = '') {
    const wanted = level === 'error' ? ['error'] : level === 'warn' ? ['warn', 'error'] : null;
    const list = wanted ? lines.filter(entry => wanted.includes(entry.level)) : lines;
    return list.slice(-Math.max(1, Math.min(60, count))).map(entry => entry.line);
}

function size() { return lines.length; }
function clear() { lines.length = 0; }

module.exports = { install, tail, size, clear, push };
