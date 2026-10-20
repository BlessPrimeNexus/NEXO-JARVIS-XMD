'use strict';

/*
 * Client IA NEXO-JARVIS : texte (.gpt, .gemini, chatbot) et images (.imagine).
 *
 * Fiabilité maximale : une clé gratuite dans les variables d'environnement
 *   GEMINI_API_KEY  (https://aistudio.google.com/apikey)
 *   GROQ_API_KEY    (https://console.groq.com/keys)
 *   OPENAI_API_KEY, POLLINATIONS_API_KEY, ou AI_API_KEY (+ AI_BASE_URL, AI_MODEL)
 * Sans clé, des API publiques sont essayées une à une (elles peuvent tomber à tout moment).
 * Chaque échec est écrit dans la console avec le nom du fournisseur.
 */

const axios = require('axios');

const TIMEOUT = 25000;
const UA = 'Mozilla/5.0 (compatible; NEXO-JARVIS-XMD)';
const enc = encodeURIComponent;

const SYSTEM_PROMPT = 'Tu es NEXO-JARVIS, une intelligence artificielle inspirée de JARVIS (Tony Stark) : ' +
    'calme, précise, polie, parfois subtilement spirituelle. Réponds dans la langue de l\'utilisateur, ' +
    'de façon claire et concise.';

const deps = { axios };

/* ─── Lecture tolérante des réponses ───────────────────────── */

const NOT_AN_ANSWER = /^(success|ok|true|false|done|error|failed?)$/i;
const NOTICE = /sunset|deprecat|legacy (text )?api|api key (is )?required|invalid api key|unauthorized|rate.?limit|too many requests|insufficient|quota|subscribe|<html/i;

function extractAnswer(node, depth = 0) {
    if (node == null || depth > 5) return '';
    if (typeof node === 'string') {
        const text = node.trim();
        return text && !NOT_AN_ANSWER.test(text) ? text : '';
    }
    if (Array.isArray(node)) {
        for (const item of node) {
            const found = extractAnswer(item, depth + 1);
            if (found) return found;
        }
        return '';
    }
    if (typeof node === 'object') {
        const choice = node.choices?.[0];
        const fromChoice = choice?.message?.content || choice?.text;
        if (typeof fromChoice === 'string' && fromChoice.trim()) return fromChoice.trim();
        for (const key of ['result', 'answer', 'response', 'reply', 'output', 'text', 'content', 'message', 'data']) {
            if (key in node) {
                const found = extractAnswer(node[key], depth + 1);
                if (found) return found;
            }
        }
    }
    return '';
}

function acceptable(text) {
    const clean = String(text || '').trim();
    if (clean.length < 2) return false;
    if (clean.length < 600 && NOTICE.test(clean)) return false;
    return true;
}

/* ─── Fournisseurs à clé (compatibles OpenAI) ──────────────── */

function openAiProvider(name, baseUrl, key, model) {
    return {
        name,
        keyed: true,
        run: async (prompt, system) => {
            const response = await deps.axios.post(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
                model,
                temperature: 0.7,
                messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }]
            }, {
                timeout: TIMEOUT,
                headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'User-Agent': UA }
            });
            return extractAnswer(response.data);
        }
    };
}

function keyedProviders(env = process.env) {
    const list = [];
    if (env.GEMINI_API_KEY) list.push({ ...openAiProvider('Gemini', 'https://generativelanguage.googleapis.com/v1beta/openai', env.GEMINI_API_KEY, env.GEMINI_MODEL || 'gemini-2.0-flash'), family: 'gemini' });
    if (env.GROQ_API_KEY) list.push(openAiProvider('Groq', 'https://api.groq.com/openai/v1', env.GROQ_API_KEY, env.GROQ_MODEL || 'llama-3.3-70b-versatile'));
    if (env.OPENAI_API_KEY) list.push(openAiProvider('OpenAI', (env.OPENAI_API_URL || 'https://api.openai.com/v1').replace(/\/chat\/completions\/?$/, ''), env.OPENAI_API_KEY, env.OPENAI_MODEL || 'gpt-4o-mini'));
    if (env.POLLINATIONS_API_KEY) list.push(openAiProvider('Pollinations (clé)', 'https://gen.pollinations.ai/v1', env.POLLINATIONS_API_KEY, 'openai'));
    if (env.AI_API_KEY) list.push(openAiProvider('API personnalisée', env.AI_BASE_URL || 'https://api.openai.com/v1', env.AI_API_KEY, env.AI_MODEL || 'gpt-4o-mini'));
    return list;
}

/* ─── API publiques (sans clé) ─────────────────────────────── */

const getJson = (url) => deps.axios.get(url, { timeout: TIMEOUT, headers: { 'User-Agent': UA } }).then(r => r.data);

const PUBLIC_PROVIDERS = [
    {
        name: 'Pollinations',
        run: async (prompt, system) => {
            const response = await deps.axios.post('https://text.pollinations.ai/openai', {
                model: 'openai',
                messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }]
            }, { timeout: TIMEOUT, headers: { 'Content-Type': 'application/json', 'User-Agent': UA } });
            return extractAnswer(response.data);
        }
    },
    { name: 'Siputzx', run: async (q) => extractAnswer(await getJson(`https://api.siputzx.my.id/api/ai/gemini-pro?content=${enc(q)}`)) },
    { name: 'Ryzumi', run: async (q) => extractAnswer(await getJson(`https://api.ryzumi.vip/api/ai/chatgpt?text=${enc(q)}`)) },
    { name: 'Vreden', run: async (q) => extractAnswer(await getJson(`https://api.vreden.my.id/api/gpt4?query=${enc(q)}`)) },
    { name: 'Nekolabs', run: async (q) => extractAnswer(await getJson(`https://api.nekolabs.web.id/text.gen/gpt/5?text=${enc(q)}`)) },
    { name: 'GiftedTech', run: async (q) => extractAnswer(await getJson(`https://api.giftedtech.my.id/api/ai/geminiai?apikey=gifted&q=${enc(q)}`)) },
    { name: 'Vapis', run: async (q) => extractAnswer(await getJson(`https://vapis.my.id/api/gemini?q=${enc(q)}`)) }
];

/* ─── Question → réponse ───────────────────────────────────── */

async function askAI(prompt, options = {}) {
    const system = options.system || SYSTEM_PROMPT;
    const keyed = keyedProviders();
    if (options.prefer === 'gemini') keyed.sort((a, b) => (b.family === 'gemini') - (a.family === 'gemini'));
    const providers = [...keyed, ...PUBLIC_PROVIDERS];

    for (const provider of providers) {
        try {
            const answer = await provider.run(String(prompt), system);
            if (acceptable(answer)) {
                console.log(`[ia] ${provider.name} : OK`);
                return { text: answer.trim(), provider: provider.name };
            }
            console.warn(`[ia] ${provider.name} : réponse inutilisable`);
        } catch (error) {
            const status = error.response?.status ? ` HTTP ${error.response.status}` : '';
            console.warn(`[ia] ${provider.name} : échec${status} — ${error.message}`);
        }
    }
    if (!keyed.length) {
        console.warn('[ia] Aucune clé configurée : ajoutez GEMINI_API_KEY ou GROQ_API_KEY (gratuites) pour une IA fiable.');
    }
    return null;
}

/* ─── Images ───────────────────────────────────────────────── */

function isImage(buffer) {
    if (!buffer || buffer.length < 5000) return false;
    const head = buffer.subarray(0, 12);
    return (head[0] === 0xFF && head[1] === 0xD8) ||
        (head[0] === 0x89 && head.toString('ascii', 1, 4) === 'PNG') ||
        (head.toString('ascii', 0, 4) === 'RIFF' && head.toString('ascii', 8, 12) === 'WEBP');
}

async function getImage(url) {
    const response = await deps.axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 90000,
        maxContentLength: 15 * 1024 * 1024,
        headers: { 'User-Agent': UA, Accept: 'image/*,*/*' }
    });
    return Buffer.from(response.data);
}

function imageProviders(prompt, env = process.env) {
    const p = enc(prompt);
    const list = [];
    if (env.POLLINATIONS_API_KEY) {
        list.push({ name: 'Pollinations (clé)', url: `https://gen.pollinations.ai/image/${p}?width=1024&height=1024&nologo=true&key=${enc(env.POLLINATIONS_API_KEY)}` });
    }
    list.push(
        { name: 'Pollinations', url: `https://image.pollinations.ai/prompt/${p}?width=1024&height=1024&nologo=true` },
        { name: 'Siputzx Flux', url: `https://api.siputzx.my.id/api/ai/flux?prompt=${p}` },
        { name: 'Ryzumi Flux', url: `https://api.ryzumi.vip/api/ai/flux?prompt=${p}` },
        { name: 'Shizo', url: `https://shizoapi.onrender.com/api/ai/imagine?apikey=shizo&query=${p}` }
    );
    return list;
}

async function generateImage(prompt) {
    for (const provider of imageProviders(prompt)) {
        try {
            const buffer = await getImage(provider.url);
            if (isImage(buffer)) {
                console.log(`[ia] image ${provider.name} : OK (${Math.round(buffer.length / 1024)} Ko)`);
                return { buffer, provider: provider.name };
            }
            console.warn(`[ia] image ${provider.name} : le fichier reçu n'est pas une image`);
        } catch (error) {
            const status = error.response?.status ? ` HTTP ${error.response.status}` : '';
            console.warn(`[ia] image ${provider.name} : échec${status} — ${error.message}`);
        }
    }
    return null;
}

module.exports = { askAI, generateImage, extractAnswer, acceptable, keyedProviders, imageProviders, isImage, deps, SYSTEM_PROMPT };
