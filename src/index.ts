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
bot.action(/^navigate_product_/, viewProductsAction); // Add this line for Next/Previous
bot.action(/^add_to_cart_/, viewProductsAction);     // Add this line for Add to Cart
bot.action('back_to_stores', startCommand);

// Error handling
bot.catch((err, ctx) => {
  console.error('Bot error:', err);
  ctx.reply('Sorry, something went wrong. Please try again.');
});

// Launch bot with long polling (works for both development and production)
async function startBot() {
  try {
    // Delete any existing webhook before starting long polling
    await bot.telegram.deleteWebhook();
    console.log('Previous webhook deleted successfully');
    
    // Start the bot with long polling
    await bot.launch();
    console.log('Bot started with long polling');
    
    // Keep the service alive by starting an Express server
    if (process.env.NODE_ENV === 'production') {
      const PORT = process.env.PORT || 3000;
      const app = express();
      
      // Simple health check endpoint
      app.get('/', (req, res) => {
        res.send('Bot is running with long polling');
      });
      
      app.listen(PORT, () => {
        console.log(`Health check server listening on port ${PORT}`);
      });
    }
    
  } catch (error) {
    console.error('Error starting bot:', error);
  }
}

startBot();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));


