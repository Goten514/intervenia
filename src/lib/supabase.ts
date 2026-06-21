import { createClient } from '@supabase/supabase-js';

/**
 * Real database-backed client.
 *
 *  - `supabase.from(table)` -> live PostgREST query builder against the configured
 *    database, giving true cross-device / cross-browser persistence.
 *  - `supabase.functions.invoke(...)` -> robust fetch-based edge function invoker
 *    that never throws on a non-2xx status (so `{ error }` payloads reach the UI).
 *
 * There is no hosted GoTrue auth on this database, so row isolation is enforced
 * at the application layer: every query is scoped by `user_id`, and RLS is left
 * permissive. The client-side AuthContext issues real UUIDs for `user_id`.
 */

const supabaseUrl = 'https://mhkptablksvzkhciqdfx.supabase.co/rest/v1/';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oa3B0YWJsa3N2emtoY2lxZGZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE5ODE2ODIsImV4cCI6MjA5NzU1NzY4Mn0.jjt8aYYGsh9kNs1XQORSLcWzxJvGUKhUHk0J1TFGBd0';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// The hosted database/functions infrastructure occasionally returns a transient
// "project_not_found" (or paused/cold-start) error for the very first request
// after the project has gone idle — the project then resolves correctly a moment
// later. These intermittent failures broke BOTH plain DB writes (e.g. creating a
// client) and edge-function calls (e.g. generating a tool). We detect them by
// body content and HTTP status, and transparently retry with backoff.
const TRANSIENT_BODY_MARKERS = [
  'project_not_found',
  'project not found',
  'project is paused',
  'project_paused',
  'temporarily unavailable',
  'service unavailable',
  'bad gateway',
  'gateway timeout',
];

const isTransientBody = (text: string): boolean => {
  const t = (text || '').toLowerCase();
  return TRANSIENT_BODY_MARKERS.some((m) => t.includes(m));
};

// Decide whether a non-OK response is a transient infra hiccup worth retrying.
//  - Any 5xx / 429 / 408 -> always retry.
//  - A 404 (or other 4xx) -> retry ONLY when the body carries a project/infra
//    marker (so we never swallow a legitimate "row not found" data response).
const shouldRetry = (status: number, bodyText: string): boolean => {
  if (status >= 500 || status === 429 || status === 408) return true;
  if (status === 404 || status === 400) return isTransientBody(bodyText);
  return false;
};

const MAX_FETCH_ATTEMPTS = 4;

/**
 * A drop-in `fetch` that auto-retries transient infrastructure errors
 * (project_not_found / paused / 5xx). It buffers the response body so the
 * caller can still read it normally, and reconstructs an equivalent Response.
 */
const retryingFetch: typeof fetch = async (input: any, init?: any) => {
  let lastErr: any = null;

  for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(input, init);

      // Fast path: clearly successful response, return as-is.
      if (res.ok) return res;

      // Buffer the body so we can inspect it AND hand a fresh Response back.
      const bodyText = await res.clone().text();

      if (shouldRetry(res.status, bodyText) && attempt < MAX_FETCH_ATTEMPTS) {
        await sleep(500 * attempt + Math.random() * 250);
        continue;
      }

      // Not transient (or out of attempts): reconstruct the response so the
      // already-consumed body is still readable downstream.
      return new Response(bodyText, {
        status: res.status,
        statusText: res.statusText,
        headers: res.headers,
      });
    } catch (err: any) {
      // A network-level throw (TypeError "Failed to fetch") usually means the
      // browser blocked the request (SSL / offline / extension). Retry a couple
      // times in case it's a transient hiccup, then rethrow so the UI can show
      // the dedicated "connexion bloquée" guidance.
      lastErr = err;
      if (attempt < MAX_FETCH_ATTEMPTS) {
        await sleep(400 * attempt);
        continue;
      }
      throw err;
    }
  }

  if (lastErr) throw lastErr;
  // Should never reach here.
  return fetch(input, init);
};

const realClient = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: retryingFetch },
});

// ---------- Robust edge-function invoker ----------
//
// supabase-js' built-in `functions.invoke` throws a `FunctionsHttpError`
// ("Edge Function returned a non-2xx status code") on any status >= 400 and
// discards the JSON body. We replace it with a fetch-based invoker that always
// parses and returns the JSON body, retries transient infra errors, and never
// throws on a non-2xx status.
const FUNCTIONS_URL = `${supabaseUrl}/functions/v1`;

const invokeFunction = async (
  name: string,
  opts: { body?: any; headers?: Record<string, string> } = {}
): Promise<{ data: any; error: any }> => {
  let lastInfraErr: string | null = null;

  for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt++) {
    try {
      // Use the raw fetch here (not retryingFetch) so we control retry semantics
      // around the JSON envelope below.
      const res = await fetch(`${FUNCTIONS_URL}/${name}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          ...(opts.headers || {}),
        },
        body: JSON.stringify(opts.body ?? {}),
      });

      const raw = await res.text();

      // Transient infrastructure failure (project waking up, 5xx, paused, or a
      // project_not_found envelope): retry a few times before giving up.
      if ((shouldRetry(res.status, raw) || (res.ok && isTransientBody(raw))) && attempt < MAX_FETCH_ATTEMPTS) {
        lastInfraErr = isTransientBody(raw) ? 'project_not_found' : `HTTP ${res.status}`;
        await sleep(600 * attempt + Math.random() * 300);
        continue;
      }

      let parsed: any = null;
      try {
        parsed = raw ? JSON.parse(raw) : null;
      } catch {
        parsed = { raw };
      }

      let data = parsed;
      if (
        parsed &&
        typeof parsed === 'object' &&
        'data' in parsed &&
        'status' in parsed &&
        'success' in parsed
      ) {
        data = parsed.data ?? parsed;
      }

      if (!res.ok && (!data || typeof data !== 'object')) {
        return { data: null, error: { message: `Function ${name} failed (HTTP ${res.status})` } };
      }

      return { data, error: null };
    } catch (err: any) {
      lastInfraErr = err?.message || 'Network error';
      // Network throw: retry a couple times, then surface so the UI can show the
      // browser-blocked guidance.
      if (attempt < MAX_FETCH_ATTEMPTS) {
        await sleep(500 * attempt);
        continue;
      }
      return { data: null, error: { message: err?.message || 'Network error' } };
    }
  }

  return {
    data: null,
    error: {
      message:
        'Le service est momentanément indisponible (initialisation). Patientez quelques secondes puis réessayez.',
      code: lastInfraErr || 'transient',
    },
  };
};

// ---------- Backend reachability probe ----------
//
// CRITICAL: API requests go to `databasepad.com` (always a valid certificate),
// NOT to the custom domain `intervenia.ca`. So a generation failure is almost
// never caused by the intervenia.ca SSL certificate. Before showing any scary
// "connexion bloquée / certificat SSL" guidance, we run this lightweight probe
// to find out whether the BACKEND host is actually reachable from this browser.
//
// Resolves:
//   true  -> backend reachable (the failure was a transient/server error;
//            we should simply retry, NOT blame SSL/security).
//   false -> backend genuinely unreachable from this browser (offline, an
//            extension/firewall is blocking it) -> show connectivity guidance.
export const probeBackendReachable = async (timeoutMs = 5000): Promise<boolean> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // `no-cors` lets the TLS handshake + TCP connection complete even though we
    // can't read the opaque response. A resolved promise means the host is
    // reachable over HTTPS (certificate valid). Cache-busted to avoid SW caches.
    await fetch(`${supabaseUrl}/functions/v1/health-check?ping=${Date.now()}`, {
      method: 'POST',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
};

// ---------- REST gateway probe (schema-exposure / CORS diagnostic) ----------
//
// The production REST gateway (databasepad.com) can return a 404 for a table
// when its PostgREST schema cache is stale or the wrong schema is exposed, OR
// the browser can block the request via CORS (missing Access-Control-Allow-Origin
// for this origin). These two failure modes look identical in most app code
// (both surface as a generic error), so this probe issues a RAW fetch we control
// in order to tell them apart precisely:
//
//   { kind: 'ok' }            -> HTTP 200/206, table is exposed and reachable
//   { kind: 'not_found' }     -> HTTP 404, schema not exposed / table absent at gateway (PLATFORM)
//   { kind: 'forbidden' }     -> HTTP 401/403, reachable but blocked by policy/key
//   { kind: 'http', status }  -> some other HTTP status (e.g. 5xx)
//   { kind: 'cors' }          -> request threw (TypeError) = CORS block or network (PLATFORM)
export type RestProbeResult =
  | { kind: 'ok'; status: number; ms: number; sample?: unknown }
  | { kind: 'not_found'; status: number; ms: number; body?: string }
  | { kind: 'forbidden'; status: number; ms: number; body?: string }
  | { kind: 'http'; status: number; ms: number; body?: string }
  | { kind: 'cors'; ms: number; detail: string };

export const probeRestTable = async (
  table: string,
  timeoutMs = 8000
): Promise<RestProbeResult> => {
  const t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const elapsed = () => Math.round((typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0);
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/${encodeURIComponent(table)}?select=*&limit=1`,
      {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          Accept: 'application/json',
        },
      }
    );
    const ms = elapsed();
    if (res.ok) {
      let sample: unknown = undefined;
      try {
        const txt = await res.text();
        sample = txt ? JSON.parse(txt) : [];
      } catch {
        /* ignore parse */
      }
      return { kind: 'ok', status: res.status, ms, sample };
    }
    let body = '';
    try {
      body = await res.text();
    } catch {
      /* ignore */
    }
    if (res.status === 404) return { kind: 'not_found', status: 404, ms, body };
    if (res.status === 401 || res.status === 403) return { kind: 'forbidden', status: res.status, ms, body };
    return { kind: 'http', status: res.status, ms, body };
  } catch (e: any) {
    // A thrown fetch (TypeError "Failed to fetch") with the gateway otherwise up
    // is the classic signature of a CORS block (no Access-Control-Allow-Origin
    // for this origin) — or an offline/blocked network.
    return { kind: 'cors', ms: elapsed(), detail: e?.message || 'Requête bloquée (CORS ou réseau)' };
  } finally {
    clearTimeout(timer);
  }
};

// ---------- Public client ----------

const supabase = {
  from: (table: string) => realClient.from(table),
  functions: {
    invoke: invokeFunction,
  },
  auth: realClient.auth,
};

export { supabase };
