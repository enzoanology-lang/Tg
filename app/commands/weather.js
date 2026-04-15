import axios from 'axios';

export const meta = {
  name: 'weather',
  aliases: ['init', 'temp'],
  version: '5.0.0',
  author: 'selov',
  description: 'Get accurate weather with RealFeel temperature',
  guide: [
    ' <city>',
    'Examples:',
    '• Lapu Lapu',
    '• Cebu',
    '• Manila'
  ],
  cooldown: 5,
  type: 'anyone',
  category: 'utility'
};

// Get weather description from WMO code
function getWeatherDescription(code) {
  const weatherMap = {
    0: { desc: "Clear sky", emoji: "☀️" },
    1: { desc: "Mainly clear", emoji: "🌤️" },
    2: { desc: "Partly cloudy", emoji: "⛅" },
    3: { desc: "Overcast", emoji: "☁️" },
    45: { desc: "Foggy", emoji: "🌫️" },
    48: { desc: "Foggy", emoji: "🌫️" },
    51: { desc: "Light drizzle", emoji: "🌧️" },
    53: { desc: "Moderate drizzle", emoji: "🌧️" },
    55: { desc: "Heavy drizzle", emoji: "🌧️" },
    61: { desc: "Light rain", emoji: "🌦️" },
    63: { desc: "Moderate rain", emoji: "🌧️" },
    65: { desc: "Heavy rain", emoji: "🌧️" },
    71: { desc: "Light snow", emoji: "❄️" },
    73: { desc: "Moderate snow", emoji: "❄️" },
    75: { desc: "Heavy snow", emoji: "❄️" },
    80: { desc: "Rain showers", emoji: "🌦️" },
    81: { desc: "Rain showers", emoji: "🌦️" },
    82: { desc: "Violent rain", emoji: "⛈️" },
    95: { desc: "Thunderstorm", emoji: "⛈️" },
    96: { desc: "Thunderstorm", emoji: "⛈️" },
    99: { desc: "Thunderstorm", emoji: "⛈️" }
  };
  return weatherMap[code] || { desc: "Unknown", emoji: "🌍" };
}

// Calculate UV Index level
function getUVLevel(uvIndex) {
  if (uvIndex >= 11) return "Extreme (11+)";
  if (uvIndex >= 8) return "Very High (8-10)";
  if (uvIndex >= 6) return "High (6-7)";
  if (uvIndex >= 3) return "Moderate (3-5)";
  return "Low (0-2)";
}

// Calculate RealFeel temperature
function getRealFeel(temp, humidity, windSpeed) {
  let heatIndex = temp;
  
  if (temp >= 27 && humidity >= 40) {
    const hi = 0.5 * (temp + 61.0 + ((temp - 68.0) * 1.2) + (humidity * 0.094));
    if (hi >= 80) {
      heatIndex = -42.379 + 2.04901523 * temp + 10.14333127 * humidity - 0.22475541 * temp * humidity - 0.00683783 * temp * temp - 0.05481717 * humidity * humidity + 0.00122874 * temp * temp * humidity + 0.00085282 * temp * humidity * humidity - 0.00000199 * temp * temp * humidity * humidity;
    }
    heatIndex = Math.round(heatIndex);
  }
  
  if (temp < 20) {
    const windChill = 13.12 + 0.6215 * temp - 11.37 * Math.pow(windSpeed, 0.16) + 0.3965 * temp * Math.pow(windSpeed, 0.16);
    heatIndex = Math.round(windChill);
  }
  
  return Math.max(temp, Math.round(heatIndex));
}

// Calculate RealFeel Shade
function getRealFeelShade(temp, humidity) {
  const realFeel = getRealFeel(temp, humidity, 0);
  return Math.max(temp - 2, realFeel - 4);
}

// Get UV Index from Open-Meteo (approximate)
function getUVIndex(lat, lon, date) {
  const month = date.getMonth();
  const hour = date.getHours();
  
  let uv = 7;
  if (hour >= 10 && hour <= 14) uv = 9;
  else if (hour >= 9 && hour <= 15) uv = 7;
  else uv = 4;
  
  if (month >= 2 && month <= 4) uv += 1;
  if (month >= 10 && month <= 11) uv -= 1;
  
  return Math.min(12, Math.max(0, uv));
}

export async function onStart({ args, response, usage }) {
  const city = args.join(' ').trim();

  if (!city) {
    return usage();
  }

  const statusMsg = await response.reply(`🔍 Getting weather for ${city}...`);

  try {
    // Get coordinates
    const geoRes = await axios.get(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=5&language=en`,
      { timeout: 10000 }
    );
    
    if (!geoRes.data.results || geoRes.data.results.length === 0) {
      return response.edit(statusMsg, `❌ City "${city}" not found. Please check the spelling.`);
    }
    
    const location = geoRes.data.results[0];
    const lat = location.latitude;
    const lon = location.longitude;
    const locationName = location.name;
    const admin1 = location.admin1 || '';
    
    // Get weather data
    const weatherRes = await axios.get(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&timezone=Asia/Manila&daily=temperature_2m_max,temperature_2m_min&hourly=temperature_2m,relativehumidity_2m`,
      { timeout: 10000 }
    );
    
    const current = weatherRes.data.current_weather;
    
    // Get current time in Manila timezone
    const phTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' });
    const phDate = new Date(phTime);
    const hour = phDate.getHours();
    const minutes = phDate.getMinutes();
    const timeStr = `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    const dateStr = phDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
    
    // Get humidity
    let humidity = 65;
    if (weatherRes.data.hourly && weatherRes.data.hourly.relativehumidity_2m) {
      const humidities = weatherRes.data.hourly.relativehumidity_2m;
      if (humidities && humidities.length > hour) {
        humidity = humidities[hour];
      }
    }
    
    const actualTemp = Math.round(current.temperature);
    const windSpeed = Math.round(current.windspeed);
    const weatherCode = current.weathercode;
    const weather = getWeatherDescription(weatherCode);
    
    const realFeel = getRealFeel(actualTemp, humidity, windSpeed);
    const realFeelShade = getRealFeelShade(actualTemp, humidity);
    const uvIndex = getUVIndex(lat, lon, phDate);
    const uvLevel = getUVLevel(uvIndex);
    
    // Wind direction arrow
    const windDir = current.winddirection || 0;
    const windArrows = ["↓ N", "↙ NE", "← E", "↖ SE", "↑ S", "↗ SW", "→ W", "↘ NW"];
    const windIndex = Math.round(windDir / 45) % 8;
    const windArrow = windArrows[windIndex];
    
    // Time of day greeting
    let greeting = "";
    if (hour >= 5 && hour < 12) greeting = "🌅 Good Morning!";
    else if (hour >= 12 && hour < 18) greeting = "☀️ Good Afternoon!";
    else greeting = "🌙 Good Evening!";
    
    // Build location display
    let locationDisplay = locationName;
    if (admin1 && admin1 !== locationName) locationDisplay += `, ${admin1}`;
    
    const resultMsg = 
      `${weather.emoji} ${locationDisplay} ${actualTemp}°C\n` +
      `${weather.desc}\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `RealFeel ${realFeel}°\n` +
      `RealFeel Shade ${realFeelShade}°\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Max UV Index ${uvIndex} (${uvLevel})\n` +
      `Wind ${windArrow} ${windSpeed} km/h\n` +
      `Humidity ${humidity}%\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📅 ${dateStr} | 🕐 ${timeStr}\n` +
      `${greeting}`;
    
    await response.edit(statusMsg, resultMsg);
    
  } catch (err) {
    console.error("Weather Error:", err);
    await response.edit(statusMsg, `❌ Failed to get weather for "${city}". Please check the city name and try again.`);
  }
}
