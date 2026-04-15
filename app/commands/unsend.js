export const meta = {
  name: 'unsend',
  aliases: ['unsent', 'remove', 'rm', 'delete'],
  version: '1.0.0',
  author: 'selov',
  description: "Remove bot's sent messages",
  guide: ['Reply to a bot message with /unsend'],
  cooldown: 2,
  type: 'anyone',
  category: 'utility'
};

export async function onStart({ response, bot, chatId, replyMessage, messageID }) {
  try {
    // Check if user replied to a message
    if (!replyMessage) {
      return response.reply('❌ Please reply to the bot message you want to delete.');
    }

    // Check if the replied message is from the bot itself
    const me = await bot.getMe();
    if (replyMessage.from.id !== me.id) {
      return response.reply('❌ I can only delete my own messages.');
    }

    // Attempt to delete the message
    try {
      await bot.deleteMessage(chatId, replyMessage.message_id);
      
      // React with a checkmark to confirm (optional)
      try {
        await bot.setMessageReaction(chatId, messageID, { reaction: [{ type: 'emoji', emoji: '✅' }] });
      } catch {}
      
    } catch (deleteErr) {
      console.error('Unsend Error:', deleteErr);
      return response.reply('❌ Failed to delete the message. It might be too old or already deleted.');
    }

  } catch (err) {
    console.error('Unsend Command Error:', err);
    return response.reply(`❌ Error: ${err.message}`);
  }
}
