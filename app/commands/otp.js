import axios from 'axios';

export const meta = {
  name: 'otp',
  aliases: ['tempnumber', 'otpbox'],
  version: '1.1.0',
  author: 'selov',
  description: 'Generate temp numbers and check OTP inbox (with refresh)',
  guide: [
    ' gen — Generate a temporary number',
    ' inbox <phone> — Check messages',
    ' refresh <phone> — Force fetch latest messages',
    'Example: /otp gen → /otp inbox 584163456064'
  ],
  cooldown: 5,
  type: 'premium',
  category: 'tools'
};

const API_BASE = "https://weak-deloris-nothing672434-fe85179d.koyeb.app/api/otps?limit=500";

// Store generated numbers per user
if (!global.userNumbers) global.userNumbers = new Map();

// Helper: decode HTML entities in message text
function decodeHtml(html) {
  return html
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

// Helper: fetch and filter messages for a phone number
async function fetchMessagesForPhone(phone) {
  const res = await axios.get(API_BASE, { timeout: 10000 });
  const entries = res.data.otps || [];
  const normalizedPhone = phone.replace(/[\s\-]/g, '');
  
  return entries.filter(e => {
    const num = (e.number || '').replace(/[\s\-]/g, '');
    return num === normalizedPhone || num.endsWith(normalizedPhone) || normalizedPhone.endsWith(num);
  });
}

export async function onStart({ args, response, senderID, usage }) {
  const subCommand = (args[0] || '').toLowerCase();

  // ----- GEN -----
  if (subCommand === 'gen') {
    try {
      const res = await axios.get(API_BASE, { timeout: 10000 });
      const entries = res.data.otps || [];
      if (!entries.length) {
        return response.reply('❌ No numbers available right now.');
      }

      const uniqueNumbers = [...new Set(entries.map(e => e.number).filter(Boolean))];
      if (!uniqueNumbers.length) {
        return response.reply('❌ Could not parse numbers.');
      }

      const picked = uniqueNumbers[Math.floor(Math.random() * uniqueNumbers.length)];
      global.userNumbers.set(String(senderID), picked);

      return response.reply(
        `📱 Temporary number\n━━━━━━━━━━━━━━━━\n➤ ${picked}\n\nCheck inbox:\n/otp inbox ${picked}\nForce refresh:\n/otp refresh ${picked}`,
        { parse_mode: 'Markdown' }
      );
    } catch (err) {
      console.error('[OTP] gen error:', err.message);
      return response.reply('❌ Failed to fetch a number.');
    }
  }

  // ----- INBOX / REFRESH -----
  if (subCommand === 'inbox' || subCommand === 'refresh') {
    let phone = args[1];
    if (!phone) {
      phone = global.userNumbers.get(String(senderID));
      if (!phone) {
        return response.reply('⚠️ Provide a number or generate one first: /otp gen');
      }
    }
    phone = phone.replace(/[\s\-]/g, '');

    const statusMsg = await response.reply(`⏳ Fetching messages for ${phone}...`);

    try {
      const matched = await fetchMessagesForPhone(phone);

      if (!matched.length) {
        return response.edit(statusMsg, `📭 No messages yet for ${phone}\n\n💡 Wait a moment after requesting an SMS, then try /otp refresh ${phone}`);
      }

      // Sort newest first
      matched.sort((a, b) => {
        const ta = new Date(a.timestamp || a.time || 0).getTime();
        const tb = new Date(b.timestamp || b.time || 0).getTime();
        return tb - ta;
      });

      const latest = matched.slice(0, 5);
      let reply = `📬 Inbox for ${phone}\n${'─'.repeat(30)}\n`;

      latest.forEach((msg, i) => {
        const sender = msg.sender || 'Unknown';
        const rawBody = msg.message || msg.body || msg.text || '';
        const body = decodeHtml(rawBody);
        const time = msg.timestamp || msg.time || '';
        const timeStr = time ? new Date(time).toLocaleString() : '';

        reply += `\n[${i + 1}] 📨 From: ${sender}\n`;
        if (timeStr) reply += `   🕐 ${timeStr}\n`;
        reply += `   💬 ${body}\n`;

        // Highlight extracted code
        const codeMatch = body.match(/\b(\d{4,8})\b/);
        if (codeMatch) {
          reply += `   🔑 Code: ${codeMatch[1]}\n`;
        }
      });

      if (matched.length > 5) {
        reply += `\n...and ${matched.length - 5} more message(s).`;
      }

      reply += `\n${'─'.repeat(30)}\n💡 Not seeing new SMS? Use /otp refresh ${phone}`;

      await response.edit(statusMsg, reply, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('[OTP] fetch error:', err.message);
      await response.edit(statusMsg, '❌ Failed to fetch inbox.');
    }
    return;
  }

  // ----- Unknown subcommand -----
  return usage();
}
