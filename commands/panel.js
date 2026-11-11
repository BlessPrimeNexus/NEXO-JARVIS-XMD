'use strict';

/*
 * PANEL — la console du bot, depuis WhatsApp (propriétaire uniquement).
 *
 *   .panel                         tableau de bord + liste de toutes les sections
 *   .sessions …                    sessions (liste, info, remove, restart, purge) — voir commands/sessions.js
 *   .ram                           mémoire détaillée          .gc  libère la mémoire maintenant
 *   .logs [n] [err|warn]           dernières lignes du journal (console)
 *   .disk                          espace utilisé par sessions / data / tmp
 *   .restart [oui]                 redémarre le bot (demande confirmation)
 *   .config                        réglages modifiables : .config get|set|reset <clé> [valeur]
 *   .owners                        propriétaires : .owners add|remove <numéro>
 *   .lang [fr|en]                  langue du bot
 *
 * Volontairement absent : un « .shell » qui exécuterait n'importe quelle commande système depuis WhatsApp.
 * Une faille d'identification ou un téléphone volé donnerait la main sur tout le serveur ; chaque action utile
 * est donc proposée sous forme de commande précise et vérifiée.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const settings = require('../settings');
const { panel, report } = require('../lib/style');
const ownerAuth = require('../lib/ownerAuth');
const memoryGuard = require('../lib/memoryGuard');
const logBuffer = require('../lib/logBuffer');
const panelConfig = require('../lib/panelConfig');
const i18n = require('../lib/i18n');

const PANEL_COMMANDS = ['panel', 'ram', 'gc', 'logs', 'disk', 'restart', 'config', 'owners', 'lang'];
const YES = new Set(['oui', 'yes', 'confirm', 'ok']);

const quick = (text, id) => ({ name: 'quick_reply', params: { display_text: text, id } });

function sessionNumbers() {
    let total = 0;
    let online = 0;
    try { total = require('../lib/session-manager').sessionManager.listSessions().length; } catch { /* registre indisponible */ }
    try { online = require('../lib/botInstance').getConnectedBots().length; } catch { /* aucune instance */ }
    return { total: Math.max(total, online), online };
}

function duration(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    const parts = [[Math.floor(s / 86400), 'j'], [Math.floor((s % 86400) / 3600), 'h'], [Math.floor((s % 3600) / 60), 'min']];
    const shown = parts.filter(([value]) => value > 0).map(([value, unit]) => `${value} ${unit}`);
    return shown.length ? shown.slice(0, 2).join(' ') : `${s} s`;
}

function folderSize(dir, limit = 40000) {
    let bytes = 0;
    let seen = 0;
    const stack = [dir];
    while (stack.length && seen < limit) {
        const current = stack.pop();
        let entries;
        try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch { continue; }
        for (const entry of entries) {
            seen += 1;
            const full = path.join(current, entry.name);
            if (entry.isDirectory()) stack.push(full);
            else { try { bytes += fs.statSync(full).size; } catch { /* fichier disparu */ } }
        }
    }
    return { bytes, truncated: seen >= limit };
}

const mbText = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} Mo`;

async function send(sock, chatId, message, text, buttons, raw = false) {
    if (buttons && buttons.length) {
        try {
            const { sendInteractiveMessage } = require('../lib/interactiveButtons');
            await sendInteractiveMessage(sock, chatId, {
                title: '',
                body: text,
                buttons,
                raw,
                quoted: message
            });
            return;
        } catch (error) {
            console.warn('[panel] Boutons indisponibles, réponse en texte :', error.message);
        }
    }
    await sock.sendMessage(chatId, raw ? { text, __plain: true } : { text }, { quoted: message });
}

/* ─── Sections ──────────────────────────────────────────────── */

function dashboard(prefix) {
    const { total, online } = sessionNumbers();
    const mem = memoryGuard.snapshot();
    const text = report('🖥️ Panel de contrôle', [['Sessions', `${online} / ${total}`], ['Langue', i18n.getLang() === 'en' ? 'English' : 'Français']], [
        { title: '⚙️ Système', rows: [['🧠 RAM', `${mem.rss} Mo (seuil ${mem.softLimit})`], ['⏱️ Bot actif', duration(process.uptime())], ['🟢 Node', process.version.replace('v', '')]] },
        { title: '🧭 Sections', rows: ['.sessions', '.ram', '.gc', '.logs', '.disk', '.dltest', '.config', '.owners', '.lang', '.restart'] }
    ], 'Choisissez une section dans la liste.');
    const rows = [
        ['📋 Sessions', 'Voir, supprimer, relancer', 'sessions'],
        ['🧠 Mémoire du bot', 'RAM détaillée', 'ram'],
        ['🧹 Libérer la mémoire', 'Nettoyage immédiat', 'gc'],
        ['📜 Journaux', 'Dernières lignes', 'logs'],
        ['🚨 Erreurs récentes', 'Seulement les erreurs', 'logs err'],
        ['💽 Espace disque', 'Sessions, data, tmp', 'disk'],
        ['⚙️ Réglages', 'Modifier sans redéployer', 'config'],
        ['👑 Propriétaires', 'Ajouter / retirer', 'owners'],
        ['🌐 Langue', 'Français / English', 'lang'],
        ['🔁 Redémarrer le bot', 'Avec confirmation', 'restart']
    ].map(([title, description, command]) => ({ header: '', title, description, id: `${prefix}${command}` }));
    const buttons = [
        { name: 'single_select', params: { title: '🖥️ Ouvrir une section', sections: [{ title: 'Sections', highlight_label: '', rows }] } },
        quick('🔄 Actualiser le panel', `${prefix}panel`)
    ];
    return { text, buttons };
}

function ramView(prefix) {
    const mem = memoryGuard.snapshot();
    const { online } = sessionNumbers();
    const sections = [
        { title: '🧠 Mémoire', rows: [['RAM (RSS)', `${mem.rss} Mo`], ['Mémoire externe', `${mem.external} Mo`], ['Tampons', `${mem.arrayBuffers} Mo`], ['Par session', online ? `${Math.round(mem.rss / online)} Mo` : '—']] },
        { title: '📦 Tas V8', rows: [['Utilisé', `${mem.heapUsed} Mo`], ['Total', `${mem.heapTotal} Mo`], ['Limite', `${mem.heapLimit} Mo`]] },
        { title: '🧹 Nettoyage', rows: [['Seuil', `${mem.softLimit} Mo`], ['Nettoyages', mem.trims], ['Dernier', mem.lastTrimAt ? new Date(mem.lastTrimAt).toLocaleTimeString('fr-FR', { timeZone: 'Africa/Kinshasa', hour12: false }) : 'aucun']] }
    ];
    const note = mem.gcAvailable ? '' : 'Ramasse-miettes indisponible : démarrez avec --expose-gc (railway.toml).';
    return { text: report('🧠 Mémoire du bot', [['RAM', `${mem.rss} Mo`], ['Seuil', `${mem.softLimit} Mo`]], sections, note), buttons: [quick('🧹 Libérer', `${prefix}gc`), quick('🔄 Actualiser la RAM', `${prefix}ram`), quick('🖥️ Panel', `${prefix}panel`)] };
}

async function sectionLogs(args) {
    const tokens = args.split(/\s+/).filter(Boolean);
    const count = Number(tokens.find(token => /^\d{1,2}$/.test(token))) || 15;
    const level = tokens.find(token => /^(err|error|warn)$/i.test(token));
    const lines = logBuffer.tail(count, level ? (/^warn$/i.test(level) ? 'warn' : 'error') : '');
    if (!lines.length) return { text: panel('📜 JOURNAUX', ['Aucune ligne pour le moment.']), buttons: [quick('🖥️ Panel', '.panel')] };
    let body = lines.join('\n');
    if (body.length > 2800) body = `…${body.slice(-2800)}`;
    return { text: `*📜 JOURNAUX* (${lines.length})\n\`\`\`${body}\`\`\``, buttons: [quick('🖥️ Panel', '.panel')] };
}

function diskView(prefix) {
    const root = path.join(__dirname, '..');
    const sessionsDir = require('../lib/sessionControl').sessionsRoot();
    const targets = [
        ['🔌 Sessions', sessionsDir],
        ['🗄️ Data', path.join(root, 'data')],
        ['🗑️ Temporaires', path.join(root, 'tmp')],
        ['📥 Téléchargements', path.join(root, 'temp')]
    ];
    const rows = [];
    for (const [label, dir] of targets) {
        if (!fs.existsSync(dir)) continue;
        const { bytes, truncated } = folderSize(dir);
        rows.push([label, `${mbText(bytes)}${truncated ? '+' : ''}`]);
    }
    rows.push(['🖥️ Serveur libre', `${mbText(os.freemem())} / ${mbText(os.totalmem())}`]);
    return { text: report('💽 Espace disque', [['Serveur libre', `${mbText(os.freemem())} / ${mbText(os.totalmem())}`]], [{ title: '📁 Dossiers', rows: rows.filter(row => row[0] !== '🖥️ Serveur libre') }]), buttons: [quick('🧹 Vider tmp', `${prefix}cleartmp`), quick('🖥️ Panel', `${prefix}panel`)] };
}

function configView(args, prefix) {
    const [action = '', key = '', ...rest] = args.split(/\s+/).filter(Boolean);
    const verb = action.toLowerCase();
    if (!verb || verb === 'list') {
        const rows = panelConfig.list(settings).map(item => {
            const value = String(item.value ?? '—');
            return `${item.changed ? '✏️' : '▫️'} ${item.key} = ${value.length > 24 ? `${value.slice(0, 24)}…` : value}`;
        });
        return { text: panel('⚙️ RÉGLAGES', rows, `${prefix}config set <clé> <valeur> • ${prefix}config reset <clé>`), buttons: [quick('🖥️ Panel', `${prefix}panel`)] };
    }
    try {
        if (verb === 'get') return { text: panel('⚙️ RÉGLAGE', [[key, String(settings[key] ?? '—')]]), buttons: [] };
        if (verb === 'set') {
            if (!key || !rest.length) throw new Error(`utilisation : ${prefix}config set <clé> <valeur>`);
            const value = panelConfig.set(settings, key, rest.join(' '));
            return { text: panel('✅ RÉGLAGE ENREGISTRÉ', [[key, String(value)]], 'Appliqué tout de suite et conservé après redémarrage.'), buttons: [] };
        }
        if (verb === 'reset') {
            const value = panelConfig.reset(settings, key);
            return { text: panel('♻️ RÉGLAGE RESTAURÉ', [[key, String(value ?? '—')]]), buttons: [] };
        }
        throw new Error('action inconnue (get, set, reset)');
    } catch (error) {
        return { text: panel('❌ RÉGLAGE REFUSÉ', [error.message], `Clés : ${Object.keys(panelConfig.ALLOWED).join(', ')}`), buttons: [] };
    }
}

function ownersView(args, prefix) {
    const [action = '', ...numberParts] = args.split(/\s+/).filter(Boolean);
    const number = numberParts.join('');   // « +243 811 222 333 » → un seul numéro
    const verb = action.toLowerCase();
    try {
        if (verb === 'add' || verb === 'ajouter') {
            const added = ownerAuth.addOwner(number);
            return { text: panel(added ? '✅ PROPRIÉTAIRE AJOUTÉ' : 'ℹ️ DÉJÀ PROPRIÉTAIRE', [['📞 Numéro', `+${ownerAuth.digits(number)}`]]), buttons: [] };
        }
        if (verb === 'remove' || verb === 'del' || verb === 'retirer') {
            const removed = ownerAuth.removeOwner(number);
            return { text: panel(removed ? '🗑️ PROPRIÉTAIRE RETIRÉ' : 'ℹ️ NON TROUVÉ', [['📞 Numéro', `+${ownerAuth.digits(number)}`]]), buttons: [] };
        }
    } catch (error) {
        return { text: panel('❌ REFUSÉ', [error.message]), buttons: [] };
    }
    const base = [...ownerAuth.baseOwners()];
    const extra = ownerAuth.extraOwners();
    const rows = [...base.map(n => `👑 +${n} (principal)`), ...extra.map(n => `➕ +${n}`)];
    return { text: panel('👑 PROPRIÉTAIRES', rows, `${prefix}owners add <n°> • ${prefix}owners remove <n°>`), buttons: [quick('🖥️ Panel', `${prefix}panel`)] };
}

function langView(args, prefix) {
    const wanted = args.trim().toLowerCase();
    if (['fr', 'francais', 'français', 'french'].includes(wanted)) i18n.setLang('fr');
    else if (['en', 'english', 'anglais'].includes(wanted)) i18n.setLang('en');
    else if (wanted === 'toggle') i18n.setLang(i18n.getLang() === 'en' ? 'fr' : 'en');
    const current = i18n.getLang() === 'en' ? 'English' : 'Français';
    const changed = ['fr', 'francais', 'français', 'french', 'en', 'english', 'anglais', 'toggle'].includes(wanted);
    // On répond dans la nouvelle langue : le texte part en français, la traduction se fait à l'envoi.
    return {
        text: panel(changed ? '🌐 LANGUE CHANGÉE' : '🌐 LANGUE', [['Langue actuelle', current]], changed ? 'Tous les menus et réponses suivent cette langue (textes non traduits : restent en français).' : `${prefix}lang fr • ${prefix}lang en`),
        buttons: [quick('🇫🇷 Français', `${prefix}lang fr`), quick('🇬🇧 English', `${prefix}lang en`)]
    };
}

async function restartView(sock, chatId, message, args, prefix) {
    if (!YES.has(args.trim().toLowerCase())) {
        return {
            text: panel('🔁 REDÉMARRER LE BOT ?', ['Toutes les sessions seront coupées quelques secondes puis reconnectées.'], 'Confirmez pour continuer.'),
            buttons: [quick('✅ Oui, redémarrer', `${prefix}restart oui`), quick('🖥️ Panel', `${prefix}panel`)]
        };
    }
    await send(sock, chatId, message, panel('🔁 REDÉMARRAGE', ['Redémarrage en cours…', 'Je reviens dans un instant, Monsieur.']));
    setTimeout(async () => {
        try { await Promise.race([require('../lib/botInstance').shutdownBotInstances(), new Promise(resolve => setTimeout(resolve, 5000))]); } catch { /* arrêt forcé */ }
        process.exit(1);   // code ≠ 0 : l'hébergeur (railway.toml : ON_FAILURE) relance le processus
    }, 1500);
    return null;
}

/* ─── Point d'entrée ────────────────────────────────────────── */

async function panelCommand(sock, chatId, message, name, rawArgs = '') {
    // La langue est un réglage de la SESSION (propriétaire du bot) ; le reste du panneau est réservé à la plateforme.
    const allowed = name === 'lang'
        ? await ownerAuth.isOwnerMessage(sock, message, chatId)
        : await ownerAuth.isPlatformOwnerMessage(sock, message, chatId);
    if (!allowed) {
        return sock.sendMessage(chatId, { text: '⛔ Accès réservé au propriétaire du système, Monsieur.' }, { quoted: message });
    }

    let prefix = '.';
    try { prefix = require('../lib/prefix').getPrefix(chatId) || '.'; } catch { /* préfixe par défaut */ }
    const args = String(rawArgs || '').trim();
    let view;

    switch (name) {
        case 'panel': view = dashboard(prefix); break;
        case 'ram': view = ramView(prefix); break;
        case 'gc': {
            const result = memoryGuard.trim('manuel');
            view = {
                text: panel('🧹 NETTOYAGE TERMINÉ', [['Avant', `${result.before} Mo`], ['Après', `${result.after} Mo`], ['Libéré', `${Math.max(0, result.freed)} Mo`]],
                    memoryGuard.snapshot().gcAvailable ? '' : 'Ramasse-miettes indisponible (--expose-gc) : seuls les caches ont été vidés.'),
                buttons: [quick('🔄 Actualiser la RAM', `${prefix}ram`), quick('🖥️ Panel', `${prefix}panel`)]
            };
            break;
        }
        case 'logs': view = await sectionLogs(args); break;
        case 'disk': view = diskView(prefix); break;
        case 'config': view = configView(args, prefix); break;
        case 'owners': view = ownersView(args, prefix); break;
        case 'lang': view = langView(args, prefix); break;
        case 'restart': view = await restartView(sock, chatId, message, args, prefix); break;
        default: return null;
    }
    if (!view) return null;
    return send(sock, chatId, message, view.text, view.buttons, name === 'logs');
}

module.exports = { panelCommand, PANEL_COMMANDS, duration, folderSize };
