import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export type PlanId = 'free' | 'pro' | 'equipe';

interface PlanContextType {
  plan: PlanId;
  isPro: boolean;
  status: string;
  pastDue: boolean;
  canceled: boolean;
  loading: boolean;
  refreshPlan: () => Promise<void>;
  setPlanLocal: (plan: PlanId) => void;
}

const PlanContext = createContext<PlanContextType | undefined>(undefined);

const cacheKey = (uid: string) => `intervenia.plan.${uid}`;

export const PlanProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [plan, setPlan] = useState<PlanId>('free');
  const [status, setStatus] = useState<string>('free');
  const [loading, setLoading] = useState(true);

  const refreshPlan = useCallback(async () => {
    if (!user) {
      setPlan('free');
      setStatus('free');
      setLoading(false);
      return;
    }
    try {
      const cached = localStorage.getItem(cacheKey(user.id)) as PlanId | null;
      if (cached) setPlan(cached);
    } catch { /* ignore */ }

    try {
      const { data } = await supabase
        .from('user_subscriptions')
        .select('plan, status, stripe_subscription_id')
        .eq('user_id', user.id)
        .maybeSingle();

      let resolvedStatus = data?.status || 'free';
      let dbPlan: PlanId =
        data?.plan === 'pro' || data?.plan === 'equipe' ? (data.plan as PlanId) : 'free';

      // Reconcile against the real subscription status from the payment gateway.
      if (data?.stripe_subscription_id) {
        const { data: live } = await supabase.functions.invoke('manage-subscription', {
          body: { action: 'get', subscriptionId: data.stripe_subscription_id },
        });
        if (live?.found && live.status) {
          resolvedStatus = live.status;
          // Persist the authoritative status back to the DB.
          supabase
            .from('user_subscriptions')
            .update({ status: live.status, updated_at: new Date().toISOString() })
            .eq('user_id', user.id);
        }
      }

      // canceled / unpaid lose access; active / trialing / past_due keep access.
      const active = !['canceled', 'incomplete_expired', 'unpaid'].includes(resolvedStatus);
      const resolved: PlanId = active ? dbPlan : 'free';
      setPlan(resolved);
      setStatus(resolvedStatus);
      localStorage.setItem(cacheKey(user.id), resolved);
    } catch {
      /* keep cached / free */
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    setLoading(true);
    refreshPlan();
  }, [refreshPlan]);

  const setPlanLocal = (p: PlanId) => {
    setPlan(p);
    if (user) {
      try { localStorage.setItem(cacheKey(user.id), p); } catch { /* ignore */ }
    }
  };

  const isPro = plan === 'pro' || plan === 'equipe';
  const pastDue = status === 'past_due';
  const canceled = ['canceled', 'unpaid', 'incomplete_expired'].includes(status);

  return (
    <PlanContext.Provider value={{ plan, isPro, status, pastDue, canceled, loading, refreshPlan, setPlanLocal }}>
      {children}
    </PlanContext.Provider>
  );
};

export const usePlan = () => {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error('usePlan must be used within PlanProvider');
  return ctx;
};
