import { PushNotifications } from '@capacitor/push-notifications';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { nativePlatform } from '@/lib/native';

// register_push_token is newer than the generated Supabase types, so use an untyped client here.
const db = supabase as unknown as SupabaseClient;

let registeredFor: string | null = null;
let listenersReady = false;
let currentToken: string | null = null;

async function saveToken(token: string) {
  // Server-side function: links the token to the signed-in user, moving it away
  // from whoever used this device before.
  const { error } = await db.rpc('register_push_token', { p_token: token, p_platform: nativePlatform() });
  if (error) console.warn('[push] could not save token', error.message);
}

/**
 * Ask for push permission and store the device token for the signed-in user.
 * Safe to call repeatedly; it registers once per signed-in user.
 */
export async function registerForPush(userId: string): Promise<void> {
  if (registeredFor === userId) return;
  registeredFor = userId;

  let perm = await PushNotifications.checkPermissions();
  if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
    perm = await PushNotifications.requestPermissions();
  }
  if (perm.receive !== 'granted') return;

  if (!listenersReady) {
    listenersReady = true;
    await PushNotifications.addListener('registration', ({ value }) => {
      currentToken = value;
      void saveToken(value);
    });
    await PushNotifications.addListener('registrationError', (err) => {
      console.warn('[push] registration error', err.error);
    });
  }

  // Fires 'registration' again, also when the token is unchanged, so a new user claims it.
  await PushNotifications.register();
}

/**
 * Remove this device's token before signing out, so the next person on this
 * device does not receive the previous user's notifications.
 */
export async function unregisterPush(): Promise<void> {
  registeredFor = null;
  if (!currentToken) return;
  const { error } = await db.from('push_tokens').delete().eq('token', currentToken);
  if (error) console.warn('[push] could not remove token', error.message);
  currentToken = null;
}
