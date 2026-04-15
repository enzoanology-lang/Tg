import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const meta = {
  name: 'ai',
  aliases: ['ask', 'voice'],
  version: '5.0.0',
  author: 'selov',
  description: 'AI assistant that replies with a voice message (knows your name).',
  guide: ['<question>'],
  cooldown: 3,
  type: 'anyone',
  category: 'ai'
};

// Simple in‑memory storage per chat
if (!global.aiMemory) global.aiMemory = new Map();

function detectLanguage(text) {
  const tagalogPattern = /[ngmga]|ako|ikaw|siya|tayo|kami|kayo|sila|maganda|pangit|mabuti|masama|kumain|inom|tulog|laro|araw|gabi|bahay|tao|aso|pusa|gimingaw|nimo|ako|ikaw|siya|kami|kamo|sila/gi;
  const tagalogWords = (text.match(tagalogPattern) || []).length;
  const totalWords = text.split(/\s+/).length;
  const tagalogRatio = tagalogWords / totalWords;
  
  if (tagalogRatio > 0.15) return "tl";       // Tagalog / Cebuano
  if (/[ñáéíóúü¿¡]/i.test(text)) return "es"; // Spanish
  if (/[çãõáéíóúâêîôûà]/i.test(text)) return "pt"; // Portuguese
  if (/[àâäéèêëïîôöùûüÿç]/i.test(text)) return "fr"; // French
  if (/[äöüß]/i.test(text)) return "de";      // German
  return "en";
}

function getGoogleTtsUrl(text, lang) {
  const encodedText = encodeURIComponent(text.substring(0, 200));
  return `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&client=tw-ob&q=${encodedText}`;
}

async function getStreamElementsTts(text, voice = "Joey") {
  try {
    const encodedText = encodeURIComponent(text.substring(0, 200));
    const url = `https://api.streamelements.com/kappa/v2/speech?voice=${voice}&text=${encodedText}`;
    const response = await axios.get(url, { responseType: "arraybuffer", timeout: 15000 });
    return response.data;
  } catch {
    return null;
  }
}

export async function onStart({ args, response, config, groq, senderID, from, bot, chatId, usage }) {
  let prompt = args.join(' ').trim();
  const firstName = from.first_name || 'User';
  const fullName = [from.first_name, from.last_name].filter(Boolean).join(' ') || firstName;

  // --- Initialize memory for this chat ---
  if (!global.aiMemory.has(chatId)) {
    global.aiMemory.set(chatId, {
      users: new Map(),
      conversations: []
    });
  }
  const memory = global.aiMemory.get(chatId);
  
  // Track user info
  const userKey = senderID;
  if (!memory.users.has(userKey)) {
    memory.users.set(userKey, {
      name: fullName,
      firstName,
      interactions: 0,
      lastSeen: Date.now()
    });
  }
  const userRecord = memory.users.get(userKey);
  userRecord.interactions++;
  userRecord.lastSeen = Date.now();

  // --- Handle no prompt ---
  if (!prompt) {
    return usage();
  }

  // --- Indicate typing ---
  await response.action('typing');

  try {
    // --- Enhance prompt with user's name ---
    const enhancedPrompt = `The user's name is ${firstName} (full name: ${fullName}). 
Please address them by their name in your response naturally. 
Keep your response warm, friendly, and concise. 
If they say "gimingaw nako nimo" or similar, respond with warmth and care.
Respond in Taglish or English naturally. Question: ${prompt}`;

    // --- Get AI response (using the same endpoint or replace with Groq if desired) ---
    const aiUrl = `https://vern-rest-api.vercel.app/api/chatgpt4?prompt=${encodeURIComponent(enhancedPrompt)}`;
    const aiResponse = await axios.get(aiUrl, { timeout: 20000 });

    let replyText = "I'm sorry, I couldn't process that request.";
    if (aiResponse.data) {
      if (aiResponse.data.result) replyText = aiResponse.data.result;
      else if (aiResponse.data.response) replyText = aiResponse.data.response;
      else if (aiResponse.data.message) replyText = aiResponse.data.message;
      else if (aiResponse.data.answer) replyText = aiResponse.data.answer;
      else if (typeof aiResponse.data === 'string') replyText = aiResponse.data;
    }

    // --- Personalise the reply (add name if missing) ---
    if (!replyText.toLowerCase().includes(firstName.toLowerCase()) && replyText.length > 20) {
      const greetings = ["Hello", "Hi", "Hey", "Kumusta", "Musta", "Oi", "Hoy"];
      const hasGreeting = greetings.some(g => replyText.toLowerCase().startsWith(g.toLowerCase()));
      if (hasGreeting) {
        replyText = replyText.replace(/(Hello|Hi|Hey|Kumusta|Musta|Oi|Hoy)/i, `$1 ${firstName}`);
      } else if (replyText.length > 30) {
        replyText = `${firstName}, ${replyText}`;
      }
    }

    // --- Limit length for TTS ---
    if (replyText.length > 200) {
      replyText = replyText.substring(0, 197) + "...";
    }

    // --- Store conversation ---
    memory.conversations.push({
      user: senderID,
      userName: firstName,
      prompt,
      response: replyText,
      timestamp: Date.now()
    });
    if (memory.conversations.length > 10) memory.conversations.shift();

    // --- Generate voice ---
    const detectedLang = detectLanguage(replyText);
    console.log(`[AI Voice] Lang: ${detectedLang} | User: ${firstName} | Reply: ${replyText.substring(0, 50)}`);

    let audioData = await getStreamElementsTts(replyText, 
      detectedLang === 'tl' ? 'Joey' :
      detectedLang === 'es' ? 'Mia' :
      detectedLang === 'fr' ? 'Chantal' :
      detectedLang === 'de' ? 'Hans' : 'Joey'
    );

    if (!audioData) {
      // Fallback to Google TTS
      const ttsUrl = getGoogleTtsUrl(replyText, detectedLang);
      const googleResp = await axios.get(ttsUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Referer': 'https://translate.google.com/'
        }
      });
      audioData = googleResp.data;
    }

    if (!audioData || audioData.length < 1000) {
      throw new Error('Audio generation failed');
    }

    // --- Save to temp file and send ---
    const cacheDir = path.join(__dirname, '..', 'cache', 'ai_tts');
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

    const audioPath = path.join(cacheDir, `ai_tts_${Date.now()}.mp3`);
    fs.writeFileSync(audioPath, audioData);

    await bot.sendVoice(chatId, audioPath, {}, {
      contentType: 'audio/mpeg',
      filename: 'ai_response.mp3'
    });

    // Clean up after a short delay
    setTimeout(() => {
      try {
        if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
      } catch {}
    }, 5000);

  } catch (err) {
    console.error('[AI Voice] Error:', err.message);
    // Silent fail – no error message to user (as in original)
  }
}
