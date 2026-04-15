import axios from 'axios';

export const meta = {
  name: 'otp',
  aliases: ['tempnumber', 'otpbox'],
  version: '1.2.0',
  author: 'selov',
  description: 'Generate temp numbers and check OTP inbox (with refresh)',
  guide: [
    '/otp gen — Generate a temporary number',
    '/otp inbox <phone> — Check messages',
    '/otp refresh <phone> — Force fetch latest messages',
    'Example: /otp gen → /otp inbox 584163456064'
  ],
  cooldown: 5,
  type: 'anyone',
  category: 'tools'
};

// FIX 1: Use a higher limit and add a timestamp to bust cache on every request
const API_BASE = "https://weak-deloris-nothing672434-fe85179d.koyeb.app/api/otps";

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

// FIX 2: Strip ALL non-digit characters for comparison (handles +, spaces, dashes, country codes)
function normalizePhone(phone) {
  return (phone || '').replace(/\D/g, '');
}

// FIX 3: Flexible phone matching — handles country code prefix differences
function phonesMatch(a, b) {
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  if (!na || !nb) return false;
  // Exact match
  if (na === nb) return true;
  // One is a suffix of the other (handles country code prefix variations)
  if (na.endsWith(nb) || nb.endsWith(na)) return true;
  // Handle cases where one has a leading 0 and the other doesn't
  const na2 = na.replace(/^0+/, '');
  const nb2 = nb.replace(/^0+/, '');
  return na2 === nb2 || na2.endsWith(nb2) || nb2.endsWith(na2);
}

// FIX 4: Fresh fetch every time with cache-busting param and higher limit
async function fetchMessagesForPhone(phone) {
  const url = `${API_BASE}?limit=1000&_t=${Date.now()}`;
  const res = await axios.get(url, {
    timeout: 15000,
    headers: {
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    }
  });

  const entries = res.data.otps || res.data.data || res.data || [];

  if (!Array.isArray(entries)) {
    console.error('[OTP] Unexpected API response shape:', JSON.stringify(res.data).slice(0, 200));
    return [];
  }

  return entries.filter(e => phonesMatch(e.number, phone));
}

// FIX 5: Safe edit — falls back to a new reply if edit is not supported
async function safeEdit(response, msgRef, text, opts = {}) {
  try {
    if (typeof response.edit === 'function') {
      await response.edit(msgRef, text, opts);
    } else {
      await response.reply(text, opts);
    }
  } catch {
    await response.reply(text, opts);
  }
}

export async function onStart({ args, response, senderID, usage }) {
  const subCommand = (args[0] || '').toLowerCase();

  // ----- GEN -----
  if (subCommand === 'gen') {
    try {
      const url = `${API_BASE}?limit=1000&_t=${Date.now()}`;
      const res = await axios.get(url, { timeout: 15000 });
      const entries = res.data.otps || res.data.data || res.data || [];

      if (!Array.isArray(entries) || !entries.length) {
        return response.reply('❌ No numbers available right now.');
      }

      const uniqueNumbers = [...new Set(entries.map(e => e.number).filter(Boolean))];
      if (!uniqueNumbers.length) {
        return response.reply('❌ Could not parse numbers from API response.');
      }

      const picked = uniqueNumbers[Math.floor(Math.random() * uniqueNumbers.length)];
      global.userNumbers.set(String(senderID), picked);

      return response.reply(
        `📱 *Temporary Number*\n━━━━━━━━━━━━━━━━\n➤ \`${picked}\`\n\nCheck inbox:\n/otp inbox ${picked}\nForce refresh:\n/otp refresh ${picked}`,
        { parse_mode: 'Markdown' }
      );
    } catch (err) {
      console.error('[OTP] gen error:', err.message);
      return response.reply('❌ Failed to fetch a number. The API may be down.');
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
    // Keep original for display, normalize for matching
    const displayPhone = phone.trim();
    const statusMsg = await response.reply(`⏳ Fetching messages for ${displayPhone}...`);

    try {
      const matched = await fetchMessagesForPhone(displayPhone);

      if (!matched.length) {
        return safeEdit(
          response, statusMsg,
          `📭 No messages yet for ${displayPhone}\n\n💡 Tips:\n• Wait 30–60 seconds after requesting the SMS\n• Make sure you entered the full number shown by /otp gen\n• Try: /otp refresh ${displayPhone}`
        );
      }

      // Sort newest first
      matched.sort((a, b) => {
        const ta = new Date(a.timestamp || a.time || 0).getTime();
        const tb = new Date(b.timestamp || b.time || 0).getTime();
        return tb - ta;
      });

      const latest = matched.slice(0, 5);
      let reply = `📬 *Inbox for ${displayPhone}*\n${'─'.repeat(28)}\n`;

      latest.forEach((msg, i) => {
        const sender = msg.sender || msg.from || 'Unknown';
        const rawBody = msg.message || msg.body || msg.text || msg.sms || '';
        const body = decodeHtml(rawBody);
        const time = msg.timestamp || msg.time || msg.created_at || '';
        const timeStr = time ? new Date(time).toLocaleString() : '';

        reply += `\n[${i + 1}] 📨 From: *${sender}*\n`;
        if (timeStr) reply += `   🕐 ${timeStr}\n`;
        reply += `   💬 ${body}\n`;

        // FIX 6: Better OTP extraction — also catches codes with spaces/dashes between digits
        const cleaned = body.replace(/[\s\-]/g, '');
        const codeMatch = cleaned.match(/\b(\d{4,8})\b/) || body.match(/\b(\d{4,8})\b/);
        if (codeMatch) {
          reply += `   🔑 *Code: ${codeMatch[1]}*\n`;
        }
      });

      if (matched.length > 5) {
        reply += `\n...and ${matched.length - 5} more message(s).`;
      }

      reply += `\n${'─'.repeat(28)}\n💡 Not seeing your Facebook code? Use /otp refresh ${displayPhone}`;

      await safeEdit(response, statusMsg, reply, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('[OTP] fetch error:', err.message);
      await safeEdit(response, statusMsg, `❌ Failed to fetch inbox.\nError: ${err.message}`);
    }
    return;
  }

  // ----- Unknown subcommand -----
  return usage();
}
