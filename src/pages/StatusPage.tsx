import React, { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  ArrowLeft,
  Brain,
  CreditCard,
  LifeBuoy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import StatusHistory, { StatusCheckRow } from '@/components/StatusHistory';
import SslIndicator from '@/components/SslIndicator';
import RestGatewayCheck from '@/components/RestGatewayCheck';



type Health = 'unknown' | 'checking' | 'ok' | 'down';

interface CheckResult {
  status: Health;
  detail?: string;
  ms?: number;
}

const StatusDot: React.FC<{ status: Health }> = ({ status }) => {
  if (status === 'checking') {
    return <Loader2 className="h-5 w-5 animate-spin text-slate-400" />;
  }
  if (status === 'ok') {
    return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
  }
  if (status === 'down') {
    return <XCircle className="h-5 w-5 text-rose-500" />;
  }
  return <span className="inline-block h-3 w-3 rounded-full bg-slate-300" />;
};

const StatusPage: React.FC = () => {
  const [backend, setBackend] = useState<CheckResult>({ status: 'unknown' });
  const [ai, setAi] = useState<CheckResult>({ status: 'unknown' });
  const [pay, setPay] = useState<CheckResult>({ status: 'unknown' });
  const [lastRun, setLastRun] = useState<Date | null>(null);
  const [running, setRunning] = useState(false);
  const [history, setHistory] = useState<StatusCheckRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('status_checks')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      setHistory((data as StatusCheckRow[]) || []);
    } catch {
      /* ignore */
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);


  // A single health-check probe tells us THREE things, so we set both the
  // "Backend" row and the "Moteur IA" row from one call:
  //   (1) backend reachable      -> the function answered at all
  //   (2) AI gateway responding  -> data.gateway === 'ok'
  //   (3) AI gateway NOT responding (timeout/error) -> honest "indisponible"
  const pingHealth = useCallback(async (): Promise<{ backend: CheckResult; ai: CheckResult }> => {
    const t0 = performance.now();
    try {
      const { data, error } = await supabase.functions.invoke('health-check', { body: {} });
      const ms = Math.round(performance.now() - t0);
      if (error || !data) {
        return {
          backend: { status: 'down', detail: error?.message || 'Backend injoignable', ms },
          ai: { status: 'down', detail: 'Indéterminé (backend injoignable)', ms },
        };
      }
      // The function answered => backend is up.
      const backendRes: CheckResult = { status: 'ok', detail: 'Backend joignable', ms };
      const gw = data.gateway as string | undefined;
      const gwMs = typeof data.gatewayLatencyMs === 'number' ? data.gatewayLatencyMs : ms;
      let aiRes: CheckResult;
      if (gw === 'ok') {
        aiRes = { status: 'ok', detail: 'Moteur IA répond', ms: gwMs };
      } else if (gw === 'timeout') {
        aiRes = { status: 'down', detail: 'Moteur IA ne répond pas (délai 8s dépassé)', ms: gwMs };
      } else if (gw === 'no_key') {
        aiRes = { status: 'down', detail: 'Clé du moteur IA non configurée', ms: gwMs };
      } else {
        aiRes = { status: 'down', detail: data.detail || 'Moteur IA en erreur', ms: gwMs };
      }
      return { backend: backendRes, ai: aiRes };
    } catch (e: any) {
      const ms = Math.round(performance.now() - t0);
      return {
        backend: { status: 'down', detail: e?.message || 'Erreur réseau', ms },
        ai: { status: 'down', detail: 'Indéterminé (backend injoignable)', ms },
      };
    }
  }, []);

  const pingPay = useCallback(async (): Promise<CheckResult> => {
    const t0 = performance.now();
    try {
      const { data, error } = await supabase.functions.invoke('manage-subscription', {
        body: { action: 'get', subscriptionId: 'healthcheck' },
      });
      const ms = Math.round(performance.now() - t0);
      // The function should respond (typically { found: false }) even for an
      // unknown subscription id — that proves FamousPay backend is alive.
      if (error) return { status: 'down', detail: error.message, ms };
      if (data !== null && data !== undefined) return { status: 'ok', detail: 'Paiement FamousPay joignable', ms };
      return { status: 'down', detail: 'Réponse vide', ms };
    } catch (e: any) {
      return { status: 'down', detail: e?.message || 'Erreur réseau', ms: Math.round(performance.now() - t0) };
    }
  }, []);


  const runChecks = useCallback(async () => {
    setRunning(true);
    setBackend({ status: 'checking' });
    setAi({ status: 'checking' });
    setPay({ status: 'checking' });
    const [healthRes, payRes] = await Promise.all([pingHealth(), pingPay()]);
    setBackend(healthRes.backend);
    setAi(healthRes.ai);
    setPay(payRes);
    setLastRun(new Date());
    setRunning(false);

    // Persist this run to the status_checks history table.
    try {
      await supabase.from('status_checks').insert({
        ai_status: healthRes.ai.status,
        pay_status: payRes.status,
        ai_ms: healthRes.ai.ms ?? null,
        pay_ms: payRes.ms ?? null,
      });
    } catch {
      /* non-blocking */
    }
    loadHistory();
  }, [pingHealth, pingPay, loadHistory]);


  // "Tout est vert" only when the backend is reachable AND the AI gateway answers.
  const allOk = backend.status === 'ok' && ai.status === 'ok' && pay.status === 'ok';
  const anyDown = backend.status === 'down' || ai.status === 'down' || pay.status === 'down';
  // The honest headline distinction: backend up but engine asleep.
  const gatewayOnlyDown = backend.status === 'ok' && ai.status === 'down';

  const services = [
    {
      key: 'backend',
      icon: Activity,
      name: 'Backend (serveur)',
      desc: 'Connexion aux fonctions serveur — indépendante du moteur IA',
      result: backend,
    },
    {
      key: 'ai',
      icon: Brain,
      name: "Moteur d'intelligence artificielle",
      desc: 'Passerelle IA qui génère les interventions et outils',
      result: ai,
    },
    {
      key: 'pay',
      icon: CreditCard,
      name: 'Paiement FamousPay',
      desc: 'Abonnements et facturation',
      result: pay,
    },
  ];


  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:py-16">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" /> Retour à l'application
        </Link>

        <div className="mt-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-100 to-violet-100">
            <Activity className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              État des services
            </h1>
            <p className="text-sm text-slate-500">
              Vérifiez que le backend fonctionne, indépendamment du domaine.
            </p>
          </div>
        </div>

        {/* Overall banner */}
        <div
          className={`mt-8 flex items-center justify-between gap-4 rounded-2xl border p-5 ${
            lastRun === null
              ? 'border-slate-200 bg-white'
              : allOk
              ? 'border-emerald-200 bg-emerald-50'
              : anyDown
              ? 'border-rose-200 bg-rose-50'
              : 'border-slate-200 bg-white'
          }`}
        >
          <div className="flex items-center gap-3">
            {lastRun === null ? (
              <span className="inline-block h-3 w-3 rounded-full bg-slate-300" />
            ) : allOk ? (
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            ) : (
              <XCircle className="h-6 w-6 text-rose-500" />
            )}
            <div>
              <p className="font-semibold text-slate-900">
                {lastRun === null
                  ? 'Aucun test exécuté'
                  : allOk
                  ? 'Tous les systèmes sont opérationnels'
                  : anyDown
                  ? 'Un ou plusieurs services rencontrent un problème'
                  : 'Vérification en cours…'}
              </p>
              <p className="text-xs text-slate-500">
                {lastRun
                  ? `Dernier test : ${lastRun.toLocaleString('fr-CA')}`
                  : 'Lancez un test pour vérifier le backend.'}
              </p>
            </div>
          </div>
          <Button onClick={runChecks} disabled={running} className="bg-gradient-to-r from-indigo-600 to-violet-600">
            {running ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Test…
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" /> {lastRun ? 'Relancer' : 'Tester maintenant'}
              </>
            )}
          </Button>
        </div>

        {/* Honest three-state explanation: backend up but AI engine asleep. */}
        {gatewayOnlyDown && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-4">
            <Brain className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-600" />
            <div className="text-sm text-orange-900">
              <p className="font-semibold">Le moteur IA est momentanément indisponible — réessayez plus tard.</p>
              <p className="mt-1 text-[13px] leading-relaxed text-orange-800">
                Bonne nouvelle&nbsp;: votre application et son serveur fonctionnent normalement. C'est
                la passerelle IA externe qui ne répond pas pour l'instant (délai dépassé). Vous pouvez
                lancer une génération&nbsp;: si le moteur reste indisponible, votre dossier est mis en
                file d'attente et l'outil vous sera <strong>envoyé par courriel</strong> dès qu'il sera
                prêt — aucune relance manuelle nécessaire.
              </p>
            </div>
          </div>
        )}

        {/* Service rows */}
        <div className="mt-6 space-y-3">
          {services.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.key}
                className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100">
                    <Icon className="h-5 w-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{s.name}</p>
                    <p className="text-xs text-slate-500">{s.desc}</p>
                    {s.result.detail && (
                      <p
                        className={`mt-0.5 text-xs ${
                          s.result.status === 'ok' ? 'text-emerald-600' : 'text-rose-600'
                        }`}
                      >
                        {s.result.detail}
                        {typeof s.result.ms === 'number' ? ` · ${s.result.ms} ms` : ''}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-semibold ${
                      s.result.status === 'ok'
                        ? 'text-emerald-600'
                        : s.result.status === 'down'
                        ? 'text-rose-600'
                        : 'text-slate-400'
                    }`}
                  >
                    {s.result.status === 'ok'
                      ? 'Opérationnel'
                      : s.result.status === 'down'
                      ? 'Hors service'
                      : s.result.status === 'checking'
                      ? 'Vérification…'
                      : 'Inconnu'}
                  </span>
                  <StatusDot status={s.result.status} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Dedicated production REST-gateway diagnostic: real SELECT on
            site_settings + user_subscriptions, distinguishing 200 / 404 (schema
            not exposed) / CORS-blocked, i.e. PLATFORM vs APPLICATION problems. */}
        <RestGatewayCheck />

        {/* Real-time SSL certificate indicator for the custom domain */}
        <SslIndicator />



        {/* History + uptime */}
        <StatusHistory rows={history} loading={historyLoading} />

        <div className="mt-8 flex flex-col items-center gap-3 text-center">
          <p className="text-xs text-slate-400">
            Cette page interroge directement les fonctions backend. Si les deux indicateurs sont
            verts, le service fonctionne — même si le domaine intervenia.ca affiche une erreur de
            certificat.
          </p>
          <Link
            to="/aide-domaine"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800"
          >
            <LifeBuoy className="h-4 w-4" /> Corriger le certificat du domaine intervenia.ca
          </Link>
        </div>
      </div>
    </div>
  );
};

export default StatusPage;
