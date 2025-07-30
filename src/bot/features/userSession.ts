import { ConversationState, UserSession } from '../../types/bot';

// In-memory storage for user sessions
const userSessions = new Map<string, UserSession>();

/**
 * Get user session by Telegram user ID
 */
export function getUserSession(telegramUserId: string): UserSession | null {
  return userSessions.get(telegramUserId) || null;
}

/**
 * Set or update user session
 */
export function setUserSession(telegramUserId: string, session: Partial<UserSession>): void {
  const existingSession = userSessions.get(telegramUserId);
  
  const updatedSession: UserSession = {
    telegramUserId,
    state: session.state || 'idle',
    data: { ...existingSession?.data, ...session.data },
    lastActivity: new Date()
  };
  
  userSessions.set(telegramUserId, updatedSession);
}

/**
 * Clear user session
 */
export function clearUserSession(telegramUserId: string): void {
  userSessions.delete(telegramUserId);
}

/**
 * Check if user is in checkout flow
 */
export function isUserInCheckout(telegramUserId: string): boolean {
  const session = getUserSession(telegramUserId);
  return session?.state !== 'idle' && session?.state !== undefined;
}

/**
 * Clean up old sessions (optional - for memory management)
 */
export function cleanupOldSessions(): void {
  const now = new Date();
  const maxAge = 30 * 60 * 1000; // 30 minutes
  
  for (const [userId, session] of userSessions.entries()) {
    if (now.getTime() - session.lastActivity.getTime() > maxAge) {
      userSessions.delete(userId);
    }
  }
}