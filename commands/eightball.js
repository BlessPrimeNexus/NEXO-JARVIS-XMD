const eightBallResponses = [
    "Oui, sans l'ombre d'un doute, Monsieur.",
    "Négatif.",
    "Veuillez reposer la question ultérieurement.",
    "C'est certain.",
    "Très peu probable.",
    "Sans aucun doute.",
    "Ma réponse est non.",
    "Les indices pointent vers un oui."
];

async function eightBallCommand(sock, chatId, question) {
    if (!question) {
        await sock.sendMessage(chatId, { text: 'Veuillez poser une question !' });
        return;
    }

    const randomResponse = eightBallResponses[Math.floor(Math.random() * eightBallResponses.length)];
    await sock.sendMessage(chatId, { text: `🎱 ${randomResponse}` });
}

module.exports = { eightBallCommand };
