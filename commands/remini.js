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

async function reminiCommand(sock, chatId, message, args) {
    try {
        let imageUrl = null;
        
        // Check if args contain a URL
        if (args.length > 0) {
            const url = args.join(' ');
            if (isValidUrl(url)) {
                imageUrl = url;
            } else {
                return sock.sendMessage(chatId, { 
                    text: '❌ L\'URL fournie n\'est pas valide, Monsieur.\n\nUtilisation : `.remini https://example.com/image.jpg`' 
                }, { quoted: message });
            }
        } else {
            // Try to get image from message or quoted message
            imageUrl = await getQuotedOrOwnImageUrl(sock, message);
            
            if (!imageUrl) {
                return sock.sendMessage(chatId, { 
                    text: '📸 *Amélioration d\'image (Remini)*\n\nUtilisation :\n• `.remini <image_url>`\n• Répondez à une image avec `.remini`\n• Envoyez une image avec `.remini`\n\nExemple : `.remini https://example.com/image.jpg`' 
                }, { quoted: message });
            }
        }

        // Call the Remini API
        const apiUrl = `https://api.princetechn.com/api/tools/remini?apikey=prince_tech_api_azfsbshfb&url=${encodeURIComponent(imageUrl)}`;
        
        const response = await axios.get(apiUrl, {
            timeout: 60000, // 60 second timeout (AI processing takes longer)
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });


        if (response.data && response.data.success && response.data.result) {
            const result = response.data.result;
            
            if (result.image_url) {
                // Download the enhanced image
                const imageResponse = await axios.get(result.image_url, {
                    responseType: 'arraybuffer',
                    timeout: 30000
                });
                
                if (imageResponse.status === 200 && imageResponse.data) {
                    // Send the enhanced image
                    await sock.sendMessage(chatId, {
                        image: imageResponse.data,
                        caption: '✨ *Image améliorée avec succès, Monsieur.*\n\nAméliorée par NEXO-JARVIS XMD'
                    }, { quoted: message });
                } else {
                    throw new Error('Le téléchargement de l\'image améliorée a échoué');
                }
            } else {
                throw new Error(result.message || 'L\'amélioration de l\'image a échoué');
            }
        } else {
            throw new Error('API returned invalid response');
        }

    } catch (error) {
        console.error('Remini Error:', error.message);
        
        let errorMessage = '❌ L\'amélioration de l\'image a échoué, Monsieur.';
        
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
        } else if (error.message.includes('Error processing image')) {
            errorMessage = '❌ Le traitement de l\'image a échoué. Essayez avec une autre image, Monsieur.';
        }
        
        await sock.sendMessage(chatId, { 
            text: errorMessage 
        }, { quoted: message });
    }
}

// Helper function to validate URL
function isValidUrl(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

module.exports = { reminiCommand };
