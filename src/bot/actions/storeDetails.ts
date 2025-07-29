import { Context, Markup } from 'telegraf';
import { supabase, escapeMarkdown } from '../../lib/supabaseClient';

export async function storeDetailsAction(ctx: Context): Promise<void> {
  try {
    // Extract store ID from callback data
    const callbackQuery = ctx.callbackQuery;
    if (!callbackQuery || !('data' in callbackQuery)) {
      await ctx.reply('Invalid store selection.');
      return;
    }

    const callbackData = callbackQuery.data;
    if (!callbackData) {
      await ctx.reply('Invalid store selection.');
      return;
    }

    const storeId = callbackData.split('_')[1];
    if (!storeId) {
      await ctx.reply('Invalid store selection.');
      return;
    }

    // Fetch store details
    const { data: store, error } = await supabase
      .from('stores')
      .select('*')
      .eq('id', storeId)
      .eq('is_active', true)
      .eq('approval_status', 'approved')
      .single();

    if (error || !store) {
      console.error('Error fetching store details:', error);
      await ctx.answerCbQuery('Store not found');
      await ctx.reply('Sorry, I could not find details for this store.');
      return;
    }

    // Format store details message
    let message = `🏪 *${escapeMarkdown(store.name)}*\n\n`;
    
    if (store.description) {
      message += `📝 *Description:*\n${escapeMarkdown(store.description)}\n\n`;
    }
    
    if (store.location) {
      message += `📍 *Location:* ${escapeMarkdown(store.location)}\n`;
    }
    
    if (store.phone_number) {
      message += `📞 *Phone:* ${escapeMarkdown(store.phone_number)}\n`;
    }
    
    if (store.channel_link) {
      message += `🔗 *Channel:* ${escapeMarkdown(store.channel_link)}\n`;
    }

    // Add payment methods info
    const paymentMethods = [];
    if (store.payment_methods?.kpay) paymentMethods.push('KPay');
    if (store.payment_methods?.usdt) paymentMethods.push('USDT');
    if (store.payment_methods?.cod) paymentMethods.push('Cash on Delivery');
    
    if (paymentMethods.length > 0) {
      message += `\n💳 *Payment Methods:* ${paymentMethods.join(', ')}`;
    }

    // Create action buttons
    const buttons = [
      [Markup.button.callback('🛍️ View Products', `view_products_${store.id}`)],
      [Markup.button.callback('🔙 Back to Stores', 'back_to_stores')]
    ];

    // Edit the original message with store details
    await ctx.editMessageText(
      message,
      {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard(buttons).reply_markup
      }
    );

    // Answer the callback query to remove loading state
    await ctx.answerCbQuery();

  } catch (error) {
    console.error('Error in store details action:', error);
    await ctx.answerCbQuery('Error loading store details');
    await ctx.reply('Sorry, something went wrong while loading store details.');
  }
}

