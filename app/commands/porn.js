import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const meta = {
  name: 'porn',
  aliases: ['randvideo'],
  version: '4.0.0',
  author: 'selov',
  description: 'Get a random video from eporner',
  guide: ['/porn'],
  cooldown: 5,
  type: 'premium',
  category: 'video'
};

export async function onStart({ response, bot, chatId, from, messageID }) {
  const firstName = from.first_name || 'User';

  const waitingMsg = await response.reply('🔍 Accessing video source...');

  try {
    const apiUrl = 'https://betadash-api-swordslush-production.up.railway.app/eporner?page=1';
    const apiResponse = await axios.get(apiUrl, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json'
      }
    });

    const videos = apiResponse.data.result || [];

    if (videos.length === 0) {
      return response.edit(waitingMsg, '❌ No videos found in response.');
    }

    await response.edit(waitingMsg, `✅ Found ${videos.length} videos. Selecting one...`);

    const randomVideo = videos[Math.floor(Math.random() * videos.length)];
    const videoUrl = randomVideo.videoUrl;
    const title = randomVideo.title || 'Untitled';

    if (!videoUrl) {
      return response.edit(waitingMsg, '❌ Could not find video URL in the data.');
    }

    await response.edit(waitingMsg, `📥 Fetching video information...`);

    // Since the API returns a webpage URL, we cannot directly download the video.
    // Send the link as a message instead.
    const caption = `🎬 RANDOM VIDEO\n━━━━━━━━━━━━━━━━\n` +
                    `Title: ${title}\n` +
                    `Link: ${videoUrl}\n` +
                    `━━━━━━━━━━━━━━━━\n` +
                    `💬 Requested by: ${firstName}`;

    await bot.deleteMessage(chatId, waitingMsg.message_id).catch(() => {});
    await response.reply(caption, { parse_mode: 'Markdown', disable_web_page_preview: false });

  } catch (err) {
    console.error('Katorsex Error:', err);
    const errorMsg = err.response ? `API returned status ${err.response.status}` : err.message;
    await response.edit(waitingMsg, `❌ Error: ${errorMsg}`).catch(() => {
      response.reply(`❌ Error: ${errorMsg}`);
    });
  }
}
