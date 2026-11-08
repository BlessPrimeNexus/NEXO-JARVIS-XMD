'use strict';

/*
 * Commandes complémentaires des catégories du menu : économie, religion, santé, cyber, notes,
 * diffusion, apk, recherche, profil, conversion, aléatoire, météo, premium.
 * Chaque commande est dans HANDLERS ; main.js appelle run() avant son routeur historique.
 * Les commandes réseau échouent proprement (message clair) si le service est injoignable.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const ECONOMY_FILE = process.env.ECONOMY_FILE || path.join(DATA_DIR, 'economy.json');
const NOTES_FILE = process.env.NOTES_FILE || path.join(DATA_DIR, 'notes.json');

const digits = value => String(value || '').split('@')[0].split(':')[0].replace(/\D/g, '');

function readJson(file, fallback) {
    try {
        const value = JSON.parse(fs.readFileSync(file, 'utf8'));
        return value && typeof value === 'object' ? value : fallback;
    } catch { return fallback; }
}
function writeJson(file, value) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temp, JSON.stringify(value, null, 2));
    fs.renameSync(temp, file);
}

async function http(url, params) {
    const axios = require('axios');
    const response = await axios.get(url, { params, timeout: 15000, headers: { 'User-Agent': 'NEXO-JARVIS-XMD' } });
    return response.data;
}

const fmt = n => Number(n).toLocaleString('fr-FR');

/* ─── Économie ─── */
const START_WALLET = 100;
function account(db, jid) {
    const id = digits(jid);
    if (!db[id]) db[id] = { wallet: START_WALLET, bank: 0, daily: 0, work: 0 };
    return db[id];
}
function targetOf(ctx) {
    const info = ctx.message.message?.extendedTextMessage?.contextInfo;
    return (info?.mentionedJid && info.mentionedJid[0]) || info?.participant || '';
}
function amountArg(value, max) {
    if (/^(all|tout)$/i.test(value || '')) return max;
    const n = parseInt(value, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
}

/* ─── Calculs santé ─── */
const num = value => Number(String(value || '').replace(',', '.'));

const HANDLERS = {
    // ── Économie ──
    balance: async ctx => {
        const db = readJson(ECONOMY_FILE, {});
        const a = account(db, targetOf(ctx) || ctx.senderId);
        writeJson(ECONOMY_FILE, db);
        return ctx.reply(`💰 *Solde*\n\n👛 Portefeuille : ${fmt(a.wallet)} 🪙\n🏦 Banque : ${fmt(a.bank)} 🪙\n💎 Total : ${fmt(a.wallet + a.bank)} 🪙`);
    },
    daily: async ctx => {
        const db = readJson(ECONOMY_FILE, {}); const a = account(db, ctx.senderId);
        const left = a.daily + 86400000 - Date.now();
        if (left > 0) return ctx.reply(`⏳ Récompense déjà prise. Revenez dans ${Math.ceil(left / 3600000)} h.`);
        const gain = 200 + Math.floor(Math.random() * 301);
        a.wallet += gain; a.daily = Date.now(); writeJson(ECONOMY_FILE, db);
        return ctx.reply(`🎁 Récompense quotidienne : +${fmt(gain)} 🪙\n👛 Portefeuille : ${fmt(a.wallet)} 🪙`);
    },
    work: async ctx => {
        const db = readJson(ECONOMY_FILE, {}); const a = account(db, ctx.senderId);
        const left = a.work + 3600000 - Date.now();
        if (left > 0) return ctx.reply(`⏳ Vous êtes fatigué. Retravaillez dans ${Math.ceil(left / 60000)} min.`);
        const jobs = ['développeur', 'livreur', 'cuisinier', 'mécanicien', 'photographe', 'chauffeur'];
        const gain = 50 + Math.floor(Math.random() * 151);
        a.wallet += gain; a.work = Date.now(); writeJson(ECONOMY_FILE, db);
        return ctx.reply(`💼 Vous avez travaillé comme ${jobs[Math.floor(Math.random() * jobs.length)]} : +${fmt(gain)} 🪙`);
    },
    deposit: async ctx => {
        const db = readJson(ECONOMY_FILE, {}); const a = account(db, ctx.senderId);
        const n = amountArg(ctx.args[0], a.wallet);
        if (!n) return ctx.reply('❌ Utilisation : *.deposit <montant|all>*');
        if (n > a.wallet) return ctx.reply('❌ Portefeuille insuffisant.');
        a.wallet -= n; a.bank += n; writeJson(ECONOMY_FILE, db);
        return ctx.reply(`🏦 ${fmt(n)} 🪙 déposés.\n👛 ${fmt(a.wallet)} • 🏦 ${fmt(a.bank)}`);
    },
    withdraw: async ctx => {
        const db = readJson(ECONOMY_FILE, {}); const a = account(db, ctx.senderId);
        const n = amountArg(ctx.args[0], a.bank);
        if (!n) return ctx.reply('❌ Utilisation : *.withdraw <montant|all>*');
        if (n > a.bank) return ctx.reply('❌ Solde bancaire insuffisant.');
        a.bank -= n; a.wallet += n; writeJson(ECONOMY_FILE, db);
        return ctx.reply(`👛 ${fmt(n)} 🪙 retirés.\n👛 ${fmt(a.wallet)} • 🏦 ${fmt(a.bank)}`);
    },
    transfer: async ctx => {
        const target = targetOf(ctx) || (ctx.args.find(v => /^\d{7,15}$/.test(v)) ? `${ctx.args.find(v => /^\d{7,15}$/.test(v))}@s.whatsapp.net` : '');
        const amountText = ctx.args.find(v => /^\d+$/.test(v) && v.length < 9);
        if (!target || !amountText) return ctx.reply('❌ Utilisation : *.transfer @membre <montant>* (ou en répondant à un message).');
        if (digits(target) === digits(ctx.senderId)) return ctx.reply('❌ Vous ne pouvez pas vous envoyer de l\'argent.');
        const db = readJson(ECONOMY_FILE, {}); const from = account(db, ctx.senderId); const to = account(db, target);
        const n = parseInt(amountText, 10);
        if (n <= 0 || n > from.wallet) return ctx.reply('❌ Portefeuille insuffisant.');
        from.wallet -= n; to.wallet += n; writeJson(ECONOMY_FILE, db);
        return ctx.sock.sendMessage(ctx.chatId, { text: `✅ ${fmt(n)} 🪙 envoyés à @${digits(target)}.`, mentions: [target] }, { quoted: ctx.message });
    },
    gamble: async ctx => {
        const db = readJson(ECONOMY_FILE, {}); const a = account(db, ctx.senderId);
        const n = amountArg(ctx.args[0], a.wallet);
        if (!n) return ctx.reply('❌ Utilisation : *.gamble <montant|all>*');
        if (n > a.wallet) return ctx.reply('❌ Portefeuille insuffisant.');
        const win = Math.random() < 0.45;
        a.wallet += win ? n : -n; writeJson(ECONOMY_FILE, db);
        return ctx.reply(win ? `🎰 Gagné ! +${fmt(n)} 🪙\n👛 ${fmt(a.wallet)} 🪙` : `🎰 Perdu… -${fmt(n)} 🪙\n👛 ${fmt(a.wallet)} 🪙`);
    },
    richest: async ctx => {
        const db = readJson(ECONOMY_FILE, {});
        const top = Object.entries(db).map(([id, a]) => [id, a.wallet + a.bank]).sort((x, y) => y[1] - x[1]).slice(0, 10);
        if (!top.length) return ctx.reply('📭 Aucun compte pour le moment. Essayez *.daily*.');
        return ctx.reply(`🏆 *Les plus riches*\n\n${top.map(([id, total], i) => `${i + 1}. +${id} — ${fmt(total)} 🪙`).join('\n')}`);
    },

    // ── Religion ──
    quran: async ctx => {
        const surah = parseInt(ctx.args[0], 10); const ayah = parseInt(ctx.args[1], 10);
        if (!(surah >= 1 && surah <= 114)) return ctx.reply('❌ Utilisation : *.quran <sourate 1-114> [verset]*\nExemple : .quran 1 2');
        try {
            if (ayah) {
                const data = await http(`https://api.alquran.cloud/v1/ayah/${surah}:${ayah}/editions/quran-uthmani,fr.hamidullah`);
                const [ar, fr] = data.data;
                return ctx.reply(`📖 *${ar.surah.englishName} (${surah}:${ayah})*\n\n${ar.text}\n\n🇫🇷 ${fr.text}`);
            }
            const data = await http(`https://api.alquran.cloud/v1/surah/${surah}/fr.hamidullah`);
            const info = data.data;
            const body = info.ayahs.slice(0, 7).map(v => `${v.numberInSurah}. ${v.text}`).join('\n');
            return ctx.reply(`📖 *Sourate ${info.englishName} (${surah})* — ${info.numberOfAyahs} versets\n\n${body}${info.ayahs.length > 7 ? '\n\n… utilisez *.quran ' + surah + ' <verset>* pour un verset précis.' : ''}`);
        } catch { return ctx.reply('❌ Service du Coran injoignable pour le moment. Réessayez plus tard.'); }
    },
    bible: async ctx => {
        const ref = ctx.args.join(' ').trim();
        if (!ref) return ctx.reply('❌ Utilisation : *.bible <référence>*\nExemple : .bible john 3:16');
        try {
            const data = await http(`https://bible-api.com/${encodeURIComponent(ref)}`, { translation: 'web' });
            return ctx.reply(`✝️ *${data.reference}*\n\n${String(data.text).trim()}`);
        } catch { return ctx.reply('❌ Passage introuvable ou service injoignable (référence en anglais : john 3:16).'); }
    },
    prayer: async ctx => {
        const city = ctx.args.join(' ').trim();
        if (!city) return ctx.reply('❌ Utilisation : *.prayer <ville>*\nExemple : .prayer Kinshasa');
        try {
            const data = await http('https://api.aladhan.com/v1/timingsByAddress', { address: city, method: 2 });
            const t = data.data.timings;
            return ctx.reply(`🕌 *Heures de prière — ${city}*\n\nFajr : ${t.Fajr}\nLever : ${t.Sunrise}\nDhuhr : ${t.Dhuhr}\nAsr : ${t.Asr}\nMaghrib : ${t.Maghrib}\nIsha : ${t.Isha}`);
        } catch { return ctx.reply('❌ Ville introuvable ou service injoignable.'); }
    },

    // ── Santé ──
    bmi: async ctx => {
        const kg = num(ctx.args[0]); const cm = num(ctx.args[1]);
        if (!(kg > 0 && cm > 0)) return ctx.reply('❌ Utilisation : *.bmi <poids kg> <taille cm>*\nExemple : .bmi 70 175');
        const v = kg / ((cm / 100) ** 2);
        const label = v < 18.5 ? 'Insuffisance pondérale' : v < 25 ? 'Poids normal' : v < 30 ? 'Surpoids' : 'Obésité';
        return ctx.reply(`⚖️ *IMC : ${v.toFixed(1)}*\n📋 ${label}\n\nℹ️ Indication générale, pas un avis médical.`);
    },
    bmr: async ctx => {
        const sex = String(ctx.args[0] || '').toLowerCase(); const kg = num(ctx.args[1]); const cm = num(ctx.args[2]); const age = num(ctx.args[3]);
        if (!['m', 'f'].includes(sex) || !(kg > 0 && cm > 0 && age > 0)) return ctx.reply('❌ Utilisation : *.bmr <m|f> <kg> <cm> <âge>*\nExemple : .bmr m 70 175 25');
        const v = 10 * kg + 6.25 * cm - 5 * age + (sex === 'm' ? 5 : -161);
        return ctx.reply(`🔥 *Métabolisme de base : ${Math.round(v)} kcal/jour*\n🚶 Activité légère : ${Math.round(v * 1.375)} kcal\n🏃 Activité intense : ${Math.round(v * 1.725)} kcal\n\nℹ️ Estimation (Mifflin-St Jeor).`);
    },
    water: async ctx => {
        const kg = num(ctx.args[0]);
        if (!(kg > 0)) return ctx.reply('❌ Utilisation : *.water <poids kg>*');
        return ctx.reply(`💧 Environ *${(kg * 0.033).toFixed(1)} L d'eau par jour* (≈ ${Math.round(kg * 0.033 / 0.25)} verres de 25 cl).`);
    },
    idealweight: async ctx => {
        const cm = num(ctx.args[0]);
        if (!(cm > 0)) return ctx.reply('❌ Utilisation : *.idealweight <taille cm>*');
        const m = cm / 100;
        return ctx.reply(`🎯 Pour ${cm} cm, un IMC sain correspond à *${(18.5 * m * m).toFixed(1)} – ${(24.9 * m * m).toFixed(1)} kg*.`);
    },
    sleep: async ctx => {
        const match = /^(\d{1,2})[:h](\d{2})$/.exec(ctx.args[0] || '');
        if (!match) return ctx.reply('❌ Utilisation : *.sleep <heure de réveil>*\nExemple : .sleep 06:30');
        const wake = parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
        const times = [6, 5, 4, 3].map(c => {
            const t = ((wake - c * 90 - 15) % 1440 + 1440) % 1440;
            return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
        });
        return ctx.reply(`😴 Pour vous réveiller à ${ctx.args[0]}, couchez-vous à :\n\n${times.map((t, i) => `• ${t} (${[9, 7.5, 6, 4.5][i]} h de sommeil)`).join('\n')}`);
    },

    // ── Cyber ──
    ip: async ctx => {
        const target = ctx.args[0];
        if (!target) return ctx.reply('❌ Utilisation : *.ip <adresse IP ou domaine>*');
        try {
            const d = await http(`https://ipwho.is/${encodeURIComponent(target)}`);
            if (!d.success) return ctx.reply('❌ Adresse introuvable.');
            return ctx.reply(`🌐 *${d.ip}*\n\n📍 ${d.city}, ${d.region}, ${d.country}\n🏢 ${d.connection?.isp || '—'}\n🕒 ${d.timezone?.id || '—'}`);
        } catch { return ctx.reply('❌ Service IP injoignable.'); }
    },
    dns: async ctx => {
        const host = (ctx.args[0] || '').replace(/^https?:\/\//, '').split('/')[0];
        if (!host) return ctx.reply('❌ Utilisation : *.dns <domaine>*');
        try {
            const dns = require('dns').promises;
            const [a, mx] = await Promise.all([dns.resolve4(host).catch(() => []), dns.resolveMx(host).catch(() => [])]);
            if (!a.length && !mx.length) return ctx.reply('❌ Aucun enregistrement trouvé.');
            return ctx.reply(`🔎 *DNS ${host}*\n\nA : ${a.join(', ') || '—'}\nMX : ${mx.map(m => m.exchange).join(', ') || '—'}`);
        } catch { return ctx.reply('❌ Résolution impossible.'); }
    },
    hash: async ctx => {
        const text = ctx.args.join(' ');
        if (!text) return ctx.reply('❌ Utilisation : *.hash <texte>*');
        const h = algo => crypto.createHash(algo).update(text).digest('hex');
        return ctx.reply(`🔐 *Empreintes*\n\nMD5 : ${h('md5')}\nSHA1 : ${h('sha1')}\nSHA256 : ${h('sha256')}`);
    },
    b64: async ctx => {
        const text = ctx.args.join(' ');
        if (!text) return ctx.reply('❌ Utilisation : *.b64 <texte>*');
        return ctx.reply(Buffer.from(text, 'utf8').toString('base64'));
    },
    unb64: async ctx => {
        const text = ctx.args.join('');
        if (!/^[A-Za-z0-9+/=_-]+$/.test(text)) return ctx.reply('❌ Utilisation : *.unb64 <texte en base64>*');
        return ctx.reply(Buffer.from(text, 'base64').toString('utf8') || '❌ Base64 invalide.');
    },
    passcheck: async ctx => {
        const p = ctx.args.join(' ');
        if (!p) return ctx.reply('❌ Utilisation : *.passcheck <mot de passe>*\n⚠️ Ne testez jamais un mot de passe réel dans un groupe.');
        let score = 0;
        if (p.length >= 8) score++; if (p.length >= 12) score++;
        if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score++;
        if (/\d/.test(p)) score++; if (/[^A-Za-z0-9]/.test(p)) score++;
        const label = ['Très faible', 'Faible', 'Moyen', 'Correct', 'Fort', 'Très fort'][score];
        return ctx.reply(`🔑 Force : *${label}* (${score}/5)\n\n💡 12 caractères ou plus, majuscules, chiffres et symboles.`);
    },
    genpass: async ctx => {
        const len = Math.min(64, Math.max(8, parseInt(ctx.args[0], 10) || 16));
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*?';
        let out = ''; for (let i = 0; i < len; i++) out += chars[crypto.randomInt(chars.length)];
        return ctx.reply(`🔐 ${out}`);
    },
    urlcheck: async ctx => {
        const raw = ctx.args[0];
        if (!raw) return ctx.reply('❌ Utilisation : *.urlcheck <lien>*');
        let url; try { url = new URL(/^https?:\/\//i.test(raw) ? raw : `http://${raw}`); } catch { return ctx.reply('❌ Lien invalide.'); }
        const flags = [];
        if (url.protocol !== 'https:') flags.push('connexion non chiffrée (http)');
        if (/^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)) flags.push('adresse IP au lieu d\'un domaine');
        if (url.hostname.includes('xn--')) flags.push('domaine à caractères trompeurs (punycode)');
        if (/(bit\.ly|tinyurl|t\.co|cutt\.ly|is\.gd|shorturl)/i.test(url.hostname)) flags.push('lien raccourci : destination masquée');
        if (url.hostname.split('.').length > 4) flags.push('trop de sous-domaines');
        if (/(login|verify|secure|account|update|wallet)/i.test(url.href) && !flags.length) flags.push('mots typiques d\'hameçonnage : vérifiez le domaine');
        return ctx.reply(`🧪 *Analyse de ${url.hostname}*\n\n${flags.length ? flags.map(f => `⚠️ ${f}`).join('\n') : '✅ Aucun signal évident.'}\n\nℹ️ Analyse simple, pas une garantie de sécurité.`);
    },

    // ── Notes ──
    addnote: async ctx => {
        const text = ctx.args.join(' ').trim();
        if (!text) return ctx.reply('❌ Utilisation : *.addnote <texte>*');
        const db = readJson(NOTES_FILE, {}); const id = digits(ctx.senderId);
        db[id] = [...(db[id] || []), { text, at: Date.now() }].slice(-100);
        writeJson(NOTES_FILE, db);
        return ctx.reply(`📝 Note n°${db[id].length} enregistrée.`);
    },
    notes: async ctx => {
        const list = readJson(NOTES_FILE, {})[digits(ctx.senderId)] || [];
        if (!list.length) return ctx.reply('📭 Aucune note. Ajoutez-en avec *.addnote <texte>*.');
        return ctx.reply(`📝 *Vos notes*\n\n${list.map((n, i) => `${i + 1}. ${n.text}`).join('\n')}`);
    },
    delnote: async ctx => {
        const index = parseInt(ctx.args[0], 10);
        const db = readJson(NOTES_FILE, {}); const id = digits(ctx.senderId); const list = db[id] || [];
        if (!(index >= 1 && index <= list.length)) return ctx.reply('❌ Utilisation : *.delnote <numéro>* (voir *.notes*).');
        list.splice(index - 1, 1); db[id] = list; writeJson(NOTES_FILE, db);
        return ctx.reply(`🗑️ Note ${index} supprimée.`);
    },
    clearnotes: async ctx => {
        const db = readJson(NOTES_FILE, {}); delete db[digits(ctx.senderId)]; writeJson(NOTES_FILE, db);
        return ctx.reply('🧹 Toutes vos notes ont été supprimées.');
    },

    // ── Diffusion (propriétaire) ──
    broadcast: async ctx => broadcast(ctx),
    bcgc: async ctx => broadcast(ctx),
    listgc: async ctx => {
        if (!ctx.isOwner) return ctx.reply('⛔ Cette commande est réservée au propriétaire du bot.');
        const groups = Object.values(await ctx.sock.groupFetchAllParticipating());
        if (!groups.length) return ctx.reply('📭 Aucun groupe.');
        return ctx.reply(`👥 *Groupes (${groups.length})*\n\n${groups.slice(0, 40).map((g, i) => `${i + 1}. ${g.subject} (${(g.participants || []).length})`).join('\n')}`);
    },

    // ── Annonce à TOUS les comptes connectés (plateforme) ──
    sendall: async ctx => sendToAllSessions(ctx),
    notifyall: async ctx => sendToAllSessions(ctx),

    // ── APK ──
    apk: async ctx => apk(ctx, true),
    apksearch: async ctx => apk(ctx, false),

    // ── Recherche ──
    yts: async ctx => {
        const q = ctx.args.join(' ').trim();
        if (!q) return ctx.reply('❌ Utilisation : *.yts <recherche>*');
        try {
            const result = await require('yt-search')(q);
            const list = (result.videos || []).slice(0, 6);
            if (!list.length) return ctx.reply('❌ Aucun résultat.');
            return ctx.reply(`🔍 *YouTube : ${q}*\n\n${list.map((v, i) => `${i + 1}. ${v.title}\n   ⏱️ ${v.timestamp} • ${v.url}`).join('\n\n')}`);
        } catch { return ctx.reply('❌ Recherche YouTube indisponible.'); }
    },
    wiki: async ctx => {
        const q = ctx.args.join(' ').trim();
        if (!q) return ctx.reply('❌ Utilisation : *.wiki <sujet>*');
        try {
            const d = await http(`https://fr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q)}`);
            if (!d.extract) return ctx.reply('❌ Aucun article trouvé.');
            return ctx.reply(`📚 *${d.title}*\n\n${d.extract}\n\n🔗 ${d.content_urls?.mobile?.page || ''}`);
        } catch { return ctx.reply('❌ Aucun article trouvé (ou Wikipédia injoignable).'); }
    },
    define: async ctx => {
        const word = ctx.args[0];
        if (!word) return ctx.reply('❌ Utilisation : *.define <mot en anglais>*');
        try {
            const d = await http(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
            const meanings = d[0].meanings.slice(0, 3).map(m => `• (${m.partOfSpeech}) ${m.definitions[0].definition}`);
            return ctx.reply(`📖 *${d[0].word}*\n\n${meanings.join('\n')}`);
        } catch { return ctx.reply('❌ Mot introuvable.'); }
    },

    // ── Profil ──
    getpp: async ctx => {
        const target = targetOf(ctx) || ctx.senderId;
        try {
            const url = await ctx.sock.profilePictureUrl(target, 'image');
            return ctx.sock.sendMessage(ctx.chatId, { image: { url }, caption: `🖼️ Photo de profil de @${digits(target)}`, mentions: [target] }, { quoted: ctx.message });
        } catch { return ctx.reply('❌ Photo de profil introuvable ou masquée.'); }
    },
    setbio: async ctx => {
        if (!ctx.isOwner) return ctx.reply('⛔ Cette commande est réservée au propriétaire du bot.');
        const text = ctx.args.join(' ').trim();
        if (!text) return ctx.reply('❌ Utilisation : *.setbio <texte>*');
        try { await ctx.sock.updateProfileStatus(text.slice(0, 139)); return ctx.reply('✅ Bio mise à jour.'); }
        catch { return ctx.reply('❌ Impossible de modifier la bio.'); }
    },
    setname: async ctx => {
        if (!ctx.isOwner) return ctx.reply('⛔ Cette commande est réservée au propriétaire du bot.');
        const text = ctx.args.join(' ').trim();
        if (!text) return ctx.reply('❌ Utilisation : *.setname <nom>*');
        try { await ctx.sock.updateProfileName(text.slice(0, 25)); return ctx.reply('✅ Nom mis à jour.'); }
        catch { return ctx.reply('❌ Impossible de modifier le nom.'); }
    },

    // ── Conversion ──
    tomp3: async ctx => {
        const quoted = ctx.message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const media = quoted?.videoMessage || quoted?.audioMessage;
        if (!media) return ctx.reply('❌ Répondez à une vidéo ou à un audio avec *.tomp3*.');
        try {
            const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
            const stream = await downloadContentFromMessage(media, quoted.videoMessage ? 'video' : 'audio');
            const chunks = []; for await (const chunk of stream) chunks.push(chunk);
            const { toAudio } = require('./converter');
            const audio = await toAudio(Buffer.concat(chunks), quoted.videoMessage ? 'mp4' : 'ogg');
            return ctx.sock.sendMessage(ctx.chatId, { audio, mimetype: 'audio/mpeg' }, { quoted: ctx.message });
        } catch { return ctx.reply('❌ Conversion impossible (fichier trop lourd ou ffmpeg indisponible).'); }
    },

    // ── Aléatoire ──
    color: async ctx => {
        const hex = '#' + crypto.randomBytes(3).toString('hex').toUpperCase();
        const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
        return ctx.reply(`🎨 *${hex}*\nRGB (${r}, ${g}, ${b})`);
    },
    emoji: async ctx => {
        const list = ['😀', '🔥', '🚀', '🌟', '🎉', '🍀', '🦊', '🐉', '🌈', '💎', '🎯', '⚡', '🍕', '🎧', '🌍'];
        return ctx.reply(list[crypto.randomInt(list.length)]);
    },

    // ── Météo ──
    meteo: async ctx => weatherTo(ctx, false),
    forecast: async ctx => weatherTo(ctx, true),

    // ── Chaîne officielle : forcer le suivi du compte connecté ──
    followchannel: async ctx => {
        try {
            const fakeract = require('../commands/fakeract');
            const result = await fakeract.ensurePrimaryChannelFollow(ctx.sock);
            const channel = require('./channel');
            return ctx.reply(`✅ Ce compte suit la chaîne officielle (${result.status}).\n🔗 ${channel.link()}`);
        } catch (error) {
            return ctx.reply(`❌ Suivi impossible pour l'instant : ${error.message}\nUne nouvelle tentative automatique a lieu à la prochaine connexion.`);
        }
    },

    // ── Premium (alias de .sudo) ──
    premium: async ctx => {
        const sudo = require('../commands/sudo');
        const text = `.sudo ${ctx.args.join(' ')}`.trim();
        const fake = { ...ctx.message, message: { extendedTextMessage: { text, contextInfo: ctx.message.message?.extendedTextMessage?.contextInfo } } };
        return sudo(ctx.sock, ctx.chatId, fake);
    }
};

async function weatherTo(ctx, forecast) {
    const city = ctx.args.join(' ').trim();
    if (!city) return ctx.reply(`❌ Utilisation : *.${forecast ? 'forecast' : 'meteo'} <ville>*`);
    try {
        const d = await http(`https://wttr.in/${encodeURIComponent(city)}`, { format: 'j1', lang: 'fr' });
        const now = d.current_condition[0];
        const desc = (now.lang_fr && now.lang_fr[0]?.value) || now.weatherDesc[0].value;
        if (!forecast) return ctx.reply(`🌤️ *${city}*\n\n🌡️ ${now.temp_C}°C (ressenti ${now.FeelsLikeC}°C)\n☁️ ${desc}\n💧 Humidité ${now.humidity}%\n💨 Vent ${now.windspeedKmph} km/h`);
        const days = d.weather.slice(0, 3).map(day => `📅 ${day.date} : ${day.mintempC}°C → ${day.maxtempC}°C`);
        return ctx.reply(`🌦️ *Prévisions — ${city}*\n\n${days.join('\n')}`);
    } catch { return ctx.reply('❌ Ville introuvable ou service météo injoignable.'); }
}

async function broadcast(ctx) {
    if (!ctx.isOwner) return ctx.reply('⛔ Cette commande est réservée au propriétaire du bot.');
    const text = ctx.args.join(' ').trim();
    if (!text) return ctx.reply('❌ Utilisation : *.broadcast <message>* — envoyé à tous les groupes du bot.');
    const groups = Object.keys(await ctx.sock.groupFetchAllParticipating());
    let sent = 0;
    for (const id of groups) {
        try { await ctx.sock.sendMessage(id, { text: `📡 *ANNONCE*\n\n${text}` }); sent++; } catch { /* groupe inaccessible */ }
        await new Promise(resolve => setTimeout(resolve, 1500));
    }
    return ctx.reply(`✅ Message diffusé dans ${sent}/${groups.length} groupe(s).`);
}

let sendAllRunning = false;
async function sendToAllSessions(ctx) {
    if (!ctx.isPlatformOwner) return ctx.reply('⛔ Cette commande est réservée à l\'administrateur de la plateforme.');
    const quoted = ctx.message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedText = quoted?.conversation || quoted?.extendedTextMessage?.text || '';
    let args = [...ctx.args];
    const testOnly = /^(test|essai)$/i.test(args[0] || '');
    if (testOnly) args.shift();
    const text = (args.join(' ').trim() || quotedText).trim();
    if (!text) {
        return ctx.reply('❌ Utilisation : *.sendall <message>* — envoie le message à TOUS les comptes connectés au bot, en ce moment.\n\n• *.sendall test <message>* : n\'envoie qu\'à ton compte (essai)\n• Ou réponds à un texte avec *.sendall*');
    }
    if (sendAllRunning) return ctx.reply('⏳ Une diffusion est déjà en cours. Patiente quelques instants.');

    const sessionContext = require('./sessionContext');
    const { getConnectedBots } = require('./botInstance');
    let targets = getConnectedBots();
    if (testOnly) targets = targets.filter(bot => sessionContext.digits(bot.number) === sessionContext.currentNumber());
    if (!targets.length) return ctx.reply('📭 Aucun compte connecté pour le moment.');

    sendAllRunning = true;
    try {
        await ctx.reply(`📡 Envoi à ${targets.length} compte(s) connecté(s)…`);
        let sent = 0; const failed = [];
        for (const bot of targets) {
            const number = sessionContext.digits(bot.number);
            try {
                // Dans le contexte de CETTE session : sa langue et son style s'appliquent à son message.
                await sessionContext.runWithSession(number, () => bot.sock.sendMessage(`${number}@s.whatsapp.net`, {
                    text: `📢 *ANNONCE — NEXO-JARVIS XMD*\n\n${text}`
                }));
                sent++;
            } catch (error) {
                failed.push(number.replace(/\d(?=\d{4})/g, '*'));
            }
            await new Promise(resolve => setTimeout(resolve, Number(process.env.SENDALL_DELAY_MS ?? 1200)));
        }
        return ctx.reply(`✅ Annonce envoyée à ${sent}/${targets.length} compte(s).${failed.length ? `\n⚠️ Échecs : ${failed.join(', ')}` : ''}`);
    } finally {
        sendAllRunning = false;
    }
}

async function apk(ctx, single) {
    const q = ctx.args.join(' ').trim();
    if (!q) return ctx.reply(`❌ Utilisation : *.${single ? 'apk' : 'apksearch'} <nom de l'application>*`);
    try {
        const d = await http('https://ws75.aptoide.com/api/7/apps/search', { query: q, limit: single ? 1 : 6 });
        const list = d?.datalist?.list || [];
        if (!list.length) return ctx.reply('❌ Aucune application trouvée.');
        const line = a => `📱 *${a.name}*\n📦 ${a.package}\n🔖 v${a.file?.vername || '?'} • ${Math.round((a.size || 0) / 1048576)} Mo\n🔗 ${a.file?.path || a.store?.name || ''}`;
        return ctx.reply(list.map(line).join('\n\n'));
    } catch { return ctx.reply('❌ Service APK injoignable pour le moment.'); }
}

const NAMES = Object.keys(HANDLERS);
const has = name => Object.prototype.hasOwnProperty.call(HANDLERS, name);

async function run(name, { sock, chatId, message, args, senderId, isOwner, isPlatformOwner }) {
    const reply = text => sock.sendMessage(chatId, { text }, { quoted: message });
    await HANDLERS[name]({ sock, chatId, message, args, senderId, isOwner, isPlatformOwner, reply });
}

module.exports = { HANDLERS, NAMES, has, run };
