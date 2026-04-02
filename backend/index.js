require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
const Schedule = require('./models/Schedule');
const User = require('./models/User');

const app = express();

// Security middleware with CSP disabled for inline scripts
app.use(helmet({
  contentSecurityPolicy: false,
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use('/api/', limiter);

// Initialize bot
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

// Store bot instance in app
app.set('bot', bot);

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB Atlas'))
.catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/schedules', require('./routes/schedules'));

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dashboard.html'));
});
// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'active', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});
// Advanced message sending function with buttons
async function sendAdvancedMessage(bot, schedule) {
  try {
    let replyMarkup = null;
    
    // Fix buttons format - ensure proper structure
    if (schedule.buttons && schedule.buttons.length > 0) {
      const keyboard = [];
      for (const button of schedule.buttons) {
        if (button.type === 'url' && button.url) {
          keyboard.push([{ text: button.text, url: button.url }]);
        } else if (button.type === 'inline' && button.callbackData) {
          keyboard.push([{ text: button.text, callback_data: button.callbackData }]);
        }
      }
      if (keyboard.length > 0) {
        replyMarkup = { inline_keyboard: keyboard };
      }
    }

    switch (schedule.messageType) {
      case 'photo':
        if (schedule.mediaUrl) {
          await bot.sendPhoto(schedule.channelId, schedule.mediaUrl, {
            caption: schedule.caption || schedule.message,
            parse_mode: 'HTML',
            reply_markup: replyMarkup
          });
        } else {
          await bot.sendMessage(schedule.channelId, schedule.message, {
            parse_mode: 'HTML',
            reply_markup: replyMarkup,
            disable_web_page_preview: false
          });
        }
        break;
        
      case 'video':
        if (schedule.mediaUrl) {
          await bot.sendVideo(schedule.channelId, schedule.mediaUrl, {
            caption: schedule.caption || schedule.message,
            parse_mode: 'HTML',
            reply_markup: replyMarkup
          });
        } else {
          await bot.sendMessage(schedule.channelId, schedule.message, {
            parse_mode: 'HTML',
            reply_markup: replyMarkup,
            disable_web_page_preview: false
          });
        }
        break;
        
      case 'poll':
        if (schedule.pollQuestion && schedule.pollOptions && schedule.pollOptions.length >= 2) {
          await bot.sendPoll(schedule.channelId, schedule.pollQuestion, schedule.pollOptions, {
            is_anonymous: false,
            reply_markup: replyMarkup
          });
        } else {
          await bot.sendMessage(schedule.channelId, schedule.message, {
            parse_mode: 'HTML',
            reply_markup: replyMarkup,
            disable_web_page_preview: false
          });
        }
        break;
        
      default:
        await bot.sendMessage(schedule.channelId, schedule.message, {
          parse_mode: 'HTML',
          reply_markup: replyMarkup,
          disable_web_page_preview: false
        });
    }
    
    return true;
  } catch (error) {
    console.error('Error sending message:', error);
    return false;
  }
}

// Schedule checking function with max sends and end date respect
async function checkAndSendMessages() {
  try {
    const now = new Date();
    
    // Find schedules ready to run
    const schedules = await Schedule.find({
      nextRunTime: { $lte: now },
      isActive: true
    });

    for (const schedule of schedules) {
      // Check max sends limit
      if (schedule.maxSends && schedule.sentCount >= schedule.maxSends) {
        schedule.isActive = false;
        await schedule.save();
        console.log(`📊 Schedule "${schedule.name}" deactivated - max sends reached (${schedule.sentCount}/${schedule.maxSends})`);
        continue;
      }
      
      // Check end date
      if (schedule.endDate && new Date(schedule.endDate) < now) {
        schedule.isActive = false;
        await schedule.save();
        console.log(`📅 Schedule "${schedule.name}" deactivated - end date passed`);
        continue;
      }
      
      // Send message
      const success = await sendAdvancedMessage(bot, schedule);
      
      if (success) {
        schedule.lastSent = now;
        schedule.sentCount += 1;
        
        // Calculate next run time based on interval
        let nextRun = new Date(now);
        switch (schedule.interval) {
          case 'every_minute':
            nextRun.setMinutes(nextRun.getMinutes() + 1);
            nextRun.setSeconds(0, 0);
            break;
          case 'every_2_hours':
            nextRun.setHours(nextRun.getHours() + 2);
            nextRun.setMinutes(0, 0, 0);
            break;
          case 'daily':
            nextRun.setDate(nextRun.getDate() + 1);
            if (schedule.specificTime && schedule.specificTime.hour !== null) {
              nextRun.setHours(schedule.specificTime.hour, schedule.specificTime.minute || 0, 0, 0);
            }
            break;
          case 'weekly':
            nextRun.setDate(nextRun.getDate() + 7);
            if (schedule.specificTime && schedule.specificTime.hour !== null) {
              nextRun.setHours(schedule.specificTime.hour, schedule.specificTime.minute || 0, 0, 0);
            }
            break;
          case 'custom':
            if (schedule.customInterval) {
              // Custom interval in minutes
              nextRun = new Date(now.getTime() + (schedule.customInterval * 60 * 1000));
            }
            break;
          default:
            nextRun.setMinutes(nextRun.getMinutes() + 1);
        }
        
        schedule.nextRunTime = nextRun;
        
        // Deactivate if max sends reached after increment
        if (schedule.maxSends && schedule.sentCount >= schedule.maxSends) {
          schedule.isActive = false;
          console.log(`✅ Schedule "${schedule.name}" completed - max sends reached (${schedule.sentCount}/${schedule.maxSends})`);
        }
        
        await schedule.save();
        console.log(`✅ Message sent to ${schedule.channelId}: "${schedule.name}" (${schedule.sentCount}/${schedule.maxSends || '∞'})`);
      } else {
        console.error(`❌ Failed to send message for schedule "${schedule.name}"`);
        // Check if bot is still admin (error handling)
        if (error && error.response?.body?.description?.includes('not enough rights')) {
          schedule.isActive = false;
          await schedule.save();
          console.log(`⚠️ Schedule "${schedule.name}" deactivated - bot is not admin in channel`);
        }
      }
    }
  } catch (error) {
    console.error('Error in schedule checker:', error);
  }
}

// Check schedules every minute
setInterval(checkAndSendMessages, 60000);

// Bot commands
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, '🤖 *Welcome to BJMS Orbit Bot!*\n\nI help you schedule messages to Telegram channels.\n\n📌 *Features:*\n• Schedule messages to channels\n• Multiple intervals (minute, daily, weekly, custom)\n• Support text, photos, videos, polls\n• Interactive buttons\n\n✨ *Get started:* Add me as admin to your channel and use the web dashboard to manage schedules.\n\n🔗 *Dashboard:* ' + process.env.FRONTEND_URL, { parse_mode: 'Markdown' });
});

bot.onText(/\/status/, async (msg) => {
  const chatId = msg.chat.id;
  const totalSchedules = await Schedule.countDocuments();
  const activeSchedules = await Schedule.countDocuments({ isActive: true });
  const totalSent = await Schedule.aggregate([{ $group: { _id: null, total: { $sum: "$sentCount" } } }]);
  const sentCount = totalSent[0]?.total || 0;
  
  bot.sendMessage(chatId, `📊 *Bot Status*\n\n📝 Total Schedules: ${totalSchedules}\n✅ Active: ${activeSchedules}\n📨 Messages Sent: ${sentCount}\n🟢 Bot is running normally`, { parse_mode: 'Markdown' });
});

// Handle bot being added to channel
bot.on('new_chat_members', async (msg) => {
  const newMembers = msg.new_chat_members;
  for (const member of newMembers) {
    if (member.id === bot.botInfo.id) {
      const channelId = msg.chat.id.toString();
      const channelTitle = msg.chat.title || 'Unknown Channel';
      console.log(`✅ Bot added to channel: ${channelTitle} (${channelId})`);
      
      // Send welcome message
      bot.sendMessage(channelId, `🎉 *Thank you for adding me!*\n\nI'm now ready to send scheduled messages to this channel.\n\n📋 *Next steps:*\n1. Open the dashboard\n2. Create a new schedule\n3. Use this channel ID: \`${channelId}\`\n\n🔗 Dashboard: ${process.env.FRONTEND_URL}`, { parse_mode: 'Markdown' });
    }
  }
});

// Handle button callbacks
bot.on('callback_query', async (callbackQuery) => {
  const message = callbackQuery.message;
  const data = callbackQuery.data;
  const user = callbackQuery.from;
  
  await bot.answerCallbackQuery(callbackQuery.id);
  await bot.sendMessage(message.chat.id, `👤 @${user.username || user.first_name} clicked: *${data}*`, { parse_mode: 'Markdown' });
  
  console.log(`🔘 Button clicked: ${data} by ${user.id} in ${message.chat.id}`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Dashboard: http://localhost:${PORT}`);
  console.log(`🤖 Bot is active and polling for messages`);
});

module.exports = { bot };
