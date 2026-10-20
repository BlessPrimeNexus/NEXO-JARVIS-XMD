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
  ownerNumber: process.env.OWNER_NUMBER || '243802506198',

  // ════════════════════════════════════════════════════
  //    🖼️ APERÇUS D'IMAGES (réponses du bot)
  //    Les 10 images hébergées sur catbox.moe s'affichent à tour de rôle,
  //    en aperçu de lien (pas de photo envoyée). Tu peux changer les liens.
  //    Un lien contenant "REMPLACE" est ignoré.
  //    Variante : variable PREVIEW_IMAGES (liens séparés par des virgules).
  // ════════════════════════════════════════════════════
  previewImages: [
    'https://files.catbox.moe/e0y2qw.jpg',
    'https://files.catbox.moe/okahni.jpg',
    'https://files.catbox.moe/t0k3j5.jpg',
    'https://files.catbox.moe/7ag4wr.jpg',
    'https://files.catbox.moe/ouybsa.jpg',
    'https://files.catbox.moe/ygvs7t.jpg',
    'https://files.catbox.moe/b703us.jpg',
    'https://files.catbox.moe/st1jdk.jpg',
    'https://files.catbox.moe/02l7v3.jpg',
    'https://files.catbox.moe/wm4yf8.jpg',
  ],
  // ── Présentation des réponses ──
  // Changer sans redéployer (propriétaire) : .menustyle mixte|complet|texte   et   .quotecard on|off|universal|business
  // Tester ce que voit un membre qui ne reçoit rien : .viewtest
  menuStyle: 'mixte',          // mixte = menu texte (visible partout) + barre de boutons ; complet = un seul message à boutons.
  quoteCard: true,             // Fausse citation « WhatsApp ✓ • Statut » sur CHAQUE réponse du bot.
  quoteCardStyle: 'universal', // universal = lue par toutes les versions de WhatsApp ; business = carte de commande (WhatsApp Business seulement).
  previewTitle: '𝗡𝗘𝗫𝗢-𝗝𝗔𝗥𝗩𝗜𝗦 𝗫𝗠𝗗',                         // Titre de l'aperçu
  previewBody: 'Systèmes opérationnels. À votre service.',   // Sous-titre de l'aperçu
  channelLink: 'https://whatsapp.com/channel/0029VbDCIHn4tRrpvS6YS332', // Lien ouvert au clic sur l'aperçu

  giphyApiKey: process.env.GIPHY_API_KEY || '',
  commandMode: "public",               // "public" ou "private"
  maxStoreMessages: 20,
  storeWriteInterval: 10000,
  description: "Assistant WhatsApp JARVIS — systèmes automatisés, modération et intelligence intégrée.",
  version: "2.0.0",
  commandCount: 148,

  // Ton lien GitHub (optionnel)
  updateZipUrl: "https://github.com/BlessPrimeNexusDev/NEXO-JARVIS-XMD/archive/refs/heads/main.zip",

  // URL du panneau — auto-détection Render / Railway / Vercel / fallback
  pairApiUrl: process.env.RENDER_EXTERNAL_URL
    ? process.env.RENDER_EXTERNAL_URL
    : process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.PANEL_URL
    || "https://nexo-jarvis-xmd.onrender.com",
};

module.exports = settings;
