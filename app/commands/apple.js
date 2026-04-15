import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const meta = {
  name: 'apple',
  aliases: ['applemusic', 'shazam'],
  version: '2.0.0',
  author: 'selov',
  description: 'Download Apple Music previews (silent mode)',
  guide: ['/apple <song name>'],
  cooldown: 2,
  type: 'anyone',
  category: 'music'
};

// Simple memory per chat
if (!global.appleMemory) global.appleMemory = new Map();

export async function onStart({ args, response, chatId, from, usage }) {
  const query = args.join(' ').trim();

  if (!query) {
    return; // Silent fail
  }

  // Show typing indicator
  await response.action('typing');

  try {
    // Get user's first name for memory
    const firstName = from.first_name || 'User';

    // Initialize memory for this chat
    if (!global.appleMemory.has(chatId)) {
      global.appleMemory.set(chatId, []);
    }
    const chatMemory = global.appleMemory.get(chatId);
    chatMemory.push(`${firstName} requested: ${query}`);

    // API call – limit to 1 result
    const apiUrl = `https://betadash-api-swordslush-production.up.railway.app/shazam?title=${encodeURIComponent(query)}&limit=1`;
    
    const res = await axios.get(apiUrl);
    const tracks = res.data.results;

    if (!tracks || tracks.length === 0) {
      return; // Silent fail
    }

    const track = tracks[0];
    
    if (!track.previewUrl) {
      return; // Silent fail
    }

    // Create cache directory
    const cacheDir = path.join(__dirname, '..', 'cache', 'apple');
    await fs.ensureDir(cacheDir);

    const audioPath = path.join(cacheDir, `apple_${Date.now()}.m4a`);
    
    // Download preview audio
    const audioRes = await axios.get(track.previewUrl, { 
      responseType: 'arraybuffer',
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    await fs.writeFile(audioPath, audioRes.data);

    // Send ONLY the audio – no text, no caption
    await response.upload('audio', audioPath, {
      reply_to_message_id: response.message_id
    });

    // Store in memory
    chatMemory.push(`Downloaded: ${track.title} by ${track.artistName}`);

    // Clean up file after sending
    setTimeout(() => {
      fs.remove(audioPath).catch(() => {});
    }, 10000);

  } catch (err) {
    console.error("Apple Music Error:", err);
    // Silent fail – no error message to user
  }
}
