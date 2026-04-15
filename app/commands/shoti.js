import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const meta = {
  name: 'shoti',
  aliases: ['tiktokrand', 'randtiktok'],
  version: '1.0.0',
  author: 'selov',
  description: 'Generate a random TikTok video with details.',
  guide: ['/shoti'],
  cooldown: 0,
  type: 'anyone',
  category: 'video'
};

export async function onStart({ response, bot, chatId, messageID }) {
  // Set reaction to loading
  try {
    await bot.setMessageReaction(chatId, messageID, { reaction: [{ type: "emoji", emoji: "⏳" }] });
  } catch {}

  // Show typing indicator
  await response.action('typing');

  try {
    // Fetch video details from API
    const apiResponse = await axios.get(
      `https://betadash-shoti-yazky.vercel.app/shotizxx?apikey=shipazu`
    );

    const data = apiResponse.data;
    if (!data || !data.shotiurl) {
      return response.reply('❌ No video found or invalid response from the API.');
    }

    // Video file path
    const cacheDir = path.join(__dirname, '..', 'cache', 'shoti');
    await fs.ensureDir(cacheDir);
    const videoPath = path.join(cacheDir, `shoti_${Date.now()}.mp4`);

    // Download the video
    const videoResponse = await axios({
      method: 'GET',
      url: data.shotiurl,
      responseType: 'stream',
      timeout: 60000
    });

    const writer = fs.createWriteStream(videoPath);
    videoResponse.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    // Set success reaction
    try {
      await bot.setMessageReaction(chatId, messageID, { reaction: [{ type: "emoji", emoji: "✅" }] });
    } catch {}

    // Prepare caption
    const caption = `📹 Title: ${data.title}\n` +
                    `👤 Username: @${data.username}\n` +
                    `📛 Nickname: ${data.nickname}\n` +
                    `⏱️ Duration: ${data.duration}s\n` +
                    `🌍 Region: ${data.region}\n` +
                    `📊 Total Videos: ${data.total_vids}`;

    // Send video with caption
    await response.upload('video', videoPath, {
      caption: caption,
      parse_mode: 'Markdown',
      supports_streaming: true
    });

    // Clean up
    setTimeout(() => {
      fs.remove(videoPath).catch(() => {});
    }, 10000);

  } catch (err) {
    console.error('Shoti Error:', err);
    // Set error reaction
    try {
      await bot.setMessageReaction(chatId, messageID, { reaction: [{ type: "emoji", emoji: "❌" }] });
    } catch {}
    response.reply(`❌ Error: ${err.message}`);
  }
}
