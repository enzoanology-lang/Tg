import axios from 'axios';

export const meta = {
  name: 'aria',
  aliases: ['askaria', 'ariaai'],
  version: '2.0.0',
  author: 'selov',
  description: 'AI assistant Aria',
  guide: ['/aria <question>', 'Example: /aria Who is Selov Asx on Facebook?'],
  cooldown: 10,
  type: 'anyone',
  category: 'ai'
};

const API_URL = "https://apiremake-production.up.railway.app/api/aria";
const API_KEY = "d48ff6e54c518a8ff88fb11b6aa938508e5d4fb65479d8605527a95375ad7faa";

export async function onStart({ args, response, usage }) {
  const prompt = args.join(' ').trim();

  if (!prompt) {
    return usage();
  }

  // Show typing indicator
  await response.action('typing');

  try {
    // Call the Aria API with API key
    const apiUrl = `${API_URL}?ask=${encodeURIComponent(prompt)}&stream=false&api_key=${API_KEY}`;
    
    const apiResponse = await axios.get(apiUrl, { 
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });
    
    // Extract data from response
    const answer = apiResponse.data?.answer || "No answer found.";
    const sources = apiResponse.data?.sources || [];
    
    // Format the response with answer and sources
    let resultMsg = `${answer}\n\n`;
    
    if (sources.length > 0) {
      resultMsg += `📚 Sources:\n`;
      sources.forEach((source, index) => {
        resultMsg += `${index + 1}. ${source.title}\n`;
        resultMsg += `   ${source.url}\n`;
      });
    }
    
    // Send answer with sources
    return response.reply(resultMsg.trim(), { parse_mode: 'Markdown' });
    
  } catch (err) {
    console.error("Aria Error:", err);
    
    let errorMsg = "❌ Aria is currently unavailable. Please try again later.";
    
    if (err.code === 'ECONNABORTED') {
      errorMsg = "❌ Request timed out. The server may be waking up. Please try again in a moment.";
    }
    
    return response.reply(errorMsg);
  }
}
