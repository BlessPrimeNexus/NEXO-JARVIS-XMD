const fetch = require('node-fetch');

async function memeCommand(sock, chatId, message) {
    try {
        let response = await fetch('https://shizoapi.onrender.com/api/memes/cheems?apikey=shizo');
        if (!response.ok || !(response.headers.get('content-type') || '').includes('image')) {
            response = await fetch('https://meme-api.com/gimme');
            const data = await response.json();
            if (!data.url) throw new Error('Meme fallback returned no image');
            response = await fetch(data.url);
        }
        
        // Check if response is an image
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('image')) {
            const imageBuffer = await response.buffer();
            
            // Les anciens « buttonsMessage » ne sont plus affichés par WhatsApp : image + légende standard.
            await sock.sendMessage(chatId, { 
                image: imageBuffer,
                caption: '> Voici votre meme, Monsieur. 🐕'
            },{ quoted: message});
        } else {
            throw new Error('Type de réponse invalide de l\'API');
        }
    } catch (error) {
        console.error('Error in meme command:', error);
        await sock.sendMessage(chatId, { 
            text: '❌ Je n\'ai pas pu récupérer de meme. Réessayez dans un instant.'
        },{ quoted: message });
    }
}

module.exports = memeCommand;
