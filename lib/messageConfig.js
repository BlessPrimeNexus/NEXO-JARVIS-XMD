// Configuration du forward — Chaîne officielle NEXO-JARVIS XMD
// Le JID de la chaîne est résolu automatiquement (lib/channel.js) : les valeurs ci-dessous sont lues
// à chaque envoi, et lib/presentation.js les (ré)applique de toute façon sur chaque message du bot.
const channel = require('./channel');

const channelInfo = {
    contextInfo: {
        forwardingScore: 1,
        isForwarded: true,
        get forwardedNewsletterMessageInfo() {
            return channel.forwardInfo() || undefined;
        }
    }
};

module.exports = { channelInfo };
