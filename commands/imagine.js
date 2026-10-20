const { generateImage } = require('../lib/aiClient');

async function imagineCommand(sock, chatId, message) {
    try {
        // Get the prompt from the message
        const prompt = message.message?.conversation?.trim() || 
                      message.message?.extendedTextMessage?.text?.trim() || '';
        
        // Remove the command prefix and trim
        const imagePrompt = prompt.slice(8).trim();
        
        if (!imagePrompt) {
            await sock.sendMessage(chatId, {
                text: 'Précisez une description pour générer l\'image, Monsieur.\nExemple : .imagine a beautiful sunset over mountains'
            }, {
                quoted: message
            });
            return;
        }

        // Send processing message
        await sock.sendMessage(chatId, {
            text: '🎨 Génération de l\'image lancée. Je vous informerai une fois l\'opération terminée.'
        }, {
            quoted: message
        });

        // Enhance the prompt with quality keywords
        const enhancedPrompt = enhancePrompt(imagePrompt);

        // Génération (cascade de fournisseurs, voir lib/aiClient.js)
        const result = await generateImage(enhancedPrompt);
        if (!result) {
            await sock.sendMessage(chatId, {
                text: 'Une anomalie a été détectée. Aucun service de génération d\'images n\'a répondu, Monsieur. Réessayez dans un instant.'
            }, { quoted: message });
            return;
        }

        // Image générée : c'est le contenu demandé, elle est donc envoyée comme image.
        await sock.sendMessage(chatId, {
            image: result.buffer,
            caption: `🎨 Image générée pour la description : « ${imagePrompt} »`
        }, {
            quoted: message
        });

    } catch (error) {
        console.error('Error in imagine command:', error);
        await sock.sendMessage(chatId, {
            text: '❌ La génération de l\'image a échoué. Réessayez dans un instant.'
        }, {
            quoted: message
        });
    }
}

// Function to enhance the prompt
function enhancePrompt(prompt) {
    // Quality enhancing keywords
    const qualityEnhancers = [
        'high quality',
        'detailed',
        'masterpiece',
        'best quality',
        'ultra realistic',
        '4k',
        'highly detailed',
        'professional photography',
        'cinematic lighting',
        'sharp focus'
    ];

    // Randomly select 3-4 enhancers
    const numEnhancers = Math.floor(Math.random() * 2) + 3; // Random number between 3-4
    const selectedEnhancers = qualityEnhancers
        .sort(() => Math.random() - 0.5)
        .slice(0, numEnhancers);

    // Combine original prompt with enhancers
    return `${prompt}, ${selectedEnhancers.join(', ')}`;
}

module.exports = imagineCommand; 