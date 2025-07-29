import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import express from 'express';
import { startCommand } from './bot/commands/start';
import { storeDetailsAction } from './bot/actions/storeDetails';
import { viewProductsAction } from './bot/actions/viewProducts';

// Load environment variables
dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  throw new Error('BOT_TOKEN is required in environment variables');
}

// Initialize bot
const bot = new Telegraf(BOT_TOKEN);

// Register command handlers
bot.start(startCommand);

// Register action handlers (for inline keyboard callbacks)
bot.action(/^store_/, storeDetailsAction);
bot.action(/^view_products_/, viewProductsAction);

// Error handling
bot.catch((err, ctx) => {
  console.error('Bot error:', err);
  ctx.reply('Sorry, something went wrong. Please try again.');
});

// Launch bot
if (process.env.NODE_ENV === 'production') {
  // Use webhooks in production
  const PORT = process.env.PORT || 3000;
  const WEBHOOK_URL = process.env.WEBHOOK_URL;
  
  if (!WEBHOOK_URL) {
    throw new Error('WEBHOOK_URL is required for production');
  }

  const app = express();
  app.use(bot.webhookCallback('/webhook'));
  bot.telegram.setWebhook(`${WEBHOOK_URL}/webhook`);

  app.listen(PORT, () => {
    console.log(`Bot listening on port ${PORT}`);
  });

} else {
  // Use long polling in development
  bot.launch();
  console.log('Bot started with long polling');
}

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

