'use strict';
const os = require('os');
const { channelInfo } = require('../lib/messageConfig');
const { panel, report } = require('../lib/style');

function uptime(sec) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return [d && `${d}j`, h && `${h}h`, m && `${m}m`, `${s}s`]
    .filter(Boolean).join(' ');
}

async function pingCommand(sock, chatId, message) {
  try {
    const startedAt = Date.now();
    await sock.sendMessage(chatId, { react: { text: '⚡', key: message.key } });
    const ping = Date.now() - startedAt;
    const memory = process.memoryUsage();
    const ram = (memory.heapUsed / 1024 / 1024).toFixed(1);
    const totalRam = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1);
    const ramPercent = ((memory.rss / os.totalmem()) * 100).toFixed(1);
    const up = uptime(Math.floor(process.uptime()));
    const load = os.loadavg?.()[0]?.toFixed(2) || 'N/A';
    const quality = ping < 300 ? 'EXCELLENT' : ping < 800 ? 'STABLE' : 'LENT';

    await sock.sendMessage(chatId, {
      text: report('⚡ Diagnostic système', [['Latence', `${ping} ms`], ['État', quality]], [
        { title: '⏱️ Activité', rows: [['🕒 Disponible', up], ['📊 Charge', load]] },
        { title: '💾 Ressources', rows: [['🧠 Heap', `${ram} Mo`], ['🖥️ RAM serveur', `${totalRam} Go (${ramPercent} %)`], ['⚙️ Moteur', `Node ${process.version.replace('v', '')}`]] }
      ], 'Tous les systèmes répondent normalement, Monsieur.'),
      ...channelInfo,
    }, { quoted: message });

  } catch (err) {
    console.error('[ping] erreur :', err && err.stack || err);
    await sock.sendMessage(chatId, {
      text: panel('⚡ DIAGNOSTIC SYSTÈME', ['❌ Diagnostic impossible pour le moment.']),
      ...channelInfo,
    }, { quoted: message });
  }
}

module.exports = pingCommand;
