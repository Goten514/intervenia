import React, { useEffect, useState } from 'react';
import { CreditCard, Check, Loader2, ShieldCheck, ArrowUpRight, XCircle, FlaskConical, CheckCircle2, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { usePlan, PlanId } from '@/contexts/PlanContext';
import { toast } from 'sonner';
import SubscribeModal from './SubscribeModal';

interface BillingPageProps {
  onUpgrade?: () => void;
}

type StepState = 'pending' | 'active' | 'done' | 'error';
interface DemoStep {
  label: string;
  state: StepState;
  detail?: string;
}

interface SubInfo {
  found: boolean;
  status?: string;
  current_period_end?: number;
  cancel_at_period_end?: boolean;
  amount?: number;
  currency?: string;
  interval?: string;
}

const PLAN_LABELS: Record<PlanId, string> = {
  free: 'Gratuit',
  pro: 'Pro',
  equipe: 'Équipe',
};

const BillingPage: React.FC<BillingPageProps> = ({ onUpgrade }) => {
  const { user } = useAuth();
  const { plan, refreshPlan, setPlanLocal } = usePlan();
  const [subRow, setSubRow] = useState<any>(null);
  const [info, setInfo] = useState<SubInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // --- Demo Pro flow ---
  const [demoOpen, setDemoOpen] = useState(false);
  const [demoRunning, setDemoRunning] = useState(false);
  const [demoSteps, setDemoSteps] = useState<DemoStep[]>([]);
  const [showDemoModal, setShowDemoModal] = useState(false);

  const initialSteps: DemoStep[] = [
    { label: 'Création de la session de paiement (FamousPay)', state: 'pending' },
    { label: 'Redirection vers le formulaire de carte sécurisé', state: 'pending' },
    { label: 'Retour de confirmation & activation du plan Pro', state: 'pending' },
  ];

  const setStep = (idx: number, state: StepState, detail?: string) => {
    setDemoSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, state, detail } : s)));
  };

  const runDemoFlow = async () => {
    if (!user?.email) {
      toast.error('Connectez-vous pour tester le flux Pro.');
      return;
    }
    setDemoOpen(true);
    setDemoRunning(true);
    setDemoSteps(initialSteps.map((s) => ({ ...s })));

    // Step 1 — create payment session (real backend call)
    setStep(0, 'active');
    try {
      const { data, error } = await supabase.functions.invoke('create-subscription', {
        body: { action: 'create-setup-intent', email: user.email, name: user?.user_metadata?.full_name, plan: 'pro' },
      });
      if (error || data?.error || !data?.clientSecret) {
        throw new Error(data?.error || error?.message || 'Aucune session retournée');
      }
      setStep(0, 'done', 'Session créée — backend FamousPay opérationnel.');
    } catch (e: any) {
      setStep(0, 'error', e?.message || 'Échec de la création de session');
      setDemoRunning(false);
      return;
    }

    // Step 2 — open secure card form (modal acts as the redirect target)
    setStep(1, 'active', 'Ouverture du formulaire de paiement sécurisé…');
    await new Promise((r) => setTimeout(r, 600));
    setShowDemoModal(true);
    setStep(1, 'done', 'Formulaire de carte affiché. Saisissez une carte pour finaliser.');

    // Step 3 — awaits real confirmation from the modal (onDone)
    setStep(2, 'active', 'En attente de la confirmation du paiement…');
    setDemoRunning(false);
  };

  const onDemoConfirmed = async () => {
    setShowDemoModal(false);
    setStep(2, 'done', 'Paiement confirmé — plan Pro activé avec succès.');
    await load();
    await refreshPlan();
    toast.success('Flux Pro validé de bout en bout.');
  };

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    setSubRow(data);
    if (data?.stripe_subscription_id) {
      const { data: res } = await supabase.functions.invoke('manage-subscription', {
        body: { action: 'get', subscriptionId: data.stripe_subscription_id },
      });
      if (res) setInfo(res);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  // When the demo's payment modal succeeds, the plan becomes 'pro' — finalize step 3.
  useEffect(() => {
    if (demoOpen && plan === 'pro' && demoSteps[2]?.state === 'active') {
      onDemoConfirmed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, demoOpen, demoSteps]);

  const handleCancel = async () => {
    if (!subRow?.stripe_subscription_id) return;
    if (!confirm('Annuler votre abonnement à la fin de la période en cours ?')) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-subscription', {
        body: { action: 'cancel', subscriptionId: subRow.stripe_subscription_id, immediately: false },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      await supabase.from('user_subscriptions')
        .update({ status: 'canceling', updated_at: new Date().toISOString() })
        .eq('user_id', user!.id);
      toast.success('Abonnement annulé — actif jusqu\'à la fin de la période.');
      await load();
      await refreshPlan();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleChange = async (newPlan: PlanId) => {
    if (!subRow?.stripe_subscription_id) {
      onUpgrade?.();
      return;
    }
    if (newPlan === plan) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-subscription', {
        body: { action: 'change-plan', subscriptionId: subRow.stripe_subscription_id, plan: newPlan },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      await supabase.from('user_subscriptions')
        .update({ plan: newPlan, status: 'active', updated_at: new Date().toISOString() })
        .eq('user_id', user!.id);
      setPlanLocal(newPlan);
      toast.success(`Plan changé pour ${PLAN_LABELS[newPlan]}.`);
      await load();
      await refreshPlan();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const renewal = info?.current_period_end
    ? new Date(info.current_period_end * 1000).toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  const isPaid = plan === 'pro' || plan === 'equipe';

  return (
    <section className="bg-gradient-to-b from-slate-50 to-white py-20 sm:py-24">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600">Compte</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Facturation &amp; abonnement
        </h2>
        <p className="mt-2 text-slate-600">Gérez votre plan, votre renouvellement et votre carte.</p>

        {loading ? (
          <div className="mt-10 flex items-center gap-2 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Chargement...
          </div>
        ) : (
          <div className="mt-8 grid gap-6">
            {/* Current plan */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-100 to-violet-100">
                    <CreditCard className="h-6 w-6 text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Plan actuel</p>
                    <p className="text-xl font-bold text-slate-900">Plan {PLAN_LABELS[plan]}</p>
                  </div>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  info?.cancel_at_period_end || subRow?.status === 'canceling'
                    ? 'bg-amber-100 text-amber-800'
                    : isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                }`}>
                  {info?.cancel_at_period_end || subRow?.status === 'canceling'
                    ? 'Annulation programmée'
                    : isPaid ? 'Actif' : 'Gratuit'}
                </span>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-3 text-sm">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-slate-500">Montant</p>
                  <p className="mt-1 font-semibold text-slate-900">
                    {info?.amount ? `${(info.amount / 100).toFixed(2)} ${(info.currency || 'cad').toUpperCase()}/${info.interval === 'year' ? 'an' : 'mois'}` : 'Gratuit'}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-slate-500">{info?.cancel_at_period_end ? 'Se termine le' : 'Prochain renouvellement'}</p>
                  <p className="mt-1 font-semibold text-slate-900">{renewal || '—'}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-slate-500">Statut</p>
                  <p className="mt-1 font-semibold capitalize text-slate-900">{info?.status || subRow?.status || 'free'}</p>
                </div>
              </div>

              {isPaid && !info?.cancel_at_period_end && subRow?.status !== 'canceling' && (
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  disabled={busy}
                  className="mt-6 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  <XCircle className="mr-2 h-4 w-4" /> Annuler l'abonnement
                </Button>
              )}
            </div>

            {/* Change plan */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Changer de plan</h3>
              <p className="mt-1 text-sm text-slate-500">Modifiez votre abonnement à tout moment.</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                {(['free', 'pro', 'equipe'] as PlanId[]).map((p) => {
                  const prices: Record<PlanId, string> = { free: '0 $', pro: '39 $/mois', equipe: '99 $/mois' };
                  const current = p === plan;
                  return (
                    <div key={p} className={`rounded-xl border p-4 ${current ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200'}`}>
                      <p className="font-semibold text-slate-900">{PLAN_LABELS[p]}</p>
                      <p className="text-sm text-slate-500">{prices[p]}</p>
                      {current ? (
                        <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600">
                          <Check className="h-3.5 w-3.5" /> Plan actuel
                        </span>
                      ) : p === 'free' ? (
                        subRow?.stripe_subscription_id ? (
                          <Button variant="outline" size="sm" onClick={handleCancel} disabled={busy} className="mt-3 w-full">
                            Rétrograder
                          </Button>
                        ) : (
                          <span className="mt-3 block text-xs text-slate-400">Plan de base</span>
                        )
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleChange(p)}
                          disabled={busy}
                          className="mt-3 w-full bg-gradient-to-r from-indigo-600 to-violet-600"
                        >
                          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                            <>{subRow?.stripe_subscription_id ? 'Changer' : 'Souscrire'} <ArrowUpRight className="ml-1 h-3.5 w-3.5" /></>
                          )}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Demo Pro flow */}
            <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/60 to-violet-50/30 p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white">
                    <FlaskConical className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Tester le flux Pro (mode démo)</h3>
                    <p className="text-sm text-slate-500">
                      Valide le paiement Pro de bout en bout sur l'URL de prévisualisation.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={runDemoFlow}
                  disabled={demoRunning}
                  className="bg-gradient-to-r from-indigo-600 to-violet-600"
                >
                  {demoRunning ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Lancement…</>
                  ) : (
                    <><FlaskConical className="mr-2 h-4 w-4" /> Lancer le test Pro</>
                  )}
                </Button>
              </div>

              {demoOpen && (
                <div className="mt-5 space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                  {demoSteps.map((s, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <span className="mt-0.5">
                        {s.state === 'done' ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                        ) : s.state === 'error' ? (
                          <XCircle className="h-5 w-5 text-rose-500" />
                        ) : s.state === 'active' ? (
                          <Loader2 className="h-5 w-5 animate-spin text-indigo-500" />
                        ) : (
                          <Circle className="h-5 w-5 text-slate-300" />
                        )}
                      </span>
                      <div>
                        <p className={`text-sm font-medium ${
                          s.state === 'done' ? 'text-emerald-700'
                          : s.state === 'error' ? 'text-rose-700'
                          : s.state === 'active' ? 'text-indigo-700'
                          : 'text-slate-500'
                        }`}>
                          Étape {i + 1} : {s.label}
                        </p>
                        {s.detail && <p className="text-xs text-slate-500">{s.detail}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400">
              <ShieldCheck className="h-4 w-4" /> Paiements sécurisés. Vos données cliniques restent privées.
            </div>
          </div>
        )}
      </div>

      <SubscribeModal
        open={showDemoModal}
        onOpenChange={(o) => {
          setShowDemoModal(o);
          // If the user closed the card form without completing, mark step 3 as halted.
          if (!o && demoSteps[2]?.state === 'active' && plan !== 'pro') {
            setStep(2, 'error', 'Formulaire fermé avant confirmation du paiement.');
          }
        }}
        plan="pro"
      />
    </section>
  );
};

export default BillingPage;
