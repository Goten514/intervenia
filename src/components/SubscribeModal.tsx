import React, { useEffect, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldCheck, Sparkles, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { usePlan, PlanId } from '@/contexts/PlanContext';
import { toast } from 'sonner';

const STRIPE_ACCOUNT_ID = 'acct_1TcHKUHAFvNqTKxi';
const stripePromise = loadStripe(
  'pk_live_51OJhJBHdGQpsHqInIzu7c6PzGPSH0yImD4xfpofvxvFZs0VFhPRXZCyEgYkkhOtBOXFWvssYASs851mflwQvjnrl00T6DbUwWZ',
  { stripeAccount: STRIPE_ACCOUNT_ID }
);

const PLAN_META: Record<Exclude<PlanId, 'free'>, { name: string; price: string }> = {
  pro: { name: 'Pro', price: '39 $ CAD / mois' },
  equipe: { name: 'Équipe', price: '99 $ CAD / mois' },
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: Exclude<PlanId, 'free'>;
}

const PaymentForm: React.FC<{
  customerId: string;
  plan: Exclude<PlanId, 'free'>;
  email: string;
  onDone: () => void;
}> = ({ customerId, plan, email, onDone }) => {
  const stripe = useStripe();
  const elements = useElements();
  const { user } = useAuth();
  const { setPlanLocal, refreshPlan } = usePlan();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    setError(null);

    const { error: setupError, setupIntent } = await stripe.confirmSetup({
      elements,
      confirmParams: { return_url: window.location.origin },
      redirect: 'if_required',
    });

    if (setupError) {
      setError(setupError.message || 'Paiement refusé');
      setLoading(false);
      return;
    }

    if (setupIntent?.status === 'succeeded') {
      try {
        const { data, error: subErr } = await supabase.functions.invoke('create-subscription', {
          body: {
            action: 'activate-subscription',
            customerId,
            plan,
            paymentMethodId: setupIntent.payment_method,
          },
        });
        if (subErr || data?.error) throw new Error(data?.error || subErr?.message);

        // Persist plan
        if (user) {
          await supabase.from('user_subscriptions').upsert({
            user_id: user.id,
            email,
            plan,
            status: 'active',
            stripe_customer_id: customerId,
            stripe_subscription_id: data.subscriptionId,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' });
        }
        setPlanLocal(plan);
        await refreshPlan();
        toast.success(`Abonnement ${PLAN_META[plan].name} activé !`);
        onDone();
      } catch (err) {
        setError((err as Error).message || 'Activation impossible');
      }
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement options={{ layout: 'tabs' }} />
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <Button
        type="submit"
        disabled={!stripe || loading}
        className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700"
        size="lg"
      >
        {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Traitement…</> : <><Lock className="mr-2 h-4 w-4" /> S'abonner — {PLAN_META[plan].price}</>}
      </Button>
      <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
        <ShieldCheck className="h-3.5 w-3.5" /> Paiement sécurisé par Stripe · Annulable à tout moment
      </p>
    </form>
  );
};

const SubscribeModal: React.FC<Props> = ({ open, onOpenChange, plan }) => {
  const { user } = useAuth();
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [initLoading, setInitLoading] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  const email = user?.email || '';

  useEffect(() => {
    if (!open) {
      setClientSecret(null);
      setCustomerId(null);
      setInitError(null);
      return;
    }
    if (!email) {
      setInitError('Veuillez vous connecter pour vous abonner.');
      return;
    }
    const init = async () => {
      setInitLoading(true);
      setInitError(null);
      try {
        // Register email in CRM (mandatory email collection)
        fetch('https://famous.ai/api/crm/6a1250619fe351fa51c4d4cd/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            name: user?.user_metadata?.full_name || undefined,
            source: 'checkout',
            tags: ['subscriber', plan],
          }),
        }).catch(() => {});

        const { data, error } = await supabase.functions.invoke('create-subscription', {
          body: { action: 'create-setup-intent', email, name: user?.user_metadata?.full_name, plan },
        });
        if (error || data?.error) throw new Error(data?.error || error?.message);
        setClientSecret(data.clientSecret);
        setCustomerId(data.customerId);
      } catch (err) {
        setInitError((err as Error).message || 'Initialisation impossible');
      } finally {
        setInitLoading(false);
      }
    };
    init();
  }, [open, email, plan, user]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-600" />
            Passer au plan {plan === 'pro' ? 'Pro' : 'Équipe'}
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/60 to-violet-50/30 p-4">
          <p className="text-sm font-semibold text-slate-900">{PLAN_META[plan].name} — {PLAN_META[plan].price}</p>
          <p className="mt-1 text-xs text-slate-600">
            {plan === 'pro'
              ? 'Générations IA illimitées, profils clients illimités, suivi de progression.'
              : 'Tout du plan Pro, jusqu\'à 5 intervenants et tableau de bord équipe.'}
          </p>
        </div>

        {initLoading && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
          </div>
        )}

        {initError && (
          <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{initError}</p>
        )}

        {clientSecret && customerId && !initError && (
          <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe' } }}>
            <PaymentForm
              customerId={customerId}
              plan={plan}
              email={email}
              onDone={() => onOpenChange(false)}
            />
          </Elements>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SubscribeModal;
