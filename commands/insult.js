const insults = [
    "Vous êtes comme un nuage : quand vous disparaissez, la journée devient magnifique.",
    "Vous apportez tant de joie à chaque fois que vous quittez la pièce.",
    "Je serais d'accord avec vous, mais nous aurions alors tort tous les deux.",
    "Vous n'êtes pas stupide ; vous manquez simplement de chance lorsque vous réfléchissez.",
    "Vos secrets sont en sécurité avec moi : je ne les écoute jamais.",
    "Vous êtes la preuve que même l'évolution fait parfois une pause.",
    "Vous avez quelque chose sur le menton... non, le troisième en partant du haut.",
    "Vous ressemblez à une mise à jour logicielle : à chaque fois, je me demande si j'en ai vraiment besoin maintenant.",
    "Vous rendez tout le monde heureux... enfin, quand vous partez.",
    "Vous êtes comme une pièce de monnaie : à double face et de peu de valeur.",
    "Vous avez quelque chose en tête... non, laissez tomber.",
    "Vous êtes la raison pour laquelle il y a un mode d'emploi sur les flacons de shampooing.",
    "Vous êtes comme un nuage : toujours à flotter sans but précis.",
    "Vos blagues sont comme du lait périmé : aigres et difficiles à digérer.",
    "Vous êtes comme une bougie dans le vent... inutile dès que les choses se compliquent.",
    "Vous avez un talent unique : agacer tout le monde de manière équitable.",
    "Vous êtes comme un signal Wi-Fi : faible quand on en a le plus besoin.",
    "Vous prouvez qu'un filtre ne fait pas de miracles.",
    "Votre énergie est un trou noir : elle aspire toute la vie de la pièce.",
    "Vous avez le visage idéal pour la radio.",
    "Vous êtes comme un embouteillage : personne ne vous veut, et pourtant vous voilà.",
    "Vous êtes comme un crayon cassé : sans pointe.",
    "Vos idées sont si originales que je suis certain de les avoir déjà entendues.",
    "Vous êtes la preuve vivante que même les erreurs peuvent être productives.",
    "Vous n'êtes pas paresseux ; vous êtes simplement très motivé pour ne rien faire.",
    "Votre cerveau tourne sous Windows 95 : lent et dépassé.",
    "Vous êtes comme un ralentisseur : personne ne vous aime, mais tout le monde doit composer avec.",
    "Vous êtes comme un nuage de moustiques : simplement irritant.",
    "Vous réunissez les gens... pour parler de votre côté agaçant."
];

async function insultCommand(sock, chatId, message) {
    try {
        if (!message || !chatId) {
            console.log('Invalid message or chatId:', { message, chatId });
            return;
        }

        let userToInsult;
        
        // Check for mentioned users
        if (message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
            userToInsult = message.message.extendedTextMessage.contextInfo.mentionedJid[0];
        }
        // Check for replied message
        else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
            userToInsult = message.message.extendedTextMessage.contextInfo.participant;
        }
        
        if (!userToInsult) {
            await sock.sendMessage(chatId, { 
                text: 'Mentionnez quelqu\'un ou répondez à son message.'
            });
            return;
        }

        const insult = insults[Math.floor(Math.random() * insults.length)];

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

        await sock.sendMessage(chatId, { 
            text: `@${userToInsult.split('@')[0]}, ${insult}`,
            mentions: [userToInsult]
        });
    } catch (error) {
        console.error('Error in insult command:', error);
        if (error.data === 429) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            try {
                await sock.sendMessage(chatId, { 
                    text: 'Veuillez réessayer dans quelques secondes.'
                });
            } catch (retryError) {
                console.error('Error sending retry message:', retryError);
            }
        } else {
            try {
                await sock.sendMessage(chatId, { 
                    text: 'Une anomalie a été détectée lors de l\'envoi.'
                });
            } catch (sendError) {
                console.error('Error sending error message:', sendError);
            }
        }
    }
}

module.exports = { insultCommand };
