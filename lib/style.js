'use strict';

/*
 * Design unique des réponses NEXO-JARVIS XMD — classique, sans bordures (inspiré du menu WEED-X) :
 *
 *   ✦『 👑 Développeur 』✦                ← titre
 *     ◇ Projet → valeur                   ← lignes d'information
 *     ◈ .commande                         ← lignes de commandes
 *     ✦ ──────────────── ✦               ← trait de fin
 *
 * Deux temps :
 *   1. panel / box / report / frameText fabriquent le texte avec des lettres NORMALES (c'est ce que le dictionnaire de
 *      traduction et les tests lisent) ;
 *   2. stylize() applique juste avant l'envoi la police « monospace » (𝙼𝚎𝚗𝚞) aux titres, libellés et noms de commandes.
 *
 * Aucune bordure : elles se désalignent ou se coupent selon la police et la largeur du téléphone.
 * Les lignes longues sont coupées aux espaces et gardent leur retrait.
 */

const settings = require('../settings');

const BOT = () => settings.botName || 'NEXO-JARVIS XMD';
const MAX_FRAMED = 800;
const WIDTH = 30;                 // largeur max (en « cases ») d'une ligne de contenu
let fancy = process.env.NEXO_FANCY_FONT !== '0';

const setFancy = (value) => { fancy = Boolean(value); };
const isFancy = () => fancy;

/* ─── Police monospace ──────────────────────────────────────── */

const LOWER = 0x1D68A;   // 𝚊
const UPPER = 0x1D670;   // 𝙰
const DIGIT = 0x1D7F6;   // 𝟶

function mono(text) {
    if (!fancy) return String(text);
    let out = '';
    // Les lettres accentuées (é, è, ç…) n'ont pas de version monospace : elles passent à la lettre de base pour garder une
    // police homogène dans les titres (« 𝙴𝚝𝚊𝚝 »). Le texte courant, lui, garde tous ses accents.
    for (const ch of String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '')) {
        const code = ch.codePointAt(0);
        if (code >= 97 && code <= 122) out += String.fromCodePoint(LOWER + code - 97);
        else if (code >= 65 && code <= 90) out += String.fromCodePoint(UPPER + code - 65);
        else if (code >= 48 && code <= 57) out += String.fromCodePoint(DIGIT + code - 48);
        else out += ch;
    }
    return out;
}

// Retour aux lettres normales (tests, recherches).
function unmono(text) {
    let out = '';
    for (const ch of String(text)) {
        const code = ch.codePointAt(0);
        if (code >= LOWER && code < LOWER + 26) out += String.fromCharCode(97 + code - LOWER);
        else if (code >= UPPER && code < UPPER + 26) out += String.fromCharCode(65 + code - UPPER);
        else if (code >= DIGIT && code < DIGIT + 10) out += String.fromCharCode(48 + code - DIGIT);
        else out += ch;
    }
    return out;
}

const SMALL_WORDS = new Set(['du', 'de', 'des', 'la', 'le', 'les', 'et', 'à', 'au', 'aux', 'en', 'of', 'the', 'and', 'to', 'in', 'on', 'a', 'an', 'or']);

// « DIAGNOSTIC SYSTÈME » → « Diagnostic Système » (un titre déjà en casse mixte reste tel quel).
function niceTitle(title) {
    const text = String(title);
    const letters = text.match(/\p{L}/gu) || [];
    const upper = letters.filter(ch => ch === ch.toUpperCase() && ch !== ch.toLowerCase()).length;
    if (!letters.length || upper / letters.length < 0.6) return text;
    const lower = text.toLowerCase();
    return lower.replace(/(^|[\s'’(\-])(\p{L}+)/gu, (all, lead, word, offset) => {
        if (offset > 0 && SMALL_WORDS.has(word)) return all;
        return `${lead}${word.charAt(0).toUpperCase()}${word.slice(1)}`;
    });
}

const capital = (word) => word.charAt(0).toUpperCase() + word.slice(1);

/*
 * stylize : à appeler UNE fois, sur le texte final (après traduction). Ne touche que :
 *   ╭═『 Titre 』═╮ · ✦『 Titre 』✦ · « ◇ Libellé → » · « │ ◈ .commande » · « ⛨ NEXO ⤫ JARVIS ».
 */
function stylize(text) {
    if (!fancy || typeof text !== 'string' || !/[✦◇◈⛨]/.test(text)) return text;
    return text.split('\n').map(line => {
        let match = line.match(/^(✦『 )(.+)( 』✦)$/);
        if (match) return `${match[1]}${mono(niceTitle(match[2]))}${match[3]}`;
        match = line.match(/^(\s*◇ )(.+?)( →.*)$/);
        if (match) return `${match[1]}${mono(match[2])}${match[3]}`;
        match = line.match(/^(\s*◈ )(\.)([A-Za-z0-9]+)(.*)$/);
        if (match) return `${match[1]}${match[2]}${mono(capital(match[3]))}${match[4]}`;
        match = line.match(/^(⛨ )(.+)$/);
        if (match) return `${match[1]}${mono(match[2])}`;
        return line;
    }).join('\n');
}

/* ─── Mesure et coupure des lignes ──────────────────────────── */

// Largeur visuelle estimée : emoji = 2 · gras mathématique ≈ 1,7 · monospace ≈ 1,2 · majuscules ≈ 1,25 · le reste = 1.
function cells(text) {
    let total = 0;
    for (const ch of String(text).replace(/[*_~]/g, '')) {
        const code = ch.codePointAt(0);
        if ((code >= 0x1D670 && code <= 0x1D6A3) || (code >= 0x1D7F6 && code <= 0x1D7FF)) total += 1.2;
        else if (code >= 0x1D400 && code <= 0x1D7FF) total += 1.7;
        else if (code >= 0x1F000 || (code >= 0x2600 && code <= 0x27BF) || (code >= 0x2B00 && code <= 0x2BFF) || (code >= 0x3000 && code <= 0x9FFF)) total += 2;
        else if (code >= 65 && code <= 90) total += 1.25;
        else total += 1;
    }
    return Math.ceil(total);
}

// Coupe une ligne en morceaux ≤ width, aux espaces ; une longue suite sans espace (lien) reste entière.
function wrapLine(line, width = WIDTH) {
    const text = String(line).replace(/\s+$/, '');
    if (cells(text) <= width) return [text];
    const words = text.split(/\s+/).filter(Boolean);
    const out = [];
    let current = '';
    for (const word of words) {
        const candidate = current ? `${current} ${word}` : word;
        if (current && cells(candidate) > width) { out.push(current); current = word; }
        else current = candidate;
    }
    if (current) out.push(current);
    for (let i = 0; i < out.length - 1; i += 1) {
        if (((out[i].match(/\*/g) || []).length % 2) === 1) { out[i] += '*'; out[i + 1] = `*${out[i + 1]}`; }
    }
    return out;
}

const wrapped = (line, prefix = '│ ') => wrapLine(line).map(part => `${prefix}${part}`);

/* ─── Briques ───────────────────────────────────────────────── */

const EMOJI_LEAD = /^[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\uFE0F\u200D\s]+/u;
const stripEmoji = (text) => String(text).replace(EMOJI_LEAD, '');
const DIVIDER = '  ✦ ──────────────── ✦';

const title = (value) => `✦『 ${value} 』✦`;

// rows : chaînes, ou paires [libellé, valeur] ; null/'' = ligne vide.
//   [libellé, valeur] →   ◇ Libellé → valeur      (l'emoji du libellé est retiré : classique et net)
//   '.commande …'     →   ◈ .commande …
//   texte libre       →   texte (retrait de 2 espaces)
function bodyLines(rows) {
    const body = [];
    for (const row of rows) {
        if (row === null || row === '' || row === undefined) { body.push(''); continue; }
        if (Array.isArray(row)) {
            const label = stripEmoji(row[0]) || String(row[0]);
            const value = String(row[1]);
            const single = `  ◇ ${label} → ${value}`;
            if (cells(single) <= WIDTH + 4) body.push(single);
            else {
                body.push(`  ◇ ${label} →`);
                for (const part of wrapLine(value, WIDTH - 2)) body.push(`      ${part}`);   // longue valeur : sur ses propres lignes
            }
            continue;
        }
        const text = String(row);
        if (/^\.[a-z0-9]/i.test(text)) body.push(...wrapLine(text, WIDTH).map((part, index) => (index === 0 ? `  ◈ ${part}` : `    ${part}`)));
        else body.push(...wrapLine(text, WIDTH + 2).map(part => `  ${part}`));
    }
    return body;
}

// Bloc : ✦『 Titre 』✦ / lignes / ✦ ──────── ✦
function box(heading, rows = []) {
    return [title(heading), ...bodyLines(rows), DIVIDER].join('\n');
}

// Réponse courte (+ note éventuelle, coupée par défaut : `.config set replyNotes on`).
function panel(heading, rows = [], note = '') {
    const out = [box(heading, rows)];
    if (note && settings.replyNotes) out.push(...wrapLine(note, WIDTH + 4).map(part => `  _${part}_`));
    return out.join('\n');
}

// Liste de commandes (menus) : une par ligne, avec ◈ ; l'emoji éventuel de l'entrée est retiré.
function listBox(heading, items = []) {
    return [title(heading), ...items.map(item => `  ◈ ${stripEmoji(item)}`), DIVIDER].join('\n');
}

// En-tête (même mise en forme qu'un bloc).
function header(heading, rows = []) {
    return box(heading, rows);
}

/**
 * Réponse complète et classée : un bloc par thème.
 *   report('🖥️ Panel', [['Sessions', '3 / 4']], [{ title: '🧠 Mémoire', rows: [...] }, …])
 */
function report(heading, headerRows = [], sections = [], note = '') {
    const parts = [header(heading, headerRows)];
    for (const section of sections) {
        if (!section || (section.rows || []).length === 0) continue;
        parts.push(box(section.title, section.rows));
    }
    const out = [parts.join('\n\n')];
    if (note && settings.replyNotes) out.push(...wrapLine(note, WIDTH + 4).map(part => `  _${part}_`));
    return out.join('\n');
}

/* ─── Habillage automatique des réponses brutes ─────────────── */

const NEW_DESIGN = /✦『|╭═『|╭─❏/;
const BOX_CHARS = /[╭╰╮╯┃║╔╚╗╝┏┗━═┌└]|^\s*│/m;

function shouldFrame(text) {
    if (typeof text !== 'string') return false;
    const value = text.trim();
    if (!value || value.length > MAX_FRAMED) return false;
    if (value.includes('```')) return false;        // texte à copier tel quel (mots de passe, codes…)
    if (BOX_CHARS.test(value)) return false;        // déjà mis en forme
    return true;
}

/* ─── Anciens cadres (┃⌬┃ , ╭━⌜…⌟ , ╔═ …) → design unique ───────── */
const LEGACY = /┃⌬|[╭┏╔]━|╔═|[╰┗╚]━|╚═|╭─〔|╭═『|╭─❏/;
const LEGACY_MAX = 2800;
const DECOR_ONLY = /^[┃║│⌬\s]*[╭╰┏┗╔╚][━═─≽❍╮╯╗╝\s]*$/;
const TITLE = /[⌜〔『\[]\s*(.+?)\s*[⌟〕』\]]/;

function restyleLegacy(text) {
    if (typeof text !== 'string' || /✦『/.test(text) || !LEGACY.test(text) || text.length > LEGACY_MAX) return text;
    const out = [];
    let heading = null;
    let body = [];
    let open = false;
    const flush = () => {
        if (!open) return;
        out.push([title(heading), ...body, DIVIDER].join('\n'));
        open = false; heading = null; body = [];
    };
    const begin = (value) => { flush(); heading = value; body = []; open = true; };
    for (const raw of text.trim().split(/\r?\n/)) {
        const line = raw.replace(/\s+$/, '');
        const trimmed = line.trim();
        if (/^[╭┏╔]/.test(trimmed) || /^[┃║│⌬\s]*[╭┏╔][━═─]/.test(trimmed)) {
            const match = trimmed.match(TITLE);
            if (/^[╭┏╔]/.test(trimmed) && (match || !open)) begin(match ? match[1] : `🤖 ${BOT()}`);
            continue;
        }
        if (DECOR_ONLY.test(trimmed)) { if (/^[╰┗╚]/.test(trimmed)) flush(); continue; }
        if (/^[┃║│]/.test(trimmed) || trimmed.startsWith('⌬')) {
            const content = trimmed.replace(/^[┃║│⌬\s]+/, '').replace(/[┃║│]+\s*$/, '');
            if (!open) begin(`🤖 ${BOT()}`);
            body.push(...(content ? wrapLine(content, WIDTH + 2).map(part => `  ${part}`) : ['']));
            continue;
        }
        flush();
        out.push(trimmed.startsWith('>') ? `_${line.replace(/^>\s?/, '')}_` : line);
    }
    flush();
    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function frameText(text) {
    if (typeof text === 'string' && /✦『/.test(text)) return text;          // déjà au nouveau design
    if (typeof text === 'string' && LEGACY.test(text)) return restyleLegacy(text);
    if (!shouldFrame(text)) return text;
    const lines = text.trim().split(/\r?\n/).flatMap(line => (line.trim() ? wrapLine(line, WIDTH + 2).map(part => `  ${part}`) : ['']));
    return [title(`🤖 ${BOT()}`), ...lines, DIVIDER].join('\n');
}

// Retire les formules de politesse de fin de phrase (« …, Monsieur. ») : réponses plus directes.
function cleanup(text) {
    if (typeof text !== 'string' || !/Monsieur/.test(text)) return text;
    return text
        .replace(/\s*,\s*Monsieur(?=\s*[.!?…]|\s*$|\s*\n)/gm, '')
        .replace(/(^|\n)\s*Monsieur\s*,\s*/g, '$1');
}

const bold = (text) => `*${text}*`;

module.exports = {
    panel, box, listBox, header, report, frameText, restyleLegacy, shouldFrame,
    stylize, cleanup, mono, unmono, niceTitle, setFancy, isFancy, wrapLine, cells, WIDTH, bold
};
