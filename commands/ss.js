const fetch = require('node-fetch');

function validPublicUrl(value) {
    try {
        const parsed = new URL(value);
        if (!['http:', 'https:'].includes(parsed.protocol)) return false;
        const host = parsed.hostname.toLowerCase();
        return !['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(host)
            && !host.startsWith('10.')
            && !host.startsWith('192.168.')
            && !host.startsWith('172.16.');
    } catch {
        return false;
    }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 25000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

async function fetchScreenshot(url) {
    const providers = [
        {
            name: 'thum.io',
            // thum.io expects the target URL as the final raw path segment.
            url: `https://image.thum.io/get/width/1280/crop/2000/noanimate/${url}`
        },
        {
            name: 'microlink',
            url: `https://api.microlink.io?url=${encodeURIComponent(url)}&screenshot=true&meta=false`
        }
    ];
    const errors = [];

    for (const provider of providers) {
        try {
            const response = await fetchWithTimeout(provider.url, { headers: { accept: '*/*' } });
            if (!response.ok) throw new Error(`${provider.name}: HTTP ${response.status}`);
            const contentType = response.headers.get('content-type') || '';
            if (contentType.includes('json')) {
                const data = await response.json();
                const imageUrl = data?.data?.screenshot?.url || data?.screenshot?.url;
                if (!imageUrl) throw new Error(`${provider.name}: image absente`);
                const imageResponse = await fetchWithTimeout(imageUrl);
                if (!imageResponse.ok) throw new Error(`${provider.name}: image HTTP ${imageResponse.status}`);
                return imageResponse.buffer();
            }
            const buffer = await response.buffer();
            if (buffer.length < 100) throw new Error(`${provider.name}: réponse vide`);
            return buffer;
        } catch (error) {
            errors.push(error.message);
        }
    }
    throw new Error(errors.join(' | '));
}

async function handleSsCommand(sock, chatId, message, match) {
    if (!match) {
        await sock.sendMessage(chatId, {
            text: `*CAPTURE D\'ÉCRAN*\n\n*.ss <url>*\n*.ssweb <url>*\n*.screenshot <url>*\n\nCapture l\'écran de n\'importe quel site web\n\nExemple :\n.ss https://google.com\n.ssweb https://google.com\n.screenshot https://google.com`,
            quoted: message
        });
        return;
    }

    try {
        // Show typing indicator
        await sock.presenceSubscribe(chatId);
        await sock.sendPresenceUpdate('composing', chatId);

        // Extract URL from command
        const url = match.trim();
        
        // Validate URL
        if (!validPublicUrl(url)) {
            return sock.sendMessage(chatId, {
                text: '❌ Fournissez une URL valide commençant par http:// ou https://',
                quoted: message
            });
        }

        const imageBuffer = await fetchScreenshot(url);

        // Send the screenshot
        await sock.sendMessage(chatId, {
            image: imageBuffer,
        }, {
            quoted: message
        });

    } catch (error) {
        console.error('❌ Error in ss command:', error);
        await sock.sendMessage(chatId, {
            text: '❌ La capture d\'écran a échoué. Réessayez dans quelques minutes, Monsieur.\n\nCauses possibles :\n• URL invalide\n• Le site bloque les captures d\'écran\n• Le site est indisponible\n• Le service est temporairement indisponible',
            quoted: message
        });
    }
}

module.exports = {
    handleSsCommand
}; 