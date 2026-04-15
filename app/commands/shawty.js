import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const meta = {
  name: 'shawty',
  aliases: ['tiktok', 'randomvid'],
  version: '3.0.0',
  author: 'selov',
  description: 'Get random TikTok videos (silent mode)',
  guide: ['/shawty'],
  cooldown: 5,
  type: 'anyone',
  category: 'video'
};

const API_BASE = 'https://oreo.gleeze.com/api';
const API_KEY = '8bba3b09c3bba06c435701f3fba84f83d8e124be47c9a42e07002f4952d24f63';

// List of possible working endpoints to try
const endpoints = [
  `/shawty?api_key=${API_KEY}`,
  `/shawty?stream=false&api_key=${API_KEY}`
];

export async function onStart({ response, bot, chatId, usage }) {
  // Show typing indicator
  await response.action('typing');

  let lastError = null;

  // Try each endpoint until one works
  for (const endpoint of endpoints) {
    try {
      const url = `${API_BASE}${endpoint}`;
      
      const apiResponse = await axios.get(url, { 
        timeout: 10000,
        validateStatus: status => status === 200
      });

      if (apiResponse.data?.success) {
        await processVideo(apiResponse.data, response, bot, chatId);
        return; // Exit after success
      }
    } catch (err) {
      console.log(`Endpoint failed: ${err.message}`);
      lastError = err;
    }
  }

  // If all endpoints failed – silent fail
  console.error('All endpoints failed:', lastError?.message);
}

async function processVideo(data, response, bot, chatId) {
  try {
    // Extract video URL
    let videoUrl = data.url || data.meta?.play || data.meta?.wmplay;
    
    if (!videoUrl) {
      throw new Error("No video URL in response");
    }

    const cacheDir = path.join(__dirname, '..', 'cache', 'shawty');
    await fs.ensureDir(cacheDir);
    
    const filePath = path.join(cacheDir, `shawty_${Date.now()}.mp4`);
    
    // Download video
    const downloadResponse = await axios({
      method: 'GET',
      url: videoUrl,
      responseType: 'stream',
      timeout: 60000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const writer = fs.createWriteStream(filePath);
    downloadResponse.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    // Send ONLY the video – no caption
    await response.upload('video', filePath, {
      supports_streaming: true
    });

    // Clean up
    setTimeout(() => {
      fs.remove(filePath).catch(() => {});
    }, 10000);

  } catch (err) {
    console.error('Processing error:', err);
    // Silent fail – no message to user
  }
}
