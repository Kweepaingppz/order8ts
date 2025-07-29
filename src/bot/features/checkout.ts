import { Context } from 'telegraf';
import { supabase, formatCurrency } from '../../lib/supabaseClient';
import { getUserCart, clearCart, getCartTotal } from './cart';

export interface CheckoutData {
  telegramName: string;
  shippingAddress: string;
  phoneNumber?: string;
  paymentMethod: 'kpay' | 'usdt' | 'cod';
  transactionNumber?: string;
  remark?: string;
}

/**
 * Create order from cart
 */
export async function createOrderFromCart(
  telegramUserId: string,
  checkoutData: CheckoutData
): Promise<{ success: boolean; message: string; orderId?: string }> {
  try {
    const cart = getUserCart(telegramUserId);
    
    if (cart.length === 0) {
      return { success: false, message: 'Cart is empty' };
    }

    // Group cart items by store
    const storeGroups = cart.reduce((groups, item) => {
      if (!groups[item.store_id]) {
        groups[item.store_id] = [];
      }
      groups[item.store_id].push(item);
      return groups;
    }, {} as Record<string, typeof cart>);

    const orderIds: string[] = [];

    // Create separate orders for each store
    for (const [storeId, items] of Object.entries(storeGroups)) {
      const storeTotal = items.reduce((total, item) => total + (item.price * item.quantity), 0);

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert([
          {
            store_id: storeId,
            status: 'pending',
            payment_method: checkoutData.paymentMethod,
            payment_status: 'pending',
            total_amount: storeTotal,
            payment_expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(), // 15 minutes
          }
        ])
        .select()
        .single();

      if (orderError || !order) {
        console.error('Error creating order:', orderError);
        continue;
      }

      // Create order items
      const orderItems = items.map(item => ({
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.price
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) {
        console.error('Error creating order items:', itemsError);
        continue;
      }

      orderIds.push(order.id);

      // Send notification to store (using existing notify-order function)
      try {
        const notificationData = {
          storeId: storeId,
          telegramName: checkoutData.telegramName,
          transactionNumber: checkoutData.transactionNumber || '',
          shippingAddress: checkoutData.shippingAddress,
          phoneNumber: checkoutData.phoneNumber || '',
          remark: checkoutData.remark || '',
          items: items.map(item => ({
            name: item.product_name,
            quantity: item.quantity,
            price: item.price
          })),
          totalAmount: storeTotal,
          paymentMethod: checkoutData.paymentMethod
        };

        await fetch(`${process.env.SUPABASE_URL}/functions/v1/notify-order`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(notificationData),
        });
      } catch (notifyError) {
        console.error('Error sending store notification:', notifyError);
        // Don't fail the order if notification fails
      }
    }

    if (orderIds.length === 0) {
      return { success: false, message: 'Failed to create orders' };
    }

    // Clear cart after successful order creation
    clearCart(telegramUserId);

    return {
      success: true,
      message: `Order(s) created successfully! Order ID(s): ${orderIds.join(', ')}`,
      orderId: orderIds[0] // Return first order ID
    };

  } catch (error) {
    console.error('Error in createOrderFromCart:', error);
    return { success: false, message: 'Failed to process order' };
  }
}

/**
 * Get payment instructions for a store
 */
export async function getPaymentInstructions(
  storeId: string,
  paymentMethod: 'kpay' | 'usdt' | 'cod',
  amount: number
): Promise<string> {
  try {
    const { data: store, error } = await supabase
      .from('stores')
      .select('payment_methods')
      .eq('id', storeId)
      .single();

    if (error || !store) {
      return 'Payment information not available';
    }

    if (paymentMethod === 'cod') {
      return `💵 *Cash on Delivery*\n\nTotal: ${formatCurrency(amount)}\n\nPlease have the exact amount ready when the order is delivered.`;
    }

    const walletAddress = store.payment_methods?.wallet_addresses?.[paymentMethod];
    if (!walletAddress) {
      return `${paymentMethod.toUpperCase()} payment is not available for this store`;
    }

    return `💳 *${paymentMethod.toUpperCase()} Payment*\n\nAmount: ${formatCurrency(amount)}\nWallet Address: \`${walletAddress}\`\n\nPlease send the exact amount and provide the last 6 digits of your transaction number.`;

  } catch (error) {
    console.error('Error getting payment instructions:', error);
    return 'Error loading payment information';
  }
}