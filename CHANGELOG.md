# Changements — révision « créateur »

## Barre de progression réparée, boutons sur toutes les réponses, thèmes

- **Barre de progression** : elle restait à 0 % car, en « mode image », le premier message était converti en photo + légende (WhatsApp ne peut pas modifier une photo avec du texte). Le message de progression reste maintenant un vrai texte (drapeau `__edittext`), et ses modifications ont la même police et la même langue que le message d'origine.
- **Boutons d'action sur TOUTES les réponses de commande** (`lib/actions.js`) : réglages de la commande quand elle en a (antilink, welcome, mode…), sinon actions de sa catégorie (relancer, commandes voisines, menu de la catégorie, menu principal). Fonctionne pour les réponses texte, photo et vidéo légendées. Les audios, stickers et documents ne peuvent pas porter de boutons dans WhatsApp. Les erreurs gardent seulement la navigation. Pas de « Relancer » sur les commandes sensibles (kick, ban, gamble…).
- **Thèmes** (`.theme`, réservé au propriétaire de la session, réglage propre à chaque numéro) : Jarvis (défaut), Escanor, Sung Jin-woo, Spider-Man, Zero Two, Gojo, Sakura. Un thème change les images (dossier `themes/<nom>/`, 5 images originales par thème) et le style des réponses (cadres, puces, séparateurs). Tout dossier `themes/<nom>/` contenant des images devient un thème supplémentaire.


## Textes superflus supprimés, .repo refait, téléchargements avec aperçu, boutons et barre de progression

- **Textes superflus retirés partout** : signatures « © 2026 … conçu par … », « ©Power by », « POWERED BY », « DOWNLOADED BY », « Téléchargé par… », pieds de page et phrases d'aide inutiles (commandes de groupe, sudo, tagall, viewonce, github, url, tiktok, instagram, facebook…). Un test empêche leur retour.
- **.repo** refait au style de `.owner` (fiche + photo + boutons « Code source GitHub », « Panneau de connexion », « Copier le lien », « Menu ») ; **.github** au même style. Liens corrigés : dépôt `https://github.com/BlessPrimeNexus/NEXO-JARVIS-XMD` et panneau `https://nexo-jarvis-xmd-production.up.railway.app` (`settings.repoUrl` / `settings.panelUrl`).
- **Téléchargements YouTube** (`.song`, `.play`, `.mp3`, `.ytmp3`, `.video`, `.ytmp4`) : le bot affiche d'abord l'aperçu de ce qui a été trouvé (miniature de la vidéo, titre, chaîne, durée, vues) avec des boutons de format : Audio MP3, Audio en document, Vidéo 360p / 480p / 720p, Vidéo en document, Ouvrir / Copier le lien.
- **Barre de progression** : un seul message qui se modifie (`██████░░░░ 61%`), puis il est supprimé quand le média est livré (YouTube, Spotify, TikTok, Instagram, Facebook, stories). Spotify : fiche avec pochette et boutons.


## Menu épuré et images au thème Jarvis

- **Menu principal** : suppression des textes superflus (phrase « Touchez… », pied de page « À utiliser avec responsabilité | … », phrase d'accroche). Il reste le titre, la salutation, le bloc « INFORMATIONS DU BOT » et les boutons.
- **Images du bot** : les 10 images de `jarvis-images/` sont remplacées par 10 images originales au thème « interface futuriste rouge et or » (noyau d'énergie, radar, grille hexagonale, circuit, hologrammes, orbites, verrouillage, fréquences vocales, plaques, ville). Pour utiliser tes propres images, dépose des `.jpg` / `.png` dans `jarvis-images/` : le bot les fait tourner automatiquement.


## Drapeaux, nouvelles images, annonce à tous les comptes

- **Site web** : les drapeaux de pays sont de nouveau affichés (sélecteur de pays et champ du numéro).
- **Images du bot** : les 10 images de `jarvis-images/` (trop sombres) sont remplacées par 10 nouvelles images lumineuses en 1200×630 : aurore, coucher de soleil, océan, bokeh menthe, polygones violets, corail, ciel, heure dorée, montagnes émeraude, verre néon.
- **Nouvelle commande `.sendall <message>`** (alias `.notifyall`) : réservée à l'administrateur de la plateforme ; envoie une annonce à TOUS les comptes connectés au bot au même moment (dans la discussion avec soi-même de chaque compte, dans la langue de chaque session). `.sendall test <message>` n'envoie qu'à ton propre compte (essai) ; on peut aussi répondre à un texte avec `.sendall`. Un rapport « envoyé à X/Y » est renvoyé.


## Sessions isolées (un numéro = un bot indépendant) et site sans emoji

- **Bug corrigé : deux numéros partageaient les mêmes réglages.** Tous les réglages étaient dans des fichiers uniques de `data/`. Chaque numéro connecté a maintenant ses propres réglages dans `data/sessions/<numéro>/` : mode public/privé, préfixe, langue, protections de groupe (antilink, antibot…), bienvenue, antidelete, autoread, sudo, bannis, avertissements, économie, notes, chatbot… (`lib/sessionContext.js`).
- Chaque événement WhatsApp s'exécute dans le contexte de sa session ; les compteurs et minuteries en mémoire (antiflood, hijack, chatbot…) sont aussi séparés.
- **Droits** : le compte connecté est propriétaire de SON bot (réglages, langue, sudo). Les commandes de la plateforme (`.panel`, `.restart`, `.sessions`, `.update`, `.ram`, `.logs`, `.config`…) restent réservées au développeur (`settings.ownerNumbers`).
- **Migration** : les anciens réglages globaux sont recopiés une seule fois vers la session du propriétaire principal (`settings.ownerNumber`, ou `LEGACY_DATA_SESSION`). Les autres numéros démarrent à neuf.
- Fichiers restés communs : cache de traduction, cookies yt-dlp, cache de la chaîne, configuration du panneau, journal des messages (clés séparées par session).
- **Site web** : plus aucun emoji ; toutes les icônes sont de vraies icônes SVG (fonctionnalités, catégories de commandes, états, boutons) et les drapeaux sont remplacés par le code pays.


## Refonte du site de connexion (partie web)

- **Nouveau design** clair / sombre (bouton de thème, mémorisé), responsive mobile, accessible.
- **Connexion améliorée** : sélecteur de pays avec drapeaux et recherche, détection d'un numéro collé en format international, suppression du 0 initial, code affiché en cases, copie en un clic, minuteur « généré il y a… », bouton Ouvrir WhatsApp, « Nouveau code », numéro mémorisé sur l'appareil (effaçable).
- **Vérifier l'état de ma connexion** (via `/status`), état du service en direct (`/health`, `/ping`), mention claire du suivi automatique de la chaîne.
- **Explorateur de commandes** avec recherche et catégories, alimenté par la nouvelle route `/api/commands` (même catalogue que le menu du bot) ; route `/api/site` (nom, chaîne, contact créateur).
- Sections : comment ça marche, fonctionnalités, bandeau chaîne officielle, FAQ, bouton WhatsApp flottant.
- Aucune modification de la logique de jumelage (`/code`, `/session`) : seules deux routes d'affichage ont été ajoutées à `web.js`.


## Auto-follow, boutons welcome, menu en français, langue partout

- **Auto-follow de la chaîne** (`lib/autoFollow.js`) : tout compte qui se connecte (site de connexion / code de couplage, commande `.pair`, reconnexion) suit automatiquement la chaîne officielle. Tentatives répétées (2 s, 15 s, 1 min, 5 min, 15 min) tant que le suivi n'est pas confirmé ; « déjà abonné » compte comme un succès ; un échec n'est plus mémorisé. Commande manuelle : `.followchannel`.
- **Boutons d'action** : un clic sur une ligne (ex. `.welcome on`) est maintenant transformé en vrai texte de commande avant traitement. Avant, `welcome`/`goodbye` relisaient un message vide et renvoyaient l'aide générale.
- **Menu 100 % français** (titre de liste, « Visiter mon créateur », salutation, « INFORMATIONS DU BOT », pied de page, heure en 24 h).
- **Langue** : `.lang en` traduit aussi les sondages et les titres d'aperçu, en plus des textes, légendes, boutons et listes ; dictionnaire anglais complété pour le menu.


## Correctifs antibot / boutons d'action / menu

- **Antibot réparé** : `lib/botInstance.js` jetait les messages des autres bots (ID `BAE5…`) avant les protections. Nouveau moteur `lib/antibot.js` : détection par ID Baileys, boutons natifs, aperçu publicitaire et bots appris ; actions `delete` / `kick` ; alerte si le bot n'est pas admin ; commandes `.antibot on|off|mode|add|remove|list|status`.
- **Boutons d'action** (`lib/actions.js`) : les commandes à plusieurs options répondent avec un bouton « ⚡ Actions » (antilink, antitag, antibot, antibadword, anti*, welcome, goodbye, chatbot, autoread, autotyping, autostatus, mode, menustyle, lang, hijack, sudo, slowmode…).
- **Menu** : 31 catégories identiques aux captures (liste « Please select any category », « Visit My Creator », « Voir toutes les options »), présentation « bot multi device » avec bloc INFORMATION BOT.
- **Nouvelles commandes** (`lib/extraCommands.js`) : économie, religion, santé, cyber, notes, diffusion, apk, recherche, profil, conversion, aléatoire, météo, premium.
- **Protections** : antilink / antimedia / antisticker / antivoice / antiflood préviennent quand le bot n'est pas admin ; antimedia ne supprime plus les stickers ni les vocaux ; antibadword : faux positifs retirés, insultes françaises ajoutées.
- Fichiers `data/*.json` alignés sur les clés lues par le code.


## Affichage (messages invisibles chez certains membres)
- Cause probable du test 3 : l'aperçu d'image utilisait `thumbnailUrl` (lien catbox à télécharger par chaque téléphone).
  Désormais : miniature JPEG intégrée au message, lue depuis `jarvis-images/`. Aucun lien distant, rien d'enregistré chez les membres.
- Aperçu, bouton « Voir la chaîne » et fausse citation sur TOUS les messages du bot (erreurs comprises).
- Anciens boutons WhatsApp (`buttons`, `templateButtons`) retirés automatiquement.
- `.preview on|off` pour couper l'aperçu ; `.viewtest` passe à 9 tests (le 9 = format exact du vrai menu).

## Révision 18 — plus aucune bordure
- Toutes les boîtes `╭═『 』═╮ … ╰═══╯` et leurs barres `│` sont supprimées (elles se coupaient ou se désalignaient selon le téléphone).
  Style unique et classique, partout (menus, ping, sessions, panel, erreurs, anciens cadres convertis automatiquement) :
  `✦『 👑 Titre 』✦` · `  ◇ Libellé → valeur` · `  ◈ .commande` · `  ✦ ──────────────── ✦`.
- Les emoji des libellés sont retirés des lignes (ils restent dans les titres) ; les menus ne gardent que `◈ .commande`.

## Révision 17 — réponses plus nettes
- **Bordures** : la ligne du bas des boîtes est courte et fixe (`╰════════════╯`) ; plus longue, WhatsApp la coupait et le `╯` tombait
  sur la ligne suivante. Les valeurs longues des en-têtes (ex. propriétaire) passent à la ligne proprement.
- **Moins de texte** : plus de signature « NEXO ⤫ JARVIS », plus de pied de message (« ©Power by… »), plus de « , Monsieur » en fin de
  phrase, plus de phrases d'accompagnement sous les réponses. Rétablissables : `.config set replyNotes on`.
- Menu : en-tête sans ligne redondante, aucune phrase après les boîtes. Le conseil de `.dltest` reste affiché (dans une boîte « Conseil »).

## Révision 16 — nouveau design de toutes les réponses (style WEED-X)
- **Design unique** (`lib/style.js`), inspiré du menu WEED-X : en-tête `✦『 🤖 Titre 』✦` avec lignes `◇ Libellé → valeur`, boîtes classées
  `╭═『 ⚙️ Section 』═╮` avec puces `◈ .commande`, signature `⛨ NEXO ⤫ JARVIS`, police monospace (𝙼𝚎𝚗𝚞) pour titres, libellés et commandes.
- Appliqué à TOUTES les réponses : menus (`.menu`, sous-menus, `.allmenu` = toutes les catégories en boîtes), ping, alive, stats, sessions,
  owner, panel, RAM, disque, test des sources ; les réponses brutes (erreurs, confirmations) et les anciens cadres des autres commandes sont
  convertis automatiquement. Longues valeurs renvoyées à la ligne sans déborder.
- La police monospace s'applique juste avant l'envoi (après traduction) : `.lang en` continue de tout traduire.
- Statut de chaîne : supprimé (`.chstatut` et le mode chaîne de `.addstatut` retirés).
- Téléchargements : `mweb` essayé en premier (le seul client qui répondait au test `.dltest`), audio limité à ~160 kbit/s (fichiers plus légers).

## Révision 15 — téléchargements, statut de chaîne
- **Channel Status (le vrai statut éphémère de chaîne)** : fonction récente de WhatsApp (déploiement progressif décidé par WhatsApp), aucun
  support dans Baileys → impossible pour un bot aujourd'hui. Le bot n'envoie donc plus de publications normales sans demande explicite :
  `.chstatut on <lien> post` et `.addstatut <lien> post <texte>` (post permanent). Sans le mot « post », explication et rien n'est publié.
  Les anciennes activations sont ignorées.
- **`.song` / `.play` / `.video` ne marchaient plus** : toutes les sources étaient des API gratuites (qui tombent) + ytdl-core (bloqué par YouTube).
  Nouvelle chaîne : yt-dlp (binaire téléchargé automatiquement, clients YouTube tv / web_safari / mweb…, cookies facultatifs `YT_COOKIES_B64`),
  puis les API, puis SoundCloud avec la même recherche, puis ytdl-core. Sources en échec répété mises de côté 10 min (fini les 9 × 20 s d'attente).
  `.video` utilise aussi yt-dlp.
- **`.dltest`** (propriétaire, menu panel) : teste chaque source une par une et affiche la vraie cause (ex. « YouTube bloque cette adresse »).

## Révision 14 — .addstatut : chaînes + nettoyage de la commande
- **Nettoyage automatique** : après la publication et la confirmation du bot, le message de commande est supprimé du groupe
  (y compris la vidéo / image qu'il portait en légende, et le média cité s'il a été envoyé par la même personne). Si le bot n'est pas
  admin, il le dit. En cas d'échec de publication, RIEN n'est supprimé.
- **Chaînes WhatsApp** (`commands/channelStatus.js`) : `.chstatut on <lien>` (propriétaire) active une chaîne dont le compte du bot est
  admin/propriétaire (vérifié) et abonne le bot à ses publications ; ensuite, « .addstatut texte » (ou avec image / vidéo) écrit DANS
  la chaîne est republié proprement puis la commande est retirée. Règles de prudence : aucune réponse publique du bot dans la chaîne
  (confirmations en privé), publication sans citation / transfert / aperçu / boutons, suppression seulement après réussite, anciennes
  publications et doublons ignorés, écho de ses propres publications ignoré, file d'attente espacée de 3 s par chaîne.
- Depuis une discussion : `.addstatut <lien de la chaîne> <texte>` (propriétaire) publie dans cette chaîne sans l'activer.

## Révision 13 — boutons grisés, langue totale
- **Boutons grisés avant même d'appuyer** : WhatsApp désactive les boutons de réponse rapide (quick_reply) pour l'EXPÉDITEUR du
  message, et le téléphone du bot est celui de l'expéditeur. La liste déroulante et les liens restent actifs. Tous les boutons de
  réponse rapide sont maintenant regroupés dans une liste « ⚡ Actions » (menu, sessions, panel, confirmations, langue…) :
  ils fonctionnent depuis le téléphone du bot comme depuis celui des membres.
- **`.lang en` traduit VRAIMENT tout** : dictionnaire du bot + traduction automatique (Google Translate, comme `.translate`) pour tout
  ce qui reste en français, en une requête par message, avec cache `data/translations.json`. Protégés : commandes, liens, mentions,
  `<paramètres>`, blocs ```, noms propres. Service injoignable → le message part avec le dictionnaire (jamais de blocage).
  Boutons, listes, légendes et cartes inclus. Seules les réponses libres de l'IA/chatbot ne sont pas traduites.

## Révision 12 — PANEL, sessions réellement supprimées, mémoire, langue
- **Menu `.panelmenu` / `.panel`** (propriétaire) : console du bot depuis WhatsApp — `.panel` (tableau de bord + liste de sections),
  `.sessions`/`.delsession`, `.ram`, `.gc`, `.logs [n] [err]`, `.disk`, `.config get|set|reset`, `.owners add|remove`, `.lang`, `.restart`,
  `.cleartmp`, `.clearsession`, `.update`, `.stats`. Toutes testées en conditions réelles de fichiers (réglages, propriétaires, langue, disque).
  Pas de `.shell` volontairement : exécuter n'importe quelle commande système depuis WhatsApp est trop dangereux.
- **Sessions** : `.sessions remove <n°>` supprime tout de suite et VÉRIFIE (instance arrêtée, dossier effacé, fiche libérée, web.js prévenu) ;
  il annonce un échec s'il reste quelque chose. Le bouton « Supprimer » passe par une confirmation (`ask`). Bug « il y a NaN j » corrigé.
  Les boutons grisés après un appui sont un comportement de WhatsApp (un bouton rapide ne sert qu'une fois).
- **RAM** : démarrage avec `--max-old-space-size` (512 Mo par défaut, `MAX_HEAP_MB`) et `--expose-gc` ; protection `lib/memoryGuard.js`
  (mesure toutes les 30 s, vide les caches au-delà de `MEM_SOFT_MB`=350 Mo, GC forcé toutes les 2 min, `MEM_HARD_MB` = redémarrage propre
  optionnel) ; stores allégés (10 messages × 300 discussions au lieu de 20 × 2000) ; `.ram` / `.gc` pour suivre et libérer.
- **Langue** : `.lang en|fr` traduit menus, panels, cartes, boutons et erreurs courantes (dictionnaire `lib/i18n.js`). Les textes absents du
  dictionnaire restent en français ; les réponses libres de l'IA ne sont pas traduites.

## Révision 11 — messages invisibles chez certains membres (cause trouvée)
- **Cause n°1 (preuve : `.viewtest`)** : tous les formats de test étaient visibles par tout le monde SAUF le test 3, l'aperçu
  de lien (`externalAdReply`). Le correctif précédent n'enlevait que le lien distant, pas l'aperçu lui-même ; or les messages
  à boutons (`.idch`, `.sessions`, menus sans photo) ajoutaient encore cet aperçu → invisibles chez certains téléphones.
  Désormais : aperçu DÉSACTIVÉ par défaut (`previewImage: false`), retiré même quand une commande en fournit un.
  Les vraies images (`.imagemode`) et le bouton « Voir la chaîne » / fausse citation (testés visibles) restent.
- **Cause n°2 (bug connu de Baileys 7, issues #2297 / #2704, présent dans rc14 = dernière version)** : le bot ne renvoie plus sa clé
  de groupe à un membre qui a changé de téléphone / réinstallé WhatsApp (surtout iPhone) → ce membre ne voit plus aucune
  réponse. Contournement documenté intégré : mémoire `sender-key-memory` effacée au 1er envoi dans chaque groupe après démarrage,
  puis au plus 1×/heure (`SENDER_KEY_RESET_MINUTES`, 0 = off). Nouvelle commande `.fixgroup` (admins) pour le forcer.
- Menu : ajout de `.fixgroup`, `.demoteadmin`, `.channelalert`, `.oogway2`, `.animuquote` et des commandes pays.

## Révision 10 — statuts de groupe en média, .del
- `.addstatut` image / vidéo : l'envoi partait sans type de média (détecté seulement à la racine du message par Baileys) ;
  WhatsApp ignorait le statut sans erreur. Correctif ciblé (le média n'est visible que pour la détection de type, jamais pour
  l'encodage, donc aucun risque de doublon dans la discussion) + diagnostic dans les journaux (`[addstatut] diagnostic : …`).
- `.del` réécrit : réservé aux admins du groupe/propriétaire (avant : n'importe quel membre pouvait l'utiliser),
  le bot doit être admin. `.del` en réponse = ce message ; `.del 4` = 4 derniers du groupe ; `.del @membre` = tous ses messages ;
  `.del @membre 8` ou `.del 8` en réponse = ses 8 derniers ; `.del all` en réponse = tous ceux de l'auteur. Max 100 par commande.
- Nouveau journal `lib/messageLog.js` (identifiants des messages de groupe vus, sauvegardé sur disque) : le bot ne peut supprimer
  que les messages qu'il a vus, même après un redémarrage. Gère les identifiants LID.

## Révision 9 — .idch en carte, .addstatut
- `.idch` : une seule carte (nom, abonnés, date, JID) sans description, avec le bouton « 📋 Copier le JID » (et « Ouvrir la chaîne »).
  Le bouton « copier » ne déclenche plus de message d'erreur quand il ne s'agit pas d'un lien.
- `.addstatut` (alias `.gstatus`, `.statutgroupe`) : publie un statut de groupe (texte, image ou vidéo, ou réponse à un message),
  réservé aux admins du groupe et au propriétaire. Nécessite une version de Baileys qui gère `groupStatusMessageV2`
  (vérifié avant l'envoi, message clair sinon).

## Révision 8 — .idch
- `.idch <lien de la chaîne>` : renvoie le JID (…@newsletter), le nom, les abonnés et la date de création d'une chaîne WhatsApp.
  Accepte le lien, le code seul, ou un lien dans le message cité. Disponible pour tous, listée dans `.toolsmenu`.

## Révision 7 — clics de boutons
- Cause probable des boutons « sans réaction » : certains téléphones n'envoient que le TEXTE du bouton (« 🔄 Actualiser »)
  sans la commande ; seul le texte des lignes de menu était reconnu. Nouveau registre (`lib/buttonRegistry.js`) :
  chaque bouton envoyé est mémorisé (par message, puis par discussion) et les boutons fixes sont connus d'avance,
  donc tous les clics sont compris (menu, sessions, confirmations, ping…), même après un redémarrage pour les boutons fixes.
- Si une réponse de bouton reste illisible, le contenu brut est écrit dans les journaux (`[bouton] réponse de bouton non reconnue`).
- `.owner` : un seul message (la carte). Le contact à enregistrer est désactivé par défaut (`ownerSendContact`).

## Révision 6 — propriétaire strict, cartes courtes
- Nouveau contrôle propriétaire unique (`lib/ownerAuth.js`) : numéros dans `settings.ownerNumbers`
  (243802506198 et 243822993775, ou variable `OWNER_NUMBERS`), identifiants anonymes `@lid` traduits
  (participantAlt, table Baileys, participants du groupe).
- Faille corrigée : un message envoyé depuis N'IMPORTE quelle session connectée (`fromMe`) valait « propriétaire ».
  Désormais seules les sessions des numéros propriétaires comptent.
- Commandes réservées (`.sessions`, `.sudo`, `.update`, `.mode`, `.settings`, `.stats`, `.viewtest`, `.menustyle`,
  `.imagemode`, `.replystyle`, `.preview`, `.quotecard`, `.autoread`, `.setpp`, `.clearsession`, `.cleartmp`, `.pmblocker`,
  `.anticall`, `.fakeract`…) : refusées avant exécution pour tout autre expéditeur ; `.sudo`, `.update`, `.mode` : propriétaire seul.
- Le numéro en dur dans `lib/isOwner.js` est remplacé par la liste configurable.
- Largeur des lignes recalculée (lettres en gras mathématique et emoji comptés plus larges) ; `.owner` raccourci :
  nom, rôle, contact + boutons (les liens sont dans les boutons, plus dans le texte).

## Révision 5 — gestion des sessions
- `.sessions` (propriétaire) : liste des sessions (✅ en ligne / ⚪ hors ligne / ⏳ couplage) avec boutons ;
  `.sessions info <n°>`, `.sessions remove <n°>` (confirmation par bouton, déconnecte l'appareil et efface les fichiers),
  `.sessions restart <n°>`, `.sessions purge` (supprime tous les hors ligne). Alias : `.session`, `.delsession`.

## Révision 4 — carte du développeur
- `.owner` : carte complète (nom, rôle, projet, version, contact, liens) en un message à boutons
  (Contacter / Voir la chaîne / Site / Menu), suivie du contact WhatsApp complet (vCard avec organisation, titre, liens).
  Réglable dans settings.js : ownerRole, ownerBio, ownerWebsite, ownerSendContact.

## Révision 3 — groupes, cadre propre, menu
- Filet de sécurité d'envoi : si WhatsApp refuse une réponse décorée (image, citation, aperçu), elle repart en version
  plus simple au lieu de « Diagnostic impossible » ; la vraie cause s'affiche dans les journaux Railway
  (« envoi décoré refusé vers un groupe : … »). Après 3 refus d'image, le mode image se coupe tout seul.
- Cadre propre : retour à la ligne automatique (chaque ligne garde sa barre │, plus de lettre qui déborde),
  suppression des bordures droites, pied de cadre unique.
- Menu : en-tête compact en fiche (icônes, valeurs en gras, durées courtes), icônes devant chaque catégorie.

## Révision 2 — images réelles, design unique
- `.imagemode on|off` (activé par défaut, solution temporaire) : chaque réponse courte part comme VRAIE image + légende ;
  le menu a la photo en tête. ⚠️ ces photos peuvent s'enregistrer dans la galerie des membres.
- `.replystyle on|off` : cadre unique appliqué automatiquement à toutes les réponses texte, et conversion des anciens
  cadres (┃⌬┃, ╭━⌜…⌟) en un seul design. Les réponses IA/chatbot restent en texte libre.
- Menu : plus aucun doublon (lien de la chaîne une fois, « ©Power by » une fois, dans le pied du message).
- `.ping`, `.alive`, `.stats` redessinés (plus de bordure droite désalignée ni de ligne « > »).
- `.viewtest` passe à 10 tests (le 10 = vraie image + légende).

## Chaîne
- Nouveau lien `https://whatsapp.com/channel/0029Vb78ycrInlqYocbYLX0P` (source unique : `lib/channel.js`).
- Le JID `@newsletter` est résolu automatiquement à la connexion (ou forcé via `CHANNEL_JID`).

## Menu
- UN SEUL message : menu stylé + liste déroulante + boutons + bouton chaîne. Raccourcis `.groupmenu`, `.downloadmenu`, etc.
- Le menu ne liste que des commandes réellement branchées (vérifié par `test/menu-routes.test.js`).

## Corrections
- `.demote` (export manquant) + annonce de rétrogradation ; `.move` ; anti-appel (clé `activé`/`enabled`) ;
  `removebg`, `myfunc`, `ytdl2` (variables non définies) ; jeux (hangman/trivia) attendus et traduits ; météo en français.
- `.ai` et `.gif` branchés.

## Nouvelles commandes (sans clé d'API)
calc, percent, random, dice, flip, choose, date, time, age, countdown, uptime, upper, lower, reverse, count, encode, decode, password, qr.
