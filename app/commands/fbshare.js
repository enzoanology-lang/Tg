import axios from 'axios';

export const meta = {
  name: 'share',
  aliases: ['fbshare'],
  version: '2.0.0',
  author: 'selov',
  description: 'Fast Facebook post sharing tool',
  guide: [
    '/share [cookie] | [fb link] | [amount]',
    'Example: /share cookie_string | https://fb.com/post | 100'
  ],
  cooldown: 5,
  type: 'premium',
  category: 'tools'
};

// User agents list with rotation
const ua_list = [
  "Mozilla/5.0 (Linux; Android 10; Wildfire E Lite) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/105.0.5195.136 Mobile Safari/537.36[FBAN/EMA;FBLC/en_US;FBAV/298.0.0.10.115;]",
  "Mozilla/5.0 (Linux; Android 11; KINGKONG 5 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/87.0.4280.141 Mobile Safari/537.36[FBAN/EMA;FBLC/fr_FR;FBAV/320.0.0.12.108;]",
  "Mozilla/5.0 (Linux; Android 11; G91 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/106.0.5249.126 Mobile Safari/537.36[FBAN/EMA;FBLC/fr_FR;FBAV/325.0.0.1.4.108;]"
];

// In-memory store for active shares (for cancellation)
if (!global.activeShares) global.activeShares = new Map();
const activeShares = global.activeShares;

// Token extraction function
async function extract_token(cookie, ua, retries = 2) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.get(
        "https://business.facebook.com/business_locations",
        {
          headers: {
            "user-agent": ua,
            "referer": "https://www.facebook.com/",
            "Cookie": cookie,
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "accept-language": "en-US,en;q=0.5",
            "accept-encoding": "gzip, deflate, br",
            "dnt": "1",
            "connection": "keep-alive",
            "upgrade-insecure-requests": "1"
          },
          timeout: 10000,
          maxRedirects: 3
        }
      );

      const patterns = [
        /(EAAG\w+)/,
        /(EAA[A-Za-z0-9]+)/,
        /access_token=([^&\s"]+)/
      ];

      for (const pattern of patterns) {
        const match = response.data.match(pattern);
        if (match) return match[1];
      }

      return null;
    } catch (err) {
      if (i === retries - 1) return null;
    }
  }
}

// Share function - OPTIMIZED FOR SPEED with concurrent requests
async function performShare(post_link, token, cookie, ua, shareId, totalLimit) {
  const results = [];
  const startTime = Date.now();

  const batchSize = 10;
  
  for (let i = 0; i < totalLimit; i += batchSize) {
    if (activeShares.get(shareId) === 'cancelled') {
      break;
    }

    const currentBatchSize = Math.min(batchSize, totalLimit - i);
    const batchPromises = [];

    for (let j = 0; j < currentBatchSize; j++) {
      batchPromises.push(
        axios.post(
          "https://graph.facebook.com/v18.0/me/feed",
          null,
          {
            params: {
              link: post_link,
              access_token: token,
              published: 0
            },
            headers: {
              "user-agent": ua,
              "Cookie": cookie,
              "accept": "application/json, text/plain, */*",
              "accept-language": "en-US,en;q=0.9",
              "origin": "https://business.facebook.com",
              "referer": "https://business.facebook.com/"
            },
            timeout: 8000
          }
        ).then(response => ({
          success: true,
          id: response.data?.id || null
        })).catch(error => ({
          success: false,
          error: error.message
        }))
      );
    }

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    if (i + batchSize < totalLimit) {
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  const endTime = Date.now();
  const duration = (endTime - startTime) / 1000;

  return {
    success: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    total: results.length,
    duration
  };
}

export async function onStart({ args, response, usage }) {
  const input = args.join(' ').split('|').map(part => part.trim());
  const cookie = input[0];
  const post_link = input[1];
  const limit = input[2];

  if (!cookie || !post_link || !limit) {
    return usage();
  }

  const limitNum = parseInt(limit, 10);

  if (isNaN(limitNum) || limitNum <= 0) {
    return response.reply('❌ Error: Amount must be a valid positive number.');
  }

  if (limitNum > 5000) {
    return response.reply('❌ Error: Maximum limit is 5000 shares per request.');
  }

  if (!cookie.includes('=')) {
    return response.reply('❌ Error: Invalid cookie format.');
  }

  try {
    new URL(post_link);
  } catch {
    return response.reply('❌ Error: Invalid Facebook URL format.');
  }

  const shareId = Date.now();
  const waitingMessage = `⚡ FAST SHARE MODE ⚡\n━━━━━━━━━━━━━━━━\n📊 Amount: ${limitNum}\n🔑 Extracting token...`;

  // Send initial message and keep reference for editing
  const info = await response.reply(waitingMessage, { parse_mode: 'Markdown' });

  try {
    const ua = ua_list[Math.floor(Math.random() * ua_list.length)];
    
    await response.edit(info, '⚡ Extracting token...', { parse_mode: 'Markdown' });
    
    const token = await extract_token(cookie, ua);

    if (!token) {
      return response.edit(info, '❌ Error: Token extraction failed. Check your cookie validity.', { parse_mode: 'Markdown' });
    }

    await response.edit(info, `✅ Token extracted!\n🚀 Starting shares (0/${limitNum}) - FAST MODE...`, { parse_mode: 'Markdown' });

    activeShares.set(shareId, 'active');

    const shareResults = await performShare(post_link, token, cookie, ua, shareId, limitNum);

    activeShares.delete(shareId);

    const successRate = ((shareResults.success / shareResults.total) * 100).toFixed(1);
    const sharesPerSecond = (shareResults.total / shareResults.duration).toFixed(1);
    
    const resultMessage = `⚡ FAST SHARE RESULTS ⚡\n━━━━━━━━━━━━━━━━━━\n✅ Successful: ${shareResults.success}\n❌ Failed: ${shareResults.failed}\n📈 Success Rate: ${successRate}%\n⚡ Speed: ${sharesPerSecond} shares/sec\n⏱️ Total Time: ${shareResults.duration.toFixed(1)}s\n━━━━━━━━━━━━━━━━━━\n${shareResults.success > 0 ? '🎉 Fast sharing completed!' : '😞 No shares were successful.'}`;

    return response.edit(info, resultMessage, { parse_mode: 'Markdown' });

  } catch (error) {
    console.error('Share command error:', error.message);
    activeShares.delete(shareId);
    return response.edit(info, `❌ Error: Failed to process share request.\n${error.message}`, { parse_mode: 'Markdown' });
  }
}
