import { Context, Markup } from 'telegraf';
import { getUserCart, getCartTotal, formatCartMessage } from '../features/cart';
import { getUserSession, setUserSession, clearUserSession } from '../features/userSession';
import { formatCurrency } from '../../lib/supabaseClient';
import { createOrderFromCart, CheckoutData } from '../features/checkout';

/**
 * Initial checkout action - triggered when user clicks "Checkout" button
 */
export async function checkoutAction(ctx: Context): Promise<void> {
  try {
    if (!ctx.from) {
      await ctx.answerCbQuery('User information not available.');
      return;
    }

    const userId = ctx.from.id.toString();
    const cart = getUserCart(userId);

    if (!cart || cart.length === 0) {
      await ctx.answerCbQuery('Your cart is empty!');
      await ctx.reply('Your cart is empty! Please add some items before checkout.');
      return;
    }

    // Set user session to start collecting shipping address
    setUserSession(userId, {
      state: 'collecting_shipping_address',
      data: {
        telegramName: ctx.from.first_name + (ctx.from.last_name ? ` ${ctx.from.last_name}` : ''),
        username: ctx.from.username || ''
      }
    });

    const total = getCartTotal(userId);
    const message = `🛒 *Checkout Process Started*\n\n` +
      `Total Amount: ${formatCurrency(total)}\n\n` +
      `📍 Please provide your shipping address:\n\n` +
      `*Example:*\n` +
      `123 Main Street\n` +
      `Apartment 4B\n` +
      `Bangkok 10110\n` +
      `Thailand`;

    await ctx.editMessageText(
      message,
      {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('❌ Cancel Checkout', 'cancel_checkout')]
        ]).reply_markup
      }
    );

    await ctx.answerCbQuery();

  } catch (error) {
    console.error('Error in checkout action:', error);
    await ctx.answerCbQuery('Error starting checkout');
    await ctx.reply('Sorry, something went wrong while starting checkout.');
  }
}

/**
 * Handle checkout input based on current conversation state
 */
export async function handleCheckoutInput(ctx: Context): Promise<void> {
  try {
    if (!ctx.from || !ctx.message || !('text' in ctx.message)) {
      return;
    }

    const userId = ctx.from.id.toString();
    const session = getUserSession(userId);
    const userInput = ctx.message.text.trim();

    if (!session || session.state === 'idle') {
      return; // User is not in checkout flow
    }

    switch (session.state) {
      case 'collecting_shipping_address':
        await handleShippingAddress(ctx, userId, userInput);
        break;
      
      case 'collecting_phone_number':
        await handlePhoneNumber(ctx, userId, userInput);
        break;
      
      case 'collecting_transaction_number':
        await handleTransactionNumber(ctx, userId, userInput);
        break;
      
      default:
        break;
    }

  } catch (error) {
    console.error('Error handling checkout input:', error);
    await ctx.reply('Sorry, something went wrong. Please try again.');
  }
}

/**
 * Handle shipping address input
 */
async function handleShippingAddress(ctx: Context, userId: string, address: string): Promise<void> {
  if (address.length < 10) {
    await ctx.reply('Please provide a more detailed shipping address (at least 10 characters).');
    return;
  }

  // Update session with shipping address
  setUserSession(userId, {
    state: 'collecting_phone_number',
    data: { shippingAddress: address }
  });

  const message = `✅ Shipping address saved!\n\n` +
    `📱 Please provide your phone number for delivery coordination:\n\n` +
    `*Example:* +66 81 234 5678`;

  await ctx.reply(
    message,
    {
      parse_mode: 'Markdown',
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('❌ Cancel Checkout', 'cancel_checkout')]
      ]).reply_markup
    }
  );
}

/**
 * Handle phone number input
 */
async function handlePhoneNumber(ctx: Context, userId: string, phoneNumber: string): Promise<void> {
  if (phoneNumber.length < 8) {
    await ctx.reply('Please provide a valid phone number.');
    return;
  }

  // Update session with phone number and move to payment method selection
  setUserSession(userId, {
    state: 'confirming_order',
    data: { phoneNumber }
  });

  const session = getUserSession(userId);
  const cart = getUserCart(userId);
  const total = getCartTotal(userId);

  const message = `📋 *Order Summary*\n\n` +
    `👤 Name: ${session?.data.telegramName}\n` +
    `📍 Address: ${session?.data.shippingAddress}\n` +
    `📱 Phone: ${phoneNumber}\n\n` +
    `${formatCartMessage(userId)}\n\n` +
    `💰 *Total: ${formatCurrency(total)}*\n\n` +
    `Please select your payment method:`;

  await ctx.reply(
    message,
    {
      parse_mode: 'Markdown',
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('💳 KPay', 'payment_kpay')],
        [Markup.button.callback('💰 USDT', 'payment_usdt')],
        [Markup.button.callback('💵 Cash on Delivery', 'payment_cod')],
        [Markup.button.callback('❌ Cancel', 'cancel_checkout')]
      ]).reply_markup
    }
  );
}

/**
 * Handle transaction number input (for KPay/USDT payments)
 */
async function handleTransactionNumber(ctx: Context, userId: string, transactionNumber: string): Promise<void> {
  if (transactionNumber.length < 6) {
    await ctx.reply('Please provide the last 6 digits of your transaction number.');
    return;
  }

  // Complete the order
  await completeOrder(ctx, userId, transactionNumber);
}

/**
 * Complete the order
 */
async function completeOrder(ctx: Context, userId: string, transactionNumber?: string): Promise<void> {
  try {
    const session = getUserSession(userId);
    if (!session) {
      await ctx.reply('Session expired. Please start checkout again.');
      return;
    }

    const checkoutData: CheckoutData = {
      telegramName: session.data.telegramName,
      shippingAddress: session.data.shippingAddress,
      phoneNumber: session.data.phoneNumber,
      paymentMethod: session.data.paymentMethod,
      transactionNumber: transactionNumber,
      remark: session.data.remark
    };

    const result = await createOrderFromCart(userId, checkoutData);

    if (result.success) {
      await ctx.reply(
        `✅ *Order Placed Successfully!*\n\n` +
        `Order ID: ${result.orderId}\n\n` +
        `Thank you for your order! You will receive updates on your order status.`,
        { parse_mode: 'Markdown' }
      );
    } else {
      await ctx.reply(`❌ Order failed: ${result.message}`);
    }

    // Clear user session
    clearUserSession(userId);

  } catch (error) {
    console.error('Error completing order:', error);
    await ctx.reply('Sorry, something went wrong while processing your order.');
  }
}

/**
 * Cancel checkout action
 */
export async function cancelCheckoutAction(ctx: Context): Promise<void> {
  try {
    if (!ctx.from) {
      await ctx.answerCbQuery('User information not available.');
      return;
    }

    const userId = ctx.from.id.toString();
    clearUserSession(userId);

    await ctx.editMessageText(
      '❌ Checkout cancelled. Your cart items are still saved.',
      {
        reply_markup: Markup.inlineKeyboard([
          [Markup.button.callback('🛒 View Cart', 'view_cart')],
          [Markup.button.callback('🛍️ Continue Shopping', 'back_to_stores')]
        ]).reply_markup
      }
    );

    await ctx.answerCbQuery('Checkout cancelled');

  } catch (error) {
    console.error('Error cancelling checkout:', error);
    await ctx.answerCbQuery('Error cancelling checkout');
  }
}

/**
 * Handle payment method selection
 */
export async function handlePaymentMethod(ctx: Context, paymentMethod: 'kpay' | 'usdt' | 'cod'): Promise<void> {
  try {
    if (!ctx.from) {
      await ctx.answerCbQuery('User information not available.');
      return;
    }

    const userId = ctx.from.id.toString();
    
    // Update session with payment method
    setUserSession(userId, {
      data: { paymentMethod }
    });

    if (paymentMethod === 'cod') {
      // For COD, complete the order immediately
      await completeOrder(ctx, userId);
    } else {
      // For KPay/USDT, ask for transaction number
      setUserSession(userId, {
        state: 'collecting_transaction_number'
      });

      const message = `💳 *${paymentMethod.toUpperCase()} Payment Selected*\n\n` +
        `Please make the payment and provide the last 6 digits of your transaction number.\n\n` +
        `*Note:* Your order will be processed once payment is confirmed.`;

      await ctx.editMessageText(
        message,
        {
          parse_mode: 'Markdown',
          reply_markup: Markup.inlineKeyboard([
            [Markup.button.callback('❌ Cancel', 'cancel_checkout')]
          ]).reply_markup
        }
      );
    }

    await ctx.answerCbQuery();

  } catch (error) {
    console.error('Error handling payment method:', error);
    await ctx.answerCbQuery('Error processing payment method');
  }
}