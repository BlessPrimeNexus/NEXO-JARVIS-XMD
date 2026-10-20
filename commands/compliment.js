const compliments = [
    "Vous êtes remarquable tel que vous êtes.",
    "Votre sens de l'humour est excellent.",
    "Vous êtes d'une grande bienveillance.",
    "Vous êtes plus puissant que vous ne le pensez.",
    "Vous illuminez la pièce.",
    "Vous êtes un véritable ami.",
    "Vous m'inspirez, et je ne dis pas cela à la légère.",
    "Votre créativité ne connaît aucune limite.",
    "Vous avez un cœur en or.",
    "Vous changez le monde, à votre échelle.",
    "Votre positivité est contagieuse.",
    "Votre éthique de travail est impressionnante.",
    "Vous révélez le meilleur chez les autres.",
    "Votre sourire éclaire la journée de tous.",
    "Vous excellez dans tout ce que vous entreprenez.",
    "Votre gentillesse rend le monde meilleur.",
    "Votre point de vue est unique et précieux.",
    "Votre enthousiasme est véritablement inspirant.",
    "Vous êtes capable de grandes choses.",
    "Vous savez toujours faire sentir à quelqu'un qu'il compte.",
    "Votre assurance est admirable.",
    "Vous avez une belle âme.",
    "Votre générosité n'a pas de limites.",
    "Vous avez un remarquable sens du détail.",
    "Votre passion est réellement motivante.",
    "Vous êtes un excellent auditeur.",
    "Vous êtes plus fort que vous ne le croyez.",
    "Votre rire est contagieux.",
    "Vous avez le don de faire sentir aux autres qu'ils comptent.",
    "Le monde est meilleur avec vous, tout simplement."
];

async function complimentCommand(sock, chatId, message) {
    try {
        if (!message || !chatId) {
            console.log('Invalid message or chatId:', { message, chatId });
            return;
        }

        let userToCompliment;
        
        // Check for mentioned users
        if (message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
            userToCompliment = message.message.extendedTextMessage.contextInfo.mentionedJid[0];
        }
        // Check for replied message
        else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
            userToCompliment = message.message.extendedTextMessage.contextInfo.participant;
        }
        
        if (!userToCompliment) {
            await sock.sendMessage(chatId, { 
                text: 'Mentionnez quelqu\'un ou répondez à son message.'
            });
            return;
        }

        const compliment = compliments[Math.floor(Math.random() * compliments.length)];

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

        await sock.sendMessage(chatId, { 
            text: `@${userToCompliment.split('@')[0]}, ${compliment}`,
            mentions: [userToCompliment]
        });
    } catch (error) {
        console.error('Error in compliment command:', error);
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
                    text: 'Une erreur est survenue lors de sending the compliment.'
                });
            } catch (sendError) {
                console.error('Error sending error message:', sendError);
            }
        }
    }
}

module.exports = { complimentCommand };
