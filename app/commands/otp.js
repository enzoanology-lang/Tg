import axios from 'axios';

export const meta = {
  name: 'otp',
  aliases: ['tempnumber', 'otpbox'],
  version: '1.0.0',
  author: 'selov',
  description: 'Generate temporary phone numbers and check OTP inbox',
  guide: [
    ' gen — Generate a temporary phone number',
    ' inbox <phone> — Check OTP messages',
    'Example:',
    ' gen',
    ' inbox 584161868057'
  ],
  cooldown: 5,
  type: 'premium',
  category: 'tools'
};

const API_BASE = "https://weak-deloris-nothing672434-fe85179d.koyeb.app/api/otps?limit=500";

// Store generated numbers per user (in-memory; resets on bot restart)
if (!global.userNumbers) global.userNumbers = new Map();

export async function onStart({ args, response, senderID, usage }) {
  const subCommand = (args[0] || '').toLowerCase();

  // ── /otp gen ──────────────────────────────────────────────────────────────
  if (subCommand === 'gen') {
    try {
      const res = await axios.get(API_BASE, { timeout: 10000 });
      const data = res.data;

      // The API returns an object with "otps" array
      const entries = data.otps || [];

      if (!entries.length) {
        return response.reply('❌ No phone numbers available right now. Try again later.');
      }

      // Extract unique numbers
      const uniqueNumbers = [...new Set(entries.map(e => e.number).filter(Boolean))];

      if (!uniqueNumbers.length) {
        return response.reply('❌ Could not parse phone numbers from the API response.');
      }

      const picked = uniqueNumbers[Math.floor(Math.random() * uniqueNumbers.length)];

      // Store this number for the user
      global.userNumbers.set(String(senderID), picked);

      return response.reply(
        `📱 Your temporary phone number:\n━━━━━━━━━━━━━━━━\n➤ ${picked}\n━━━━━━━━━━━━━━━━\n\nUse this command to check for OTPs:\n/otp inbox ${picked}`,
        { parse_mode: 'Markdown' }
      );
    } catch (err) {
      console.error('[OTP] gen error:', err.message);
      return response.reply('❌ Failed to fetch a phone number. The API may be down.');
    }
  }

  // ── /otp inbox <phone> ────────────────────────────────────────────────────
  if (subCommand === 'inbox') {
    let phone = args[1];

    // If no phone given, fall back to the user's last generated number
    if (!phone) {
      phone = global.userNumbers.get(String(senderID));
      if (!phone) {
        return response.reply(
          '⚠️ Please provide a phone number or generate one first:\n/otp gen'
        );
      }
    }

    // Normalize: strip spaces/dashes
    phone = phone.replace(/[\s\-]/g, '');

    try {
      const res = await axios.get(API_BASE, { timeout: 10000 });
      const data = res.data;
      const entries = data.otps || [];

      // Filter messages belonging to this number
      const matched = entries.filter(e => {
        const num = (e.number || '').replace(/[\s\-]/g, '');
        return num === phone || num.endsWith(phone) || phone.endsWith(num);
      });

      if (!matched.length) {
        return response.reply(
          `📭 No OTP messages found for:\n${phone}\n\nMake sure you used the correct number. Messages may take a moment to arrive.`
        );
      }

      // Sort newest first (by timestamp)
      matched.sort((a, b) => {
        const ta = new Date(a.timestamp || a.time || 0).getTime();
        const tb = new Date(b.timestamp || b.time || 0).getTime();
        return tb - ta;
      });

      // Show up to 5 most recent
      const display = matched.slice(0, 5);
      let reply = `📬 **OTP Inbox for ${phone}**\n${'─'.repeat(30)}\n`;

      display.forEach((msg, i) => {
        const sender = msg.sender || 'Unknown';
        const body = msg.message || msg.body || msg.text || '—';
        const time = msg.timestamp || msg.time || '';
        const timeStr = time ? new Date(time).toLocaleString() : '';
        
        reply += `\n[${i + 1}] 📨 From: ${sender}\n`;
        if (timeStr) reply += `   🕐 ${timeStr}\n`;
        reply += `   💬 ${body}\n`;
      });

      if (matched.length > 5) {
        reply += `\n...and ${matched.length - 5} more message(s).`;
      }

      return response.reply(reply, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('[OTP] inbox error:', err.message);
      return response.reply('❌ Failed to fetch inbox. The API may be down.');
    }
  }

  // ── Unknown subcommand ────────────────────────────────────────────────────
  return usage();
}
