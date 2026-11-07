'use strict';

/*
 * Suppression / relance complètes d'une session, utilisées par .sessions et le panel.
 * Une session = une instance en cours + un dossier de fichiers (creds, clés…) + une fiche dans le registre.
 * Tout doit disparaître, sinon le bot la ressuscite au prochain démarrage (web.js relit le dossier sessions/).
 */

const fs = require('fs');
const path = require('path');
const { sessionManager } = require('./session-manager');

const hooks = [];

function sessionsRoot() {
    return process.env.SESSION_DIR ? path.resolve(process.env.SESSION_DIR) : path.join(__dirname, '..', 'sessions');
}

// web.js s'y abonne pour oublier le numéro (pairedNumbers…).
function onRemoved(callback) {
    if (typeof callback === 'function') hooks.push(callback);
}

// Un chemin n'est supprimé que s'il se trouve dans un dossier de sessions connu.
function isInsideSessionsRoot(target) {
    const resolved = path.resolve(target);
    const roots = [sessionsRoot(), path.join(__dirname, '..', 'sessions'), path.join(__dirname, '..', 'session')];
    return roots.some(root => resolved !== root && resolved.startsWith(root + path.sep));
}

function candidateDirs(number, record, instance) {
    const list = [record?.sessionDir, instance?.sessionDir, path.join(sessionsRoot(), `user_${number}`)];
    if (record?.sessionId) list.push(path.join(sessionsRoot(), record.sessionId));
    return [...new Set(list.filter(Boolean).map(dir => path.resolve(dir)))];
}

function botControl() {
    return require('./botInstance');
}

/**
 * Supprime la session. Retourne { ok, removedDirs, leftovers[] } après VÉRIFICATION : on ne dit « supprimée »
 * que si l'instance, les fichiers et la fiche du registre ont réellement disparu.
 */
async function removeSession(number, { logout = true } = {}) {
    const key = String(number).replace(/\D/g, '');
    const control = botControl();
    const instance = control.getBotInstance(key);
    const record = sessionManager.getByPhone(key) || null;
    const leftovers = [];

    if (instance) {
        instance.stopping = true;                 // pas de reconnexion automatique pendant la suppression
        if (logout && instance.sock && instance.connected) {
            // Déconnecte aussi l'appareil lié dans WhatsApp (4 s d'attente au plus).
            try { await Promise.race([instance.sock.logout(), new Promise(resolve => setTimeout(resolve, 4000))]); } catch { /* déjà déconnectée */ }
        }
    }
    control.stopBotInstance(key);

    const removedDirs = [];
    for (const dir of candidateDirs(key, record, instance)) {
        if (!isInsideSessionsRoot(dir)) { leftovers.push(`dossier hors zone de sécurité : ${dir}`); continue; }
        try { fs.rmSync(dir, { recursive: true, force: true }); } catch (error) { leftovers.push(`${dir} : ${error.message}`); }
        if (fs.existsSync(dir)) leftovers.push(`dossier encore présent : ${dir}`); else removedDirs.push(dir);
    }

    sessionManager.releaseSession(key);
    if (sessionManager.getByPhone(key)) leftovers.push('fiche encore dans le registre');
    if (control.getBotInstance(key)) leftovers.push('instance encore active');

    for (const hook of hooks) { try { hook(key); } catch { /* sans conséquence */ } }
    return { ok: leftovers.length === 0, removedDirs, leftovers };
}

module.exports = { removeSession, onRemoved, sessionsRoot, isInsideSessionsRoot };
