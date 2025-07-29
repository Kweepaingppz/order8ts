import { Context as TelegrafContext } from 'telegraf';

// Extend Telegraf Context with custom properties
export interface BotContext extends TelegrafContext {
  // Add custom properties here if needed
  user?: {
    id: string;
    telegram_user_id: string;
    email?: string;
  };
}

// Store interface for bot
export interface Store {
  id: string;
  name: string;
  description?: string;
  logo_url?: string;
  location: string;
  category: string;
  is_active: boolean;
  is_verified: boolean;
  username: string;
  phone_number?: string;
  channel_link?: string;
  payment_methods: {
    kpay: boolean;
    usdt: boolean;
    cod: boolean;
    wallet_addresses: {
      kpay?: string;
      usdt?: string;
    };
  };
}

// Product interface for bot
export interface Product {
  id: string;
  store_id: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  category: string;
  in_stock: boolean;
  stock_quantity: number;
  is_active: boolean;
}

// Order interface for bot
export interface Order {
  id: string;
  store_id: string;
  status: 'pending' | 'paid' | 'confirmed' | 'completed' | 'cancelled';
  payment_method: 'kpay' | 'usdt' | 'cod';
  payment_status: 'pending' | 'completed' | 'failed';
  total_amount: number;
  created_at: string;
}

// Conversation state types
export type ConversationState = 
  | 'idle'
  | 'collecting_shipping_address'
  | 'collecting_phone_number'
  | 'collecting_transaction_number'
  | 'confirming_order';

export interface UserSession {
  telegramUserId: string;
  state: ConversationState;
  data: Record<string, any>;
  lastActivity: Date;
}