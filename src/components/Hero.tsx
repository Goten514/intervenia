import React from 'react';
import { Sparkles, ArrowRight, ShieldCheck, Clock3, Stethoscope, CheckCircle2, FileText, Target, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HeroProps {
  onCTA: () => void;
}

const Hero: React.FC<HeroProps> = ({ onCTA }) => {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-slate-50 via-white to-indigo-50/20">
      {/* Soft background decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[520px] w-[1100px] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-200/30 via-violet-200/30 to-sky-200/30 blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left Content */}
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-indigo-200/70 bg-white/90 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-700 shadow-sm backdrop-blur">
              <Stethoscope className="h-3.5 w-3.5" />
              Assistant clinique pour intervenants
            </div>

            <h1 className="text-4xl font-bold leading-[1.08] tracking-tight text-slate-900 sm:text-5xl lg:text-[3.5rem]">
              Créez des outils d'intervention
              <span className="block bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-500 bg-clip-text text-transparent">
                professionnels et adaptés
              </span>
              à chaque situation.
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
              IntervenIA structure votre jugement clinique en outils prêts à l'usage —
              <strong className="text-slate-900"> objectifs, étapes, matériel, conseils </strong>
              — en <strong className="text-slate-900">moins de 60 secondes</strong>.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                onClick={onCTA}
                className="group h-12 bg-gradient-to-r from-indigo-600 to-violet-600 px-6 text-base shadow-xl shadow-indigo-500/30 hover:from-indigo-700 hover:to-violet-700"
              >
                Créer mon premier outil
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={onCTA}
                className="h-12 border-slate-300 bg-white px-6 text-base text-slate-700 hover:bg-slate-50"
              >
                Voir un exemple
              </Button>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-slate-600">
              <div className="flex items-center gap-1.5">
                <Clock3 className="h-4 w-4 text-indigo-600" />
                <span>Moins de 60 secondes</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-indigo-600" />
                <span>Confidentialité garantie</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                <span>Adapté au jugement clinique</span>
              </div>
            </div>
          </div>

          {/* Right Visual — preview of an actual tool output */}
          <div className="relative">
            <div className="relative rounded-3xl border border-slate-200/80 bg-white p-5 shadow-2xl shadow-indigo-500/10 sm:p-6">
              {/* Mini header simulating an output card */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-sm font-bold text-white shadow-md shadow-indigo-500/30">
                    IA
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600">Outil généré</p>
                    <p className="text-sm font-semibold text-slate-900">Plan d'intervention — 12 ans</p>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                  <Sparkles className="h-3 w-3" />
                  En 42 s
                </div>
              </div>

              <h3 className="mt-4 text-lg font-bold text-slate-900">
                Réguler l'impulsivité en contexte scolaire
              </h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-medium text-indigo-700">25 min</span>
                <span className="rounded-full bg-violet-50 px-2.5 py-0.5 text-[11px] font-medium text-violet-700">TCC</span>
                <span className="rounded-full bg-sky-50 px-2.5 py-0.5 text-[11px] font-medium text-sky-700">Secondaire</span>
              </div>

              {/* Objectifs */}
              <div className="mt-5">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <Target className="h-3.5 w-3.5 text-indigo-600" /> Objectifs
                </div>
                <ul className="mt-2 space-y-1.5">
                  <li className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-indigo-500" />
                    Identifier les déclencheurs émotionnels
                  </li>
                  <li className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-indigo-500" />
                    Mettre en place une stratégie de pause active
                  </li>
                </ul>
              </div>

              {/* Étapes preview */}
              <div className="mt-4 space-y-2">
                {[
                  { n: 1, t: 'Accueil et mise en contexte', d: '3 min' },
                  { n: 2, t: 'Cartographie du « volcan intérieur »', d: '10 min' },
                  { n: 3, t: 'Plan d\'action personnalisé', d: '12 min' },
                ].map((s) => (
                  <div key={s.n} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/60 p-2.5">
                    <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-[11px] font-bold text-white">
                      {s.n}
                    </div>
                    <p className="flex-1 text-sm font-medium text-slate-900">{s.t}</p>
                    <span className="text-[11px] font-medium text-slate-500">{s.d}</span>
                  </div>
                ))}
              </div>

              {/* Conseil */}
              <div className="mt-4 flex gap-2.5 rounded-xl border border-amber-200/70 bg-amber-50/60 p-3">
                <Lightbulb className="h-4 w-4 flex-shrink-0 text-amber-600" />
                <p className="text-xs leading-relaxed text-amber-900">
                  Valider l'émotion avant la stratégie. Le jeune doit se sentir entendu.
                </p>
              </div>
            </div>

            {/* Floating badges */}
            <div className="absolute -bottom-4 -left-4 hidden rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-lg sm:flex items-center gap-2.5">
              <FileText className="h-4 w-4 text-indigo-600" />
              <div>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">Exportable</p>
                <p className="text-xs font-semibold text-slate-900">PDF clinique stylisé</p>
              </div>
            </div>
          </div>
        </div>

        {/* Trust bar */}
        <div className="mt-20 border-t border-slate-200 pt-10">
          <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Conçu avec et pour des intervenants au Québec
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 opacity-70">
            {['CISSS Laval', 'Commissions scolaires', 'Centres jeunesse', 'CIUSSS Montréal', 'Cabinets privés'].map((name) => (
              <div key={name} className="text-sm font-semibold text-slate-700">
                {name}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
