import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Lock, ShieldAlert, ShieldCheck, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CUSTOM_DOMAIN } from '@/lib/domain-config';
import { supabase } from '@/lib/supabase';
import SslHistory, { SslCheckRow } from '@/components/SslHistory';

type SslState = 'idle' | 'checking' | 'secure' | 'invalid';

/**
 * Real-time SSL indicator for the custom domain.
 *
 * Browsers refuse to complete a `fetch` to a host with an invalid/mismatched
 * TLS certificate — the request rejects with a network error. We exploit that:
 * a successful (even opaque, no-cors) response means the certificate is valid
 * and the host is reachable over HTTPS; a thrown error means the certificate is
 * invalid (or the host is unreachable). A short timeout guards against hangs.
 *
 * Each result is persisted to the `ssl_checks` table so we can show an uptime
 * history (last 24 h / 7 days) of the certificate's validity.
 */
const SslIndicator: React.FC = () => {
  const [state, setState] = useState<SslState>('idle');
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [history, setHistory] = useState<SslCheckRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('ssl_checks')
        .select('*')
        .eq('domain', CUSTOM_DOMAIN)
        .order('created_at', { ascending: false })
        .limit(200);
      setHistory((data as SslCheckRow[]) || []);
    } catch {
      /* ignore */
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const persist = useCallback(
    async (status: 'secure' | 'invalid') => {
      try {
        await supabase.from('ssl_checks').insert({
          status,
          domain: CUSTOM_DOMAIN,
        });
      } catch {
        /* non-blocking */
      }
      loadHistory();
    },
    [loadHistory]
  );

  const check = useCallback(async () => {
    setState('checking');
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    let result: 'secure' | 'invalid' = 'invalid';
    try {
      // Cache-busting query so we hit the network each time.
      await fetch(`https://${CUSTOM_DOMAIN}/robots.txt?ssl=${Date.now()}`, {
        mode: 'no-cors',
        cache: 'no-store',
        signal: controller.signal,
      });
      // If we reached here, the TLS handshake succeeded -> certificate is valid.
      result = 'secure';
    } catch {
      // A TLS/cert failure (or unreachable host) lands here.
      result = 'invalid';
    } finally {
      window.clearTimeout(timeout);
      setState(result);
      setCheckedAt(new Date());
      persist(result);
    }
  }, [persist]);

  useEffect(() => {
    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const secure = state === 'secure';
  const invalid = state === 'invalid';
  const checking = state === 'checking';

  return (
    <div className="mt-6">
      <div
        className={`flex items-center justify-between gap-4 rounded-2xl border p-5 ${
          secure
            ? 'border-emerald-200 bg-emerald-50'
            : invalid
            ? 'border-rose-200 bg-rose-50'
            : 'border-slate-200 bg-white'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-lg ${
              secure ? 'bg-emerald-100' : invalid ? 'bg-rose-100' : 'bg-slate-100'
            }`}
          >
            {checking ? (
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            ) : secure ? (
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
            ) : invalid ? (
              <ShieldAlert className="h-5 w-5 text-rose-600" />
            ) : (
              <Lock className="h-5 w-5 text-slate-500" />
            )}
          </div>
          <div>
            <p className="font-semibold text-slate-900">
              Certificat SSL de {CUSTOM_DOMAIN}
            </p>
            <p className="text-xs text-slate-500">
              {checkedAt
                ? `Dernière vérification : ${checkedAt.toLocaleTimeString('fr-CA')}`
                : 'Vérification du certificat HTTPS du domaine personnalisé.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {checking ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
              Vérification…
            </span>
          ) : secure ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
              <ShieldCheck className="h-3.5 w-3.5" /> Sécurisé
            </span>
          ) : invalid ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
              <ShieldAlert className="h-3.5 w-3.5" /> Certificat invalide
            </span>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={check}
            disabled={checking}
            className="border-slate-300"
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${checking ? 'animate-spin' : ''}`} />
            Revérifier
          </Button>
        </div>
      </div>

      {/* Persisted uptime history (24 h / 7 days) */}
      <SslHistory rows={history} loading={historyLoading} />
    </div>
  );
};

export default SslIndicator;
