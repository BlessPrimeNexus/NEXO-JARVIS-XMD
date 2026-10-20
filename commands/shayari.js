const fetch = require('node-fetch');

async function shayariCommand(sock, chatId, message) {
    try {
        const response = await fetch('https://shizoapi.onrender.com/api/texts/shayari?apikey=shizo');
        const data = await response.json();
        
        if (!data || !data.result) {
            throw new Error('Invalid response from API');
        }

        // Les anciens « buttonsMessage » ne sont plus affichés par WhatsApp : message texte standard.
        await sock.sendMessage(chatId, { 
            text: data.result
        }, { quoted: message });
    } catch (error) {
        console.error('Error in shayari command:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Je n\'ai pas pu récupérer de shayari. Réessayez dans un instant.',
        }, { quoted: message });
    }
}

module.exports = { shayariCommand }; 