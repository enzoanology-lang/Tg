import axios from 'axios';

export const meta = {
  name: 'aigpt',
  aliases: ['gptai', 'ask', 'biblegpt'],
  version: '5.0.0',
  author: 'selov',
  description: 'AI-powered Bible study assistant with empathetic responses',
  guide: [
    '/aigpt <question> - Ask about the Bible or Christian living',
    'Examples:',
    '• /aigpt What does the Bible say about forgiveness?',
    '• /aigpt Explain John 3:16',
    '• /aigpt Nagkasala ako, ano ang gagawin ko?'
  ],
  cooldown: 3,
  type: 'anyone',
  category: 'religion'
};

// Store user conversation history globally
if (!global.bibleAIUsers) global.bibleAIUsers = {};

// Bible context for the AI with proper emotional awareness
const BIBLE_CONTEXT = `You are BibleGPT, a compassionate AI assistant focused on answering questions about the Bible, theology, and Christian living.

IMPORTANT RULES:
1. Base your answers on Scripture.
2. Be EMOTIONALLY AWARE and EMPATHETIC:
   - If the user mentions sin, guilt, sadness, or mistakes → Be gentle, compassionate, and offer hope (DO NOT use cheerful greetings like "Ang saya naman")
   - If the user mentions joy or gratitude → Be warm and cheerful (can use "Ang saya naman" or similar)
   - Match the user's emotional tone
3. FORMATTING RULES (CRITICAL):
   - If your answer is LONG (more than 3 sentences) → Format as TWO PARAGRAPHS with a blank line between them
   - If your answer is SHORT (3 sentences or less) → Format as ONE PARAGRAPH only
   - Example of two paragraphs:
     "First paragraph content here.
     
     Second paragraph content here."
4. Use Taglish (Tagalog + English) naturally
5. Always offer hope and point to God's grace

EMOTIONAL GUIDELINES:
- For sin/guilt topics: "Alam kong hindi madali..." / "Naiintindihan ko ang bigat na nadarama mo..." / "God's grace is sufficient..."
- For sad topics: "I'm sorry to hear that..." / "Nakikiisa ako sa iyo..."
- For joyful topics: "Ang saya naman!" / "That's wonderful to hear!"`;

export async function onStart({ args, response, from, senderID, usage }) {
  const userQuestion = args.join(' ').trim();

  if (!userQuestion) {
    return usage();
  }

  // Initialize user memory if not exists
  if (!global.bibleAIUsers[senderID]) {
    global.bibleAIUsers[senderID] = {
      history: [],
      lastQuestion: null
    };
  }

  // Get user's first name for personalization
  const firstName = from.first_name || 'kaibigan';

  // Show typing indicator
  await response.action('typing');

  try {
    // Detect emotional tone from question
    let emotionalContext = "";
    const sadKeywords = ["nagkasala", "kasalanan", "sad", "malungkot", "guilty", "error", "mistake", "failure", "mali", "pagsisisi", "kasalanan", "sorry", "patawad"];
    const happyKeywords = ["salamat", "thank", "grateful", "saya", "happy", "blessed", "pinagpala", "maganda", "masaya"];
    
    const lowerQuestion = userQuestion.toLowerCase();
    const isSad = sadKeywords.some(keyword => lowerQuestion.includes(keyword));
    const isHappy = happyKeywords.some(keyword => lowerQuestion.includes(keyword));
    
    if (isSad) {
      emotionalContext = "The user is expressing guilt, sadness, or concern about sin. Be GENTLE, COMPASSIONATE, and offer HOPE. DO NOT use cheerful greetings like 'Ang saya naman'. Start with empathy like: 'Alam kong hindi madali ang pinagdadaanan mo...' or 'Naiintindihan ko ang bigat na nadarama mo...'";
    } else if (isHappy) {
      emotionalContext = "The user seems joyful or grateful. You can be warm and cheerful. You may use greetings like 'Ang saya naman!'";
    } else {
      emotionalContext = "Neutral tone. Be warm and helpful. Do not use overly cheerful greetings unless the user seems happy.";
    }
    
    // Add conversation history for context
    const recentHistory = global.bibleAIUsers[senderID].history.slice(-3);
    
    let fullPrompt = `${BIBLE_CONTEXT}\n\n`;
    
    // Add conversation history if exists
    if (recentHistory.length > 0) {
      fullPrompt += `Previous conversation:\n`;
      for (const entry of recentHistory) {
        fullPrompt += `User: ${entry.question}\n`;
        fullPrompt += `Assistant: ${entry.answer}\n\n`;
      }
    }
    
    // Add current question with user's name and emotional context
    fullPrompt += `EMOTIONAL CONTEXT: ${emotionalContext}\n\n`;
    fullPrompt += `User: ${firstName} asked: ${userQuestion}\n\n`;
    fullPrompt += `Assistant: Provide a Bible-based response that is emotionally appropriate. Follow the formatting rules: use TWO PARAGRAPHS with blank line for long answers, ONE PARAGRAPH for short answers.`;

    // Call the Vern REST API
    const aiResponse = await axios.get(
      `https://vern-rest-api.vercel.app/api/chatgpt4?prompt=${encodeURIComponent(fullPrompt)}`,
      { timeout: 30000 }
    );

    let answer = aiResponse.data?.result || 
                 aiResponse.data?.response || 
                 aiResponse.data?.message || 
                 aiResponse.data?.answer ||
                 "I'm sorry, I couldn't generate a response. Please try again.";

    // Clean up the answer
    answer = answer.replace(/```/g, '').trim();

    // Ensure proper paragraph formatting
    const sentenceCount = (answer.match(/[.!?]+/g) || []).length;
    
    // If answer is long (more than 3 sentences) and doesn't have paragraph breaks, try to split it
    if (sentenceCount > 3 && !answer.includes('\n\n')) {
      // Find a good place to split (after a sentence ending with period)
      const sentences = answer.match(/[^.!?]+[.!?]+/g);
      if (sentences && sentences.length > 1) {
        // Calculate split point (around halfway)
        const splitPoint = Math.ceil(sentences.length / 2);
        const firstPara = sentences.slice(0, splitPoint).join(' ').trim();
        const secondPara = sentences.slice(splitPoint).join(' ').trim();
        
        if (secondPara.length > 0) {
          answer = `${firstPara}\n\n${secondPara}`;
        }
      }
    }

    // Store conversation in memory
    global.bibleAIUsers[senderID].history.push({
      question: userQuestion,
      answer: answer,
      timestamp: Date.now()
    });

    // Limit history to last 20 exchanges
    if (global.bibleAIUsers[senderID].history.length > 20) {
      global.bibleAIUsers[senderID].history.shift();
    }

    // Send the answer
    return response.reply(answer, { parse_mode: 'Markdown' });

  } catch (err) {
    console.error("BibleGPT Error:", err);
    
    let errorMsg = "❌ Sorry, I couldn't generate a response. Please try again.";
    
    if (err.response?.status === 400) {
      errorMsg = "❌ Invalid request. Please try a different question.";
    } else if (err.code === 'ECONNABORTED') {
      errorMsg = "❌ Request timed out. Please try again.";
    }
    
    return response.reply(errorMsg);
  }
}
