import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  ServerCog,
  RefreshCw,
  PlayCircle,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  WifiOff,
  Clock,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface GatewayLog {
  id: string;
  type: string;
  recipient: string;
  subject: string | null;
  status: string;
  error: string | null;
  created_at: string;
}

// Shape returned by the rest-gateway-monitor edge function.
interface MonitorResult {
  success: boolean;
  healthy?: boolean;
  alerted?: boolean;
  throttled?: boolean;
  reason?: 'not_found' | 'unreachable' | string;
  ms?: number;
  error?: string;
}

// A recovery / all-clear row is logged with this subject prefix by the monitor.
const RECOVERY_PREFIX = 'Rétablissement passerelle REST';
function isRecovery(subject: string | null): boolean {
  return (subject || '').startsWith(RECOVERY_PREFIX);
}

// Pull a human-readable verdict out of the alert subject, e.g.
// "Alerte passerelle REST (not_found)" -> not_found.
function verdictFromSubject(subject: string | null): { label: string; reason: string } {
  if (isRecovery(subject))
    return { label: 'Rétablissement confirmé — la passerelle répond de nouveau', reason: '' };
  const m = (subject || '').match(/\(([^)]+)\)\s*$/);
  const reason = m ? m[1] : '';
  if (reason === 'not_found')
    return { label: 'Schéma non exposé (404 / cache PostgREST obsolète)', reason };
  if (reason === 'unreachable')
    return { label: 'Passerelle injoignable (réseau / timeout)', reason };
  return { label: subject || 'Alerte passerelle', reason };
}

const AdminGatewayLogs: React.FC = () => {
  const [logs, setLogs] = useState<GatewayLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<MonitorResult | null>(null);
  const [resultError, setResultError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('email_logs')
      .select('*')
      .eq('type', 'gateway')
      .order('created_at', { ascending: false })
      .limit(100);
    setLogs((data as GatewayLog[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const runTest = async () => {
    setTesting(true);
    setResult(null);
    setResultError(null);
    try {
      const { data, error } = await supabase.functions.invoke('rest-gateway-monitor', { body: {} });
      if (error) throw new Error(error.message);
      const res = data as MonitorResult;
      setResult(res);
      if (res.healthy && (res as any).recovered) {
        toast.success("Passerelle rétablie — courriel de rétablissement envoyé à l'équipe");
      } else if (res.healthy) {
        toast.success(`Passerelle REST opérationnelle (${res.ms ?? '?'} ms)`);
      } else if (res.success) {
        toast.warning(
          res.throttled
            ? `Panne détectée (${res.reason}) — alerte déjà envoyée récemment`
            : `Panne détectée (${res.reason}) — alerte envoyée par courriel`
        );
      } else {
        toast.error(res.error || 'Échec du test');
      }
      // Refresh history so any newly logged alert appears.
      await load();
    } catch (err: any) {
      const msg = err?.message || 'erreur';
      setResultError(msg);
      toast.error(`Impossible de lancer le test : ${msg}`);
    } finally {
      setTesting(false);
    }
  };

  const recoveries = logs.filter((l) => isRecovery(l.subject)).length;
  const alerts = logs.filter((l) => !isRecovery(l.subject)).length;
  const failed = logs.filter((l) => l.status !== 'success').length;

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <ServerCog className="h-5 w-5 text-indigo-600" /> Passerelle REST
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Historique des alertes de surveillance de la passerelle REST de production. Une
            vérification automatique tourne toutes les 5 minutes ; lancez-en une manuellement pour
            connaître l'état en direct.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={runTest} disabled={testing} className="gradient-brand">
            <PlayCircle className={`mr-2 h-4 w-4 ${testing ? 'animate-pulse' : ''}`} />
            {testing ? 'Test en cours…' : 'Tester maintenant'}
          </Button>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Actualiser
          </Button>
        </div>
      </div>

      {/* Live test result */}
      {(result || resultError) && (
        <div
          className={`mt-5 rounded-xl border p-4 ${
            resultError
              ? 'border-red-200 bg-red-50'
              : result?.healthy
                ? 'border-emerald-200 bg-emerald-50'
                : 'border-amber-200 bg-amber-50'
          }`}
        >
          {resultError ? (
            <div className="flex items-start gap-2 text-sm text-red-700">
              <WifiOff className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">Le test n'a pas pu s'exécuter</p>
                <p className="mt-0.5 text-xs">{resultError}</p>
              </div>
            </div>
          ) : result?.healthy ? (
            <div className="flex items-start gap-2 text-sm text-emerald-800">
              {(result as any)?.recovered ? (
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              )}
              <div>
                <p className="font-semibold">
                  {(result as any)?.recovered
                    ? 'Passerelle REST rétablie'
                    : 'Passerelle REST opérationnelle'}
                </p>
                <p className="mt-0.5 text-xs text-emerald-700">
                  {(result as any)?.recovered
                    ? `Fin d'incident — un courriel de rétablissement vient d'être envoyé à l'équipe (${result.ms ?? '?'} ms).`
                    : `Réponse en ${result.ms ?? '?'} ms · aucune action requise.`}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2 text-sm text-amber-800">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <p className="font-semibold">
                  Panne détectée — {result?.reason === 'not_found'
                    ? 'schéma non exposé (404 / cache PostgREST)'
                    : 'passerelle injoignable (réseau)'}
                </p>
                <p className="mt-0.5 text-xs text-amber-700">
                  {result?.throttled
                    ? 'Une alerte a déjà été envoyée récemment (anti-spam de 30 min).'
                    : result?.alerted
                      ? 'Une alerte courriel vient d’être envoyée à l’équipe.'
                      : 'Problème de plateforme (déploiement de la passerelle), pas du code applicatif.'}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Summary */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-2xl font-bold text-amber-700">{alerts}</p>
          <p className="text-xs text-amber-600">Alertes de panne</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-2xl font-bold text-emerald-700">{recoveries}</p>
          <p className="text-xs text-emerald-600">Rétablissements</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-2xl font-bold text-red-700">{failed}</p>
          <p className="text-xs text-red-600">Échecs d'envoi</p>
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-400">
        Diagnostic en direct détaillé sur la page{' '}
        <a
          href="/status"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-indigo-600 hover:underline"
        >
          /status <ExternalLink className="h-3 w-3" />
        </a>
      </p>

      {/* History list */}
      <div className="mt-6 space-y-3">
        {logs.length === 0 && !loading && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
            <p className="mt-2 font-medium text-emerald-800">Aucune alerte enregistrée</p>
            <p className="mt-1 text-sm text-emerald-600">
              La passerelle REST n'a déclenché aucune alerte — tout va bien.
            </p>
          </div>
        )}
        {logs.map((l) => {
          const ok = l.status === 'success';
          const rec = isRecovery(l.subject);
          const verdict = verdictFromSubject(l.subject);
          const borderClass = !ok
            ? 'border-red-200'
            : rec
              ? 'border-emerald-200'
              : 'border-amber-200';
          return (
            <div key={l.id} className={`rounded-xl border bg-white p-4 ${borderClass}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {!ok ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                      <AlertTriangle className="h-3 w-3" /> Envoi échoué
                    </span>
                  ) : rec ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                      <ShieldCheck className="h-3 w-3" /> Rétablissement (tout est rentré dans l'ordre)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                      <ShieldAlert className="h-3 w-3" /> Alerte envoyée
                    </span>
                  )}
                  {verdict.reason && (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                        verdict.reason === 'not_found'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {verdict.reason === 'not_found' ? (
                        <ServerCog className="h-3 w-3" />
                      ) : (
                        <WifiOff className="h-3 w-3" />
                      )}
                      {verdict.reason}
                    </span>
                  )}
                  <span className="text-sm font-medium text-slate-800">{l.recipient}</span>
                </div>
                <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                  <Clock className="h-3 w-3" />
                  {new Date(l.created_at).toLocaleString('fr-CA')}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-700">
                <span className="font-medium text-slate-900">Verdict :</span> {verdict.label}
              </p>
              {!ok && l.error && (
                <p className="mt-2 rounded-lg bg-red-50 p-2 font-mono text-xs text-red-700">
                  {l.error}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AdminGatewayLogs;
