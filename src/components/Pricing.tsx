import React, { useState } from 'react';
import { Check, Sparkles, BadgeCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { usePlan, PlanId } from '@/contexts/PlanContext';
import SubscribeModal from './SubscribeModal';

interface PlanDef {
  id: PlanId;
  name: string;
  price: string;
  period: string;
  description: string;
  features: string[];
  cta: string;
  popular: boolean;
}

const plans: PlanDef[] = [
  {
    id: 'free',
    name: 'Découverte',
    price: '0',
    period: '/mois',
    description: 'Pour tester la plateforme',
    features: [
      '5 générations IA par mois',
      '1 profil client',
      'Export PDF basique',
      'Support communautaire',
    ],
    cta: 'Commencer gratuitement',
    popular: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '39',
    period: '/mois',
    description: 'Pour les intervenants en pratique privée',
    features: [
      'Générations IA illimitées',
      'Profils clients illimités',
      'Plans d\'intervention complets',
      'Historique & suivi de progression',
      'Export PDF professionnel',
      'Bibliothèque d\'activités interactives',
      'Support prioritaire',
    ],
    cta: 'Passer au plan Pro',
    popular: true,
  },
  {
    id: 'equipe',
    name: 'Équipe',
    price: '99',
    period: '/mois',
    description: 'Pour les cabinets et organismes',
    features: [
      'Tout du plan Pro',
      'Jusqu\'à 5 intervenants',
      'Tableau de bord équipe',
      'Partage de profils sécurisé',
      'Analytics avancés',
      'Formation incluse',
      'Support dédié',
    ],
    cta: 'Choisir Équipe',
    popular: false,
  },
];

interface Props {
  onRequireAuth?: () => void;
}

const Pricing: React.FC<Props> = ({ onRequireAuth }) => {
  const { user } = useAuth();
  const { plan: currentPlan } = usePlan();
  const [subOpen, setSubOpen] = useState(false);
  const [subPlan, setSubPlan] = useState<Exclude<PlanId, 'free'>>('pro');

  const handleSelect = (planDef: PlanDef) => {
    if (planDef.id === 'free') {
      if (!user) {
        onRequireAuth?.();
      } else {
        toast.success('Vous profitez déjà du plan Découverte gratuit.');
      }
      return;
    }
    if (!user) {
      toast.info('Connectez-vous pour vous abonner.');
      onRequireAuth?.();
      return;
    }
    if (currentPlan === planDef.id) {
      toast.success(`Le plan ${planDef.name} est déjà actif.`);
      return;
    }
    setSubPlan(planDef.id as Exclude<PlanId, 'free'>);
    setSubOpen(true);
  };

  return (
    <section className="bg-gradient-to-b from-white to-slate-50 py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600">Tarifs</p>
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
            Un plan adapté à votre pratique
          </h2>
          <p className="mt-4 text-lg text-slate-600">
            Commencez gratuitement. Évoluez quand vous êtes prêt. Annulez quand vous voulez.
          </p>
        </div>

        <div className="mt-16 grid gap-6 lg:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = user && currentPlan === plan.id;
            return (
              <div
                key={plan.name}
                className={`relative rounded-3xl border p-8 ${
                  plan.popular
                    ? 'border-indigo-600 bg-gradient-to-b from-white to-indigo-50/30 shadow-2xl shadow-indigo-500/20 lg:scale-105'
                    : 'border-slate-200 bg-white shadow-sm'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <div className="flex items-center gap-1 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-1 text-xs font-semibold text-white shadow-md">
                      <Sparkles className="h-3 w-3" /> Plus populaire
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
                  {isCurrent && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                      <BadgeCheck className="h-3 w-3" /> Actif
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-600">{plan.description}</p>

                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-5xl font-bold tracking-tight text-slate-900">${plan.price}</span>
                  <span className="text-slate-500">{plan.period} CAD</span>
                </div>

                <Button
                  onClick={() => handleSelect(plan)}
                  disabled={!!isCurrent}
                  className={`mt-6 w-full ${
                    plan.popular
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 shadow-lg shadow-indigo-500/30 hover:from-indigo-700 hover:to-violet-700'
                      : 'bg-slate-900 hover:bg-slate-800'
                  }`}
                  size="lg"
                >
                  {isCurrent ? 'Plan actuel' : plan.cta}
                </Button>

                <ul className="mt-8 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                      <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-indigo-600" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <p className="mt-10 text-center text-sm text-slate-500">
          Plan Enterprise pour CISSS, commissions scolaires et grandes organisations.{' '}
          <button onClick={() => toast.info('Notre équipe vous contactera')} className="font-medium text-indigo-600 hover:underline">
            Demander un devis
          </button>
        </p>
      </div>

      <SubscribeModal open={subOpen} onOpenChange={setSubOpen} plan={subPlan} />
    </section>
  );
};

export default Pricing;
