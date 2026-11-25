import type { SupabaseClient } from "npm:@supabase/supabase-js@2.118.0";

// Fallback when app_settings.launch_date is missing or malformed.
const DEFAULT_LAUNCH = "2026-12-01";

/** Launch moment as epoch ms: midnight Amsterdam time on app_settings.launch_date. */
export async function launchAt(admin: SupabaseClient): Promise<{ date: string; ms: number }> {
  const { data } = await admin.from("app_settings").select("value").eq("key", "launch_date").maybeSingle();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(data?.value ?? "") ? data!.value : DEFAULT_LAUNCH;
  // Amsterdam is UTC+1 in winter and UTC+2 in summer; take the offset that day.
  const probe = new Date(`${date}T12:00:00Z`);
  const offsetHours = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Amsterdam", hour: "2-digit", hour12: false }).format(probe)) - 12;
  return { date, ms: Date.parse(`${date}T00:00:00Z`) - offsetHours * 3600_000 };
}

/** Shortest term that earns the Founding Partner price and status. */
export const FOUNDING_MIN_MONTHS = 6;
/** Terms an owner can pick for a monthly place; 1 means cancellable every month. */
export const TERM_MONTHS = [1, 3, 6, 12] as const;

/** End of a minimum term of `months` (default the 6-month Founding Partner term) that starts on `fromMs`. */
export function commitmentEnd(fromMs: number, months: number = FOUNDING_MIN_MONTHS): string {
  const end = new Date(fromMs);
  end.setUTCMonth(end.getUTCMonth() + months);
  return end.toISOString();
}
