const axios = require('axios');
const { commandInput, safeFileName } = require('../lib/downloadUtils');

async function spotifyCommand(sock, chatId, message) {
    try {
        const query = commandInput(message);

        if (!query) {
            await sock.sendMessage(chatId, { text: 'Utilisation : .spotify <song/artist/keywords>\nExemple : .spotify con calma' }, { quoted: message });
            return;
        }

        const apiUrl = `https://okatsu-rolezapiiz.vercel.app/search/spotify?q=${encodeURIComponent(query)}`;
        const { data } = await axios.get(apiUrl, { timeout: 20000, headers: { 'user-agent': 'Mozilla/5.0' } });

        if (!data?.status || !data?.result) {
            throw new Error('No result from Spotify API');
        }

        const r = data.result;
        const audioUrl = r.audio || r.audio_url || r.download || r.downloadUrl;
        if (!audioUrl) {
            await sock.sendMessage(chatId, { text: 'Aucun audio téléchargeable pour cette requête, Monsieur.' }, { quoted: message });
            return;
        }

        const caption = `🎵 ${r.title || r.name || 'Titre inconnu'}\n👤 ${r.artist || ''}\n⏱ ${r.duration || ''}\n🔗 ${r.url || ''}`.trim();

         // Send cover and info as a follow-up (optional)
         if (caption) {
            await sock.sendMessage(chatId, { text: caption }, { quoted: message });
        }
        await sock.sendMessage(chatId, {
            audio: { url: audioUrl },
            mimetype: 'audio/mpeg',
            fileName: `${safeFileName(r.title || r.name, 'track')}.mp3`
        }, { quoted: message });

       

    } catch (error) {
        console.error('[SPOTIFY] error:', error?.message || error);
        await sock.sendMessage(chatId, { text: 'La récupération de l\'audio Spotify a échoué. Essayez une autre requête dans un instant.' }, { quoted: message });
    }
}

module.exports = spotifyCommand;
