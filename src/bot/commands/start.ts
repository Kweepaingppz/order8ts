import { Context, Markup } from 'telegraf';
import { supabase } from '../../lib/supabaseClient';

// Store pagination state
const userPagination = new Map<string, number>();

export async function startCommand(ctx: Context): Promise<void> {
  try {
    const userId = ctx.from?.id.toString();
    if (!userId) return;
    
    // Reset pagination for this user
    userPagination.set(userId, 0);
    
    const welcomeMessage = `🌟 *Welcome to the Mall!* 🌟

Hello ${ctx.from?.first_name || 'there'}! 👋

Choose from our amazing stores below or use our convenient app for the best experience!`;

    await ctx.reply(welcomeMessage, { parse_mode: 'Markdown' });
    
    // Show stores with pagination (starting from page 0)
    await showStoresWithPagination(ctx, 0);
    
  } catch (error) {
    console.error('Error in start command:', error);
    await ctx.reply('Welcome! There was an error loading stores, but you can still try again.');
  }
}

// Function to show stores with pagination
export async function showStoresWithPagination(ctx: Context, page: number = 0): Promise<void> {
  try {
    const userId = ctx.from?.id.toString();
    if (!userId) return;

    const STORES_PER_PAGE = 10;
    const offset = page * STORES_PER_PAGE;

    // Fetch stores from Supabase with pagination
    const { data: stores, error, count } = await supabase
      .from('stores')
      .select('id, name, description', { count: 'exact' })
      .eq('is_active', true)
      .eq('approval_status', 'approved')
      .order('display_order', { ascending: true, nullsFirst: false })
      .order('name')
      .range(offset, offset + STORES_PER_PAGE - 1);

    if (error) {
      console.error('Error fetching stores:', error);
      await ctx.reply('Sorry, there was an error loading stores.');
      return;
    }

    if (!stores || stores.length === 0) {
      if (page === 0) {
        await ctx.reply('No active stores found at the moment. Please check back later!');
      } else {
        await ctx.reply('No more stores to show.');
      }
      return;
    }

    // Create inline keyboard
    const keyboard = [];

    // Add "Order with App" button at the top (large button spanning full width)
    keyboard.push([
      Markup.button.url('🛍️ Order with App', 'https://t.me/order8bot/order')
    ]);

    // Add store buttons (2 per row for better layout)
    const storeButtons = stores.map(store =>
      Markup.button.callback(` ${store.name}`, `store_${store.id}`)
    );

    // Group store buttons in rows of 2
    for (let i = 0; i < storeButtons.length; i += 2) {
      const row = [storeButtons[i]];
      if (i + 1 < storeButtons.length) {
        row.push(storeButtons[i + 1]);
      }
      keyboard.push(row);
    }

    // Add navigation buttons
    const navButtons = [];
    
    // Previous button (if not on first page)
    if (page > 0) {
      navButtons.push(
        Markup.button.callback('⬅️ Previous', 'prev_stores')
      );
    }

    // More stores button (if there are more stores)
    const totalStores = count || 0;
    const hasMoreStores = (offset + STORES_PER_PAGE) < totalStores;
    
    if (hasMoreStores) {
      navButtons.push(
        Markup.button.callback('➡️ More Stores', 'more_stores')
      );
    }

    if (navButtons.length > 0) {
      keyboard.push(navButtons);
    }

    // Add View Cart button
    keyboard.push([
      Markup.button.callback('🛒 View Cart', 'view_cart')
    ]);

    const totalPages = Math.ceil(totalStores / STORES_PER_PAGE);
    const currentPageDisplay = page + 1;
    
    const message = ` *Available Stores* (Page ${currentPageDisplay}/${totalPages})\n\nChoose a store to browse products:`;

    if (ctx.callbackQuery) {
      await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard(keyboard).reply_markup
      });
    } else {
      await ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard(keyboard).reply_markup
      });
    }

  } catch (error) {
    console.error('Error in showStoresWithPagination:', error);
    await ctx.reply('Sorry, there was an error loading stores.');
  }
}

// Handle pagination actions
export async function handleMoreStores(ctx: Context): Promise<void> {
  const userId = ctx.from?.id.toString();
  if (!userId) return;

  const currentPage = userPagination.get(userId) || 0;
  const nextPage = currentPage + 1;
  
  userPagination.set(userId, nextPage);
  
  await showStoresWithPagination(ctx, nextPage);
  await ctx.answerCbQuery?.();
}

export async function handlePrevStores(ctx: Context): Promise<void> {
  const userId = ctx.from?.id.toString();
  if (!userId) return;

  const currentPage = userPagination.get(userId) || 0;
  const prevPage = Math.max(0, currentPage - 1);
  
  userPagination.set(userId, prevPage);
  
  await showStoresWithPagination(ctx, prevPage);
  await ctx.answerCbQuery?.();
} 