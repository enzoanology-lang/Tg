import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Persistent storage file
const stateFile = path.join(__dirname, '..', 'data', 'sim_active.json');

// Load active chat IDs from file
async function loadActiveChats() {
  try {
    await fs.ensureFile(stateFile);
    const data = await fs.readFile(stateFile, 'utf8');
    const arr = JSON.parse(data || '[]');
    return new Set(arr);
  } catch {
    return new Set();
  }
}

// Save active chat IDs to file
async function saveActiveChats(set) {
  await fs.ensureDir(path.dirname(stateFile));
  await fs.writeFile(stateFile, JSON.stringify(Array.from(set)), 'utf8');
}

// Initialize global set (will be loaded on first use)
if (!global.simActiveChats) {
  global.simActiveChats = await loadActiveChats();
}

export const meta = {
  name: 'simv3',
  aliases: ['sim', 'simsimi'],
  version: '3.0.0',
  author: 'selov',
  description: 'Auto-reply with SimSimi AI (persistent)',
  guide: [
    ' on — Activate auto-reply in this chat',
    ' off — Deactivate auto-reply',
    'Once activated, any message will get a SimSimi response.'
  ],
  cooldown: 3,
  type: 'premium',
  category: 'fun'
};

// Command handler: /simv3 on | off
export async function onStart({ args, response, chatId, usage }) {
  const subcmd = (args[0] || '').toLowerCase();

  if (subcmd === 'on') {
    if (global.simActiveChats.has(chatId)) {
      return response.reply('✅ SimSimi auto-reply is already active in this chat.');
    }
    global.simActiveChats.add(chatId);
    await saveActiveChats(global.simActiveChats);
    return response.reply('✅ SimSimi auto-reply activated! All messages will receive SimSimi responses.');
  }

  if (subcmd === 'off') {
    if (!global.simActiveChats.has(chatId)) {
      return response.reply('ℹ️ SimSimi auto-reply is not active in this chat.');
    }
    global.simActiveChats.delete(chatId);
    await saveActiveChats(global.simActiveChats);
    return response.reply('🔕 SimSimi auto-reply deactivated.');
  }

  return usage();
}

// Auto-reply handler
export async function onChat({ body, response, chatId, senderID, bot, isUserCallCommand }) {
  // Skip if not active in this chat, or if message is a command, or from the bot itself
  if (!global.simActiveChats.has(chatId)) return;
  if (isUserCallCommand) return;
  if (!body || body.trim() === '') return;

  // Optional: avoid replying to bot's own messages
  const me = await bot.getMe();
  if (senderID === me.id) return;

  try {
    const apiKey = '2a5a2264d2ee4f0b847cb8bd809ed34bc3309be7';
    const apiUrl = `https://simsimi.ooguy.com/sim?query=${encodeURIComponent(body)}&apikey=${apiKey}`;
    const { data } = await axios.get(apiUrl, { timeout: 10000 });

    if (data && data.respond) {
      await response.reply(data.respond);
    }
  } catch (error) {
    console.error('[SimSimi] Error:', error.message);
    // Silent fail – no error shown to user
  }
}
