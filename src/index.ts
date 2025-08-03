import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import express from 'express';
import { startCommand, handleMoreStores, handlePrevStores } from './bot/commands/start';
import { storeDetailsAction } from './bot/actions/storeDetails';
import { viewProductsAction } from './bot/actions/viewProducts';
import { viewCartAction } from './bot/actions/viewCart';
import { checkoutAction, cancelCheckoutAction, handleCheckoutInput, handlePaymentMethod } from './bot/actions/checkoutAction';
import { getUserSession } from './bot/features/userSession';
import { supabase, formatCurrency } from './lib/supabaseClient';

// Load environment variables
dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  throw new Error('BOT_TOKEN is required in environment variables');
}

const bot = new Telegraf(BOT_TOKEN);

async function startBot(): Promise<void> {
  try {
    // Register command handlers
    bot.start(startCommand);

    // Register action handlers (for inline keyboard callbacks)
    bot.action(/^store_/, storeDetailsAction);
    bot.action(/^view_products_/, viewProductsAction);
    bot.action(/^navigate_product_/, viewProductsAction);
    bot.action(/^add_to_cart_/, viewProductsAction);
    bot.action('back_to_stores', startCommand);
    bot.action('view_cart', viewCartAction);
    bot.action('checkout', checkoutAction);
    bot.action('cancel_checkout', cancelCheckoutAction);
    bot.action('payment_kpay', (ctx) => handlePaymentMethod(ctx, 'kpay'));
    bot.action('payment_usdt', (ctx) => handlePaymentMethod(ctx, 'usdt'));
    bot.action('payment_cod', (ctx) => handlePaymentMethod(ctx, 'cod'));

    // Handle pagination actions
    bot.action('more_stores', handleMoreStores);
    bot.action('prev_stores', handlePrevStores);

    // Handle text messages during checkout flow
    bot.on('text', async (ctx) => {
      const userId = ctx.from?.id.toString();
      if (!userId) return;
      
      const session = getUserSession(userId);
      
      // Only handle text if user is in checkout flow
      if (session && session.state !== 'idle') {
        await handleCheckoutInput(ctx);
      }
    });

    // Error handling
    bot.catch((err, ctx) => {
      console.error('Bot error:', err);
      ctx.reply('Sorry, something went wrong. Please try again.');
    });

    // Launch bot with long polling (works for both development and production)
    await bot.telegram.deleteWebhook();
    console.log('Previous webhook deleted successfully');
    
    await bot.launch();
    console.log('Bot started with long polling');
    
    // Keep the service alive by starting an Express server
    if (process.env.NODE_ENV === 'production') {
      const PORT = process.env.PORT || 3000;
      const app = express();
      
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