import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const meta = {
  name: 'katorsex',
  aliases: ['randvideo'],
  version: '4.5.0',
  author: 'selov',
  description: 'Get a random video (video only)',
  guide: ['/katorsex'],
  cooldown: 5,
  type: 'anyone',
  category: 'video'
};

export async function onStart({ response, bot, chatId, messageID }) {
  const waitingMsg = await response.reply('🔍 Fetching random video...');

  try {
    const apiUrl = 'https://betadash-api-swordslush-production.up.railway.app/katorsex?page=1';
    const { data } = await axios.get(apiUrl, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    // Try multiple possible response keys
    const videos = data.results || data.result || data.data || [];
    if (!videos.length) {
      return response.edit(waitingMsg, '❌ No videos found.');
    }

    const video = videos[Math.floor(Math.random() * videos.length)];
    const videoUrl = video.videoUrl || video.url || video.src;

    if (!videoUrl) {
      return response.edit(waitingMsg, '❌ Missing video URL.');
    }

    await response.edit(waitingMsg, '📥 Downloading video...');

    const cacheDir = path.join(__dirname, '..', 'cache', 'katorsex');
    await fs.ensureDir(cacheDir);
    const videoPath = path.join(cacheDir, `video_${Date.now()}.mp4`);

    const videoResponse = await axios.get(videoUrl, {
      responseType: 'arraybuffer',
      timeout: 60000,
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://katorsex.com/'
      }
    });

    await fs.writeFile(videoPath, videoResponse.data);
    const stats = await fs.stat(videoPath);
    if (stats.size === 0) throw new Error('Empty file');

    // Delete the waiting message
    await bot.deleteMessage(chatId, waitingMsg.message_id).catch(() => {});

    // Send video directly using bot.sendVideo (bypasses response.upload)
    await bot.sendVideo(chatId, videoPath, {
      supports_streaming: true,
      reply_to_message_id: messageID // optional: reply to the command message
    });

    // Clean up
    setTimeout(() => fs.remove(videoPath).catch(() => {}), 60000);

  } catch (err) {
    console.error('Katorsex Error:', err);
    const errorMsg = err.response ? `API status ${err.response.status}` : err.message;
    await response.edit(waitingMsg, `❌ Error: ${errorMsg}`).catch(() => {
      response.reply(`❌ Error: ${errorMsg}`);
    });
  }
}
