'use strict';

const { askAI } = require('../lib/aiClient');

// .gpt / .gemini — questions à l'intelligence artificielle (cascade de fournisseurs, voir lib/aiClient.js)
async function aiCommand(sock, chatId, message) {
    try {
        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || '';
        const parts = text.trim().split(/\s+/);
        const command = (parts[0] || '').toLowerCase();
        const query = parts.slice(1).join(' ').trim();

        if (!query) {
            return await sock.sendMessage(chatId, {
                text: 'Posez votre question après la commande, Monsieur.\n\nExemple : *.gpt explique-moi la relativité en deux phrases*'
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, { react: { text: '🤖', key: message.key } });

        const result = await askAI(query, { prefer: command === '.gemini' ? 'gemini' : undefined });
        if (!result) {
            return await sock.sendMessage(chatId, {
                text: 'Une anomalie a été détectée. Aucun service d\'intelligence artificielle n\'a répondu, Monsieur. Réessayez dans un instant.'
            }, { quoted: message });
        }

        await sock.sendMessage(chatId, { text: result.text }, { quoted: message });
    } catch (error) {
        console.error('AI Command Error:', error);
        try {
            await sock.sendMessage(chatId, {
                text: 'Une anomalie a été détectée. L\'opération n\'a pas pu aboutir, Monsieur.'
            }, { quoted: message });
        } catch { /* conversation indisponible */ }
    }
}

module.exports = aiCommand;
