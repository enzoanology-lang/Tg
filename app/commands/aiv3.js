import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const meta = {
  name: 'aiv3',
  aliases: ['selov', 'voiceai', 'aitts'],
  version: '5.0.0',
  author: 'selov',
  description: 'AI with Tsundere voice TTS (AI response delivered as audio only)',
  guide: ['/aiv3 <question>'],
  cooldown: 5,
  type: 'anyone',
  category: 'ai'
};

// Store conversation memory per user
if (!global.aiv3Memory) global.aiv3Memory = {};

// API endpoints
const CHAT_API = "https://restapijay.onrender.com/api/chatgptfree";
const TTS_API = "https://restapijay.onrender.com/api/api/ai/tsundere";

export async function onStart({ args, response, bot, chatId, senderID, usage }) {
  const prompt = args.join(' ').trim();

  if (!prompt) {
    return; // Silent fail (no help message)
  }

  // Show typing indicator
  await response.action('typing');

  try {
    // Step 1: Get AI response from ChatGPT API
    const aiUrl = `${CHAT_API}?prompt=${encodeURIComponent(prompt)}`;
    
    const aiResponse = await axios.get(aiUrl, { timeout: 30000 });
    
    let aiText = aiResponse.data?.result?.answer || 
                 aiResponse.data?.answer || 
                 "Sorry, I couldn't process that request.";
    
    // Store in memory
    if (!global.aiv3Memory[senderID]) {
      global.aiv3Memory[senderID] = [];
    }
    global.aiv3Memory[senderID].push({
      prompt: prompt,
      response: aiText,
      timestamp: Date.now()
    });
    
    // Limit memory to last 10
    if (global.aiv3Memory[senderID].length > 10) {
      global.aiv3Memory[senderID].shift();
    }
    
    // Step 2: Convert AI response to Tsundere voice
    const ttsUrl = `${TTS_API}?text=${encodeURIComponent(aiText)}`;
    
    const ttsResponse = await axios.get(ttsUrl, { timeout: 30000 });
    
    // Get audio URL from response
    const audioUrl = ttsResponse.data?.result?.audio || 
                     ttsResponse.data?.audio;
    
    if (!audioUrl) {
      console.log("TTS Response:", JSON.stringify(ttsResponse.data, null, 2));
      throw new Error("No audio URL received");
    }
    
    // Create cache directory
    const cacheDir = path.join(__dirname, '..', 'cache', 'aiv3');
    await fs.ensureDir(cacheDir);
    
    // Determine file extension from URL or default to mp3
    const fileExt = audioUrl.split('.').pop() || 'mp3';
    const audioPath = path.join(cacheDir, `aiv3_${Date.now()}.${fileExt}`);
    
    // Download audio
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
    console.error("AIv3 Error:", err);
    // Silent fail – no error message sent to user
  }
}
