import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import express from 'express';
import { startCommand } from './bot/commands/start';
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

// Store pagination state
const userPagination = new Map();

async function startBot() {
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

    // Handle "more stores" pagination
    bot.action('more_stores', async (ctx) => {
      const userId = ctx.from.id.toString();
      const currentPage = userPagination.get(userId) || 0;
      const nextPage = currentPage + 1;
      
      userPagination.set(userId, nextPage);
      
      await showStoresWithPagination(ctx, nextPage);
      await ctx.answerCbQuery();
    });

    // Handle "previous stores" pagination
    bot.action('prev_stores', async (ctx) => {
      const userId = ctx.from.id.toString();
      const currentPage = userPagination.get(userId) || 0;
      const prevPage = Math.max(0, currentPage - 1);
      
      userPagination.set(userId, prevPage);
      
      await showStoresWithPagination(ctx, prevPage);
      await ctx.answerCbQuery();
    });

    // Handle text messages during checkout flow
    bot.on('text', async (ctx) => {
      const userId = ctx.from.id.toString();
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

// Function to show stores with pagination
async function showStoresWithPagination(ctx, page = 0) {
  try {
    const userId = ctx.from.id.toString();
    const STORES_PER_PAGE = 10;
    const offset = page * STORES_PER_PAGE;

    // Fetch stores from Supabase with pagination
    const { data: stores, error, count } = await supabase
      .from('stores')
      .select('*', { count: 'exact' })
      .range(offset, offset + STORES_PER_PAGE - 1)
      .order('name');

    if (error) {
      console.error('Error fetching stores:', error);
      await ctx.reply('Sorry, there was an error loading stores.');
      return;
    }

    if (!stores || stores.length === 0) {
      if (page === 0) {
        await ctx.reply('No stores available at the moment.');
      } else {
        await ctx.reply('No more stores to show.');
      }
      return;
    }

    // Create inline keyboard
    const keyboard = [];

    // Add "Order with App" button at the top (large button spanning full width)
    keyboard.push([{
      text: '🛍️ Order with App',
      url: 'https://t.me/order8bot/order'
    }]);

    // Add store buttons (2 per row for better layout)
    for (let i = 0; i < stores.length; i += 2) {
      const row = [];
      
      // First store in row
      row.push({
        text: `🏪 ${stores[i].name}`,
        callback_data: `store_${stores[i].id}`
      });
      
      // Second store in row (if exists)
      if (i + 1 < stores.length) {
        row.push({
          text: `🏪 ${stores[i + 1].name}`,
          callback_data: `store_${stores[i + 1].id}`
        });
      }
      
      keyboard.push(row);
    }

    // Add navigation buttons
    const navButtons = [];
    
    // Previous button (if not on first page)
    if (page > 0) {
      navButtons.push({
        text: '⬅️ Previous',
        callback_data: 'prev_stores'
      });
    }

    // More stores button (if there are more stores)
    const totalStores = count || 0;
    const hasMoreStores = (offset + STORES_PER_PAGE) < totalStores;
    
    if (hasMoreStores) {
      navButtons.push({
        text: '➡️ More Stores',
        callback_data: 'more_stores'
      });
    }

    if (navButtons.length > 0) {
      keyboard.push(navButtons);
    }

    // Add View Cart button
    keyboard.push([{
      text: '🛒 View Cart',
      callback_data: 'view_cart'
    }]);

    const totalPages = Math.ceil(totalStores / STORES_PER_PAGE);
    const currentPageDisplay = page + 1;
    
    const message = `🏪 *Available Stores* (Page ${currentPageDisplay}/${totalPages})\n\nChoose a store to browse products:`;

    if (ctx.callbackQuery) {
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: keyboard
        }
      });
    } else {
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: keyboard
        }
      });
    }

  } catch (error) {
    console.error('Error in showStoresWithPagination:', error);
    await ctx.reply('Sorry, there was an error loading stores.');
  }
}

startBot();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

// Export the pagination function for use in start command
export { showStoresWithPagination }; 