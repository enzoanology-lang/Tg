import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const meta = {
  name: 'tiktok',
  aliases: ['tt', 'tik'],
  version: '1.0.0',
  author: 'selov',
  description: 'Get random TikTok videos or search by keyword',
  guide: [
    ' — Get a random TikTok video',
    ' <search query> — Search for TikTok videos'
  ],
  cooldown: 3,
  type: 'anyone',
  category: 'video'
};

export async function onStart({ args, response, bot, chatId, messageID, usage }) {
  const query = args.join(' ').trim();

  // Set loading reaction
  try {
    await bot.setMessageReaction(chatId, messageID, { reaction: [{ type: 'emoji', emoji: '⏳' }] });
  } catch {}

  // Show typing indicator
  await response.action('typing');

  try {
    // Determine API URL (search vs random feed)
    const apiUrl = query
      ? `https://tikwm.com/api/feed/search?keywords=${encodeURIComponent(query)}`
      : `https://tikwm.com/api/feed/list?region=PH&count=1`;

    const apiResponse = await axios.get(apiUrl, { timeout: 15000 });
    
    let videoUrl = null;

    // Extract video URL from TikWM‑style response
    if (apiResponse.data.data?.videos) {
      const videos = apiResponse.data.data.videos;
      if (videos.length > 0) {
        videoUrl = videos[0].play || videos[0].wmplay;
      }
    } else if (Array.isArray(apiResponse.data.data)) {
      const videos = apiResponse.data.data;
      if (videos.length > 0) {
        videoUrl = videos[0].play;
      }
    }

    if (!videoUrl) {
      throw new Error('No video found');
    }

    // Download video
    const cacheDir = path.join(__dirname, '..', 'cache', 'tiktok');
    await fs.ensureDir(cacheDir);
    const videoPath = path.join(cacheDir, `tiktok_${Date.now()}.mp4`);

    const videoRes = await axios.get(videoUrl, {
      responseType: 'arraybuffer',
      timeout: 60000
    });

    await fs.writeFile(videoPath, videoRes.data);

    // Set success reaction
    try {
      await bot.setMessageReaction(chatId, messageID, { reaction: [{ type: 'emoji', emoji: '✅' }] });
    } catch {}

    // Send video with caption
    const caption = query ? `🎵 TikTok search: "${query}"` : '🎵 Random TikTok video';
    await response.upload('video', videoPath, {
      caption,
      supports_streaming: true
    });

    // Cleanup
    setTimeout(() => {
      fs.remove(videoPath).catch(() => {});
    }, 10000);

  } catch (err) {
    console.error('TikTok Error:', err);
    // Set error reaction
    try {
      await bot.setMessageReaction(chatId, messageID, { reaction: [{ type: 'emoji', emoji: '❌' }] });
    } catch {}
    response.reply(`❌ Error: ${err.message}`);
  }
}
