import { Context, Markup } from 'telegraf';
import { supabase, formatCurrency, escapeMarkdown } from '../../lib/supabaseClient';
import { addToCart } from '../features/cart';

// In-memory storage for user's current product index in a store
const userProductIndex: Map<string, { storeId: string, products: any[], currentIndex: number }> = new Map();

export async function viewProductsAction(ctx: Context): Promise<void> {
  try {
    const callbackQuery = ctx.callbackQuery;
    if (!callbackQuery || !('data' in callbackQuery)) {
      await ctx.reply('Invalid product view selection.');
      return;
    }

    const callbackData = callbackQuery.data;
    if (!callbackData) {
      await ctx.reply('Invalid product view selection.');
      return;
    }

    let storeId: string;
    let productIndex: number;

    // Determine if it's an initial view or navigation
    if (callbackData.startsWith('view_products_')) {
      storeId = callbackData.split('_')[2];
      productIndex = 0; // Start from the first product

      // Fetch products for this store
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('store_id', storeId)
        .eq('in_stock', true)
        .eq('is_active', true)
        .order('name');

      if (productsError) {
        console.error('Error fetching products:', productsError);
        await ctx.answerCbQuery('Error loading products');
        await ctx.reply('Sorry, I could not load products for this store.');
        return;
      }

      if (!products || products.length === 0) {
        await ctx.answerCbQuery();
        const { data: store, error: storeError } = await supabase
          .from('stores')
          .select('name')
          .eq('id', storeId)
          .single();
        const storeName = store ? escapeMarkdown(store.name) : 'Store';
        await ctx.editMessageText(
          `🏪 *${storeName}*\n\n❌ No products available at the moment.`,
          {
            parse_mode: 'Markdown',
            reply_markup: Markup.inlineKeyboard([
              [Markup.button.callback('🔙 Back to Store Details', `store_${storeId}`)]
            ]).reply_markup
          }
        );
        return;
      }

      userProductIndex.set(ctx.from.id.toString(), { storeId, products, currentIndex: productIndex });

    } else if (callbackData.startsWith('navigate_product_')) {
      const parts = callbackData.split('_');
      const direction = parts[2]; // 'next' or 'prev'
      const userData = userProductIndex.get(ctx.from.id.toString());

      if (!userData) {
        await ctx.answerCbQuery('Please start from the store selection.');
        await ctx.reply('Please start from the store selection.');
        return;
      }

      storeId = userData.storeId;
      let newIndex = userData.currentIndex;

      if (direction === 'next') {
        newIndex = Math.min(userData.products.length - 1, newIndex + 1);
      } else if (direction === 'prev') {
        newIndex = Math.max(0, newIndex - 1);
      }
      productIndex = newIndex;
      userData.currentIndex = newIndex;
      userProductIndex.set(ctx.from.id.toString(), userData);

    } else if (callbackData.startsWith('add_to_cart_')) {
      const productId = callbackData.split('_')[3];
      const userData = userProductIndex.get(ctx.from.id.toString());

      if (!userData) {
        await ctx.answerCbQuery('Please select a product first.');
        await ctx.reply('Please select a product first.');
        return;
      }

      const result = await addToCart(ctx.from.id.toString(), productId, 1);
      await ctx.answerCbQuery(result.message);
      return;
    } else {
      await ctx.answerCbQuery('Unknown action.');
      return;
    }

    const userData = userProductIndex.get(ctx.from.id.toString());
    if (!userData || userData.products.length === 0) {
      await ctx.answerCbQuery('No products to display.');
      await ctx.reply('No products to display.');
      return;
    }

    const currentProduct = userData.products[userData.currentIndex];

    // Format product message
    let message = `*${escapeMarkdown(currentProduct.name)}*\n\n`;
    if (currentProduct.description) {
      message += `📝 ${escapeMarkdown(currentProduct.description)}\n`;
    }
    message += `💰 ${formatCurrency(currentProduct.price)}\n`;
    message += `📦 Stock: ${currentProduct.stock_quantity}\n\n`;
    message += `Product ${userData.currentIndex + 1}/${userData.products.length}`;

    // Create navigation and add to cart buttons
    const buttons = [
      [
        Markup.button.callback('⬅️ Previous', `navigate_product_prev_${storeId}`),
        Markup.button.callback('➡️ Next', `navigate_product_next_${storeId}`),
      ],
      [Markup.button.callback('➕ Add to Cart', `add_to_cart_${currentProduct.id}`)],
      [Markup.button.callback('🔙 Back to Store Details', `store_${storeId}`)],
    ];

    // Send photo with caption and buttons
    if (currentProduct.image_url) {
      await ctx.replyWithPhoto(
        currentProduct.image_url,
        {
          caption: message,
          parse_mode: 'Markdown',
          reply_markup: Markup.inlineKeyboard(buttons).reply_markup
        }
      );
    } else {
      // If no image, edit the message text as before
      await ctx.editMessageText(
        message,
        {
          parse_mode: 'Markdown',
          reply_markup: Markup.inlineKeyboard(buttons).reply_markup
        }
      );
    }

    await ctx.answerCbQuery();

  } catch (error) {
    console.error('Error in view products action:', error);
    await ctx.answerCbQuery('Error loading products');
    await ctx.reply('Sorry, something went wrong while loading products.');
  }
}


