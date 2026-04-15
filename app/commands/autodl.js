import axios from "axios";
import fs from "fs-extra";
import path from "path";
import { fileURLToPath } from "url";
import { Readable } from "stream";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ===== API BASE ===== */
async function baseApiUrl() {
  const res = await axios.get(
    "https://raw.githubusercontent.com/noobcore404/NC-STORE/refs/heads/main/NCApiUrl.json",
    { timeout: 10000 }
  );
  if (!res.data?.apiv1) throw new Error("API base not found");
  return res.data.apiv1;
}

/* ===== SUPPORTED DOMAINS ===== */
const supportedDomains = [
  "facebook.com", "fb.watch",
  "youtube.com", "youtu.be",
  "tiktok.com",
  "instagram.com", "instagr.am",
  "likee.com", "likee.video",
  "capcut.com",
  "spotify.com",
  "terabox.com",
  "twitter.com", "x.com",
  "drive.google.com",
  "soundcloud.com",
  "ndown.app",
  "pinterest.com", "pin.it"
];

/* ===== EXTENSION HELPER ===== */
function getExt(url, type) {
  if (type === "audio") return "mp3";
  if (type === "image") return "jpg";

  const clean = url.split("?")[0];
  const ext = clean.split(".").pop();
  return ext.length <= 5 ? ext : "mp4";
}

/* ===== META ===== */
export const meta = {
  name: 'autodl',
  aliases: ['dl', 'download'],
  version: '3.1.0',
  author: 'selov',
  description: 'Auto Media Downloader — automatically downloads media from supported links.',
  guide: [
    'Simply send any supported media link in the chat.',
    'Supported platforms:',
    '• Facebook, YouTube, TikTok, Instagram',
    '• Likee, CapCut, Spotify',
    '• Terabox, Twitter/X, Google Drive',
    '• SoundCloud, Pinterest, and more'
  ],
  cooldown: 3,
  type: 'anyone',
  category: 'downloader'
};

/* ===== onStart ===== */
export async function onStart({ response, usage }) {
  // If the user explicitly types /autodl, show the info message.
  // The auto-detection happens in onChat.
  return usage();
}

/* ===== onChat ===== */
export async function onChat({ body, response, bot, chatId, messageID, isUserCallCommand }) {
  // Only process if it's not a prefixed command and body contains a URL
  if (isUserCallCommand || !body) return;

  const text = body.trim();
  if (!text.startsWith("https://")) return;
  if (!supportedDomains.some(d => text.includes(d))) return;

  // React with "loading" indicator
  try {
    await bot.setMessageReaction(chatId, messageID, { reaction: [{ type: "emoji", emoji: "⏳" }] });
  } catch (e) {
    // Reaction may fail in some contexts; continue anyway
  }

  try {
    const base = await baseApiUrl();
    const apiUrl = `${base}/api/auto?url=${encodeURIComponent(text)}`;
    const { data } = await axios.get(apiUrl, { timeout: 30000 });

    if (!data) throw new Error("No API data");

    const mediaUrl = data.high_quality || data.low_quality;
    if (!mediaUrl) throw new Error("No media URL");

    const ext = getExt(mediaUrl, data.type);
    const cacheDir = path.join(__dirname, "..", "cache", "autodl");
    await fs.ensureDir(cacheDir);
    const filePath = path.join(cacheDir, `AUTODL_${Date.now()}.${ext}`);

    const buffer = await axios.get(mediaUrl, {
      responseType: "arraybuffer",
      timeout: 60000
    });

    await fs.writeFile(filePath, buffer.data);

    // Success reaction
    try {
      await bot.setMessageReaction(chatId, messageID, { reaction: [{ type: "emoji", emoji: "✅" }] });
    } catch (e) {}

    // Build caption
    const caption = `╭─「 ✅ DOWNLOAD COMPLETE 」─╮\n` +
                    `│ 🎬 Title    : ${data.title || "Unknown"}\n` +
                    `│ 📁 Type     : ${data.type || "media"}\n` +
                    `╰──────────────────────╯`;

    // Send media using Response.upload
    await response.upload(
      data.type === "audio" ? "audio" : "video",
      filePath,
      {
        caption: caption,
        reply_to_message_id: messageID
      }
    );

    // Cleanup after a short delay
    setTimeout(() => {
      fs.remove(filePath).catch(() => {});
    }, 10000);

  } catch (err) {
    console.error("[AUTODL ERROR]", err.message);

    // Error reaction
    try {
      await bot.setMessageReaction(chatId, messageID, { reaction: [{ type: "emoji", emoji: "❌" }] });
    } catch (e) {}

    await response.reply(
      `╭─「 ❌ DOWNLOAD FAILED 」─╮\n` +
      `│ ⚠️ Cannot fetch media\n` +
      `│ 🔁 Try another link\n` +
      `╰──────────────────────╯`,
      { reply_to_message_id: messageID }
    );
  }
}
