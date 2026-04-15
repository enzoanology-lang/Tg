import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const meta = {
  name: 'pinterest',
  aliases: ['pin', 'pinsearch'],
  version: '1.0.1',
  author: 'selov',
  description: 'Search images from Pinterest (up to 10 images)',
  guide: ['/pinterest <search query>', 'Example: /pinterest cute cats'],
  cooldown: 2,
  type: 'anyone',
  category: 'search'
};

// Simple memory per chat
if (!global.pinMemory) global.pinMemory = new Map();

export async function onStart({ args, response, bot, chatId, from, usage }) {
  const query = args.join(' ').trim();

  if (!query) {
    return usage();
  }

  // Get user's first name for memory
  const firstName = from.first_name || 'User';

  // Initialize memory for this chat
  if (!global.pinMemory.has(chatId)) {
    global.pinMemory.set(chatId, []);
  }
  const chatMemory = global.pinMemory.get(chatId);
  chatMemory.push(`${firstName} searched Pinterest for: ${query}`);

  // Send searching indicator
  const statusMsg = await response.reply('🔍 Searching Pinterest...');

  try {
    const apiUrl = `https://rapido-api.vercel.app/api/pin?search=${encodeURIComponent(query)}&count=10&apikey=zk-f50c8cb6ab9a0932f90abe0ea147959f227845da812fbeb30c8e114950a3ddd4`;
    
    const res = await axios.get(apiUrl, { timeout: 20000 });
    
    if (!res.data || !res.data.data || res.data.data.length === 0) {
      await bot.deleteMessage(chatId, statusMsg.message_id);
      return response.reply('❌ No images found for your query.');
    }

    const imageUrls = res.data.data.slice(0, 10); // Limit to 10 max
    const cacheDir = path.join(__dirname, '..', 'cache', 'pinterest');
    await fs.ensureDir(cacheDir);

    const downloadedPaths = [];
    const mediaGroup = [];

    // Download up to 10 images
    for (let i = 0; i < imageUrls.length; i++) {
      try {
        const imageUrl = imageUrls[i];
        const imgPath = path.join(cacheDir, `pin_${Date.now()}_${i}.jpg`);
        
        const imgResponse = await axios.get(imageUrl, {
          responseType: 'arraybuffer',
          timeout: 15000
        });

        await fs.writeFile(imgPath, imgResponse.data);
        downloadedPaths.push(imgPath);

        // Add to media group (only first image gets caption)
        mediaGroup.push({
          type: 'photo',
          media: imgPath,
          caption: i === 0 ? `📌 Pinterest Results\nQuery: "${query}"\n📸 ${imageUrls.length} images found` : '',
          parse_mode: 'Markdown'
        });
      } catch (err) {
        console.error(`Error downloading image ${i + 1}:`, err.message);
      }
    }

    // Delete the status message
    await bot.deleteMessage(chatId, statusMsg.message_id).catch(() => {});

    if (downloadedPaths.length === 0) {
      return response.reply('❌ Failed to download images.');
    }

    // Send as media group (album) – Telegram supports up to 10 items
    await bot.sendMediaGroup(chatId, mediaGroup);

    // Update memory
    chatMemory.push(`Found ${downloadedPaths.length} images for "${query}"`);

    // Cleanup after a short delay
    setTimeout(() => {
      downloadedPaths.forEach(p => fs.remove(p).catch(() => {}));
    }, 10000);

  } catch (err) {
    console.error('Pinterest Command Error:', err);
    await bot.deleteMessage(chatId, statusMsg.message_id).catch(() => {});
    response.reply(`❌ Error: ${err.message}`);
  }
}
