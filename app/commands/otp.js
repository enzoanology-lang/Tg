import axios from 'axios';

// ─── Meta ─────────────────────────────────────────────────────────────────────
export const meta = {
  name: 'otp',
  version: '2.0.0',
  aliases: ['tempnumber', 'otpbox'],
  description: 'Generate temporary phone numbers and check OTP inbox.',
  author: 'selov',
  category: 'tools',
  type: 'anyone',
  cooldown: 5,
  guide: [
    'gen                   — Get a temporary number',
    'inbox <number>        — Check messages for a number',
    'refresh <number>      — Force re-fetch latest messages',
  ],
};

// ─── Constants ────────────────────────────────────────────────────────────────
const API_BASE = 'https://weak-deloris-nothing672434-fe85179d.koyeb.app/api/otps';

// ─── Per-user last generated number ──────────────────────────────────────────
// Stored under global.Reze to match the framework's global namespace
if (!global.Reze._otpNumbers) global.Reze._otpNumbers = new Map();

// ─── Helpers ──────────────────────────────────────────────────────────────────
function decodeHtml(html = '') {
  return html
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function normalizePhone(phone = '') {
  return phone.replace(/\D/g, '');
}

// Flexible match — handles country code prefix differences
function phonesMatch(a, b) {
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.endsWith(nb) || nb.endsWith(na)) return true;
  const na2 = na.replace(/^0+/, '');
  const nb2 = nb.replace(/^0+/, '');
  return na2 === nb2 || na2.endsWith(nb2) || nb2.endsWith(na2);
}

// Always fresh — cache-busted, high limit, handles all API response shapes
async function fetchAll() {
  const url = `${API_BASE}?limit=1000&_t=${Date.now()}`;
  const res = await axios.get(url, {
    timeout: 15000,
    headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
  });
  const raw = res.data;
  return raw?.otps || raw?.data || (Array.isArray(raw) ? raw : []);
}

async function fetchForPhone(phone) {
  const entries = await fetchAll();
  return entries.filter(e => phonesMatch(e.number, phone));
}

// Handles codes like "123 456" or "1-2-3-4-5-6"
function extractCode(text = '') {
  const clean = text.replace(/[\s\-]/g, '');
  const m = clean.match(/\b(\d{4,8})\b/) || text.match(/\b(\d{4,8})\b/);
  return m ? m[1] : null;
}

// Safe edit — your framework uses response.edit('text', message_id, text, opts)
// Falls back to a new reply if edit fails for any reason
async function safeEdit(response, msgId, text, opts = {}) {
  try {
    return await response.edit('text', msgId, text, opts);
  } catch {
    return await response.reply(text, opts);
  }
}

// ─── onStart ──────────────────────────────────────────────────────────────────
export async function onStart({ args, response, senderID, usedPrefix, config }) {
  const prefix = usedPrefix || config?.prefix || '/';
  const sub = (args[0] || '').toLowerCase();

  // ── GEN ──────────────────────────────────────────────────────────────────
  if (sub === 'gen') {
    try {
      const entries = await fetchAll();
      if (!entries.length) {
        return response.reply('❌ No numbers available right now. Try again shortly.');
      }

      const unique = [...new Set(entries.map(e => e.number).filter(Boolean))];
      if (!unique.length) {
        return response.reply('❌ Could not parse numbers from API response.');
      }

      const picked = unique[Math.floor(Math.random() * unique.length)];
      global.Reze._otpNumbers.set(String(senderID), picked);

      return response.reply(
        `📱 Temporary Number Generated\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `➤ \`${picked}\`\n\n` +
        `Next steps:\n` +
        `1️⃣ Enter this number on Facebook/any site\n` +
        `2️⃣ Wait ~30–60 seconds for the SMS\n` +
        `3️⃣ Run: \`${prefix}otp inbox ${picked}\`\n\n` +
        `🔄 Not showing up? \`${prefix}otp refresh ${picked}\``,
        { parse_mode: 'Markdown' }
      );
    } catch (err) {
      console.error('[OTP] gen error:', err.message);
      return response.reply('❌ Failed to fetch a number. The API may be temporarily down.');
    }
  }

  // ── INBOX / REFRESH ───────────────────────────────────────────────────────
  if (sub === 'inbox' || sub === 'refresh') {
    let phone = args[1];

    // Fall back to last generated number for this user
    if (!phone) {
      phone = global.Reze._otpNumbers.get(String(senderID));
      if (!phone) {
        return response.reply(
          `⚠️ No number provided.\n\nGenerate one first: \`${prefix}otp gen\`\nOr specify one: \`${prefix}otp inbox <number>\``,
          { parse_mode: 'Markdown' }
        );
      }
    }

    const displayPhone = phone.trim();
    const statusMsg = await response.reply(
      `⏳ Fetching inbox for \`${displayPhone}\`...`,
      { parse_mode: 'Markdown' }
    );

    try {
      const matched = await fetchForPhone(displayPhone);

      if (!matched.length) {
        return safeEdit(
          response,
          statusMsg.message_id,
          `📭 No messages yet for \`${displayPhone}\`\n\n` +
          `💡 Tips:\n` +
          `• Wait 30–60 seconds after requesting the OTP\n` +
          `• Facebook can take up to 2 minutes sometimes\n` +
          `• Make sure you entered the number exactly as shown\n\n` +
          `🔄 Try again: \`${prefix}otp refresh ${displayPhone}\``,
          { parse_mode: 'Markdown' }
        );
      }

      // Sort newest first
      matched.sort((a, b) => {
        const ta = new Date(a.timestamp || a.time || a.created_at || 0).getTime();
        const tb = new Date(b.timestamp || b.time || b.created_at || 0).getTime();
        return tb - ta;
      });

      const latest = matched.slice(0, 5);
      let reply = `📬 *Inbox for* \`${displayPhone}\`\n${'─'.repeat(28)}\n`;

      for (let i = 0; i < latest.length; i++) {
        const msg = latest[i];
        const sender = msg.sender || msg.from || 'Unknown';
        const rawBody = msg.message || msg.body || msg.text || msg.sms || '';
        const body = decodeHtml(rawBody);
        const time = msg.timestamp || msg.time || msg.created_at || '';
        const timeStr = time ? new Date(time).toLocaleString() : '';
        const code = extractCode(body);

        reply += `\n*[${i + 1}]* 📨 From: *${sender}*\n`;
        if (timeStr) reply += `   🕐 ${timeStr}\n`;
        reply += `   💬 ${body}\n`;
        if (code) reply += `   🔑 OTP Code: \`${code}\`\n`;
      }

      if (matched.length > 5) {
        reply += `\n_...and ${matched.length - 5} more message(s)._`;
      }

      reply +=
        `\n\n${'─'.repeat(28)}\n` +
        `🔄 \`${prefix}otp refresh ${displayPhone}\` to check again`;

      return safeEdit(response, statusMsg.message_id, reply, { parse_mode: 'Markdown' });

    } catch (err) {
      console.error('[OTP] inbox error:', err.message);
      return safeEdit(
        response,
        statusMsg.message_id,
        `❌ Failed to fetch inbox.\n\`${err.message}\``,
        { parse_mode: 'Markdown' }
      );
    }
  }

  // ── Unknown subcommand — show usage ──────────────────────────────────────
  return response.reply(
    `🛠️ OTP Command Usage\n\n` +
    `\`${prefix}otp gen\` — Get a temporary number\n` +
    `\`${prefix}otp inbox <number>\` — Check messages\n` +
    `\`${prefix}otp refresh <number>\` — Force re-fetch\n\n` +
    `*Example flow:*\n` +
    `\`${prefix}otp gen\`  →  use the number on Facebook  →  \`${prefix}otp inbox <number>\``,
    { parse_mode: 'Markdown' }
  );
}
