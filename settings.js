const settings = {
  // ════════════════════════════════════════════════════
  //    🥷 CONFIGURATION DE TON BOT — REMPLIS ICI
  // ════════════════════════════════════════════════════

  packname: '𝗡𝗘𝗫𝗢-𝗝𝗔𝗥𝗩𝗜𝗦 𝗫𝗠𝗗',          // Nom du pack sticker
  author: '✘🦠𝗕𝗟𝗘𝗦𝗦 | 𝗗𝗘𝗩🧬»𝟰𝟬𝟰. ✘',               // Ton nom
  botName: "𝗡𝗘𝗫𝗢-𝗝𝗔𝗥𝗩𝗜𝗦 𝗫𝗠𝗗",           // Nom du bot affiché
  botOwner: '✘🦠𝗕𝗟𝗘𝗦𝗦 | 𝗗𝗘𝗩🧬»𝟰𝟬𝟰. ✘',             // Ton vrai nom
  menuOwner: '✘🦠𝗕𝗟𝗘𝗦𝗦 | 𝗗𝗘𝗩🧬»𝟰𝟬𝟰. ✘',
  developer: '✘🦠𝗕𝗟𝗘𝗦𝗦 | 𝗗𝗘𝗩🧬»𝟰𝟬𝟰. ✘',

  // ⚠️ Ton numéro WhatsApp SANS le + (ex: 224621000000)
  // Carte du développeur (.owner)
  ownerRole: 'Développeur',
  ownerBio: 'Concepteur et mainteneur de NEXO-JARVIS XMD.',
  ownerWebsite: 'https://nexo-jarvis-xmd-production.up.railway.app',
  ownerSendContact: false,  // true = la carte est suivie d'un 2e message : le contact WhatsApp à enregistrer d'un clic
  // Propriétaires : le développeur + le numéro sur lequel le bot principal est connecté.
  // Seuls ces numéros peuvent utiliser les commandes réservées (.sessions, .mode, .update…).
  // Modifiable sans toucher au code : variable OWNER_NUMBERS=243802506198,243822993775
  ownerNumbers: ['243802506198', '243822993775'],
  ownerNumber: process.env.OWNER_NUMBER || '243802506198',

  // ════════════════════════════════════════════════════
  //    🖼️ PRÉSENTATION DES RÉPONSES
  //    Les aperçus d'images viennent du dossier jarvis-images/ : chaque image est réduite en
  //    miniature et embarquée dans le message (aucun lien distant à télécharger côté membre,
  //    donc visible par tout le monde et rien ne s'enregistre sur leur téléphone).
  //    Ajoute ou remplace des .jpg / .png dans jarvis-images/ pour changer les aperçus.
  // ════════════════════════════════════════════════════
  // Réglable sans redéployer (propriétaire) :  .menustyle complet|texte   .quotecard on|off   .preview on|off
  // Tester ce que voit un membre qui ne reçoit rien : .viewtest
  menuStyle: 'complet',        // complet = UN SEUL message : menu + boutons ; texte = menu en texte simple.
  imageReply: true,            // Vraie image (jarvis-images/) envoyée avec chaque réponse courte (solution temporaire). .imagemode on|off
  replyNotes: false,           // Phrases d'accompagnement sous les réponses (conseils, « Monsieur »…) : coupées par défaut. .config set replyNotes on
  replyFrame: true,            // Habille automatiquement les réponses texte brutes dans le cadre NEXO-JARVIS. .replystyle on|off
  previewImage: false,         // Aperçu de lien (externalAdReply) : DÉSACTIVÉ — il rend les messages invisibles chez certains membres (test 3 de .viewtest). .preview on pour le réactiver.
  quoteCard: true,             // Fausse citation « WhatsApp ✓ • Statut » sur CHAQUE réponse du bot.
  quoteCardStyle: 'universal', // universal = lue par toutes les versions de WhatsApp ; business = carte de commande (WhatsApp Business seulement).
  previewTitle: '𝗡𝗘𝗫𝗢-𝗝𝗔𝗥𝗩𝗜𝗦 𝗫𝗠𝗗',                         // Titre de l'aperçu
  previewBody: 'Systèmes opérationnels. À votre service.',   // Sous-titre de l'aperçu
  // Chaîne officielle : voir lib/channel.js (le JID est résolu automatiquement à la connexion).
  channelLink: 'https://whatsapp.com/channel/0029Vb78ycrInlqYocbYLX0P', // Lien ouvert au clic sur l'aperçu et sur le bouton CHAÎNE
  botLink: process.env.BOT_LINK || '',  // Lien affiché dans le menu à la place de la chaîne (facultatif)

  giphyApiKey: process.env.GIPHY_API_KEY || '',
  commandMode: "public",               // "public" ou "private"
  maxStoreMessages: 10,
  storeWriteInterval: 10000,
  description: "Assistant WhatsApp JARVIS — systèmes automatisés, modération et intelligence intégrée.",
  version: "2.0.0",

  // Liens officiels (utilisés par .repo et .github)
  repoUrl: 'https://github.com/BlessPrimeNexus/NEXO-JARVIS-XMD',
  panelUrl: process.env.PANEL_URL || 'https://nexo-jarvis-xmd-production.up.railway.app',

  // Ton lien GitHub (optionnel)
  updateZipUrl: "https://github.com/BlessPrimeNexus/NEXO-JARVIS-XMD/archive/refs/heads/main.zip",

  // URL du panneau — auto-détection Render / Railway / Vercel / fallback
  pairApiUrl: process.env.RENDER_EXTERNAL_URL
    ? process.env.RENDER_EXTERNAL_URL
    : process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.PANEL_URL
    || "https://nexo-jarvis-xmd-production.up.railway.app",
};

// Réglages modifiés depuis WhatsApp (.config) : réappliqués à chaque démarrage.
try { require('./lib/panelConfig').applyTo(settings); } catch (error) { console.warn('[config] réglages du panel ignorés :', error.message); }

module.exports = settings;
