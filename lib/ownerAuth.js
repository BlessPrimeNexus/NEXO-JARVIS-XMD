'use strict';

/*
 * Contrôle « propriétaire » unique du bot.
 *
 * Propriétaires = les numéros listés dans settings.ownerNumbers (variable OWNER_NUMBERS=num1,num2) :
 * le numéro du développeur ET le numéro sur lequel le bot principal est connecté.
 *
 * Règles :
 *   • message envoyé depuis le compte connecté à CETTE session (fromMe) → propriétaire seulement si ce compte
 *     est dans la liste. (Avant : n'importe quelle session connectée passait pour « propriétaire ».)
 *   • message reçu → on compare le numéro de l'expéditeur. Dans les groupes et de plus en plus en privé,
 *     WhatsApp donne un identifiant anonyme (@lid) au lieu du numéro : on le traduit (participantAlt,
 *     table de correspondance de Baileys, puis liste des participants du groupe).
 */

const fs = require('fs');
const path = require('path');
const settings = require('../settings');
const sessionContext = require('./sessionContext');

const OWNERS_FILE = process.env.OWNERS_FILE || path.join(__dirname, '..', 'data', 'owners.json');

const digits = (value) => String(value || '').split('@')[0].split(':')[0].replace(/\D/g, '');

// Propriétaires ajoutés depuis WhatsApp (.owners add) : gardés dans data/owners.json.
function extraOwners() {
    try {
        const data = JSON.parse(fs.readFileSync(OWNERS_FILE, 'utf8'));
        return (Array.isArray(data.numbers) ? data.numbers : []).map(digits).filter(value => value.length >= 7);
    } catch { return []; }
}

function saveExtraOwners(numbers) {
    fs.mkdirSync(path.dirname(OWNERS_FILE), { recursive: true });
    fs.writeFileSync(OWNERS_FILE, JSON.stringify({ numbers }, null, 2));
}

function baseOwners() {
    const list = [];
    const fromEnv = String(process.env.OWNER_NUMBERS || '').split(/[,\s;]+/);
    if (Array.isArray(settings.ownerNumbers)) list.push(...settings.ownerNumbers);
    list.push(settings.ownerNumber, ...fromEnv);
    return new Set(list.map(digits).filter(value => value.length >= 7));
}

function addOwner(number) {
    const clean = digits(number);
    if (clean.length < 7 || clean.length > 15) throw new Error('numéro invalide');
    if (ownerNumbers().has(clean)) return false;
    saveExtraOwners([...extraOwners(), clean]);
    return true;
}

function removeOwner(number) {
    const clean = digits(number);
    if (baseOwners().has(clean)) throw new Error('propriétaire principal (settings.js / OWNER_NUMBERS) : non supprimable ici');
    const current = extraOwners();
    if (!current.includes(clean)) return false;
    saveExtraOwners(current.filter(value => value !== clean));
    return true;
}

// Propriétaires de la PLATEFORME : settings.js / OWNER_NUMBERS + anciens propriétaires globaux (avant l'isolation).
function platformOwnerNumbers() {
    const legacy = sessionContext.withoutSession(() => extraOwners());
    return new Set([...baseOwners(), ...legacy]);
}

// Propriétaires de CETTE session : le compte connecté lui-même + ceux ajoutés par .owners add (réglage propre à la session).
function sessionOwnerNumbers() {
    const list = [...extraOwners()];
    const own = sessionContext.currentNumber();
    if (own) list.push(own);
    return new Set(list.map(digits).filter(value => value.length >= 7));
}

function ownerNumbers() {
    return new Set([...platformOwnerNumbers(), ...sessionOwnerNumbers()]);
}

const isPhoneJid = (jid) => /@s\.whatsapp\.net$/.test(String(jid || ''));
const isLid = (jid) => /@lid$/.test(String(jid || ''));

async function phoneFromLid(sock, lid) {
    try {
        const mapping = sock?.signalRepository?.lidMapping;
        if (mapping?.getPNForLID) {
            const pn = await mapping.getPNForLID(lid);
            if (pn) return digits(pn);
        }
    } catch { /* table indisponible */ }
    return '';
}

async function phoneFromGroup(sock, chatId, lid) {
    if (!sock?.groupMetadata || !String(chatId || '').endsWith('@g.us')) return '';
    try {
        const metadata = await sock.groupMetadata(chatId);
        const wanted = digits(lid);
        for (const participant of metadata.participants || []) {
            const ids = [participant.id, participant.lid].filter(Boolean).map(digits);
            if (ids.includes(wanted)) {
                const phone = digits(participant.phoneNumber || participant.jid || (isPhoneJid(participant.id) ? participant.id : ''));
                if (phone) return phone;
            }
        }
    } catch { /* métadonnées indisponibles */ }
    return '';
}

/** Numéros de téléphone possibles de l'expéditeur du message (jamais de LID brut). */
async function senderPhones(sock, message, chatId) {
    const key = message.key || {};
    const isGroup = String(chatId || key.remoteJid || '').endsWith('@g.us');
    const raw = [key.participant, key.participantAlt, isGroup ? null : key.remoteJid, isGroup ? null : key.remoteJidAlt].filter(Boolean);
    const phones = new Set();
    for (const jid of raw) {
        if (isPhoneJid(jid)) { phones.add(digits(jid)); continue; }
        if (isLid(jid)) {
            const phone = await phoneFromLid(sock, jid) || await phoneFromGroup(sock, chatId || key.remoteJid, jid);
            if (phone) phones.add(phone);
        }
    }
    return phones;
}

/** Propriétaire de la PLATEFORME (développeur) : seul autorisé pour .restart, .panel, .sessions, .update… */
async function isPlatformOwnerMessage(sock, message, chatId) {
    const owners = platformOwnerNumbers();
    const key = (message && message.key) || {};
    if (key.fromMe) return owners.has(digits(sock?.user?.id));
    const phones = await senderPhones(sock, message, chatId);
    return [...phones].some(phone => owners.has(phone));
}

/** Propriétaire de CETTE session (le compte connecté, ses .owners, ou un propriétaire de la plateforme). Sans sudo. */
async function isOwnerMessage(sock, message, chatId) {
    const key = (message && message.key) || {};
    if (key.fromMe) return true;   // message envoyé depuis le compte connecté à cette session : c'est SON bot
    const owners = ownerNumbers();
    const phones = await senderPhones(sock, message, chatId);
    return [...phones].some(phone => owners.has(phone));
}

/** Propriétaire ou sudo désigné par le propriétaire (jamais via fromMe d'une autre session). */
async function isOwnerOrSudoMessage(sock, message, chatId) {
    if (await isOwnerMessage(sock, message, chatId)) return true;
    if (message?.key?.fromMe) return false;
    try {
        const { isSudo } = require('./index');
        const phones = await senderPhones(sock, message, chatId);
        for (const phone of phones) if (await isSudo(`${phone}@s.whatsapp.net`)) return true;
        const sender = message.key.participant || message.key.remoteJid;
        return await isSudo(sender);
    } catch {
        return false;
    }
}

module.exports = { ownerNumbers, platformOwnerNumbers, sessionOwnerNumbers, isPlatformOwnerMessage, baseOwners, extraOwners, addOwner, removeOwner, isOwnerMessage, isOwnerOrSudoMessage, senderPhones, digits };
