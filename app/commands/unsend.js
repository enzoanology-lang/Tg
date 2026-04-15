export const meta = {
  name: 'unsend',
  aliases: ['unsent', 'remove', 'rm', 'delete'],
  version: '1.0.1',
  author: 'selov',
  description: "Remove bot's sent messages",
  guide: ['Reply to a bot message with /unsend'],
  cooldown: 2,
  type: 'anyone',
  category: 'utility'
};

export async function onStart({ response, bot, chatId, message, replyMessage, messageID }) {
  try {
    // The framework may provide replyMessage, but fallback to raw message object
    const repliedMsg = replyMessage || message?.reply_to_message;

    if (!repliedMsg) {
      return response.reply('❌ Please reply to the bot message you want to delete.');
    }

    // Get bot's own ID
    const me = await bot.getMe();

    // Check if the replied message is from the bot
    if (repliedMsg.from.id !== me.id) {
      return response.reply('❌ I can only delete my own messages.');
    }

    // Attempt to delete
    await bot.deleteMessage(chatId, repliedMsg.message_id);

    // Optionally react with a checkmark to confirm
    try {
      await bot.setMessageReaction(chatId, messageID, { reaction: [{ type: 'emoji', emoji: '✅' }] });
    } catch {}

  } catch (err) {
    console.error('Unsend Error:', err);
    return response.reply(`❌ Failed to delete: ${err.message}`);
  }
}
