import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const meta = {
  name: 'katorsex',
  aliases: ['randvideo'],
  version: '4.2.0',
  author: 'selov',
  description: 'Get a random video from kaltokan (video only)',
  guide: ['/katorsex'],
  cooldown: 5,
  type: 'premium',
  category: 'video'
};

// Helper: extract direct video URL from a kaltokan page
async function extractDirectVideoUrl(pageUrl) {
  try {
    const { data } = await axios.get(pageUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    // Common patterns for video source in kaltokan pages
    const patterns = [
      /<source\s+src=["']([^"']+\.mp4)["']/i,
      /"videoUrl":"([^"]+\.mp4)"/i,
      /"contentUrl":"([^"]+\.mp4)"/i,
      /(https?:\/\/[^\s"']+\.mp4[^\s"']*)/i
    ];

    for (const pattern of patterns) {
      const match = data.match(pattern);
      if (match && match[1]) {
        return match[1].replace(/\\/g, ''); // clean escaped slashes
      }
    }

    return null;
  } catch (err) {
    console.error('Extraction error:', err.message);
    return null;
  }
}

export async function onStart({ response, bot, chatId, messageID }) {
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
    const postUrl = video.postUrl || video.videoUrl;

    if (!postUrl) {
      return response.edit(waitingMsg, '❌ Missing video URL.');
    }

    await response.edit(waitingMsg, '📥 Extracting video source...');

    // Step 1: Try to get direct video URL
    let directVideoUrl = video.videoUrl;
    // If the videoUrl looks like a page (contains 'kaltokan.com'), scrape it
    if (!directVideoUrl || directVideoUrl.includes('kaltokan.com')) {
      const extracted = await extractDirectVideoUrl(postUrl);
      if (extracted) directVideoUrl = extracted;
    }

    if (!directVideoUrl) {
      throw new Error('Could not find direct video URL');
    }

    await response.edit(waitingMsg, '📥 Downloading video...');

    const cacheDir = path.join(__dirname, '..', 'cache', 'katorsex');
    await fs.ensureDir(cacheDir);
    const videoPath = path.join(cacheDir, `kaltokan_${Date.now()}.mp4`);

    const videoResponse = await axios.get(directVideoUrl, {
      responseType: 'arraybuffer',
      timeout: 60000,
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': postUrl
      }
    });

    await fs.writeFile(videoPath, videoResponse.data);
    const stats = await fs.stat(videoPath);
    if (stats.size === 0) throw new Error('Empty file');

    // Delete waiting message and send video only
    await bot.deleteMessage(chatId, waitingMsg.message_id).catch(() => {});
    await response.upload('video', videoPath, {
      supports_streaming: true
    });

    // Cleanup
    setTimeout(() => fs.remove(videoPath).catch(() => {}), 60000);

  } catch (err) {
    console.error('Katorsex Error:', err);
    const errorMsg = err.response ? `API status ${err.response.status}` : err.message;
    await response.edit(waitingMsg, `❌ Error: ${errorMsg}`).catch(() => {
      response.reply(`❌ Error: ${errorMsg}`);
    });
  }
}
