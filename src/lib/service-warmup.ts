import { supabase } from '@/lib/supabase';

// Module-level guard so the global warm-up ping only fires ONCE per page load,
// no matter how many dashboard components mount or remount.
let warmedUp = false;
let inflight: Promise<void> | null = null;

/**
 * Fire-and-forget warm-up of the hosted generation service.
 *
 * Pings the lightweight `health-check` edge function so the project (and the
 * generation runtime behind it) is already awake by the time the intervenant
 * opens the generator tab — regardless of which dashboard tab they land on
 * first. Safe to call from many places: it self-deduplicates and never throws.
 */
export const warmUpService = (): Promise<void> => {
  if (warmedUp) return Promise.resolve();
  if (inflight) return inflight;

  warmedUp = true;
  inflight = supabase.functions
    .invoke('health-check', { body: {} })
    .then(() => undefined)
    .catch(() => {
      // Allow a later retry if the very first warm-up ping failed outright.
      warmedUp = false;
      return undefined;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
};
