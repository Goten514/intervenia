import React, { createContext, useContext, useEffect, useState } from 'react';

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

export const PlanProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [plan, setPlan] = useState<PlanId>('free');
  const [status, setStatus] = useState<string>('active');
  const [loading, setLoading] = useState(false);

  const refreshPlan = async () => {
    setLoading(true);
    // En mode backend, toujours gratuit pour l'instant
    setPlan('free');
    setStatus('active');
    setLoading(false);
  };

  useEffect(() => { refreshPlan(); }, []);

  const setPlanLocal = (p: PlanId) => setPlan(p);

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