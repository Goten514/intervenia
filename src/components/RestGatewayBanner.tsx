import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ServerCrash, ExternalLink, X, RefreshCw } from 'lucide-react';
import { probeRestTable } from '@/lib/supabase';

/**
 * Site-wide, NON-BLOCKING admin banner.
 *
 * On app load it runs a single `probeRestTable('site_settings')`. If the
 * production REST gateway answers 404 (schema not exposed / stale PostgREST
 * cache) or the request is blocked by CORS/network, it shows a dismissible
 * warning ONLY to admins explaining that this is a PLATFORM/deployment issue
 * (the gateway needs a schema reload + CORS allowlist update), with a link to
 * the /status page diagnostic for the full breakdown.
 *
 * Admin detection: the AdminMessages password gate sets `intervenia_admin=1`
 * in localStorage on successful login. Non-admins never see this banner.
 *
 * It is purely informational — it never blocks rendering of the app.
 */

const ADMIN_FLAG = 'intervenia_admin';
const DISMISS_KEY = 'intervenia_rest_banner_dismissed';

type Verdict = 'ok' | 'not_found' | 'cors' | 'checking' | 'other';

const isAdmin = (): boolean => {
  try {
    return localStorage.getItem(ADMIN_FLAG) === '1';
  } catch {
    return false;
  }
};

const RestGatewayBanner: React.FC = () => {
  const [verdict, setVerdict] = useState<Verdict>('checking');
  const [dismissed, setDismissed] = useState(false);
  const [admin] = useState<boolean>(isAdmin);

  const run = async () => {
    if (!admin) return;
    setVerdict('checking');
    try {
      const r = await probeRestTable('site_settings');
      if (r.kind === 'ok' || r.kind === 'forbidden') setVerdict('ok');
      else if (r.kind === 'not_found') setVerdict('not_found');
      else if (r.kind === 'cors') setVerdict('cors');
      else setVerdict('other');
    } catch {
      setVerdict('cors');
    }
  };

  useEffect(() => {
    if (!admin) return;
    try {
      if (localStorage.getItem(DISMISS_KEY) === '1') setDismissed(true);
    } catch {
      /* ignore */
    }
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  // Only surface for admins, on a genuine platform failure, and when not dismissed.
  const failing = verdict === 'not_found' || verdict === 'cors';
  if (!admin || dismissed || !failing) return null;

  const is404 = verdict === 'not_found';

  return (
    <div className="relative z-40 border-b-2 border-amber-300 bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-amber-100">
              <ServerCrash className="h-5 w-5 text-amber-700" />
            </span>
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-900">
                {is404
                  ? 'Passerelle REST de production : schéma non exposé (404)'
                  : 'Passerelle REST de production : requête bloquée (CORS / réseau)'}
              </p>
              <p className="mt-0.5 text-sm text-amber-800">
                {is404 ? (
                  <>
                    Un appel à <span className="font-mono">/rest/v1/site_settings</span> renvoie 404. Il s'agit
                    d'un problème de <span className="font-semibold">plateforme</span>, pas du code applicatif :
                    la passerelle REST de production doit <span className="font-semibold">recharger son cache
                    PostgREST</span> (NOTIFY pgrst « reload schema » / redéploiement) pour exposer le bon schéma.
                  </>
                ) : (
                  <>
                    Un appel à <span className="font-mono">/rest/v1/site_settings</span> est bloqué par le
                    navigateur. C'est un problème de <span className="font-semibold">plateforme</span> :
                    ajoutez <span className="font-mono">https://intervenia.ca</span> et{' '}
                    <span className="font-mono">https://www.intervenia.ca</span> à la liste des origines
                    autorisées (CORS) de la passerelle de base de données.
                  </>
                )}{' '}
                <span className="text-amber-700">Visible uniquement par les administrateurs.</span>
              </p>
            </div>
          </div>

          <div className="flex flex-shrink-0 items-center gap-2 pl-12 md:pl-0">
            <button
              onClick={run}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-800 transition hover:bg-amber-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Relancer
            </button>
            <Link
              to="/status"
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700"
            >
              Diagnostic complet <ExternalLink className="h-3.5 w-3.5" />
            </Link>
            <button
              onClick={dismiss}
              aria-label="Fermer l'avertissement"
              className="rounded-md p-1.5 text-amber-700 transition hover:bg-amber-100 hover:text-amber-900"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RestGatewayBanner;
