import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const meta = {
  name: 'smart',
  aliases: [],
  version: '1.0.0',
  author: 'selov',
  description: 'Smart NLP command detection without prefixes',
  guide: ['Just talk naturally — the bot understands context.'],
  cooldown: 2,
  type: 'anyone',
  category: 'ai'
};

// Simple in‑memory cooldown
const cooldowns = new Map();
const COOLDOWN_MS = 5000;

// AI toggle states per chat
if (!global.aiToggleStates) global.aiToggleStates = new Map();

// Gojo toggle states per chat
if (!global.gojoToggleStates) global.gojoToggleStates = new Map();

// Simple keyword detection (fallback)
function detectIntent(message) {
  const lower = message.toLowerCase();

  // Stock / GAG
  if (/gag stock|stock gag|restock timer|garden stock/.test(lower)) return 'gag';

  // Download
  if (/download|dl/.test(lower) && /facebook\.com|fb\.watch/.test(message)) return 'fbdl';
  if (/instagram|ig/.test(lower) && /instagram\.com/.test(message)) return 'igdl';

  // TikTok
  if (/tiktok/.test(lower) && !/download|facebook\.com/.test(lower)) return 'tiktok';

  // Spotify
  if (/spotify|music|song|play/.test(lower)) return 'spotify';

  // Contact / Rules / Help / Prefix / Uptime / UID
  if (/contact|owner|developer/.test(lower)) return 'contact';
  if (/rules|regulation|guideline/.test(lower)) return 'rules';
  if (/help|command|what can you do/.test(lower)) return 'help';
  if (/prefix/.test(lower)) return 'prefix';
  if (/uptime|how long|run time/.test(lower)) return 'uptime';
  if (/uid|user id|my id/.test(lower)) return 'uid';
  if (/leave|out|exit|goodbye/.test(lower)) return 'out';
  if (/list group|list box/.test(lower)) return 'listbox';

  // Toggles
  if (/on ai|ai on|enable ai/.test(lower)) return 'ai_on';
  if (/off ai|ai off|disable ai/.test(lower)) return 'ai_off';
  if (/on gojo|gojo on/.test(lower)) return 'gojo_on';
  if (/off gojo|gojo off/.test(lower)) return 'gojo_off';

  // Video
  if (/video|shoti|girl/.test(lower)) return 'video';

  // Women meme
  if (/women|babae/.test(lower)) return 'women';

  // Admin commands (handled by separate files usually)
  if (/add user|change admin|shell|eval/.test(lower)) return 'admin';

  return null;
}

export async function onStart({ response, bot, chatId, from, messageID, body, args, isUserCallCommand, prefix }) {
  // If the command was explicitly called (e.g., /smart), show help
  if (isUserCallCommand) {
    return handleHelp(response, chatId, prefix);
  }

  // Cooldown check
  const userId = from.id;
  const now = Date.now();
  if (cooldowns.has(userId)) {
    const expiry = cooldowns.get(userId);
    if (now < expiry) {
      return; // silent
    }
  }
  cooldowns.set(userId, now + COOLDOWN_MS);
  setTimeout(() => cooldowns.delete(userId), COOLDOWN_MS);

  const message = body || '';

  // If AI is enabled globally for this chat, answer with AI and return
  if (global.aiToggleStates.get(chatId)) {
    return handleAIQuery(response, message, chatId);
  }

  // If Gojo is enabled globally for this chat, answer with Gojo and return
  if (global.gojoToggleStates.get(chatId)) {
    return handleGojoQuery(response, message, chatId);
  }

  // Detect intent via keyword matching
  const intent = detectIntent(message);

  switch (intent) {
    case 'gag':
      return handleGagStock(response, chatId, message);
    case 'fbdl':
      return handleFBDownload(response, chatId, message);
    case 'igdl':
      return handleIGDownload(response, chatId, message);
    case 'tiktok':
      return handleTikTok(response, chatId, message);
    case 'spotify':
      return handleSpotify(response, chatId, message);
    case 'contact':
      return response.reply('🧑‍💻 Developer: selov\n📧 selov@example.com');
    case 'rules':
      return response.reply('1. Be respectful\n2. No spam\n3. Stay on topic');
    case 'help':
      return handleHelp(response, chatId, prefix);
    case 'prefix':
      return response.reply(`My prefix is \`${prefix}\`, but you don't need it! Just talk naturally.`);
    case 'uptime':
      const uptime = process.uptime();
      return response.reply(`⏱️ Uptime: ${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`);
    case 'uid':
      return response.reply(`Your Telegram ID: \`${userId}\``, { parse_mode: 'Markdown' });
    case 'out':
      // Admin check handled in separate command
      return response.reply('Use /leave to make me exit (admin only).');
    case 'listbox':
      return response.reply('Group listing is available via /listgroups');
    case 'ai_on':
      global.aiToggleStates.set(chatId, true);
      return response.reply('✅ AI mode activated. I will respond to all messages.');
    case 'ai_off':
      global.aiToggleStates.set(chatId, false);
      return response.reply('🔕 AI mode deactivated.');
    case 'gojo_on':
      global.gojoToggleStates.set(chatId, true);
      return response.reply('😈 Gojo mode activated.');
    case 'gojo_off':
      global.gojoToggleStates.set(chatId, false);
      return response.reply('🔕 Gojo mode deactivated.');
    case 'video':
      return handleShoti(response, chatId);
    case 'women':
      return handleWomen(response, chatId);
    case 'admin':
      return response.reply('Admin commands must be used with prefix (e.g., /adduser, /shell).');
    default:
      // If no intent matched, optionally answer with AI if the message looks conversational
      if (await isConversational(message)) {
        return handleAIQuery(response, message, chatId);
      }
      break;
  }
}

// Helper: determine if message is conversational (simple heuristic)
async function isConversational(message) {
  return message.endsWith('?') || message.split(' ').length > 3;
}

// AI Query (using your existing endpoint)
async function handleAIQuery(response, prompt, chatId) {
  try {
    const url = `https://restapijay.onrender.com/api/chatgptfree?prompt=${encodeURIComponent(prompt)}`;
    const { data } = await axios.get(url);
    await response.reply(data.response || 'No response.');
  } catch {
    await response.reply('AI service unavailable.');
  }
}

// Gojo Query
async function handleGojoQuery(response, prompt, chatId) {
  try {
    // Use the exh.ai endpoint from original code
    const data = JSON.stringify({
      context: [{ message: prompt, turn: "user", media_id: null }],
      strapi_bot_id: "594494",
      output_audio: false,
      enable_proactive_photos: true
    });
    const res = await axios.post("https://api.exh.ai/chatbot/v4/botify/response", data, {
      headers: { "Content-Type": "application/json", "x-auth-token": "..." }
    });
    await response.reply(res.data.responses[0].response);
  } catch {
    await response.reply('Gojo is unavailable.');
  }
}

// GAG Stock (simplified – full WebSocket version should be a separate command)
async function handleGagStock(response, chatId, message) {
  await response.reply('🌾 GAG Stock tracking is available via /gagstock start');
}

// Facebook Download (simplified)
async function handleFBDownload(response, chatId, message) {
  const urlMatch = message.match(/(https?:\/\/[^\s]+)/);
  if (!urlMatch) return response.reply('No URL found.');
  await response.reply('Facebook download is available via /fbdl ' + urlMatch[0]);
}

// Instagram Download
async function handleIGDownload(response, chatId, message) {
  const urlMatch = message.match(/(https?:\/\/[^\s]+)/);
  if (!urlMatch) return response.reply('No URL found.');
  await response.reply('Instagram download is available via /igdl ' + urlMatch[0]);
}

// TikTok
async function handleTikTok(response, chatId, message) {
  const query = message.replace(/tiktok/gi, '').trim();
  await response.reply('TikTok search is available via /tiktok ' + query);
}

// Spotify
async function handleSpotify(response, chatId, message) {
  const query = message.replace(/spotify|music|song/gi, '').trim();
  await response.reply('Spotify search is available via /spotify ' + query);
}

// Shoti (random video)
async function handleShoti(response, chatId) {
  await response.reply('Random video is available via /shoti');
}

// Women meme
async function handleWomen(response, chatId) {
  await response.reply('☕ Women talaga');
}

// Help
function handleHelp(response, chatId, prefix) {
  const helpText = `🤖 **NASHBOT COMMANDS**

**AI & Intelligence**
- \`on ai\` / \`off ai\` — Toggle AI auto‑response
- \`on gojo\` / \`off gojo\` — Toggle Gojo mode

**Media**
- \`video\` / \`shoti\` — Random TikTok
- \`tiktok <search>\` — Search TikTok
- \`spotify <song>\` — Search Spotify
- \`instagram <url>\` — Download IG video
- \`download <fb url>\` — Download Facebook video

**Utilities**
- \`uid\` — Your Telegram ID
- \`uptime\` — Bot runtime
- \`rules\` — Group rules
- \`contact\` — Developer info

**GAG Stock**
- \`gag stock start\` — Live tracking
- \`gag stock stop\` — Stop tracking
- \`restock timer\` — View timers

Prefix: \`${prefix}\` (optional — most commands work without it)`;

  response.reply(helpText, { parse_mode: 'Markdown' });
}
