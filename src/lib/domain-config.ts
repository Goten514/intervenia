/**
 * Shared domain / SSL configuration.
 *
 * The custom domain `intervenia.ca` currently has an invalid or mismatched SSL
 * certificate, so browsers block it. Everything related to the "broken host"
 * detection and the secure redirect URL lives here so it can be updated in a
 * single place.
 *
 * EDIT `OFFICIAL_SECURE_URL` if your official preview/production URL changes.
 * Once a valid SSL certificate is provisioned for intervenia.ca and propagated,
 * you can clear `BROKEN_HOSTS` (set it to an empty array) to disable the banner
 * and the auto-redirect everywhere.
 */

/** The official, secure URL where the app is fully hosted (frontend + backend). */
export const OFFICIAL_SECURE_URL = 'https://ajvnzolrahpqohsbeyse.databasepad.com';

/** Hosts whose SSL certificate is currently invalid and should redirect. */
export const BROKEN_HOSTS = ['intervenia.ca', 'www.intervenia.ca'];

/** The custom domain we are trying to secure (for display / SSL test). */
export const CUSTOM_DOMAIN = 'intervenia.ca';

/** Seconds before the silent auto-redirect fires (cancellable). */
export const REDIRECT_COUNTDOWN_SECONDS = 5;

/** localStorage keys shared across the domain-warning UI. */
export const STORAGE_KEYS = {
  dismissed: 'intervenia.domainWarning.dismissed',
  clicked: 'intervenia.domainWarning.clicked',
  autoRedirect: 'intervenia.domainWarning.autoRedirect',
} as const;

/** Returns true if the given hostname is a known broken host. */
export const isBrokenHost = (hostname: string): boolean =>
  BROKEN_HOSTS.includes(hostname.toLowerCase());

/**
 * Live SSL probe.
 *
 * Browsers refuse to complete a `fetch` to a host with an invalid/mismatched
 * TLS certificate (the request rejects with a network error). A resolved
 * promise therefore means the certificate is now valid and the host is
 * reachable over HTTPS. We use this so the warning banner / auto-redirect can
 * SELF-HEAL the instant the platform provisions a valid certificate — without
 * any code change or redeploy needed to clear `BROKEN_HOSTS`.
 *
 * Resolves to `true` when the certificate is valid, `false` otherwise.
 */
export const probeSslValid = async (
  domain: string = CUSTOM_DOMAIN,
  timeoutMs = 6000,
): Promise<boolean> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetch(`https://${domain}/robots.txt?ssl=${Date.now()}`, {
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal,
    });
    return true; // TLS handshake succeeded -> certificate is valid.
  } catch {
    return false; // Cert invalid / mismatched / host unreachable.
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Cached SSL self-heal state.
 *
 * Probing the certificate on EVERY page load is wasteful (and adds a 6s timeout
 * worst-case). Once the certificate has been confirmed valid we persist that
 * fact in localStorage so subsequent navigations skip the probe entirely and
 * treat the host as healed. We still re-probe periodically while it's reported
 * invalid, so the banner / generation block disappear automatically the moment
 * a valid certificate is provisioned.
 */
const SSL_CACHE_KEY = 'intervenia.sslHealed.v1';
const SSL_CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12h — re-confirm a "valid" result twice a day.

interface SslCache { valid: boolean; ts: number }

const readSslCache = (): SslCache | null => {
  try {
    const raw = localStorage.getItem(SSL_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SslCache;
    if (typeof parsed?.valid !== 'boolean' || typeof parsed?.ts !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
};

const writeSslCache = (valid: boolean) => {
  try {
    localStorage.setItem(SSL_CACHE_KEY, JSON.stringify({ valid, ts: Date.now() }));
  } catch {
    /* ignore */
  }
};

/**
 * Synchronous check: has the certificate been confirmed valid recently? Used to
 * instantly stop blocking generation / hide the banner without awaiting a probe.
 */
export const isSslHealedCached = (): boolean => {
  const c = readSslCache();
  return !!c && c.valid && Date.now() - c.ts < SSL_CACHE_TTL_MS;
};

/**
 * Cached, self-healing SSL probe. If a recent "valid" result is cached it short-
 * circuits to `true`. Otherwise it runs a live probe and persists the result so
 * future page loads don't re-probe once the cert is confirmed valid.
 */
export const probeSslValidCached = async (
  domain: string = CUSTOM_DOMAIN,
  timeoutMs = 6000,
): Promise<boolean> => {
  const cached = readSslCache();
  if (cached && cached.valid && Date.now() - cached.ts < SSL_CACHE_TTL_MS) {
    return true;
  }
  const valid = await probeSslValid(domain, timeoutMs);
  writeSslCache(valid);
  return valid;
};



/**
 * Build the secure target URL, preserving the current path + query string so
 * the user lands exactly where they were.
 */
export const buildSecureTarget = (): string =>
  `${OFFICIAL_SECURE_URL}${window.location.pathname}${window.location.search}`;
