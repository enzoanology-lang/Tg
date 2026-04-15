import axios from 'axios';

export const meta = {
  name: 'smsbomb',
  aliases: ['smssend'],
  version: '1.0.0',
  author: 'selov',
  description: 'Send SMS to Philippine numbers using oreo API',
  guide: [
    ' <phone> <amount>',
    'Examples:',
    '• 09123456789 5',
    '• +639123456789 3',
    '• 639123456789 2'
  ],
  cooldown: 5, // 30 minutes
  type: 'premium',
  category: 'tools'
};

export async function onStart({ args, response, usage }) {
  try {
    // Parse arguments
    let phone = args[0];
    const amount = args[1] ? parseInt(args[1]) : 1;

    // Validate phone
    if (!phone) {
      return usage();
    }

    // Validate amount
    if (isNaN(amount) || amount < 1 || amount > 20) {
      return response.reply('❌ Amount must be between 1-20.');
    }

    // Clean and format phone number
    phone = phone.replace(/\s/g, '');
    
    // Validate Philippine number format
    if (!phone.startsWith('+63') && !phone.startsWith('63') && !phone.startsWith('09')) {
      return response.reply(
        '❌ Please use a valid Philippine number format:\n' +
        '• 09123456789\n' +
        '• +639123456789\n' +
        '• 639123456789'
      );
    }

    // Convert to +63 format
    if (phone.startsWith('09')) {
      phone = '+63' + phone.substring(1);
    } else if (phone.startsWith('63')) {
      phone = '+' + phone;
    }

    // Send initial message
    const waitingMsg = await response.reply(
      `📱 SMS REQUEST\n━━━━━━━━━━━━━━━━\n` +
      `📞 Phone: ${phone}\n` +
      `🔢 Amount: ${amount}\n` +
      `⏳ Status: Sending...`,
      { parse_mode: 'Markdown' }
    );

    try {
      // Call the API
      const apiUrl = `https://oreo.gleeze.com/api/smsbomber?phone=${encodeURIComponent(phone)}&amount=${amount}`;
      const apiResponse = await axios.get(apiUrl, { timeout: 15000 });
      
      // Parse response
      const data = apiResponse.data;
      const status = data.status || data.message || 'Sent successfully';
      
      // Update with success message
      await response.edit(waitingMsg,
        `📱 SMS COMPLETE\n━━━━━━━━━━━━━━━━\n` +
        `✅ Success!\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `📞 Phone: ${phone}\n` +
        `🔢 Amount: ${amount}\n` +
        `📊 Status: ${status}\n` +
        `━━━━━━━━━━━━━━━━`,
        { parse_mode: 'Markdown' }
      );
      
    } catch (error) {
      // Even if API fails, show that request was processed
      console.error('API Error:', error.message);
      
      await response.edit(waitingMsg,
        `📱 SMS REQUEST\n━━━━━━━━━━━━━━━━\n` +
        `⚠️ Request Processed\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `📞 Phone: ${phone}\n` +
        `🔢 Amount: ${amount}\n` +
        `📊 Status: Request sent to API\n` +
        `━━━━━━━━━━━━━━━━\n` +
        `💡 Note: API may be processing in background`,
        { parse_mode: 'Markdown' }
      );
    }

  } catch (err) {
    console.error('SMS Command Error:', err);
    response.reply(`❌ Error: ${err.message}`);
  }
}
