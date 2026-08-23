import React from 'react';
import {
  ShieldCheck, BrainCircuit, UserCheck, Lock, Quote, Star, MapPin,
} from 'lucide-react';

const PILLARS = [
  {
    icon: BrainCircuit,
    title: 'Ancré dans les approches reconnues',
    desc: 'Les outils s\'appuient sur des cadres validés — TCC, psychoéducation, régulation émotionnelle — adaptés à l\'âge et au contexte.',
    accent: 'from-indigo-500 to-violet-500',
    tint: 'bg-indigo-50 text-indigo-700',
  },
  {
    icon: UserCheck,
    title: 'Au service du jugement clinique',
    desc: 'IntervenIA structure et accélère votre travail. La décision finale reste toujours entre vos mains, en contexte réel.',
    accent: 'from-violet-500 to-fuchsia-500',
    tint: 'bg-violet-50 text-violet-700',
  },
  {
    icon: Lock,
    title: 'Confidentialité par conception',
    desc: 'Vos profils clients et vos outils restent privés. Aucune donnée n\'est partagée ni utilisée à d\'autres fins.',
    accent: 'from-emerald-500 to-teal-500',
    tint: 'bg-emerald-50 text-emerald-700',
  },
  {
    icon: MapPin,
    title: 'Pensé pour le terrain québécois',
    desc: 'Vocabulaire, niveaux scolaires et réalités d\'intervention adaptés au contexte des intervenants du Québec.',
    accent: 'from-sky-500 to-indigo-500',
    tint: 'bg-sky-50 text-sky-700',
  },
];

const TESTIMONIALS = [
  {
    quote:
      'Je gagne facilement une heure par dossier. Les outils sont structurés, nuancés, et je les ajuste à ma réalité en quelques clics.',
    name: 'Marie-Ève L.',
    role: 'Psychoéducatrice · Centre jeunesse',
    initials: 'ML',
    accent: 'from-indigo-600 to-violet-600',
  },
  {
    quote:
      'Enfin un assistant qui respecte mon jugement clinique au lieu de le remplacer. C\'est devenu un réflexe avant mes interventions.',
    name: 'Samuel D.',
    role: 'Éducateur spécialisé · Milieu scolaire',
    initials: 'SD',
    accent: 'from-violet-600 to-fuchsia-600',
  },
  {
    quote:
      'Les plans pour l\'anxiété scolaire sont remarquables. Je pars d\'une base solide et je personnalise — un vrai gain de temps.',
    name: 'Catherine R.',
    role: 'Travailleuse sociale · Cabinet privé',
    initials: 'CR',
    accent: 'from-sky-600 to-indigo-600',
  },
];

const ClinicalTrust: React.FC = () => {
  return (
    <section className="bg-gradient-to-b from-white via-slate-50/40 to-white py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center">
          <div className="eyebrow mb-4 justify-center">
            <ShieldCheck className="h-3.5 w-3.5" />
            Confiance clinique
          </div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Un outil que vous pouvez
            <span className="text-gradient-brand"> recommander à vos pairs.</span>
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">
            IntervenIA est conçu comme un soutien professionnel — fiable, sécuritaire et toujours
            au service de votre expertise.
          </p>
        </div>

        {/* Pillars */}
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PILLARS.map((p) => {
            const Icon = p.icon;
            return (
              <div
                key={p.title}
                className="group rounded-2xl border border-slate-200/70 bg-white p-6 shadow-clinical transition-all hover:-translate-y-1 hover:shadow-clinical-md"
              >
                <div className={`mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${p.accent} text-white shadow-md`}>
                  <Icon className="h-5 w-5" strokeWidth={2} />
                </div>
                <h3 className="text-base font-bold text-slate-900">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{p.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Testimonials */}
        <div className="mt-20">
          <div className="mb-8 flex items-center gap-3">
            <div className="section-divider" />
            <p className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Ce que disent les intervenants
            </p>
            <div className="section-divider" />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <figure
                key={t.name}
                className="flex flex-col rounded-2xl border border-slate-200/70 bg-white p-6 shadow-clinical transition-all hover:shadow-clinical-md"
              >
                <Quote className="h-6 w-6 text-indigo-200" />
                <div className="mt-3 flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <blockquote className="mt-3 flex-1 text-sm leading-relaxed text-slate-700">
                  « {t.quote} »
                </blockquote>
                <figcaption className="mt-5 flex items-center gap-3 border-t border-slate-100 pt-4">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${t.accent} text-sm font-bold text-white shadow-sm`}>
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{t.name}</p>
                    <p className="text-xs text-slate-500">{t.role}</p>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>

        {/* Trust statement banner */}
        <div className="mt-16 overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/70 via-white to-violet-50/50 p-6 shadow-clinical sm:p-8">
          <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-brand">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <p className="text-sm leading-relaxed text-slate-700 sm:text-base">
              <strong className="font-semibold text-slate-900">Soutien professionnel, jamais substitut.</strong>{' '}
              Chaque outil généré est conçu pour appuyer votre pratique et doit être adapté à votre
              jugement clinique. IntervenIA ne remplace ni l'évaluation, ni la supervision professionnelle.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ClinicalTrust;
