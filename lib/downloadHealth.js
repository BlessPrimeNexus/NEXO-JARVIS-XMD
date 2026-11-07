'use strict';

/*
 * Santé des sources de téléchargement (song, video…).
 * Une source qui échoue 2 fois de suite est mise de côté 10 minutes (puis 20, 40… jusqu'à 1 h) au lieu d'être réessayée
 * à chaque commande : avant, chaque .song attendait jusqu'à 9 sources × 20 s avant d'abandonner.
 * Un succès la remet immédiatement en service. .dltest affiche cet état.
 */

const state = new Map();
const BASE_PAUSE_MS = 10 * 60 * 1000;
const MAX_PAUSE_MS = 60 * 60 * 1000;

const entry = (name) => {
    if (!state.has(name)) state.set(name, { fails: 0, until: 0, strikes: 0, lastOk: 0, lastError: '', lastMs: 0 });
    return state.get(name);
};

const usable = (name) => entry(name).until <= Date.now();

function ok(name, ms = 0) {
    const current = entry(name);
    Object.assign(current, { fails: 0, until: 0, strikes: 0, lastOk: Date.now(), lastError: '', lastMs: ms });
}

function fail(name, reason, ms = 0) {
    const current = entry(name);
    current.fails += 1;
    current.lastError = String(reason || '').slice(0, 160);
    current.lastMs = ms;
    if (current.fails >= 2) {
        current.strikes += 1;
        current.until = Date.now() + Math.min(MAX_PAUSE_MS, BASE_PAUSE_MS * 2 ** (current.strikes - 1));
        current.fails = 0;
    }
}

const snapshot = () => [...state].map(([name, value]) => ({ name, ...value, paused: value.until > Date.now() }));
const reset = () => state.clear();

module.exports = { usable, ok, fail, snapshot, reset };
