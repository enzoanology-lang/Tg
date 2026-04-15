import axios from 'axios';

export const meta = {
  name: 'aihumanize',
  aliases: ['humanize'],
  version: '1.0.0',
  author: 'selov',
  description: 'Makes text sound more human-like and conversational',
  guide: [
    '/aihumanize <text>',
    'Reply to a message with /aihumanize'
  ],
  cooldown: 5,
  type: 'anyone',
  category: 'ai'
};

export async function onStart({ args, response, replyMessage, usage }) {
  // Get text from either reply or direct input
  let text = '';

  if (replyMessage?.text) {
    text = replyMessage.text;
  } else {
    text = args.join(' ').trim();
  }

  if (!text) {
    return usage();
  }

  // Show typing indicator
  await response.action('typing');

  try {
    // Call the humanize API
    const apiResponse = await axios.get(
      `https://hutchingd-ccprojectsjonell.hf.space/api/aihuman?text=${encodeURIComponent(text)}`
    );

    if (apiResponse.data && apiResponse.data.message) {
      const humanizedText = apiResponse.data.message;

      // Format the response
      const formattedResponse =
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🔄 HUMANIZED TEXT\n` +
        `━━━━━━━━━━━━━━━━━━━━\n\n` +
        `${humanizedText}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `💡 Original: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`;

      await response.reply(formattedResponse, { parse_mode: 'Markdown' });
    } else {
      await response.reply('❌ Failed to humanize text. Please try again.');
    }
  } catch (error) {
    console.error('Error in humanize command:', error);
    await response.reply('❌ An error occurred while humanizing your text. Please try again later.');
  }
}
