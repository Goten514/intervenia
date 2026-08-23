import React from 'react';
import {
  Sparkles, Users, ClipboardList, BarChart3,
  MessageSquare, FileText, Target, Zap
} from 'lucide-react';

const features = [
  {
    icon: Sparkles,
    title: 'Génération IA en temps réel',
    description: 'Décrivez votre besoin, recevez un outil complet : objectifs, étapes, matériel et conseils.',
    gradient: 'from-indigo-500 to-violet-500',
  },
  {
    icon: Users,
    title: 'Profils clients intelligents',
    description: 'Chaque enfant a un profil dynamique. L\'IA adapte automatiquement vos outils à son contexte.',
    gradient: 'from-violet-500 to-fuchsia-500',
  },
  {
    icon: ClipboardList,
    title: 'Plans d\'intervention complets',
    description: 'Objectifs, journaux de séance, suivi de progression. Tout au même endroit.',
    gradient: 'from-fuchsia-500 to-pink-500',
  },
  {
    icon: BarChart3,
    title: 'Analytics & progression',
    description: 'Visualisez l\'évolution de chaque client et l\'efficacité réelle de vos interventions.',
    gradient: 'from-emerald-500 to-teal-500',
  },
  {
    icon: FileText,
    title: 'Export PDF professionnel',
    description: 'Téléchargez instantanément vos outils en format imprimable, prêts à utiliser.',
    gradient: 'from-amber-500 to-orange-500',
  },
  {
    icon: Target,
    title: 'Recommandations adaptatives',
    description: 'L\'IA apprend de vos pratiques et suggère les meilleurs outils pour chaque situation.',
    gradient: 'from-cyan-500 to-blue-500',
  },
  {
    icon: MessageSquare,
    title: 'Activités interactives',
    description: 'Au-delà du PDF : questionnaires dynamiques, exercices et jeux sur tablette.',
    gradient: 'from-rose-500 to-red-500',
  },
  {
    icon: Zap,
    title: 'Workflow complet',
    description: 'De l\'évaluation initiale au rapport final, automatisez chaque étape de votre travail.',
    gradient: 'from-purple-500 to-indigo-500',
  },
];

const Features: React.FC = () => {
  return (
    <section className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600">
            Fonctionnalités
          </p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
            Tout ce dont vous avez besoin,
            <span className="block text-slate-500">au-delà des PDF statiques</span>
          </h2>
          <p className="mt-5 text-lg text-slate-600">
            IntervenIA n'est pas une bibliothèque — c'est un système intelligent qui pense
            avec vous et s'adapte à chaque cas.
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <div
                key={i}
                className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:-translate-y-1 hover:border-slate-300 hover:shadow-xl hover:shadow-indigo-500/10"
              >
                <div
                  className={`inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${feature.gradient} text-white shadow-lg`}
                >
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-slate-900">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* Comparison */}
        <div className="mt-24 overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-indigo-50/30 p-8 sm:p-12">
          <div className="grid gap-8 lg:grid-cols-2">
            <div>
              <div className="mb-3 inline-block rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                Hier
              </div>
              <h3 className="text-2xl font-bold text-slate-900">Bibliothèques de PDF statiques</h3>
              <ul className="mt-4 space-y-2 text-slate-600">
                <li>• Catalogues génériques, non personnalisés</li>
                <li>• Aucune intelligence, aucune adaptation</li>
                <li>• Pas de suivi client</li>
                <li>• Modèle "à l'unité" ou abonnement passif</li>
              </ul>
            </div>
            <div className="rounded-2xl bg-white p-6 shadow-lg ring-1 ring-indigo-100">
              <div className="mb-3 inline-block rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
                Avec IntervenIA
              </div>
              <h3 className="text-2xl font-bold text-slate-900">Système intelligent et vivant</h3>
              <ul className="mt-4 space-y-2 text-slate-700">
                <li>✓ Outils générés sur-mesure pour chaque client</li>
                <li>✓ IA spécialisée en psychoéducation</li>
                <li>✓ Suivi complet de la progression</li>
                <li>✓ Vous vendez des résultats, pas du contenu</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Features;
