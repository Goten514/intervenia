import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

// Three explicit realities, not one blurry "down":
//   ready        -> backend reachable AND the AI gateway answered our live probe
//   warming      -> backend reachable, gateway answered but slowly (cold start)
//   gateway-down -> backend reachable BUT the AI gateway timed out / errored
//   down         -> the backend (edge function) itself was unreachable
export type HealthState = 'checking' | 'ready' | 'warming' | 'gateway-down' | 'down';
export type GatewayState = 'ok' | 'timeout' | 'error' | 'no_key' | 'unknown';

interface ServiceHealthValue {
  state: HealthState;
  /** Raw gateway sub-status from the health-check probe. */
  gateway: GatewayState;
  /** Whether the backend edge function itself is reachable. */
  backendReachable: boolean;
  /** Honest, user-facing French message from the backend probe. */
  message: string;
  latency: number | null;
  /** Manually trigger a fresh health ping. */
  ping: () => Promise<void>;
}

const ServiceHealthContext = createContext<ServiceHealthValue | undefined>(undefined);

/**
 * Centralized live service-health for the generation backend. A single provider
 * pings the `health-check` edge function (which itself performs a real, 8s-bounded
 * call to the AI gateway) on mount + on an interval, so BOTH the small status
 * pill AND the generator read the same three-state source of truth.
 */
export const ServiceHealthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<HealthState>('checking');
  const [gateway, setGateway] = useState<GatewayState>('unknown');
  const [backendReachable, setBackendReachable] = useState(false);
  const [message, setMessage] = useState('Vérification de l\'état du service…');
  const [latency, setLatency] = useState<number | null>(null);
  const inflight = useRef(false);

  const ping = useCallback(async () => {
    if (inflight.current) return;
    inflight.current = true;
    setState((prev) => (prev === 'ready' ? prev : 'checking'));
    const t0 = Date.now();
    try {
      const { data, error } = await supabase.functions.invoke('health-check', { body: {} });
      const elapsed = Date.now() - t0;
      setLatency(elapsed);
      if (error || !data) {
        // The edge function itself could not be reached -> backend down.
        setBackendReachable(false);
        setGateway('unknown');
        setState('down');
        setMessage('Le backend est injoignable depuis votre appareil — vérifiez votre connexion.');
      } else {
        // The function answered => the backend is definitely reachable.
        setBackendReachable(true);
        const gw: GatewayState = data.gateway || 'unknown';
        setGateway(gw);
        setMessage(data.message || '');
        if (gw === 'ok' && data.ready) {
          // A slow gateway answer usually means a cold start finishing.
          const gwMs = typeof data.gatewayLatencyMs === 'number' ? data.gatewayLatencyMs : elapsed;
          setState(gwMs > 4000 ? 'warming' : 'ready');
        } else if (gw === 'timeout') {
          setState('gateway-down');
        } else {
          // error / no_key — the gateway is not usable right now.
          setState('gateway-down');
        }
      }
    } catch {
      setBackendReachable(false);
      setGateway('unknown');
      setState('down');
      setMessage('Le backend est injoignable depuis votre appareil — vérifiez votre connexion.');
    } finally {
      inflight.current = false;
    }
  }, []);

  useEffect(() => {
    ping();
    const id = setInterval(ping, 60000);
    return () => clearInterval(id);
  }, [ping]);

  return (
    <ServiceHealthContext.Provider value={{ state, gateway, backendReachable, message, latency, ping }}>
      {children}
    </ServiceHealthContext.Provider>
  );
};

export const useServiceHealth = (): ServiceHealthValue => {
  const ctx = useContext(ServiceHealthContext);
  if (!ctx) {
    return {
      state: 'checking',
      gateway: 'unknown',
      backendReachable: false,
      message: '',
      latency: null,
      ping: async () => {},
    };
  }
  return ctx;
};
