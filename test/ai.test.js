'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const ai = require('../lib/aiClient');
const aiCommand = require('../commands/ai');

const KEYS = ['GEMINI_API_KEY', 'GROQ_API_KEY', 'OPENAI_API_KEY', 'POLLINATIONS_API_KEY', 'AI_API_KEY'];
function withEnv(values, fn) {
    const saved = Object.fromEntries(KEYS.map(k => [k, process.env[k]]));
    KEYS.forEach(k => delete process.env[k]);
    Object.assign(process.env, values);
    return Promise.resolve(fn()).finally(() => {
        KEYS.forEach(k => { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; });
    });
}
function stubAxios(handler) {
    const original = { ...ai.deps };
    const calls = [];
    ai.deps.axios = {
        get: async (url, options) => { calls.push(url); return handler('GET', url, options); },
        post: async (url, body, options) => { calls.push(url); return handler('POST', url, options, body); }
    };
    return { calls, restore: () => Object.assign(ai.deps, original) };
}

test('extractAnswer lit les formats d\'API courants', () => {
    assert.equal(ai.extractAnswer({ result: 'Bonjour' }), 'Bonjour');
    assert.equal(ai.extractAnswer({ status: true, data: { answer: 'Salut' } }), 'Salut');
    assert.equal(ai.extractAnswer({ choices: [{ message: { content: 'Réponse OpenAI' } }] }), 'Réponse OpenAI');
    assert.equal(ai.extractAnswer({ status: 'success', message: 'ok' }), '');
    assert.equal(ai.extractAnswer('texte brut'), 'texte brut');
});

test('les avis de service (obsolète, clé requise, quota) ne sont pas pris pour une réponse', () => {
    assert.equal(ai.acceptable('IMPORTANT NOTICE: the legacy text API is being sunset, use an API key'), false);
    assert.equal(ai.acceptable('Rate limit exceeded'), false);
    assert.equal(ai.acceptable('x'), false);
    assert.equal(ai.acceptable('La capitale de la France est Paris.'), true);
});

test('une clé Gemini est utilisée en premier pour .gemini', async () => {
    await withEnv({ GEMINI_API_KEY: 'g', GROQ_API_KEY: 'q' }, async () => {
        const stub = stubAxios(async (method, url) => ({ data: { choices: [{ message: { content: `via ${url.split('/')[2]}` } }] } }));
        try {
            const result = await ai.askAI('Bonjour', { prefer: 'gemini' });
            assert.equal(result.provider, 'Gemini');
            assert.match(result.text, /generativelanguage/);
            const other = await ai.askAI('Bonjour');
            assert.equal(other.provider, 'Gemini');   // ordre : Gemini, Groq…
        } finally { stub.restore(); }
    });
});

test('cascade : un fournisseur en panne ou qui répond par un avis est contourné', async () => {
    await withEnv({}, async () => {
        const stub = stubAxios(async (method, url) => {
            if (url.includes('text.pollinations.ai')) return { data: 'IMPORTANT NOTICE: legacy API sunset' };
            if (url.includes('siputzx')) throw new Error('HTTP 502');
            if (url.includes('ryzumi')) return { data: { status: true, result: 'Voici la vraie réponse.' } };
            throw new Error('inattendu ' + url);
        });
        try {
            const result = await ai.askAI('Question');
            assert.equal(result.provider, 'Ryzumi');
            assert.equal(result.text, 'Voici la vraie réponse.');
        } finally { stub.restore(); }
    });
});

test('tout échoue : askAI renvoie null sans lever d\'erreur', async () => {
    await withEnv({}, async () => {
        const stub = stubAxios(async () => { throw new Error('réseau coupé'); });
        try { assert.equal(await ai.askAI('Question'), null); } finally { stub.restore(); }
    });
});

test('images : un fichier qui n\'est pas une image est rejeté, la suivante est prise', async () => {
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), Buffer.alloc(8000, 7)]);
    const stub = stubAxios(async (method, url) => {
        if (url.includes('image.pollinations.ai')) return { data: Buffer.from('<html>notice</html>'.repeat(500)) };
        if (url.includes('siputzx')) return { data: png };
        throw new Error('HTTP 500');
    });
    try {
        const result = await ai.generateImage('un lever de soleil');
        assert.equal(result.provider, 'Siputzx Flux');
        assert.ok(ai.isImage(result.buffer));
    } finally { stub.restore(); }
});

test('.gpt : réponse envoyée citée ; sans question, message d\'aide ; échec = message JARVIS', async () => {
    const sent = [];
    const sock = { sendMessage: async (jid, content) => { sent.push(content); return {}; } };
    const msg = (text) => ({ key: { id: 'A', remoteJid: 'g@g.us' }, message: { conversation: text } });

    await aiCommand(sock, 'g@g.us', msg('.gpt'));
    assert.match(sent.at(-1).text, /Posez votre question/);

    await withEnv({}, async () => {
        let stub = stubAxios(async (method, url) => ({ data: { result: 'Paris est la capitale de la France.' } }));
        try {
            await aiCommand(sock, 'g@g.us', msg('.gpt capitale de la France ?'));
            assert.equal(sent.at(-1).text, 'Paris est la capitale de la France.');
        } finally { stub.restore(); }

        stub = stubAxios(async () => { throw new Error('hors ligne'); });
        try {
            await aiCommand(sock, 'g@g.us', msg('.gemini bonjour'));
            assert.match(sent.at(-1).text, /Aucun service d'intelligence artificielle/);
        } finally { stub.restore(); }
    });
});
