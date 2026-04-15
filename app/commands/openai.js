import axios from 'axios';

export const meta = {
  name: 'openai',
  aliases: ['open', 'jay'],
  version: '1.1.0',
  author: 'selov',
  description: 'Chat with OpenAI (text only)',
  guide: [
    '/openai <question>',
    'Examples:',
    '• /openai hi',
    '• /openai what model are you?',
    '• /openai what is love?'
  ],
  cooldown: 3,
  type: 'anyone',
  category: 'ai'
};

// Store conversation memory per user (session IDs)
if (!global.openaiMemory) global.openaiMemory = {};

export async function onStart({ args, response, senderID, usage }) {
  const prompt = args.join(' ').trim();

  if (!prompt) {
    return usage();
  }

  // Show typing indicator
  await response.action('typing');

  try {
    // Call the API with uid for session persistence
    const apiUrl = `https://restapijay.onrender.com/api/jay?prompt=${encodeURIComponent(prompt)}&uid=${senderID}`;
    
    const apiResponse = await axios.get(apiUrl, { timeout: 30000 });
    
    // Extract response text
    let replyText = apiResponse.data?.response || 
                    apiResponse.data?.answer || 
                    apiResponse.data?.result ||
                    "Sorry, I couldn't process that request.";
    
    // Save session ID if provided (for future context)
    if (apiResponse.data?.session_id) {
      global.openaiMemory[senderID] = apiResponse.data.session_id;
    }
    
    // Clean up the response
    replyText = replyText.replace(/```/g, '').trim();
    
    // Send ONLY the answer
    return response.reply(replyText);
    
  } catch (err) {
    console.error("OpenAI Error:", err);
    
    let errorMsg = "❌ pasensya na diko ma process ang iyong requests. balik kanalang.";
    
    if (err.code === 'ECONNABORTED') {
      errorMsg = "❌ walang kanang oras extend kanalang. balik ka mayamaya.";
    } else if (err.response?.status === 500) {
      errorMsg = "❌ sira ang server kasi may problema. Please try again later.";
    }
    
    return response.reply(errorMsg);
  }
}
