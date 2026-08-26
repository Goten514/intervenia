import React, { useEffect, useRef, useState } from 'react';
import { ShieldAlert, ExternalLink, X, Timer, ShieldCheck } from 'lucide-react';
import {
  CUSTOM_DOMAIN,
  REDIRECT_COUNTDOWN_SECONDS,
  STORAGE_KEYS,
  isBrokenHost,
  buildSecureTarget,
  probeSslValidCached,
} from '@/lib/domain-config';

/**
 * Banner shown when a visitor lands on a host whose SSL certificate is invalid
 * (see src/lib/domain-config.ts). It offers a one-click secure redirect plus an
 * opt-in silent auto-redirect with a cancellable countdown.
 *
 * SELF-HEALING: even when the host is in `BROKEN_HOSTS`, we run a live SSL probe
 * before showing the warning. If the certificate has since been provisioned by
 * the platform (it becomes valid the moment DNS is propagated + the cert is
 * issued), the probe succeeds and the banner / auto-redirect never appear — no
 * code change or redeploy required.
 */
const DomainWarningBanner: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [hasClickedBefore, setHasClickedBefore] = useState(false);
  const [autoRedirect, setAutoRedirect] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    try {
      const host = window.location.hostname.toLowerCase();
      const onBrokenHost = isBrokenHost(host);
      const dismissed = localStorage.getItem(STORAGE_KEYS.dismissed) === '1';
      const clicked = localStorage.getItem(STORAGE_KEYS.clicked) === '1';
      const auto = localStorage.getItem(STORAGE_KEYS.autoRedirect) === '1';

      setHasClickedBefore(clicked);
      setAutoRedirect(auto);

      if (!onBrokenHost || dismissed) {
        setVisible(false);
        return;
      }

      // Verify with a live probe before alarming the user / redirecting. This
      // makes the banner disappear automatically once SSL is provisioned.
      probeSslValidCached().then((valid) => {
        if (cancelled) return;
        if (valid) {
          // Certificate is now valid — nothing to warn about. Clean up any
          // stale auto-redirect preference so we never bounce a working site.
          setVisible(false);
          return;
        }
        setVisible(true);
        if (clicked && auto) {
          setCountdown(REDIRECT_COUNTDOWN_SECONDS);
        }
      });
    } catch {
      setVisible(false);
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // Countdown driver for the auto-redirect.
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      window.location.href = buildSecureTarget();
      return;
    }
    timerRef.current = window.setTimeout(() => {
      setCountdown((c) => (c === null ? null : c - 1));
    }, 1000);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown]);

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEYS.dismissed, '1');
    } catch {
      /* ignore */
    }
    setVisible(false);
    cancelCountdown();
  };

  const cancelCountdown = () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setCountdown(null);
  };

  const markClicked = () => {
    try {
      localStorage.setItem(STORAGE_KEYS.clicked, '1');
    } catch {
      /* ignore */
    }
    setHasClickedBefore(true);
  };

  const goNow = () => {
    markClicked();
    window.location.href = buildSecureTarget();
  };

  const toggleAuto = (checked: boolean) => {
    setAutoRedirect(checked);
    try {
      localStorage.setItem(STORAGE_KEYS.autoRedirect, checked ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (!checked) cancelCountdown();
    else if (hasClickedBefore && countdown === null) {
      setCountdown(REDIRECT_COUNTDOWN_SECONDS);
    }
  };

  if (!visible) return null;

  const target = buildSecureTarget();
  const redirecting = countdown !== null;

  return (
    <div className="relative z-50 border-b-2 border-red-300 bg-gradient-to-r from-red-50 via-rose-50 to-orange-50">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-red-100">
              <ShieldAlert className="h-5 w-5 text-red-600" />
            </span>
            <div className="flex-1">
              {redirecting ? (
                <p className="flex flex-wrap items-center gap-2 text-sm text-red-900">
                  <Timer className="h-4 w-4 text-red-600" />
                  <span className="font-semibold">
                    Redirection automatique vers le site sécurisé dans {countdown}s…
                  </span>
                  <button
                    onClick={cancelCountdown}
                    className="rounded-md border border-red-400 bg-white/70 px-2 py-0.5 text-xs font-semibold text-red-800 transition hover:bg-white"
                  >
                    Annuler
                  </button>
                </p>
              ) : (
                <>
                  <p className="text-sm font-bold text-red-900">
                    Problème de sécurité&nbsp;: connexion non sécurisée
                  </p>
                  <p className="mt-0.5 text-sm text-red-800">
                    Le certificat SSL du domaine <span className="font-semibold">{CUSTOM_DOMAIN}</span>{' '}
                    n'est pas encore valide. Pour protéger vos données, utilisez l'adresse
                    officielle sécurisée ci-contre.
                  </p>
                </>
              )}

              {hasClickedBefore && !redirecting && (
                <label className="mt-1.5 inline-flex cursor-pointer items-center gap-2 text-xs text-red-800">
                  <input
                    type="checkbox"
                    checked={autoRedirect}
                    onChange={(e) => toggleAuto(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-red-400 text-red-600 focus:ring-red-500"
                  />
                  Toujours me rediriger automatiquement vers le site sécurisé
                </label>
              )}
            </div>
          </div>

          <div className="flex flex-shrink-0 items-center gap-2 pl-12 md:pl-0">
            <button
              onClick={goNow}
              className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1"
            >
              <ShieldCheck className="h-4 w-4" />
              Ouvrir le site sécurisé
            </button>
            <a
              href={target}
              onClick={markClicked}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden items-center gap-1 rounded-lg border border-red-300 bg-white px-3 py-2 text-xs font-semibold text-red-800 transition hover:bg-red-50 sm:inline-flex"
            >
              Nouvel onglet <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <button
              onClick={dismiss}
              aria-label="Fermer l'avertissement"
              className="rounded-md p-1.5 text-red-700 transition hover:bg-red-100 hover:text-red-900"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DomainWarningBanner;
