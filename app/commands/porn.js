import axios from 'axios';

export const meta = {
  name: 'porn',
  aliases: ['randvideo'],
  version: '4.0.1',
  author: 'selov',
  description: 'Get a random video link from eporner',
  guide: ['/porn'],
  cooldown: 5,
  type: 'premium',
  category: 'video'
};

export async function onStart({ response, bot, chatId, from }) {
  const firstName = from.first_name || 'User';
  const waitingMsg = await response.reply('🔍 Fetching random video...');

  try {
    const apiUrl = 'https://betadash-api-swordslush-production.up.railway.app/eporner?page=1';
    const { data } = await axios.get(apiUrl, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    const videos = data.result || [];
    if (!videos.length) {
      return response.edit(waitingMsg, '❌ No videos found.');
    }

    const video = videos[Math.floor(Math.random() * videos.length)];
    const videoUrl = video.videoUrl;
    const title = video.title || 'Untitled';

    if (!videoUrl) {
      return response.edit(waitingMsg, '❌ Missing video URL.');
    }

    const caption = `🎬 Random Video\n━━━━━━━━━━━━━━━━\n` +
                    `Title: ${title}\n` +
                    `Link: ${videoUrl}\n` +
                    `━━━━━━━━━━━━━━━━\n` +
                    `💬 Requested by: ${firstName}`;

    // Delete the waiting message and send the final response
    await bot.deleteMessage(chatId, waitingMsg.message_id).catch(() => {});
    await response.reply(caption, { parse_mode: 'Markdown', disable_web_page_preview: false });

  } catch (err) {
    console.error('Katorsex Error:', err);
    const errorMsg = err.response ? `API status ${err.response.status}` : err.message;
    await response.edit(waitingMsg, `❌ Error: ${errorMsg}`).catch(() => {
      response.reply(`❌ Error: ${errorMsg}`);
    });
  }
}
