import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const meta = {
  name: 'katorsex',
  aliases: ['randvideo'],
  version: '5.0.0',
  author: 'selov',
  description: 'Get one random video (video only, no text)',
  guide: ['/katorsex'],
  cooldown: 5,
  type: 'anyone',
  category: 'video'
};

export async function onStart({ bot, chatId, messageID, args, response }) {
  // 发送处理中提示（使用原生 bot 发送消息，然后获取 message_id 用于后续删除）
  let statusMsg;
  try {
    statusMsg = await bot.sendMessage(chatId, '🔍 Fetching random video...');
  } catch (e) {
    // 如果连消息都发不出，直接返回
    return;
  }

  try {
    const apiUrl = 'https://betadash-api-swordslush-production.up.railway.app/katorsex?page=1';
    const { data } = await axios.get(apiUrl, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    // 兼容多种返回格式
    const videos = data.results || data.result || data.data || [];
    if (!videos.length) {
      await bot.editMessageText('❌ No videos found.', {
        chat_id: chatId,
        message_id: statusMsg.message_id
      });
      return;
    }

    const video = videos[Math.floor(Math.random() * videos.length)];
    const videoUrl = video.videoUrl || video.url || video.src;

    if (!videoUrl) {
      await bot.editMessageText('❌ Missing video URL.', {
        chat_id: chatId,
        message_id: statusMsg.message_id
      });
      return;
    }

    await bot.editMessageText('📥 Downloading video...', {
      chat_id: chatId,
      message_id: statusMsg.message_id
    });

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

    // 删除状态消息
    await bot.deleteMessage(chatId, statusMsg.message_id).catch(() => {});

    // 直接发送视频（无 caption）
    await bot.sendVideo(chatId, videoPath, {
      supports_streaming: true,
      reply_to_message_id: messageID
    });

    // 清理缓存
    setTimeout(() => fs.remove(videoPath).catch(() => {}), 60000);

  } catch (err) {
    console.error('Katorsex Error:', err);
    const errorMsg = err.response ? `API status ${err.response.status}` : err.message;
    await bot.editMessageText(`❌ Error: ${errorMsg}`, {
      chat_id: chatId,
      message_id: statusMsg.message_id
    }).catch(() => {});
  }
}
