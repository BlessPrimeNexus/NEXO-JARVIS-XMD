'use strict';

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const CHANNEL_JID = '120363426264191950@newsletter';
const CHANNEL_NAME = '𝗡𝗘𝗫𝗢-𝗝𝗔𝗥𝗩𝗜𝗦 𝗫𝗠𝗗';

function channelInfo() {
    return {
        contextInfo: {
            forwardingScore: 1,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
                newsletterJid: CHANNEL_JID,
                newsletterName: CHANNEL_NAME,
                serverMessageId: -1
            }
        }
    };
}

function normalizeJid(value) {
    return String(value || '').split(':')[0].split('@')[0];
}

function participantJid(participant) {
    return typeof participant === 'string'
        ? participant
        : (participant?.id || String(participant));
}

function ordinal(number) {
    const value = Number(number) || 0;
    const lastTwo = value % 100;
    if (lastTwo >= 11 && lastTwo <= 13) return `${value}th`;
    switch (value % 10) {
        case 1: return `${value}st`;
        case 2: return `${value}nd`;
        case 3: return `${value}rd`;
        default: return `${value}th`;
    }
}

function memberCountAfterLeave(participants, leavingJid) {
    const list = Array.isArray(participants) ? participants : [];
    const stillListed = list.some((participant) => (
        normalizeJid(participant?.id || participant) === normalizeJid(leavingJid)
    ));
    return Math.max(0, list.length - (stillListed ? 1 : 0));
}

/* ─── Messages de bienvenue et de départ (style JARVIS) ───────── */

const DEFAULT_MARK = '__JARVIS_DEFAULT__';
const OLD_DEFAULTS = [
    'Bienvenue {user} dans *{group}* ! 🎉',
    'Au revoir {user} 👋'
];

function isDefaultTemplate(template) {
    const value = String(template || '').trim();
    return !value || value === DEFAULT_MARK || value.startsWith('╔═⚔️') || OLD_DEFAULTS.includes(value);
}

function frenchDate(now = new Date()) {
    const options = { timeZone: 'Africa/Kinshasa' };
    return {
        date: now.toLocaleDateString('fr-FR', options),
        time: now.toLocaleTimeString('fr-FR', { ...options, hour: '2-digit', minute: '2-digit', hour12: false })
    };
}

function shorten(text, max = 180) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

const label = (jid) => `@${normalizeJid(jid)}`;

// Remplace {user} {group} {count} {description} {date} {time} {author} dans un modèle personnalisé.
function fillTemplate(template, values) {
    return String(template).replace(/\{(user|group|count|description|date|time|author)\}/gi, (match, key) => {
        const value = values[key.toLowerCase()];
        return value === undefined || value === null ? '' : String(value);
    });
}

function buildWelcome({ jid, groupName, count, description, author, template, now }) {
    const { date, time } = frenchDate(now);
    if (!isDefaultTemplate(template)) {
        return fillTemplate(template, {
            user: label(jid), group: groupName, count, description: shorten(description), date, time,
            author: author ? label(author) : ''
        }).trim();
    }
    const lines = [
        '╭━━⟪ 𝗡𝗘𝗫𝗢-𝗝𝗔𝗥𝗩𝗜𝗦 𝗫𝗠𝗗 ⟫━━╮',
        '┃ Nouvelle connexion détectée.',
        `┃ Bienvenue parmi nous, ${label(jid)}.`,
        '╰━━━━━━━━━━━━━━━━━━━╯',
        '',
        `◈ ɢʀᴏᴜᴘᴇ : ${groupName}`
    ];
    if (count) lines.push(`◈ ᴍᴇᴍʙʀᴇ ɴ° : ${count}`);
    lines.push(`◈ ᴀʀʀɪᴠéᴇ : ${date} • ${time}`);
    if (author && normalizeJid(author) !== normalizeJid(jid)) lines.push(`◈ ᴀᴊᴏᴜᴛé ᴘᴀʀ : ${label(author)}`);
    if (description) lines.push('', `📜 ${shorten(description)}`);
    lines.push('', 'Je reste à votre disposition : tapez *.menu* pour consulter mes commandes.');
    return lines.join('\n');
}

function buildGoodbye({ jid, groupName, count, author, template, now }) {
    const { date, time } = frenchDate(now);
    const removed = author && normalizeJid(author) !== normalizeJid(jid);
    if (!isDefaultTemplate(template)) {
        return fillTemplate(template, {
            user: label(jid), group: groupName, count, description: '', date, time,
            author: removed ? label(author) : ''
        }).trim();
    }
    return [
        '╭━━⟪ 𝗡𝗘𝗫𝗢-𝗝𝗔𝗥𝗩𝗜𝗦 𝗫𝗠𝗗 ⟫━━╮',
        '┃ Déconnexion enregistrée.',
        removed
            ? `┃ ${label(jid)} a été retiré du groupe par ${label(author)}.`
            : `┃ ${label(jid)} a quitté le groupe.`,
        '╰━━━━━━━━━━━━━━━━━━━╯',
        '',
        `◈ ɢʀᴏᴜᴘᴇ : ${groupName}`,
        `◈ ᴍᴇᴍʙʀᴇs ʀᴇsᴛᴀɴᴛs : ${count}`,
        `◈ ᴅᴀᴛᴇ : ${date} • ${time}`,
        '',
        'Bonne continuation. Les portes restent ouvertes.'
    ].join('\n');
}

async function sendMemberEvent(sock, groupId, jid, caption, extraMentions = []) {
    // Texte + aperçu d'image tournant (ajouté par lib/presentation.js) :
    // plus de photo envoyée, donc plus de galeries saturées.
    const mentions = [...new Set([jid, ...extraMentions].filter(Boolean))];
    await sock.sendMessage(groupId, {
        text: caption,
        mentions,
        ...channelInfo()
    });
}

module.exports = {
    DEFAULT_MARK,
    buildGoodbye,
    buildWelcome,
    isDefaultTemplate,
    channelInfo,
    memberCountAfterLeave,
    ordinal,
    participantJid,
    sendMemberEvent
};