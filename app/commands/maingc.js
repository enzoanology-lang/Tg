export const meta = {
  name: 'maingc',
  aliases: ['support', 'supportgc', 'joingc'],
  version: '1.0.0',
  author: 'selov',
  description: 'Get the invite link to the official main group chat',
  guide: ['/maingc'],
  cooldown: 3,
  type: 'anyone',
  category: 'system'
};

// Your Telegram support group ID or invite link
const SUPPORT_GROUP_ID = '-1003839524499'; // Replace with your actual group ID
const INVITE_LINK = 'https://t.me/+_qP8ZyWOXahmY2Rl'; // Replace with your actual invite link

export async function onStart({ response, bot, senderID, chatId }) {
  try {
    // Check if the user is already in the support group
    let isMember = false;
    try {
      const member = await bot.getChatMember(SUPPORT_GROUP_ID, senderID);
      // Status can be 'member', 'administrator', 'creator', 'left', 'kicked', 'restricted'
      if (['member', 'administrator', 'creator'].includes(member.status)) {
        isMember = true;
      }
    } catch (err) {
      // User not found or bot can't check (maybe not in group)
      console.log('[Support] Could not check membership:', err.message);
    }

    if (isMember) {
      return response.reply(
        `✅ You are already a member of our support group!\n\n` +
        `📌 Group Link:\n${INVITE_LINK}`,
        { parse_mode: 'Markdown' }
      );
    }

    // Send waiting message
    await response.action('typing');

    // Provide invite link (Telegram bots cannot forcibly add users to groups)
    await response.reply(
      `🔄 Join our official support group\n\n` +
      `Click the link below to join:\n` +
      `👉 ${INVITE_LINK}\n\n` +
      `After joining, you can ask questions and get help directly.`,
      { parse_mode: 'Markdown', disable_web_page_preview: true }
    );

  } catch (err) {
    console.error('Support Command Error:', err);
    response.reply(
      `❌ Error: ${err.message}\n\n` +
      `📌 Manual Join:\n${INVITE_LINK}`,
      { parse_mode: 'Markdown', disable_web_page_preview: true }
    );
  }
}
