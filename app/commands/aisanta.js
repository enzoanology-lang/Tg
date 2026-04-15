import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const meta = {
  name: 'aisanta',
  aliases: ['santa', 'santaai'],
  version: '1.0.0',
  author: 'selov',
  description: 'AI with Santa voice response (audio only)',
  guide: ['/aisanta <question>'],
  cooldown: 5,
  type: 'anyone',
  category: 'ai'
};

// Store user sessions in global memory
if (!global.aiv3Memory) global.aiv3Memory = {};

export async function onStart({ args, response, bot, chatId, senderID, usage }) {
  const prompt = args.join(' ').trim();

  if (!prompt) {
    return; // Silent fail
  }

  // Show typing indicator
  await response.action('typing');

  try {
    // Step 1: Get AI response from ChatGPT API
    const aiUrl = `https://restapijay.onrender.com/api/Chatgpt?prompt=${encodeURIComponent(prompt)}&uid=${senderID}`;
    
    const aiResponse = await axios.get(aiUrl, { timeout: 20000 });
    
    let aiText = aiResponse.data?.response || 
                 aiResponse.data?.answer || 
                 "Sorry, I couldn't process that request.";
    
    // Store conversation in memory
    if (!global.aiv3Memory[senderID]) {
      global.aiv3Memory[senderID] = [];
    }
    global.aiv3Memory[senderID].push({
      prompt: prompt,
      response: aiText,
      timestamp: Date.now()
    });
    
    // Limit memory to last 10 exchanges
    if (global.aiv3Memory[senderID].length > 10) {
      global.aiv3Memory[senderID].shift();
    }
    
    // Step 2: Convert AI response to Santa voice TTS
    const ttsUrl = `https://restapijay.onrender.com/api/svara/tts?text=${encodeURIComponent(aiText)}&voice=Santa`;
    
    const ttsResponse = await axios.get(ttsUrl, { timeout: 30000 });
    
    const audioUrl = ttsResponse.data?.audio_url;
    
    if (!audioUrl) {
      throw new Error("No audio URL received");
    }
    
    // Create cache directory
    const cacheDir = path.join(__dirname, '..', 'cache', 'aiv3');
    await fs.ensureDir(cacheDir);
    
    const audioPath = path.join(cacheDir, `aiv3_${Date.now()}.wav`);
    
    // Download audio file
    const audioResponse = await axios.get(audioUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });
    
    await fs.writeFile(audioPath, audioResponse.data);
    
    // Check file size
    const stats = await fs.stat(audioPath);
    if (stats.size === 0) {
      throw new Error("Downloaded audio file is empty");
    }
    
    // Send ONLY audio (no text)
    await response.upload('audio', audioPath, {
      reply_to_message_id: response.message_id
    });
    
    // Clean up after a short delay
    setTimeout(() => {
      fs.remove(audioPath).catch(() => {});
    }, 10000);
    
  } catch (err) {
    console.error("AISanta Error:", err);
    // Silent fail – no error message to user
  }
}
