'use strict';

/*
 * Commandes utilitaires NEXO-JARVIS XMD — sans clé d'API, sans service externe (sauf .qr → module qrcode local) :
 *   calcul : calc, percent, random, dice, flip, choose
 *   date   : date, time, age, countdown, uptime
 *   texte  : upper, lower, reverse, count, encode, decode, password
 *   image  : qr
 * Les réponses passent par sock.sendMessage : bouton chaîne, aperçu d'image et fausse citation sont ajoutés
 * automatiquement par lib/presentation.js.
 */

const crypto = require('crypto');
const os = require('os');

const UTILS_COMMANDS = [
    'calc', 'percent', 'random', 'dice', 'flip', 'choose',
    'date', 'time', 'age', 'countdown', 'uptime',
    'upper', 'lower', 'reverse', 'count', 'encode', 'decode', 'password', 'qr'
];

const TZ = 'Africa/Kinshasa';
const { panel } = require('../lib/style');
const box = (title, lines) => panel(title, lines);   // même design que le reste du bot

/* ─── Calcul sécurisé (aucun eval) ──────────────────────────── */

const FUNCTIONS = {
    sqrt: Math.sqrt, abs: Math.abs, sin: Math.sin, cos: Math.cos, tan: Math.tan,
    log: Math.log10, ln: Math.log, exp: Math.exp, round: Math.round, floor: Math.floor, ceil: Math.ceil
};
const CONSTANTS = { pi: Math.PI, e: Math.E };

function tokenize(input) {
    const tokens = [];
    const text = String(input).toLowerCase().replace(/,/g, '.').replace(/×/g, '*').replace(/÷/g, '/').replace(/\s+/g, '');
    let i = 0;
    while (i < text.length) {
        const ch = text[i];
        if (/[0-9.]/.test(ch)) {
            let j = i;
            while (j < text.length && /[0-9.]/.test(text[j])) j += 1;
            const raw = text.slice(i, j);
            if ((raw.match(/\./g) || []).length > 1) throw new Error('nombre invalide');
            tokens.push({ type: 'num', value: Number(raw) });
            i = j;
        } else if (/[a-z]/.test(ch)) {
            let j = i;
            while (j < text.length && /[a-z]/.test(text[j])) j += 1;
            const word = text.slice(i, j);
            if (word in CONSTANTS) tokens.push({ type: 'num', value: CONSTANTS[word] });
            else if (word in FUNCTIONS) tokens.push({ type: 'fn', value: word });
            else throw new Error(`« ${word} » n'est pas reconnu`);
            i = j;
        } else if ('+-*/%^()'.includes(ch)) {
            tokens.push({ type: 'op', value: ch });
            i += 1;
        } else {
            throw new Error(`caractère « ${ch} » non autorisé`);
        }
    }
    return tokens;
}

function evaluate(expression) {
    const tokens = tokenize(expression);
    if (!tokens.length) throw new Error('expression vide');
    let pos = 0;
    const peek = () => tokens[pos];
    const take = () => tokens[pos++];
    const isOp = (value) => peek() && peek().type === 'op' && peek().value === value;

    function parseExpression() {
        let left = parseTerm();
        while (isOp('+') || isOp('-')) {
            const op = take().value;
            const right = parseTerm();
            left = op === '+' ? left + right : left - right;
        }
        return left;
    }
    function parseTerm() {
        let left = parsePower();
        while (isOp('*') || isOp('/') || isOp('%')) {
            const op = take().value;
            const right = parsePower();
            if (op === '*') left *= right;
            else if (right === 0) throw new Error('division par zéro');
            else left = op === '/' ? left / right : left % right;
        }
        return left;
    }
    function parsePower() {
        const base = parseUnary();
        if (isOp('^')) {
            take();
            return Math.pow(base, parsePower());
        }
        return base;
    }
    function parseUnary() {
        if (isOp('-')) { take(); return -parsePower(); }
        if (isOp('+')) { take(); return parsePower(); }
        return parsePrimary();
    }
    function parsePrimary() {
        const token = take();
        if (!token) throw new Error('expression incomplète');
        if (token.type === 'num') return token.value;
        if (token.type === 'fn') {
            if (!isOp('(')) throw new Error(`« ${token.value} » attend des parenthèses`);
            take();
            const inner = parseExpression();
            if (!isOp(')')) throw new Error('parenthèse fermante manquante');
            take();
            return FUNCTIONS[token.value](inner);
        }
        if (token.value === '(') {
            const inner = parseExpression();
            if (!isOp(')')) throw new Error('parenthèse fermante manquante');
            take();
            return inner;
        }
        throw new Error('expression invalide');
    }

    const result = parseExpression();
    if (pos < tokens.length) throw new Error('expression invalide');
    if (!Number.isFinite(result)) throw new Error('résultat hors limites');
    return result;
}

function formatNumber(value) {
    if (Number.isInteger(value)) return String(value);
    return String(Number(value.toPrecision(12)));
}

/* ─── Aides ─────────────────────────────────────────────────── */

const argsOf = (text, name) => String(text || '').trim().slice(name.length + 1).trim();

function parseDate(input) {
    const raw = String(input || '').trim();
    let match = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    if (match) return new Date(Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1])));
    match = raw.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$/);
    if (match) return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    return null;
}

function formatDuration(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds));
    const parts = [
        [Math.floor(s / 86400), 'j'], [Math.floor((s % 86400) / 3600), 'h'],
        [Math.floor((s % 3600) / 60), 'min'], [s % 60, 's']
    ].filter(([value]) => value > 0).map(([value, unit]) => `${value}${unit}`);
    return parts.join(' ') || '0s';
}

function localTime(zone) {
    const now = new Date();
    return {
        date: now.toLocaleDateString('fr-FR', { timeZone: zone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
        time: now.toLocaleTimeString('fr-FR', { timeZone: zone, hour12: false })
    };
}

const ZONES = {
    kinshasa: 'Africa/Kinshasa', lubumbashi: 'Africa/Lubumbashi', paris: 'Europe/Paris', londres: 'Europe/London',
    london: 'Europe/London', newyork: 'America/New_York', montreal: 'America/Toronto', dakar: 'Africa/Dakar',
    abidjan: 'Africa/Abidjan', lagos: 'Africa/Lagos', nairobi: 'Africa/Nairobi', cairo: 'Africa/Cairo',
    casablanca: 'Africa/Casablanca', dubai: 'Asia/Dubai', tokyo: 'Asia/Tokyo', pekin: 'Asia/Shanghai',
    beijing: 'Asia/Shanghai', delhi: 'Asia/Kolkata', moscou: 'Europe/Moscow', saopaulo: 'America/Sao_Paulo',
    utc: 'UTC'
};

/* ─── Commandes ─────────────────────────────────────────────── */

async function utilsCommand(sock, chatId, message, name, rawText) {
    const reply = (text, extra = {}) => sock.sendMessage(chatId, { text, ...extra }, { quoted: message });
    const input = argsOf(rawText, name);

    switch (name) {
        case 'calc': {
            if (!input) return reply('🧮 Indiquez un calcul, Monsieur.\nExemples : *.calc 12*(3+4)*, *.calc sqrt(144)+2^3*');
            try {
                const result = evaluate(input);
                return reply(box('CALCUL', [`${input}`, `= ${formatNumber(result)}`]));
            } catch (error) {
                return reply(`❌ Calcul impossible : ${error.message}.`);
            }
        }
        case 'percent': {
            const numbers = input.replace(/,/g, '.').split(/\s+/).map(Number);
            if (numbers.length !== 2 || numbers.some(n => !Number.isFinite(n))) {
                return reply('📊 Utilisation : *.percent <pourcentage> <valeur>*\nExemple : *.percent 15 240* → 15 % de 240.');
            }
            const [pct, value] = numbers;
            return reply(box('POURCENTAGE', [`${formatNumber(pct)} % de ${formatNumber(value)} = ${formatNumber(pct * value / 100)}`, `${formatNumber(value)} + ${formatNumber(pct)} % = ${formatNumber(value * (1 + pct / 100))}`, `${formatNumber(value)} − ${formatNumber(pct)} % = ${formatNumber(value * (1 - pct / 100))}`]));
        }
        case 'random': {
            const numbers = input.split(/\s+/).filter(Boolean).map(Number);
            const [min, max] = numbers.length === 1 ? [1, numbers[0]] : numbers.length >= 2 ? numbers : [1, 100];
            if (![min, max].every(Number.isFinite)) return reply('🎲 Utilisation : *.random [min] [max]* — par défaut entre 1 et 100.');
            const low = Math.ceil(Math.min(min, max));
            const high = Math.floor(Math.max(min, max));
            return reply(`🎲 Nombre tiré entre ${low} et ${high} : *${crypto.randomInt(low, high + 1)}*`);
        }
        case 'dice': {
            const count = Math.min(10, Math.max(1, parseInt(input, 10) || 1));
            const rolls = Array.from({ length: count }, () => crypto.randomInt(1, 7));
            return reply(`🎲 ${count > 1 ? 'Résultats' : 'Résultat'} : *${rolls.join(' • ')}*${count > 1 ? `\nTotal : ${rolls.reduce((a, b) => a + b, 0)}` : ''}`);
        }
        case 'flip':
            return reply(`🪙 La pièce est tombée sur *${crypto.randomInt(0, 2) ? 'PILE' : 'FACE'}*.`);
        case 'choose': {
            const options = input.split(/\s*(?:\||,|;|\bou\b)\s*/i).map(item => item.trim()).filter(Boolean);
            if (options.length < 2) return reply('🤔 Donnez au moins deux options séparées par « | » ou « ou ».\nExemple : *.choose pizza | burger | tacos*');
            return reply(`🤔 Mon choix : *${options[crypto.randomInt(0, options.length)]}*`);
        }
        case 'date': {
            const t = localTime(TZ);
            return reply(box('DATE', [`${t.date}`, `Heure : ${t.time} (Kinshasa)`]));
        }
        case 'time': {
            const key = input.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');
            const zone = key ? (ZONES[key] || null) : TZ;
            if (!zone) return reply(`🕒 Ville inconnue. Essayez : ${Object.keys(ZONES).slice(0, 12).join(', ')}…`);
            const t = localTime(zone);
            return reply(box('HEURE', [`${key ? input : 'Kinshasa'} : ${t.time}`, t.date]));
        }
        case 'age': {
            const birth = parseDate(input);
            if (!birth || birth > new Date()) return reply('🎂 Utilisation : *.age JJ/MM/AAAA*\nExemple : *.age 14/03/2001*');
            const now = new Date();
            let years = now.getUTCFullYear() - birth.getUTCFullYear();
            let months = now.getUTCMonth() - birth.getUTCMonth();
            let days = now.getUTCDate() - birth.getUTCDate();
            if (days < 0) { months -= 1; days += 30; }
            if (months < 0) { years -= 1; months += 12; }
            const totalDays = Math.floor((now - birth) / 86400000);
            return reply(box('ÂGE', [`${years} ans, ${months} mois, ${days} jours`, `Soit ${totalDays.toLocaleString('fr-FR')} jours de vie`]));
        }
        case 'countdown': {
            const target = parseDate(input);
            if (!target) return reply('⏳ Utilisation : *.countdown JJ/MM/AAAA*\nExemple : *.countdown 31/12/2026*');
            const diff = Math.ceil((target - new Date()) / 86400000);
            if (diff === 0) return reply('🎉 C’est aujourd’hui, Monsieur !');
            return reply(diff > 0 ? `⏳ Il reste *${diff} jour${diff > 1 ? 's' : ''}* avant cette date.` : `📅 Cette date est passée depuis *${-diff} jour${-diff > 1 ? 's' : ''}*.`);
        }
        case 'uptime':
            return reply(box('DISPONIBILITÉ', [`Bot : ${formatDuration(process.uptime())}`, `Serveur : ${formatDuration(os.uptime())}`]));
        case 'upper':
        case 'lower':
        case 'reverse': {
            const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const source = input || quoted?.conversation || quoted?.extendedTextMessage?.text || '';
            if (!source) return reply(`✏️ Utilisation : *.${name} <texte>* ou répondez à un message avec *.${name}*.`);
            const out = name === 'upper' ? source.toUpperCase() : name === 'lower' ? source.toLowerCase() : [...source].reverse().join('');
            return reply(out);
        }
        case 'count': {
            const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const source = input || quoted?.conversation || quoted?.extendedTextMessage?.text || '';
            if (!source) return reply('🔢 Utilisation : *.count <texte>* ou répondez à un message avec *.count*.');
            const words = source.trim().split(/\s+/).filter(Boolean).length;
            return reply(box('COMPTEUR', [`Caractères : ${[...source].length}`, `Mots : ${words}`, `Lignes : ${source.split(/\r?\n/).length}`]));
        }
        case 'encode': {
            if (!input) return reply('🔐 Utilisation : *.encode <texte>* (Base64).');
            return reply(Buffer.from(input, 'utf8').toString('base64'));
        }
        case 'decode': {
            if (!input) return reply('🔓 Utilisation : *.decode <texte en Base64>*.');
            if (!/^[A-Za-z0-9+/=_-]+$/.test(input)) return reply('❌ Ce texte n’est pas du Base64 valide.');
            const decoded = Buffer.from(input, 'base64').toString('utf8');
            return reply(decoded || '❌ Décodage impossible.');
        }
        case 'password': {
            const length = Math.min(64, Math.max(6, parseInt(input, 10) || 16));
            const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*?';
            const password = Array.from({ length }, () => alphabet[crypto.randomInt(0, alphabet.length)]).join('');
            return reply(`🔑 Mot de passe (${length} caractères) :\n\`\`\`${password}\`\`\`\nGardez-le pour vous, Monsieur.`);
        }
        case 'qr': {
            if (!input) return reply('🔳 Utilisation : *.qr <texte ou lien>*');
            if (input.length > 900) return reply('❌ Texte trop long pour un QR code (900 caractères maximum).');
            try {
                const QRCode = require('qrcode');
                const buffer = await QRCode.toBuffer(input, { width: 512, margin: 2 });
                return sock.sendMessage(chatId, { image: buffer, caption: '🔳 Voici votre QR code, Monsieur.' }, { quoted: message });
            } catch (error) {
                console.error('[qr]', error.message);
                return reply('❌ Je n’ai pas pu générer le QR code.');
            }
        }
        default:
            return null;
    }
}

module.exports = { utilsCommand, UTILS_COMMANDS, evaluate };
