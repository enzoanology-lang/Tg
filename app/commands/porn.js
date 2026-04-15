import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const meta = {
  name: 'porn',
  aliases: ['pinayot', 'randred'],
  version: '4.0.0',
  author: 'selov',
  description: 'Get random videos from pinayot API',
  guide: ['/porn'],
  cooldown: 5,
  type: 'premium',
  category: 'video'
};

export async function onStart({ response, bot, chatId, from, messageID }) {
  const firstName = from.first_name || 'User';

  // Send initial status
  const waitingMsg = await response.reply('🎬 Fetching random video...');

  try {
    const apiUrl = 'https://betadash-api-swordslush-production.up.railway.app/pinayot?page=1';
    const apiResponse = await axios.get(apiUrl, {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const videos = apiResponse.data.result || [];

    if (videos.length === 0) {
      await bot.deleteMessage(chatId, waitingMsg.message_id);
      return response.reply('❌ No videos found.');
    }

    const randomVideo = videos[Math.floor(Math.random() * videos.length)];
    const videoUrl = randomVideo.videoUrl;
    const description = randomVideo.description || 'No description';
    const uploadDate = randomVideo.uploadDate
      ? new Date(randomVideo.uploadDate).toLocaleDateString()
      : 'Unknown';

    if (!videoUrl) {
      await bot.deleteMessage(chatId, waitingMsg.message_id);
      return response.reply('❌ Video URL not found.');
    }

    // Update status
    await response.edit(waitingMsg, '📥 Downloading video...');

    // Create cache directory
    const cacheDir = path.join(__dirname, '..', 'cache', 'red');
    await fs.ensureDir(cacheDir);
    const videoPath = path.join(cacheDir, `red_${Date.now()}.mp4`);

    // Download video
    const videoResponse = await axios.get(videoUrl, {
      responseType: 'arraybuffer',
      timeout: 60000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://pinayot.com/'
      }
    });

    await fs.writeFile(videoPath, videoResponse.data);
    const stats = await fs.stat(videoPath);
    if (stats.size === 0) {
      throw new Error('Downloaded file is empty');
    }

    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

    // Delete status message
    await bot.deleteMessage(chatId, waitingMsg.message_id);

    // Send video
    const caption = `🎬 RANDOM VIDEO\n━━━━━━━━━━━━━━━━\n` +
                    `Description: ${description}\n` +
                    `Upload Date: ${uploadDate}\n` +
                    `Size: ${fileSizeMB} MB\n` +
                    `━━━━━━━━━━━━━━━━\n` +
                    `💬 Requested by: ${firstName}`;

    await response.upload('video', videoPath, {
      caption,
      parse_mode: 'Markdown',
      supports_streaming: true
    });

    // Cleanup
    setTimeout(() => {
      fs.remove(videoPath).catch(() => {});
    }, 60000);

  } catch (err) {
    console.error('Red Command Error:', err);
    await bot.deleteMessage(chatId, waitingMsg.message_id).catch(() => {});
    response.reply(`❌ Error: ${err.message}`);
  }
}
