import { Context } from 'telegraf';
import { supabase } from '../../lib/supabaseClient';

export interface TelegramUser {
  id: string;
  telegram_user_id: string;
  email?: string;
  created_at: string;
}

/**
 * Get or create a user based on their Telegram ID
 */
export async function getOrCreateUser(ctx: Context): Promise<TelegramUser | null> {
  try {
    const telegramUserId = ctx.from?.id?.toString();
    if (!telegramUserId) {
      return null;
    }

    // Check if user already exists
    const { data: existingUser, error: fetchError } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_user_id', telegramUserId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching user:', fetchError);
      return null;
    }

    if (existingUser) {
      return existingUser;
    }

    // Create new user if doesn't exist
    const { data: newUser, error: createError } = await supabase
      .from('users')
      .insert([
        {
          telegram_user_id: telegramUserId,
          email: null, // Will be set later if user chooses to link account
          role: 'user'
        }
      ])
      .select()
      .single();

    if (createError) {
      console.error('Error creating user:', createError);
      return null;
    }

    return newUser;

  } catch (error) {
    console.error('Error in getOrCreateUser:', error);
    return null;
  }
}

/**
 * Link a Telegram user to an existing email account
 */
export async function linkUserAccount(telegramUserId: string, email: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('users')
      .update({ email })
      .eq('telegram_user_id', telegramUserId);

    if (error) {
      console.error('Error linking user account:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in linkUserAccount:', error);
    return false;
  }
}