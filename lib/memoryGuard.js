'use strict';

/*
 * Protection mémoire.
 *
 * Constat : chaque session WhatsApp ouvre un socket (≈ 60-100 Mo) et Node ne libère la mémoire que tard : sans plafond
 * de tas ni ramasse-miettes forcé, le processus gonfle jusqu'à la limite du serveur. Ici :
 *   • toutes les 30 s on mesure ; au-delà de MEM_SOFT_MB (défaut 350 Mo de RSS) on vide les caches non essentiels
 *     (messages mémorisés par les stores, cache des messages envoyés, journal .del, boutons) puis on lance le GC ;
 *   • un GC forcé tourne aussi toutes les 2 minutes (nécessite --expose-gc : voir railway.toml / package.json) ;
 *   • MEM_HARD_MB (défaut 0 = jamais) : redémarrage propre si la mémoire reste au-dessus après nettoyage.
 */

const v8 = require('v8');

const SOFT_MB = Math.max(100, Number(process.env.MEM_SOFT_MB || 350));
const HARD_MB = Math.max(0, Number(process.env.MEM_HARD_MB || 0));
const CHECK_MS = 30 * 1000;
const GC_MS = 2 * 60 * 1000;

const trimmers = [];
let timer = null;
let lastGc = 0;
let lastTrimAt = 0;
let trimCount = 0;

const mb = (bytes) => Math.round(bytes / 1024 / 1024 * 10) / 10;

function registerTrimmer(name, fn) {
    trimmers.push({ name, fn });
}

function snapshot() {
    const usage = process.memoryUsage();
    return {
        rss: mb(usage.rss),
        heapUsed: mb(usage.heapUsed),
        heapTotal: mb(usage.heapTotal),
        external: mb(usage.external),
        arrayBuffers: mb(usage.arrayBuffers || 0),
        heapLimit: mb(v8.getHeapStatistics().heap_size_limit),
        softLimit: SOFT_MB,
        gcAvailable: typeof global.gc === 'function',
        trims: trimCount,
        lastTrimAt
    };
}

function runGc() {
    if (typeof global.gc !== 'function') return false;
    try { global.gc(); lastGc = Date.now(); return true; } catch { return false; }
}

// Vide les caches non essentiels. Retourne { before, after, freed } en Mo (RSS).
function trim(reason = 'auto') {
    const before = mb(process.memoryUsage().rss);
    const cleared = [];
    for (const { name, fn } of trimmers) {
        try { fn(); cleared.push(name); } catch { /* un cache qui résiste n'empêche pas les autres */ }
    }
    runGc();
    trimCount += 1;
    lastTrimAt = Date.now();
    const after = mb(process.memoryUsage().rss);
    if (reason !== 'quiet') console.log(`[mémoire] nettoyage (${reason}) : ${before} → ${after} Mo [${cleared.join(', ')}]`);
    return { before, after, freed: Math.round((before - after) * 10) / 10, cleared };
}

function check() {
    const rss = mb(process.memoryUsage().rss);
    if (rss > SOFT_MB) {
        const result = trim('seuil');
        if (HARD_MB && result.after > HARD_MB) {
            console.error(`[mémoire] ${result.after} Mo > ${HARD_MB} Mo après nettoyage : redémarrage propre.`);
            setTimeout(() => process.exit(1), 1000);
        }
    } else if (Date.now() - lastGc > GC_MS) {
        runGc();
    }
}

function start() {
    if (timer) return;
    timer = setInterval(check, CHECK_MS);
    timer.unref?.();
}

module.exports = { start, trim, snapshot, registerTrimmer, runGc, SOFT_MB };
