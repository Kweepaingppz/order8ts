// src/bot/actions/viewCart.ts
import { Context, Markup } from 'telegraf';
import { getUserCart, formatCartMessage, getCartTotal } from '../features/cart';
import { escapeMarkdown, formatCurrency } from '../../lib/supabaseClient';

// Define CartItem interface to match cart.ts
interface CartItem {
  product_id: string;
  product_name: string;
  price: number;
  quantity: number;
  store_id: string;
  store_name: string;
}

export async function viewCartAction(ctx: Context): Promise<void> {
  try {
    if (!ctx.from) {
      await ctx.answerCbQuery('User information not available.');
      await ctx.reply('User information not available.');
      return;
    }

    const userId = ctx.from.id.toString();
    const cart = await getUserCart(userId);

    if (!cart || cart.length === 0) {
      await ctx.answerCbQuery();
      await ctx.editMessageText(
        'Your cart is empty! 🛒\n\nStart shopping by viewing products.',
        {
          parse_mode: 'Markdown',
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('🛍️ View Products', 'view_products_initial')],
            [Markup.button.callback('🔙 Back to Stores', 'back_to_stores')],
          ]).reply_markup,
        }
      );
      return;
    }

    const cartMessage = formatCartMessage(userId); // Fixed: Pass userId, not cart
    const total = getCartTotal(userId); // Fixed: Pass userId, not cart

    let message = `*Your Shopping Cart* 🛒\n\n${cartMessage}\n*Total:* ${formatCurrency(total)}\n\n`;

    const buttons = [
      [Markup.button.callback('Checkout', 'checkout')],
      [Markup.button.callback('Clear Cart', 'clear_cart')],
      [Markup.button.callback('🛍️ Continue Shopping', 'back_to_stores')],
    ];

    await ctx.editMessageText(
      message,
      {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard(buttons).reply_markup,
      }
    );

    await ctx.answerCbQuery();
  } catch (error) {
    console.error('Error in view cart action:', error);
    await ctx.answerCbQuery('Error loading cart');
    await ctx.reply('Sorry, something went wrong while loading your cart.');
  }
}
