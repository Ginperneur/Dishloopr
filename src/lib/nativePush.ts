import { PushNotifications } from '@capacitor/push-notifications';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { nativePlatform } from '@/lib/native';

let registered = false;

/**
 * Ask for push permission and store the device token in public.push_tokens.
 * Safe to call repeatedly; it only registers once per app session.
 */
export async function registerForPush(userId: string): Promise<void> {
  if (registered) return;
  registered = true;

  let perm = await PushNotifications.checkPermissions();
  if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
    perm = await PushNotifications.requestPermissions();
  }
  if (perm.receive !== 'granted') return;

  await PushNotifications.removeAllListeners();
  await PushNotifications.addListener('registration', async ({ value }) => {
    // push_tokens is newer than the generated Supabase types, so use an untyped client here.
    const db = supabase as unknown as SupabaseClient;
    const { error } = await db.from('push_tokens').upsert(
      { user_id: userId, token: value, platform: nativePlatform(), last_seen_at: new Date().toISOString() },
      { onConflict: 'token' },
    );
    if (error) console.warn('[push] could not save token', error.message);
  });
  await PushNotifications.addListener('registrationError', (err) => {
    console.warn('[push] registration error', err.error);
  });

  await PushNotifications.register();
}
