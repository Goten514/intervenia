import React from 'react';
import { Target, Heart, Users, ShieldCheck, Sparkles, Clock } from 'lucide-react';

const FOUNDERS = [
  {
    name: 'Marie Tremblay',
    role: 'Cofondatrice & PDG',
    bio: 'Psychoéducatrice de formation avec 15 ans de terrain, Marie a fondé IntervenIA pour redonner du temps aux intervenants.',
    img: 'https://d64gsuwffb70l.cloudfront.net/6a1250619fe351fa51c4d4cd_1780139734862_e23f15aa.jpg',
  },
  {
    name: 'Julien Bouchard',
    role: 'Cofondateur & Directeur technique',
    bio: 'Ingénieur en IA passionné par l\'impact social, Julien conçoit des outils éthiques et respectueux de la vie privée.',
    img: 'https://d64gsuwffb70l.cloudfront.net/6a1250619fe351fa51c4d4cd_1780139736750_04a2d698.png',
  },
  {
    name: 'Sophie Lavoie',
    role: 'Cofondatrice & Directrice clinique',
    bio: 'Travailleuse sociale et chercheuse, Sophie veille à ce que chaque fonctionnalité repose sur des données probantes.',
    img: 'https://d64gsuwffb70l.cloudfront.net/6a1250619fe351fa51c4d4cd_1780139739410_ec833c45.png',
  },
];

const VALUES = [
  { Icon: Heart, title: 'Bienveillance', text: 'L\'humain au centre de chaque décision, pour les intervenants comme pour les bénéficiaires.' },
  { Icon: ShieldCheck, title: 'Confidentialité', text: 'Vos données et celles de vos clients sont protégées selon les plus hauts standards.' },
  { Icon: Sparkles, title: 'Rigueur clinique', text: 'Chaque outil s\'appuie sur des pratiques validées par la recherche.' },
  { Icon: Clock, title: 'Efficacité', text: 'Nous libérons du temps administratif pour le réinvestir dans la relation.' },
];

const AboutPage: React.FC = () => {
  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="bg-gradient-to-b from-indigo-50 to-white py-16 sm:py-24">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <span className="inline-flex items-center rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-700">
            À propos
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Redonner du temps humain à celles et ceux qui aident
          </h1>
          <p className="mt-5 text-lg text-slate-600">
            IntervenIA est née d'un constat simple : les intervenants québécois passent trop de temps
            sur l'administratif et pas assez auprès des personnes qu'ils accompagnent.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="py-16">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                <Target className="h-5 w-5" />
              </span>
              <h2 className="text-2xl font-bold text-slate-900">Notre mission</h2>
            </div>
            <p className="mt-4 text-slate-600">
              Outiller les psychoéducateurs, enseignants et intervenants avec une intelligence
              artificielle éthique, pensée pour le contexte québécois, afin qu'ils puissent se
              consacrer pleinement à l'accompagnement humain.
            </p>
            <p className="mt-4 text-slate-600">
              Nous croyons que la technologie doit servir la relation, jamais la remplacer. Chaque
              fonctionnalité d'IntervenIA est conçue avec et pour les professionnels du terrain.
            </p>
          </div>
          <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 p-8 text-white shadow-lg">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-3xl font-bold">+2 000</p>
                <p className="mt-1 text-sm text-indigo-100">Intervenants outillés</p>
              </div>
              <div>
                <p className="text-3xl font-bold">8 h</p>
                <p className="mt-1 text-sm text-indigo-100">Économisées par semaine</p>
              </div>
              <div>
                <p className="text-3xl font-bold">100 %</p>
                <p className="mt-1 text-sm text-indigo-100">Conçu au Québec</p>
              </div>
              <div>
                <p className="text-3xl font-bold">2024</p>
                <p className="mt-1 text-sm text-indigo-100">Année de fondation</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Nos valeurs</h2>
            <p className="mt-3 text-slate-600">Quatre principes qui guident chacune de nos décisions.</p>
          </div>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {VALUES.map(({ Icon, title, text }) => (
              <div key={title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-semibold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <span className="flex items-center justify-center gap-2 text-sm font-semibold text-indigo-600">
              <Users className="h-4 w-4" /> L'équipe fondatrice
            </span>
            <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
              Des expertises complémentaires
            </h2>
            <p className="mt-3 text-slate-600">
              Une clinicienne, un ingénieur et une chercheuse réunis par une même conviction.
            </p>
          </div>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {FOUNDERS.map((f) => (
              <div key={f.name} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <img src={f.img} alt={f.name} className="aspect-square w-full object-cover" />
                <div className="p-6">
                  <h3 className="font-semibold text-slate-900">{f.name}</h3>
                  <p className="text-sm font-medium text-indigo-600">{f.role}</p>
                  <p className="mt-3 text-sm text-slate-600">{f.bio}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* History */}
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Notre histoire</h2>
          <div className="mt-8 space-y-8 border-l-2 border-indigo-200 pl-6">
            {[
              { year: '2024', text: 'Trois professionnels du milieu psychosocial fondent IntervenIA à Montréal.' },
              { year: '2025', text: 'Lancement de la première version du générateur d\'outils d\'intervention par IA.' },
              { year: '2026', text: 'Plus de 2 000 intervenants utilisent la plateforme à travers le Québec.' },
            ].map((step) => (
              <div key={step.year} className="relative">
                <span className="absolute -left-[31px] top-1 h-4 w-4 rounded-full border-2 border-indigo-500 bg-white" />
                <p className="font-bold text-indigo-600">{step.year}</p>
                <p className="mt-1 text-slate-600">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default AboutPage;
