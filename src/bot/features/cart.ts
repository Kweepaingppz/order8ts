import { Context } from 'telegraf';
import { supabase, formatCurrency } from '../../lib/supabaseClient';

export interface CartItem {
  product_id: string;
  product_name: string;
  price: number;
  quantity: number;
  store_id: string;
  store_name: string;
}

// In-memory cart storage (for simplicity)
// In production, consider using Redis or database storage
const userCarts = new Map<string, CartItem[]>();

/**
 * Get user's cart
 */
export function getUserCart(telegramUserId: string): CartItem[] {
  return userCarts.get(telegramUserId) || [];
}

/**
 * Add item to cart
 */
export async function addToCart(
  telegramUserId: string, 
  productId: string, 
  quantity: number = 1
): Promise<{ success: boolean; message: string }> {
  try {
    // Fetch product details
    const { data: product, error } = await supabase
      .from('products')
      .select(`
        *,
        stores!inner(name)
      `)
      .eq('id', productId)
      .eq('in_stock', true)
      .eq('is_active', true)
      .single();

    if (error || !product) {
      return { success: false, message: 'Product not found or out of stock' };
    }

    // Check stock availability
    if (product.stock_quantity < quantity) {
      return { 
        success: false, 
        message: `Only ${product.stock_quantity} items available in stock` 
      };
    }

    const cart = getUserCart(telegramUserId);
    const existingItemIndex = cart.findIndex(item => item.product_id === productId);

    if (existingItemIndex >= 0) {
      // Update existing item
      const newQuantity = cart[existingItemIndex].quantity + quantity;
      if (newQuantity > product.stock_quantity) {
        return { 
          success: false, 
          message: `Cannot add more items. Maximum available: ${product.stock_quantity}` 
        };
      }
      cart[existingItemIndex].quantity = newQuantity;
    } else {
      // Add new item
      cart.push({
        product_id: productId,
        product_name: product.name,
        price: product.price,
        quantity,
        store_id: product.store_id,
        store_name: (product as any).stores.name
      });
    }

    userCarts.set(telegramUserId, cart);
    return { 
      success: true, 
      message: `Added ${quantity}x ${product.name} to cart` 
    };

  } catch (error) {
    console.error('Error adding to cart:', error);
    return { success: false, message: 'Failed to add item to cart' };
  }
}

/**
 * Remove item from cart
 */
export function removeFromCart(telegramUserId: string, productId: string): boolean {
  const cart = getUserCart(telegramUserId);
  const filteredCart = cart.filter(item => item.product_id !== productId);
  userCarts.set(telegramUserId, filteredCart);
  return true;
}

/**
 * Clear entire cart
 */
export function clearCart(telegramUserId: string): void {
  userCarts.delete(telegramUserId);
}

/**
 * Get cart total
 */
export function getCartTotal(telegramUserId: string): number {
  const cart = getUserCart(telegramUserId);
  return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
}

/**
 * Format cart for display
 */
export function formatCartMessage(telegramUserId: string): string {
  const cart = getUserCart(telegramUserId);
  
  if (cart.length === 0) {
    return '🛒 Your cart is empty';
  }

  let message = '🛒 *Your Cart:*\n\n';
  
  cart.forEach((item, index) => {
    message += `${index + 1}. *${item.product_name}*\n`;
    message += `   Store: ${item.store_name}\n`;
    message += `   Price: ${formatCurrency(item.price)} x ${item.quantity}\n`;
    message += `   Subtotal: ${formatCurrency(item.price * item.quantity)}\n\n`;
  });

  message += `💰 *Total: ${formatCurrency(getCartTotal(telegramUserId))}*`;
  
  return message;
}