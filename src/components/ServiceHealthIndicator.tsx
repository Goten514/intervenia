import React from 'react';
import { Loader2 } from 'lucide-react';
import { useServiceHealth, type HealthState } from '@/contexts/ServiceHealthContext';

/**
 * Small live service-health indicator. Reads the shared ServiceHealthContext
 * (a single provider pings the `health-check` edge function, which itself makes
 * a real 8s-bounded call to the AI gateway). It now distinguishes three honest
 * realities: backend down, AI gateway not responding, and everything ready.
 */
const ServiceHealthIndicator: React.FC = () => {
  const { state, latency, ping, message } = useServiceHealth();

  const config: Record<HealthState, { dot: string; ring: string; label: string; title: string }> = {
    checking: {
      dot: 'bg-slate-400',
      ring: 'bg-slate-400/40',
      label: 'Vérification…',
      title: 'Vérification de l\'état du service de génération',
    },
    ready: {
      dot: 'bg-emerald-500',
      ring: 'bg-emerald-500/40',
      label: 'Moteur IA prêt',
      title: latency != null ? `Moteur IA prêt (${latency} ms)` : 'Moteur IA prêt',
    },
    warming: {
      dot: 'bg-amber-500',
      ring: 'bg-amber-500/40',
      label: 'Préchauffage…',
      title: 'Le moteur IA démarre — la première génération peut être un peu plus lente.',
    },
    'gateway-down': {
      dot: 'bg-orange-500',
      ring: 'bg-orange-500/40',
      label: 'Moteur IA indisponible',
      title: message || 'Le moteur IA est momentanément indisponible — réessayez plus tard.',
    },
    down: {
      dot: 'bg-red-500',
      ring: 'bg-red-500/40',
      label: 'Backend injoignable',
      title: message || 'Le backend est injoignable depuis votre appareil.',
    },
  };

  const c = config[state];

  return (
    <button
      type="button"
      onClick={() => ping()}
      title={`${c.title} — cliquez pour revérifier`}
      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
    >
      {state === 'checking' ? (
        <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
      ) : (
        <span className="relative flex h-2.5 w-2.5">
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${c.ring}`} />
          <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${c.dot}`} />
        </span>
      )}
      <span>{c.label}</span>
    </button>
  );
};

export default ServiceHealthIndicator;
