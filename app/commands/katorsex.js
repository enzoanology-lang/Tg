import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const meta = {
  name: 'katorsex',
  aliases: ['randvideo'],
  version: '4.0.0',
  author: 'selov',
  description: 'Get a random video',
  guide: ['/katorsex'],
  cooldown: 5,
  type: 'premium',
  category: 'video'
};

export async function onStart({ response, bot, chatId, from, messageID }) {
  const firstName = from.first_name || 'User';

  // Send initial status message
  const waitingMsg = await response.reply('🔍 Accessing video source...');

  try {
    // Test API base (optional, for logging)
    const testUrl = 'https://betadash-api-swordslush-production.up.railway.app/';
    try {
      await axios.get(testUrl, { timeout: 5000 });
    } catch (testErr) {
      console.log('API Base Error:', testErr.message);
    }

    // Update status
    await response.edit(waitingMsg, '📡 Connecting to video server...');

    const apiUrl = 'https://betadash-api-swordslush-production.up.railway.app/katorsex?page=1';
    const apiResponse = await axios.get(apiUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      }
    });

    // Extract videos from various possible response structures
    let videos = [];
    const data = apiResponse.data;

    if (Array.isArray(data)) {
      videos = data;
    } else if (data.results && Array.isArray(data.results)) {
      videos = data.results;
    } else if (data.data && Array.isArray(data.data)) {
      videos = data.data;
    } else if (data.videos && Array.isArray(data.videos)) {
      videos = data.videos;
    }

    if (videos.length === 0) {
      return response.edit(waitingMsg, '❌ No videos found in response.');
    }

    await response.edit(waitingMsg, `✅ Found ${videos.length} videos. Selecting one...`);

    // Pick a random video
    const randomVideo = videos[Math.floor(Math.random() * videos.length)];

    // Find video URL in possible fields
    let videoUrl = null;
    const possibleFields = ['videoUrl', 'downloadUrl', 'url', 'link', 'video', 'mp4', 'file', 'src', 'source'];

    for (const field of possibleFields) {
      if (randomVideo[field]) {
        videoUrl = randomVideo[field];
        break;
      }
    }

    if (!videoUrl && randomVideo.video_info) {
      for (const field of possibleFields) {
        if (randomVideo.video_info[field]) {
          videoUrl = randomVideo.video_info[field];
          break;
        }
      }
    }

    if (!videoUrl) {
      return response.edit(waitingMsg, '❌ Could not find video URL in the data.');
    }

    await response.edit(waitingMsg, `📥 Downloading video...`);

    // Prepare cache directory
    const cacheDir = path.join(__dirname, '..', 'cache', 'katorsex');
    await fs.ensureDir(cacheDir);
    const videoPath = path.join(cacheDir, `video_${Date.now()}.mp4`);

    // Download video
    const videoResponse = await axios.get(videoUrl, {
      responseType: 'arraybuffer',
      timeout: 60000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://betadash-api-swordslush-production.up.railway.app/'
      }
    });

    await fs.writeFile(videoPath, videoResponse.data);
    const stats = await fs.stat(videoPath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

    // Delete the waiting message
    await bot.deleteMessage(chatId, waitingMsg.message_id).catch(() => {});

    // Send video
    const caption = `🎬 RANDOM VIDEO\n━━━━━━━━━━━━━━━━\n` +
                    `Title: ${randomVideo.title || 'Untitled'}\n` +
                    `Size: ${fileSizeMB} MB\n` +
                    `━━━━━━━━━━━━━━━━\n` +
                    `💬 Requested by: ${firstName}`;

    await response.upload('video', videoPath, {
      caption,
      parse_mode: 'Markdown',
      supports_streaming: true
    });

    // Clean up
    setTimeout(() => {
      fs.remove(videoPath).catch(() => {});
    }, 60000);

  } catch (err) {
    console.error('Katorsex Error:', err);
    const errorMsg = err.response ? `API returned status ${err.response.status}` : err.message;
    await response.edit(waitingMsg, `❌ Error: ${errorMsg}`).catch(() => {
      response.reply(`❌ Error: ${errorMsg}`);
    });
  }
}
