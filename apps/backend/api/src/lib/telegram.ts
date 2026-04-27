/**
 * Telegram notification module.
 * Sends a plain-text message to a configured Telegram chat via the Bot API.
 * Fire-and-forget: the exported function returns void and never throws.
 * No-ops silently when TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID are absent or empty.
 */
import { logger } from './logger';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Timeout for the Telegram Bot API request. */
const TELEGRAM_TIMEOUT_MS = 5_000;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Sends a plain-text message to the configured Telegram chat.
 * Fire-and-forget: returns void, never throws.
 * No-ops silently when TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID are not set.
 *
 * @param text - The message text to send.
 */
export function sendTelegramMessage(text: string): void {
  void (async (): Promise<void> => {
    const token = process.env['TELEGRAM_BOT_TOKEN'];
    const chatId = process.env['TELEGRAM_CHAT_ID'];

    if (!token || !chatId) return;

    const url = `https://api.telegram.org/bot${token}/sendMessage`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text }),
        signal: AbortSignal.timeout(TELEGRAM_TIMEOUT_MS),
      });

      if (!res.ok) {
        logger.warn({ status: res.status }, 'telegram: sendMessage returned non-2xx response');
      }
    } catch (err: unknown) {
      logger.warn({ err }, 'telegram: sendMessage failed');
    }
  })();
}
