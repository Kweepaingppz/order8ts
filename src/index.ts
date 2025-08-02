import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import express from 'express';
import { startCommand } from './bot/commands/start';
import { storeDetailsAction } from './bot/actions/storeDetails';
import { viewProductsAction } from './bot/actions/viewProducts';
import { viewCartAction } from './bot/actions/viewCart'; // Import viewCartAction
import { checkoutAction, cancelCheckoutAction, handleCheckoutInput, handlePaymentMethod } from './bot/actions/checkoutAction';
import { getUserSession } from './bot/features/userSession';
import { supabase, formatCurrency } from './lib/supabaseClient';

// Load environment variables
dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  throw new Error('BOT_TOKEN is required in environment variables');
            // Create order in Supabase
            const { data: order, error: orderError } = await supabase
                .from('orders')
                .insert([
                    {
                        store_id: orderData.storeId,
                        status: 'pending',
                        payment_method: orderData.paymentMethod,
                        payment_status: 'pending',
                        total_amount: orderData.total,
                        // user_id is null since we don't have Supabase auth integration yet
                        // You can add this later when implementing user authentication
                    }
                ])
                .select()
                .single();

            if (orderError || !order) {
                logger.error('Error creating order:', orderError);
                await ctx.reply('❌ There was an error processing your order. Please try again.');
                return;
            }

            const orderId = order.id;
            logger.info(`Order created with ID: ${orderId}`);

            // Create order items
            const orderItems = [];
            for (const [productId, quantity] of Object.entries(orderData.cart)) {
                const product = PRODUCTS[productId as keyof typeof PRODUCTS];
                if (product) {
                    orderItems.push({
                        order_id: orderId,
                        product_id: productId,
                        product_name: product.name,
                        price_at_purchase: product.price,
                        quantity: quantity,
                        store_id: orderData.storeId
                    });
                }
            }

            if (orderItems.length > 0) {
                const { error: itemsError } = await supabase
                    .from('order_items')
                    .insert(orderItems);

                if (itemsError) {
                    logger.error('Error creating order items:', itemsError);
                    // Order was created but items failed - you might want to handle this case
                    await ctx.reply('⚠️ Order was created but there was an issue with some items. Please contact support.');
                    return;
                }
            }
    storeId: string; // UUID of the store
    paymentMethod: 'kpay' | 'usdt' | 'cod'; // Payment method
            let orderSummary = `🎉 *Order Confirmed!*\n\n`;
            orderSummary += `📋 *Order ID:* \`${orderId}\`\n`;
}

// Register command handlers
bot.start(startCommand);

// Register action handlers (for inline keyboard callbacks)
bot.action(/^store_/, storeDetailsAction);
bot.action(/^view_products_/, viewProductsAction);
bot.action(/^navigate_product_/, viewProductsAction);
bot.action(/^add_to_cart_/, viewProductsAction);
bot.action('back_to_stores', startCommand);
bot.action('view_cart', viewCartAction); // Add this line for View Cart
bot.action('checkout', checkoutAction);
bot.action('cancel_checkout', cancelCheckoutAction);
bot.action('payment_kpay', (ctx) => handlePaymentMethod(ctx, 'kpay'));
bot.action('payment_usdt', (ctx) => handlePaymentMethod(ctx, 'usdt'));
bot.action('payment_cod', (ctx) => handlePaymentMethod(ctx, 'cod'));

// Handle text messages during checkout flow
bot.on('text', async (ctx) => {
            orderSummary += `\n💰 *Total Amount:* ${formatCurrency(orderData.total)}\n`;
            orderSummary += `💳 *Payment Method:* ${orderData.paymentMethod.toUpperCase()}\n`;
  
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
            logger.info(`Order ${orderId} processed successfully`);
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
    