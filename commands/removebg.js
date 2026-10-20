const axios = require('axios');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { uploadImage } = require('../lib/uploadImage');

async function getQuotedOrOwnImageUrl(sock, message) {
    // 1) Quoted image (highest priority)
    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (quoted?.imageMessage) {
        const stream = await downloadContentFromMessage(quoted.imageMessage, 'image');
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        const buffer = Buffer.concat(chunks);
        return await uploadImage(buffer);
    }

    // 2) Image in the current message
    if (message.message?.imageMessage) {
        const stream = await downloadContentFromMessage(message.message.imageMessage, 'image');
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        const buffer = Buffer.concat(chunks);
        return await uploadImage(buffer);
    }

    return null;
}

module.exports = {
    name: 'removebg',
    alias: ['rmbg', 'nobg'],
    category: 'general',
    desc: 'Supprime l\'arrière-plan des images',
    async exec(sock, message, args) {
        try {
            const chatId = message.key.remoteJid;
            let imageUrl = null;
            
            // Check if args contain a URL
            if (args.length > 0) {
                const url = args.join(' ');
                if (isValidUrl(url)) {
                    imageUrl = url;
                } else {
                    return sock.sendMessage(chatId, { 
                        text: '❌ L\'URL fournie n\'est pas valide, Monsieur.\n\nUtilisation : `.removebg https://example.com/image.jpg`' 
                    }, { quoted: message });
                }
            } else {
                // Try to get image from message or quoted message
                imageUrl = await getQuotedOrOwnImageUrl(sock, message);
                
                if (!imageUrl) {
                    return sock.sendMessage(chatId, { 
                        text: '📸 *Détourage d\'arrière-plan*\n\nUtilisation :\n• `.removebg <image_url>`\n• Répondez à une image avec `.removebg`\n• Envoyez une image avec `.removebg`\n\nExemple : `.removebg https://example.com/image.jpg`' 
                    }, { quoted: message });
                }
            }

        
            // Call the remove background API
            const apiUrl = `https://api.siputzx.my.id/api/iloveimg/removebg?image=${encodeURIComponent(imageUrl)}`;
            
            const response = await axios.get(apiUrl, {
                responseType: 'arraybuffer',
                timeout: 30000, // 30 second timeout
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
            });

            if (response.status === 200 && response.data) {
                // Send the processed image
                await sock.sendMessage(chatId, {
                    image: response.data,
                    caption: '✨ *Arrière-plan supprimé avec succès, Monsieur.*\n\nTraité par NEXO-JARVIS XMD'
                }, { quoted: message });
            } else {
                throw new Error('Le traitement de l\'image a échoué');
            }

        } catch (error) {
            console.error('RemoveBG Error:', error.message);
            
            let errorMessage = '❌ Le détourage de l\'arrière-plan a échoué, Monsieur.';
            
            if (error.response?.status === 429) {
                errorMessage = '⏰ Rate limit exceeded. Réessayez plus tard.';
            } else if (error.response?.status === 400) {
                errorMessage = '❌ URL ou format d\'image invalide.';
            } else if (error.response?.status === 500) {
                errorMessage = '🔧 Server error. Réessayez plus tard.';
            } else if (error.code === 'ECONNABORTED') {
                errorMessage = '⏰ Request timeout. Veuillez réessayer.';
            } else if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
                errorMessage = '🌐 Erreur réseau. Vérifiez votre connexion, Monsieur.';
            }
            
            await sock.sendMessage(chatId, { 
                text: errorMessage 
            }, { quoted: message });
        }
    }
};

// Helper function to validate URL
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}
