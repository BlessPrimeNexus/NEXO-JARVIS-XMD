/**
 * 𝗡𝗘𝗫𝗢-𝗝𝗔𝗥𝗩𝗜𝗦 𝗫𝗠𝗗 - A WhatsApp Bot
 * Copyright (c) 2026 Professor
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the MIT License.
 * 
 * Credits:
 * - Baileys Library by @adiwajshing
 * - Pair Code implementation inspired by ✘🦠𝗕𝗟𝗘𝗦𝗦 | 𝗗𝗘𝗩🧬»𝟰𝟬𝟰. ✘
 */
require('./settings')
const { Boom } = require('@hapi/boom')
const fs = require('fs')
const chalk = require('chalk')
const FileType = require('file-type')
const path = require('path')
const axios = require('axios')
const { handleMessages, handleGroupParticipantUpdate, handleStatus, restoreHijackTimers } = require('./main');
const PhoneNumber = require('awesome-phonenumber')
const { imageToWebp, videoToWebp, writeExifImg, writeExifVid } = require('./lib/exif')
const { smsg, isUrl, generateMessageTag, getBuffer, getSizeMedia, fetch, sleep, reSize } = require('./lib/myfunc')
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    generateForwardMessageContent,
    prepareWAMessageMedia,
    generateWAMessageFromContent,
    generateMessageID,
    downloadContentFromMessage,
    jidDecode,
    proto,
    jidNormalizedUser,
    makeCacheableSignalKeyStore,
    Browsers,
    delay
} = require("@whiskeysockets/baileys")
const NodeCache = require("node-cache")
// Using a lightweight persisted store instead of makeInMemoryStore (compat across versions)
const pino = require("pino")
const readline = require("readline")
const { parsePhoneNumber } = require("libphonenumber-js")
const { rmSync, existsSync } = require('fs')
const { join } = require('path')

// Import lightweight store
const createStore = require('./lib/lightweight_store')
const store = createStore()   // instance unique pour index.js (mode mono-utilisateur)
const settings = require('./settings')

// Memory optimization - Force garbage collection if available
const gcTimer = setInterval(() => {
    if (global.gc) {
        global.gc()
        console.log('🧹 Garbage collection completed')
    }
}, 60_000) // every 1 minute
gcTimer.unref?.()

// Memory monitoring - Restart if RAM gets too high
const memoryTimer = setInterval(() => {
    const used = process.memoryUsage().rss / 1024 / 1024
    if (used > 400) {
        console.error(`⚠️ RAM élevée (${Math.round(used)}MB). Le processus reste actif pour éviter une boucle de redémarrage; inspecte /health.`)
    }
}, 30_000) // check every 30 seconds
memoryTimer.unref?.()

const configuredOwnerNumber = String(process.env.OWNER_NUMBER || settings.ownerNumber || '').replace(/\D/g, '')
const configuredBotNumber = String(process.env.BOT_NUMBER || '').replace(/\D/g, '')
let phoneNumber = configuredBotNumber
let legacyReconnectPending = false
let legacyReconnectAttempts = 0
let pairingRunId = 0
let owner = (() => { try { return JSON.parse(fs.readFileSync("./data/owner.json", "utf8")); } catch { return { ownerNumber: settings.ownerNumber, ownerName: settings.botOwner, botName: settings.botName, prefix: process.env.PREFIX || ".", version: settings.version, mess: settings.botOwner }; } })()

global.botname = "𝗡𝗘𝗫𝗢-𝗝𝗔𝗥𝗩𝗜𝗦 𝗫𝗠𝗗"
global.themeemoji = "•"
const pairingCode = !process.env.SKIP_PAIRING && (!!phoneNumber || process.argv.includes("--pairing-code"))
const useMobile = process.argv.includes("--mobile")

// Only create readline interface if we're in an interactive environment
const rl = process.stdin.isTTY ? readline.createInterface({ input: process.stdin, output: process.stdout }) : null
const question = (text) => {
    if (rl) {
        return new Promise((resolve) => rl.question(text, resolve))
    } else {
        // In non-interactive environment, use ownerNumber from settings
        return Promise.resolve(configuredBotNumber || phoneNumber)
    }
}


async function startXeonBotInc() {
    try {
        // Baileys 6.7.24 default. Do not fall back to the old 1023097280
        // version: WhatsApp can reject the generated pairing code.
        let version = [2, 3000, 1043857760];
        let isLatest = false;
        try {
            const _v = await Promise.race([
                fetchLatestBaileysVersion(),
                new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 2500))
            ]);
            if (_v && _v.version) { version = _v.version; isLatest = _v.isLatest; }
        } catch (e) {
            console.warn('[NEXO-JARVIS] Version Baileys indisponible rapidement → version de secours');
        }
        // Supporte --session-dir <dir> pour les instances multi-utilisateurs
        const sessionDirArg = (() => {
            const idx = process.argv.indexOf('--session-dir');
            return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : null;
        })();
        const SESSION_DIR = sessionDirArg || process.env.SESSION_DIR || './session';
        const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR)
        const msgRetryCounterCache = new NodeCache()

        const XeonBotInc = makeWASocket({
            version,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: !pairingCode,
            browser: Browsers.ubuntu('Chrome'),
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" }).child({ level: "fatal" })),
            },
            getMessage: async (key) => {
                // Message envoyé par le bot : indispensable pour le renvoyer à un téléphone qui ne l'a pas déchiffré.
                const sent = require('./lib/sentMessages').recall(key)
                if (sent) return sent
                let jid = jidNormalizedUser(key.remoteJid)
                let msg = await store.loadMessage(jid, key.id)
                return msg?.message || undefined
            },
            msgRetryCounterCache,
            defaultQueryTimeoutMs: 60000,
            connectTimeoutMs: 60000,
            keepAliveIntervalMs: 20000,
            markOnlineOnConnect: false,
            syncFullHistory: false,
        })
        require('./lib/presentation').wrapSocket(XeonBotInc)

        // Save credentials when they update
        XeonBotInc.ev.on('creds.update', saveCreds)

    store.bind(XeonBotInc.ev)

    // Message handling
    XeonBotInc.ev.on('messages.upsert', async chatUpdate => {
        try {
            const incoming = Array.isArray(chatUpdate?.messages) ? chatUpdate.messages : []
            if (!incoming.length) return

            const { handleChannelMessages } = require('./commands/fakeract')
            await handleChannelMessages(XeonBotInc, incoming, chatUpdate?.type)

            const normalMessages = incoming.filter(message =>
                message?.key?.remoteJid &&
                !message.key.remoteJid.endsWith('@newsletter') &&
                message.message &&
                !(message.key?.id?.startsWith('BAE5') && message.key.id.length === 16)
            )
            if (!normalMessages.length) return
            const normalUpdate = normalMessages.length === incoming.length
                ? chatUpdate
                : { ...chatUpdate, messages: normalMessages }
            const mek = normalMessages[0]
            mek.message = (Object.keys(mek.message)[0] === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message
            if (mek.key?.remoteJid === 'status@broadcast') {
                await handleStatus(XeonBotInc, normalUpdate)
                return
            }
            if (!XeonBotInc.public && !mek.key.fromMe && chatUpdate.type === 'notify') {
                const isGroup = mek.key?.remoteJid?.endsWith('@g.us')
                if (!isGroup) return
            }
            if (XeonBotInc?.msgRetryCounterCache) XeonBotInc.msgRetryCounterCache.clear()

            try {
                await handleMessages(XeonBotInc, normalUpdate, true)
            } catch (err) {
                console.error("Error in handleMessages:", err)
                if (mek.key?.remoteJid) {
                    await XeonBotInc.sendMessage(mek.key.remoteJid, {
                        text: '❌ Une anomalie est survenue lors du traitement de votre message, Monsieur.',
                        contextInfo: {
                            forwardingScore: 1,
                            isForwarded: true,
                            forwardedNewsletterMessageInfo: {
                                newsletterJid: '120363426264191950@newsletter',
                                newsletterName: '𝗡𝗘𝗫𝗢-𝗝𝗔𝗥𝗩𝗜𝗦 𝗫𝗠𝗗',
                                serverMessageId: -1
                            }
                        }
                    }).catch(console.error)
                }
            }
        } catch (err) {
            console.error("Error in messages.upsert:", err)
        }
    })

    // Add these event handlers for better functionality
    XeonBotInc.decodeJid = (jid) => {
        if (!jid) return jid
        if (/:\d+@/gi.test(jid)) {
            let decode = jidDecode(jid) || {}
            return decode.user && decode.server && decode.user + '@' + decode.server || jid
        } else return jid
    }

    XeonBotInc.ev.on('contacts.update', update => {
        for (let contact of update) {
            let id = XeonBotInc.decodeJid(contact.id)
            if (store && store.contacts) store.contacts[id] = { id, name: contact.notify }
        }
    })

    XeonBotInc.getName = (jid, withoutContact = false) => {
        const id = XeonBotInc.decodeJid(jid)
        withoutContact = XeonBotInc.withoutContact || withoutContact
        let v
        if (id.endsWith("@g.us")) return new Promise(async (resolve) => {
            v = store.contacts[id] || {}
            if (!(v.name || v.subject)) v = XeonBotInc.groupMetadata(id) || {}
            resolve(v.name || v.subject || PhoneNumber('+' + id.replace('@s.whatsapp.net', '')).getNumber('international'))
        })
        else v = id === '0@s.whatsapp.net' ? {
            id,
            name: 'WhatsApp'
        } : id === XeonBotInc.decodeJid(XeonBotInc.user.id) ?
            XeonBotInc.user :
            (store.contacts[id] || {})
        return (withoutContact ? '' : v.name) || v.subject || v.verifiedName || PhoneNumber('+' + jid.replace('@s.whatsapp.net', '')).getNumber('international')
    }

    XeonBotInc.public = true

    XeonBotInc.serializeM = (m) => smsg(XeonBotInc, m, store)

    // Handle pairing code
    if (pairingCode && !state.creds.registered) {
        if (useMobile) throw new Error('Cannot use pairing code with mobile api')

        let phoneNumber
        if (!!global.phoneNumber) {
            phoneNumber = global.phoneNumber
        } else if (configuredBotNumber) {
            phoneNumber = configuredBotNumber
        } else {
            phoneNumber = await question(chalk.greenBright('Numéro WhatsApp à lier (indicatif du pays, sans + ni espaces) : '))
        }

        // Clean the phone number - remove any non-digit characters
        phoneNumber = phoneNumber.replace(/[^0-9]/g, '')

        // Validate the phone number using awesome-phonenumber
        const pn = require('awesome-phonenumber');
        if (!pn('+' + phoneNumber).isValid()) {
            console.log(chalk.red('Numéro invalide. Indiquez le numéro complet avec l\'indicatif du pays (ex. 243812345678).'))
            process.exit(1);
        }

        console.log(chalk.yellow(`📱 Liaison du numéro ${phoneNumber} : demande du code en cours…`))
        const pairingRun = ++pairingRunId
        require('./lib/pairingCode').requestPairingCodeWhenReady(XeonBotInc, phoneNumber, {
            isCurrent: () => pairingRun === pairingRunId,
            onRetry: (attempt, total) => console.log(chalk.yellow(`⏳ Connexion à WhatsApp pas encore prête, nouvel essai (${attempt}/${total})…`))
        }).then(code => {
            if (!code) return
            console.log(chalk.black(chalk.bgGreen(' Code de jumelage : ')), chalk.bold.white(code))
            console.log(chalk.yellow('\nSaisissez ce code dans WhatsApp :\n1. Ouvrez WhatsApp\n2. Paramètres > Appareils connectés\n3. Lier un appareil > Lier avec un numéro de téléphone\n4. Entrez le code ci-dessus (il expire en quelques minutes)'))
        }).catch(error => {
            console.error('Erreur lors de la demande du code :', error?.message || error)
            console.log(chalk.red('Impossible d\'obtenir le code. Vérifiez le numéro puis redémarrez le serveur.'))
        })
    }

    // Connection handling
    XeonBotInc.ev.on('connection.update', async (s) => {
        const { connection, lastDisconnect, qr } = s
        
        if (qr) {
            console.log(chalk.yellow('📱 QR Code generated. Please scan with WhatsApp.'))
        }
        
        if (connection === 'connecting') {
            console.log(chalk.yellow('🔄 Connecting to WhatsApp...'))
        }
        
        if (connection == "open") {
            legacyReconnectAttempts = 0
            legacyReconnectPending = false
            restoreHijackTimers(XeonBotInc);
            Promise.resolve()
                .then(() => require('./commands/fakeract').restorePrimaryChannel(XeonBotInc))
                .then(() => console.info('[auto-join] official channel follow and live updates restored for legacy session'))
                .catch(error => console.error('[auto-join] legacy official channel setup failed:', error.message));
            Promise.resolve()
                .then(() => require('./commands/fakeract').restoreChannelAlerts(XeonBotInc))
                .then(active => { if (active) console.info('[channel-alert] live updates restored for legacy session') })
                .catch(error => console.error('[channel-alert] legacy session restore failed:', error.message));
            console.log(chalk.magenta(` `))
            console.log(chalk.yellow('🤩 Connected to WhatsApp successfully.'))

            // NE PAS envoyer de message automatique au numéro connecté —
            // cela enverrait le lien de la chaîne à n'importe quel utilisateur
            // qui connecte son compte. Le message de bienvenue est supprimé.

            await delay(250)
            console.log(chalk.yellow(`\n\n                  ${chalk.bold.blue(`[ ${global.botname || '𝗡𝗘𝗫𝗢-𝗝𝗔𝗥𝗩𝗜𝗦 𝗫𝗠𝗗'} ]`)}\n\n`))
            console.log(chalk.cyan(`< ================================================== >`))
            console.log(chalk.magenta(`\n${global.themeemoji || '•'} YT CHANNEL:𝗡𝗘𝗫𝗢-𝗝𝗔𝗥𝗩𝗜𝗦 𝗫𝗠𝗗`))
            console.log(chalk.magenta(`${global.themeemoji || '•'} GITHUB: NEXO-JARVIS-XMD`))
            console.log(chalk.magenta(`${global.themeemoji || '•'} OWNER: configured\n${global.themeemoji || '•'} BOT: connected`))
            console.log(chalk.magenta(`${global.themeemoji || '•'} CRÉDIT: ✘🦠𝗕𝗟𝗘𝗦𝗦 | 𝗗𝗘𝗩🧬»𝟰𝟬𝟰. ✘`))
            console.log(chalk.green(`${global.themeemoji || '•'} 🤖 Bot Connected Successfully! ✅`))
            console.log(chalk.blue(`Bot Version: ${settings.version}`))
        }
        
        if (connection === 'close') {
            require('./commands/fakeract').stopPrimaryChannelUpdates(XeonBotInc)
            const disconnectError = lastDisconnect?.error
            const statusCode = disconnectError?.output?.statusCode
                ?? disconnectError?.data?.statusCode
                ?? disconnectError?.statusCode
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut && statusCode !== 401
            
            console.log(chalk.red(`Connection closed due to ${lastDisconnect?.error}, reconnecting ${shouldReconnect}`))
            
            if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                console.log(chalk.red('Session logged out by WhatsApp. Credentials preserved; re-pair explicitly.'))
                try { fs.writeFileSync(path.join(SESSION_DIR, '.logged_out'), JSON.stringify({ statusCode, at: new Date().toISOString() }, null, 2)) } catch {}
            }

            if (shouldReconnect && !legacyReconnectPending) {
                legacyReconnectPending = true
                legacyReconnectAttempts += 1
                const reconnectDelay = Math.min(60000, 5000 * (2 ** Math.min(legacyReconnectAttempts - 1, 4)))
                console.log(chalk.yellow(`Reconnecting in ${reconnectDelay}ms...`))
                setTimeout(async () => {
                    legacyReconnectPending = false
                    try { await startXeonBotInc() } catch (error) { console.error('Reconnect failed:', error) }
                }, reconnectDelay)
            }
        }
    })

    // Track recently-notified callers to avoid spamming messages
    const antiCallNotified = new Set();

    // Anticall handler: block callers when enabled
    XeonBotInc.ev.on('call', async (calls) => {
        try {
            const { readState: readAnticallState } = require('./commands/anticall');
            const state = readAnticallState();
            if (!state.enabled) return;
            for (const call of calls) {
                const callerJid = call.from || call.peerJid || call.chatId;
                if (!callerJid) continue;
                try {
                    // First: attempt to reject the call if supported
                    try {
                        if (typeof XeonBotInc.rejectCall === 'function' && call.id) {
                            await XeonBotInc.rejectCall(call.id, callerJid);
                        } else if (typeof XeonBotInc.sendCallOfferAck === 'function' && call.id) {
                            await XeonBotInc.sendCallOfferAck(call.id, callerJid, 'reject');
                        }
                    } catch {}

                    // Notify the caller only once within a short window
                    if (!antiCallNotified.has(callerJid)) {
                        antiCallNotified.add(callerJid);
                        setTimeout(() => antiCallNotified.delete(callerJid), 60000);
                        await XeonBotInc.sendMessage(callerJid, { text: '📵 Le filtrage d\'appels est actif. Votre appel a été rejeté et vous allez être bloqué.' });
                    }
                } catch {}
                // Then: block after a short delay to ensure rejection and message are processed
                setTimeout(async () => {
                    try { await XeonBotInc.updateBlockStatus(callerJid, 'block'); } catch {}
                }, 800);
            }
        } catch (e) {
            // ignore
        }
    });

    XeonBotInc.ev.on('group-participants.update', async (update) => {
        await handleGroupParticipantUpdate(XeonBotInc, update);
    });

    XeonBotInc.ev.on('status.update', async (status) => {
        await handleStatus(XeonBotInc, status);
    });

    XeonBotInc.ev.on('messages.reaction', async (status) => {
        await handleStatus(XeonBotInc, status);
    });

    return XeonBotInc
    } catch (error) {
        console.error('Error in startXeonBotInc:', error)
        await delay(5000)
        return startXeonBotInc()
    }
}


// Start the bot with error handling
startXeonBotInc().catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
})
process.on('uncaughtException', (err) => {
    console.error('[NEXO-JARVIS] Uncaught Exception:', err?.stack || err)
    console.error('[NEXO-JARVIS] Le superviseur doit redémarrer le processus après cette erreur critique.')
    process.exitCode = 1
})

process.on('unhandledRejection', (err) => {
    console.error('[NEXO-JARVIS] Unhandled Rejection:', err?.stack || err)
})

let legacyShuttingDown = false
async function shutdownLegacy(signal) {
    if (legacyShuttingDown) return
    legacyShuttingDown = true
    console.warn(`[NEXO-JARVIS] ${signal}: fermeture propre du socket legacy`)
    clearInterval(gcTimer)
    clearInterval(memoryTimer)
    try { rl?.close() } catch {}
    process.exit(0)
}
process.on('SIGTERM', () => shutdownLegacy('SIGTERM').catch(err => {
    console.error('[NEXO-JARVIS] Legacy shutdown failed:', err)
    process.exit(1)
}))
process.on('SIGINT', () => shutdownLegacy('SIGINT').catch(err => {
    console.error('[NEXO-JARVIS] Legacy shutdown failed:', err)
    process.exit(1)
}))
