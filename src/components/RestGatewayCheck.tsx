import React, { useCallback, useEffect, useState } from 'react';

import {
  Database,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ServerCrash,
  Globe,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  probeRestTable,
  probeBackendReachable,
  type RestProbeResult,
} from '@/lib/supabase';

// Tables the production app depends on for its very first paint. If the REST
// gateway can't serve these, the whole site shows 404/CORS errors in the console.
const PROBE_TABLES = ['site_settings', 'user_subscriptions'] as const;

type Verdict =
  | 'idle'
  | 'running'
  | 'ok'
  | 'platform_not_found'
  | 'platform_cors'
  | 'forbidden'
  | 'http_error'
  | 'unreachable';

interface TableProbe {
  table: string;
  result: RestProbeResult | null;
}

const statusLabel = (r: RestProbeResult | null): string => {
  if (!r) return 'En attente…';
  switch (r.kind) {
    case 'ok':
      return `200 OK · exposée (${r.ms} ms)`;
    case 'not_found':
      return `404 Not Found · schéma non exposé (${r.ms} ms)`;
    case 'forbidden':
      return `${r.status} · bloquée par politique/clé (${r.ms} ms)`;
    case 'cors':
      return `Bloquée par CORS / réseau (${r.ms} ms)`;
    case 'http':
      return `HTTP ${r.status} (${r.ms} ms)`;
    default:
      return 'Inconnu';
  }
};

const RowIcon: React.FC<{ result: RestProbeResult | null; running: boolean }> = ({
  result,
  running,
}) => {
  if (running && !result) return <Loader2 className="h-5 w-5 animate-spin text-slate-400" />;
  if (!result) return <span className="inline-block h-3 w-3 rounded-full bg-slate-300" />;
  if (result.kind === 'ok') return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
  return <XCircle className="h-5 w-5 text-rose-500" />;
};

const RestGatewayCheck: React.FC = () => {
  const [probes, setProbes] = useState<TableProbe[]>(
    PROBE_TABLES.map((t) => ({ table: t, result: null }))
  );
  const [verdict, setVerdict] = useState<Verdict>('idle');
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<Date | null>(null);

  const run = useCallback(async () => {
    setRunning(true);
    setVerdict('running');
    setProbes(PROBE_TABLES.map((t) => ({ table: t, result: null })));

    // Run all table probes in parallel, plus a backend-reachability probe so we
    // can distinguish a CORS block (gateway up, origin not allow-listed) from a
    // genuinely unreachable host (offline / TLS / firewall).
    const [results, backendReachable] = await Promise.all([
      Promise.all(PROBE_TABLES.map((t) => probeRestTable(t))),
      probeBackendReachable(6000),
    ]);

    const next: TableProbe[] = PROBE_TABLES.map((t, i) => ({ table: t, result: results[i] }));
    setProbes(next);

    // Derive a single, honest verdict from the worst observed outcome.
    const kinds = results.map((r) => r.kind);
    let v: Verdict;
    if (kinds.every((k) => k === 'ok')) {
      v = 'ok';
    } else if (kinds.some((k) => k === 'cors')) {
      // The gateway host responded to the no-cors backend probe, but the real
      // REST GET was blocked by the browser => the origin is not in the CORS
      // allow-list. If the host is also unreachable, it's a connectivity issue.
      v = backendReachable ? 'platform_cors' : 'unreachable';
    } else if (kinds.some((k) => k === 'not_found')) {
      v = 'platform_not_found';
    } else if (kinds.some((k) => k === 'forbidden')) {
      v = 'forbidden';
    } else {
      v = 'http_error';
    }
    setVerdict(v);
    setLastRun(new Date());
    setRunning(false);
  }, []);

  // Run once automatically so an admin opening the status page sees the live
  // gateway verdict without an extra click.
  useEffect(() => {
    run();
  }, [run]);


  const banner = (() => {
    switch (verdict) {
      case 'ok':
        return {
          tone: 'emerald',
          icon: CheckCircle2,
          title: 'Passerelle REST de production opérationnelle',
          body:
            'Les tables site_settings et user_subscriptions répondent 200 OK et l’en-tête CORS est correct pour cette origine. Aucun problème côté plateforme : si l’app affiche une erreur, elle est applicative.',
        };
      case 'platform_not_found':
        return {
          tone: 'rose',
          icon: ServerCrash,
          title: 'Problème PLATEFORME — schéma non exposé (404)',
          body:
            'La passerelle REST renvoie 404 pour des tables qui existent bel et bien dans la base. Le cache PostgREST de production est obsolète ou le mauvais schéma est exposé. Correctif côté déploiement : recharger le schéma (NOTIFY pgrst, \'reload schema\') ou exposer le bon schéma. Ce n’est PAS un bug applicatif et aucune migration SQL ne le corrige.',
        };
      case 'platform_cors':
        return {
          tone: 'rose',
          icon: Globe,
          title: 'Problème PLATEFORME — origine bloquée par CORS',
          body:
            'Le serveur est joignable mais la requête /rest/v1 est bloquée par le navigateur : l’en-tête Access-Control-Allow-Origin manque pour cette origine. Correctif côté déploiement : ajouter https://intervenia.ca et https://www.intervenia.ca à la liste des origines autorisées de la passerelle. Ce n’est PAS un bug applicatif.',
        };
      case 'forbidden':
        return {
          tone: 'amber',
          icon: ShieldAlert,
          title: 'Accès refusé (401/403)',
          body:
            'La passerelle répond mais refuse la requête (clé anon ou politique RLS). La table est exposée, mais l’accès est bloqué par la politique de sécurité — à vérifier côté configuration.',
        };
      case 'unreachable':
        return {
          tone: 'rose',
          icon: ServerCrash,
          title: 'Hôte de la base injoignable',
          body:
            'Impossible d’atteindre databasepad.com depuis ce navigateur (hors-ligne, pare-feu, extension ou TLS). Vérifiez votre connexion, puis relancez le test.',
        };
      case 'http_error':
        return {
          tone: 'rose',
          icon: XCircle,
          title: 'Erreur HTTP inattendue',
          body:
            'La passerelle a renvoyé un code d’erreur inhabituel (voir le détail par table ci-dessous). Probablement un incident temporaire côté serveur — relancez dans un instant.',
        };
      default:
        return null;
    }
  })();

  const toneClasses: Record<string, string> = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    rose: 'border-rose-200 bg-rose-50 text-rose-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
  };
  const toneIcon: Record<string, string> = {
    emerald: 'text-emerald-600',
    rose: 'text-rose-600',
    amber: 'text-amber-600',
  };

  return (
    <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-sky-100 to-cyan-100">
            <Database className="h-5 w-5 text-sky-600" />
          </div>
          <div>
            <p className="font-semibold text-slate-900">Passerelle base de données (REST)</p>
            <p className="text-xs text-slate-500">
              Teste un vrai SELECT léger sur site_settings et user_subscriptions et distingue
              200 / 404 (schéma non exposé) / CORS.
            </p>
          </div>
        </div>
        <Button
          onClick={run}
          disabled={running}
          variant="outline"
          size="sm"
          className="flex-shrink-0"
        >
          {running ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Test…
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" /> {lastRun ? 'Relancer' : 'Tester la base'}
            </>
          )}
        </Button>
      </div>

      {banner && (
        <div className={`mt-4 flex items-start gap-3 rounded-xl border p-4 ${toneClasses[banner.tone]}`}>
          <banner.icon className={`mt-0.5 h-5 w-5 flex-shrink-0 ${toneIcon[banner.tone]}`} />
          <div className="text-sm">
            <p className="font-semibold">{banner.title}</p>
            <p className="mt-1 text-[13px] leading-relaxed opacity-90">{banner.body}</p>
          </div>
        </div>
      )}

      <div className="mt-4 space-y-2">
        {probes.map((p) => {
          const ok = p.result?.kind === 'ok';
          return (
            <div
              key={p.table}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="font-mono text-xs font-semibold text-slate-700">
                  GET /rest/v1/{p.table}
                </p>
                <p
                  className={`mt-0.5 text-xs ${
                    !p.result ? 'text-slate-400' : ok ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {statusLabel(p.result)}
                </p>
              </div>
              <RowIcon result={p.result} running={running} />
            </div>
          );
        })}
      </div>

      {lastRun && (
        <p className="mt-3 text-[11px] text-slate-400">
          Dernier test base : {lastRun.toLocaleString('fr-CA')} · requêtes envoyées vers
          ajvnzolrahpqohsbeyse.databasepad.com/rest/v1
        </p>
      )}
    </div>
  );
};

export default RestGatewayCheck;
