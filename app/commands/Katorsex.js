import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const meta = {
  name: 'katorsex',
  aliases: ['randvideo'],
  version: '4.1.1',
  author: 'selov',
  description: 'Get a random video from kaltokan (video only, no caption)',
  guide: ['/katorsex'],
  cooldown: 5,
  type: 'anyone',
  category: 'video'
};

export async function onStart({ response, bot, chatId, from, messageID }) {
  const waitingMsg = await response.reply('🔍 Fetching random video...');

  try {
    const apiUrl = 'https://betadash-api-swordslush-production.up.railway.app/kaltokan?page=1';
    const { data } = await axios.get(apiUrl, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    const videos = data.results || [];
    if (!videos.length) {
      return response.edit(waitingMsg, '❌ No videos found.');
    }

    const video = videos[Math.floor(Math.random() * videos.length)];
    const videoUrl = video.videoUrl;
    const postUrl = video.postUrl;

    if (!videoUrl) {
      return response.edit(waitingMsg, '❌ Missing video URL.');
    }

    // Try to download and send the video file directly
    try {
      await response.edit(waitingMsg, '📥 Downloading video...');

      const cacheDir = path.join(__dirname, '..', 'cache', 'katorsex');
      await fs.ensureDir(cacheDir);
      const videoPath = path.join(cacheDir, `kaltokan_${Date.now()}.mp4`);

      const videoResponse = await axios.get(videoUrl, {
        responseType: 'arraybuffer',
        timeout: 60000,
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Referer': 'https://kaltokan.com/'
        }
      });

      await fs.writeFile(videoPath, videoResponse.data);
      const stats = await fs.stat(videoPath);
      if (stats.size === 0) throw new Error('Empty file');

      // Delete the waiting message
      await bot.deleteMessage(chatId, waitingMsg.message_id).catch(() => {});

      // Send ONLY the video – no caption
      await response.upload('video', videoPath, {
        supports_streaming: true
      });

      // Clean up
      setTimeout(() => fs.remove(videoPath).catch(() => {}), 60000);

    } catch (downloadErr) {
      console.error('Download failed, sending link instead:', downloadErr.message);
      await bot.deleteMessage(chatId, waitingMsg.message_id).catch(() => {});

      // Fallback: send the post link with minimal text (or you can remove text entirely)
      await response.reply(postUrl || videoUrl, { disable_web_page_preview: true });
    }

  } catch (err) {
    console.error('Katorsex Error:', err);
    const errorMsg = err.response ? `API status ${err.response.status}` : err.message;
    await response.edit(waitingMsg, `❌ Error: ${errorMsg}`).catch(() => {
      response.reply(`❌ Error: ${errorMsg}`);
    });
  }
}
