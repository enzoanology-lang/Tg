import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// API Configuration
const API_BASE = "https://apiremake-production.up.railway.app/api/chipp";
const API_KEY = "d48ff6e54c518a8ff88fb11b6aa938508e5d4fb65479d8605527a95375ad7faa";

// Store conversation memory per user
if (!global.chippMemory) global.chippMemory = {};

export const meta = {
  name: 'aichip',
  aliases: ['chip', 'chippai'],
  version: '1.0.0',
  author: 'selov',
  description: 'AI assistant with memory, image recognition, web search, and image generation',
  guide: [
    '/aichip <question> - Ask anything',
    '/aichip search <query> - Search web',
    '/aichip generate <prompt> - Generate image',
    '/aichip clear - Clear conversation memory',
    'Reply to an image with /aichip - Describe image'
  ],
  cooldown: 5,
  type: 'anyone',
  category: 'ai'
};

// Helper: Get conversation context
function getConversationContext(senderID, maxHistory = 5) {
  const userMemory = global.chippMemory[senderID];
  if (!userMemory?.history || userMemory.history.length === 0) return "";
  
  const recentHistory = userMemory.history.slice(-maxHistory);
  let context = "Previous conversation:\n";
  
  for (const entry of recentHistory) {
    context += `User: ${entry.prompt}\n`;
    context += `Assistant: ${entry.response}\n`;
  }
  context += "\n";
  
  return context;
}

// Helper: Generate image
async function generateImage(bot, chatId, prompt, response) {
  const waitingMsg = await response.reply(`🎨 Generating image: "${prompt}"...`);
  const messageId = waitingMsg.message_id;
  
  try {
    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true`;
    
    const imgResponse = await axios.get(imageUrl, { responseType: "arraybuffer", timeout: 60000 });
    
    const cacheDir = path.join(__dirname, "..", "cache", "chipp");
    await fs.ensureDir(cacheDir);
    
    const imgPath = path.join(cacheDir, `gen_${Date.now()}.jpg`);
    await fs.writeFile(imgPath, Buffer.from(imgResponse.data));
    
    // Delete waiting message
    try {
      await bot.deleteMessage(chatId, messageId);
    } catch {}
    
    // Send photo with caption
    await bot.sendPhoto(chatId, imgPath, {
      caption: `🎨 Generated Image\n━━━━━━━━━━━━━━━━\n📝 Prompt: ${prompt}`,
      parse_mode: 'Markdown'
    });
    
    // Cleanup
    setTimeout(() => {
      fs.remove(imgPath).catch(() => {});
    }, 10000);
    
  } catch (err) {
    console.error("Generate Error:", err);
    try { await bot.deleteMessage(chatId, messageId); } catch {}
    await response.reply("❌ Failed to generate image. Please try again.");
  }
}

// Helper: Search web
async function searchWeb(bot, chatId, query, response) {
  const waitingMsg = await response.reply(`🔍 Searching: "${query}"...`);
  const messageId = waitingMsg.message_id;
  
  try {
    const searchUrl = `https://restapijay.onrender.com/api/webpilot?q=${encodeURIComponent(query)}`;
    const searchResponse = await axios.get(searchUrl, { timeout: 20000 });
    
    let answer = searchResponse.data?.answer || searchResponse.data?.result || "No results found.";
    
    try { await bot.deleteMessage(chatId, messageId); } catch {}
    
    await response.reply(
      `🔍 **Search Results**\n━━━━━━━━━━━━━━━━\n📝 ${query}\n━━━━━━━━━━━━━━━━\n${answer}`,
      { parse_mode: 'Markdown' }
    );
    
  } catch (err) {
    console.error("Search Error:", err);
    try { await bot.deleteMessage(chatId, messageId); } catch {}
    await response.reply("❌ Search failed. Please try again.");
  }
}

export async function onStart({ args, response, bot, chatId, from, senderID, replyMessage, usage }) {
  let prompt = args.join(' ').trim();
  let imageUrl = null;
  let isImageReply = false;

  // Check if replying to a message with a photo
  if (replyMessage?.photo && replyMessage.photo.length > 0) {
    // Get the largest photo size
    const photo = replyMessage.photo[replyMessage.photo.length - 1];
    try {
      const fileLink = await bot.getFileLink(photo.file_id);
      imageUrl = fileLink;
      isImageReply = true;
      if (!prompt) {
        prompt = "Describe this image in detail.";
      }
    } catch (e) {
      console.error("Failed to get photo link:", e);
    }
  }

  // If no prompt and no image, show help
  if (!prompt && !imageUrl) {
    return usage();
  }

  // Show typing indicator
  await response.action('typing');

  // Check for clear command
  if (prompt.toLowerCase() === "clear") {
    if (global.chippMemory[senderID]) {
      delete global.chippMemory[senderID];
      return response.reply("✅ Conversation memory cleared!");
    }
    return response.reply("📭 No memory to clear.");
  }

  // Check for generate image command
  if (prompt.toLowerCase().startsWith("generate ")) {
    const genPrompt = prompt.slice(9).trim();
    if (!genPrompt) {
      return response.reply("🎨 Please provide an image description.\nExample: /aichip generate a cat wearing a hat");
    }
    return await generateImage(bot, chatId, genPrompt, response);
  }

  // Check for search command
  if (prompt.toLowerCase().startsWith("search ")) {
    const searchQuery = prompt.slice(7).trim();
    return await searchWeb(bot, chatId, searchQuery, response);
  }

  // Regular AI chat (with optional image)
  try {
    // Get or create user session
    let uid = global.chippMemory[senderID]?.uid || senderID;
    
    // Get conversation context
    const conversationContext = getConversationContext(senderID);
    
    // Prepare the API request
    let askPrompt = prompt;
    if (conversationContext) {
      askPrompt = `${conversationContext}User: ${prompt}\nAssistant:`;
    }

    // Build API URL
    let apiUrl = `${API_BASE}?ask=${encodeURIComponent(askPrompt)}&uid=${uid}&roleplay=&img_url=${imageUrl ? encodeURIComponent(imageUrl) : ''}&api_key=${API_KEY}`;

    const apiResponse = await axios.get(apiUrl, { timeout: 60000 });
    
    if (!apiResponse.data) {
      throw new Error("No response from API");
    }
    
    let answer = apiResponse.data?.answer || "No response from Chipp.";
    const newUid = apiResponse.data?.uid || uid;
    
    // Store in memory
    if (!global.chippMemory[senderID]) {
      global.chippMemory[senderID] = {
        uid: newUid,
        history: []
      };
    }
    global.chippMemory[senderID].uid = newUid;
    global.chippMemory[senderID].history.push({
      prompt: prompt,
      response: answer,
      timestamp: Date.now(),
      hasImage: !!imageUrl
    });
    
    // Limit history to last 15
    if (global.chippMemory[senderID].history.length > 15) {
      global.chippMemory[senderID].history.shift();
    }
    
    // Send response
    let responseMsg = answer;
    if (isImageReply) {
      responseMsg = `🖼️ Image Analysis\n━━━━━━━━━━━━━━━━\n${answer}`;
    }
    
    return response.reply(responseMsg, { parse_mode: 'Markdown' });
    
  } catch (err) {
    console.error("Chipp Error:", err);
    
    let errorMsg = "❌ Chipp is currently unavailable. Please try again later.";
    
    if (err.code === 'ECONNABORTED') {
      errorMsg = "❌ Request timed out. The server may be waking up. Please try again in a moment.";
    }
    
    return response.reply(errorMsg);
  }
}
