import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Sparkles, Clock, Target, FileText, Activity, Lightbulb,
  CheckCircle2, ShieldCheck, Stethoscope, FileX, ArrowLeft,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Etape { numero: number; titre: string; description: string }

interface Shared {
  titre: string;
  duree?: string;
  type?: string | null;
  age?: number | null;
  problematique?: string | null;
  materiel?: string[];
  objectifs?: string[];
  etapes?: Etape[];
  conseils_intervenant?: string[];
  indicateurs_succes?: string[];
}

// Decode the optional data payload carried in the URL hash (#d=<base64 json>)
// so a copied link is portable across browsers/devices.
const decodeHash = (): Shared | null => {
  try {
    const hash = window.location.hash || '';
    const m = hash.match(/[#&]d=([^&]+)/);
    if (!m) return null;
    const json = decodeURIComponent(escape(atob(decodeURIComponent(m[1]))));
    return JSON.parse(json);
  } catch {
    return null;
  }
};

const SharedIntervention: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Shared | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = 'Outil clinique partagé — IntervenIA';
    const load = async () => {
      // 1) Try the portable hash payload first.
      const fromHash = decodeHash();
      if (fromHash) {
        setData(fromHash);
        setLoading(false);
        return;
      }
      // 2) Fall back to fetching by id (no auth).
      if (id) {
        const { data: rows } = await supabase
          .from('interventions')
          .select('*')
          .eq('id', id);
        const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
        if (row) {
          const c = row.contenu || {};
          setData({
            titre: c.titre || row.titre,
            duree: c.duree,
            type: row.type,
            age: row.age,
            problematique: row.problematique,
            materiel: c.materiel,
            objectifs: c.objectifs,
            etapes: c.etapes,
            conseils_intervenant: c.conseils_intervenant,
            indicateurs_succes: c.indicateurs_succes,
          });
        }
      }
      setLoading(false);
    };
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-500">
          <Sparkles className="h-5 w-5 animate-pulse text-indigo-600" />
          Chargement de l'outil partagé…
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
          <FileX className="h-8 w-8 text-slate-400" />
        </div>
        <h1 className="mt-4 text-xl font-bold text-slate-900">Outil introuvable</h1>
        <p className="mt-2 max-w-sm text-sm text-slate-600">
          Ce lien de partage n'est plus valide ou l'outil a été supprimé. Demandez à l'intervenant
          de regénérer un lien.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          <ArrowLeft className="h-4 w-4" /> Retour à IntervenIA
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50/40 via-white to-white">
      {/* Top bar */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 shadow">
              <Stethoscope className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-slate-900">IntervenIA</span>
          </Link>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
            <ShieldCheck className="h-3 w-3" /> Aperçu en lecture seule
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-indigo-500/5 sm:p-8">
          {/* Title */}
          <div className="border-b border-slate-100 pb-5">
            <h1 className="text-2xl font-bold leading-tight text-slate-900 sm:text-3xl">{data.titre}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              {data.duree && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700">
                  <Clock className="h-3 w-3" /> {data.duree}
                </span>
              )}
              {data.type && (
                <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700">
                  {data.type}
                </span>
              )}
              {data.age != null && (
                <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
                  {data.age} ans
                </span>
              )}
            </div>
          </div>

          {data.problematique && (
            <div className="mt-6 rounded-xl bg-slate-50/80 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Problématique ciblée
              </p>
              <p className="mt-1 text-sm font-medium text-slate-800">{data.problematique}</p>
            </div>
          )}

          {data.objectifs && data.objectifs.length > 0 && (
            <Block icon={Target} title="Objectifs cliniques">
              <ul className="space-y-2">
                {data.objectifs.map((o, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-slate-700">
                    <span className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-indigo-500" />
                    {o}
                  </li>
                ))}
              </ul>
            </Block>
          )}

          {data.materiel && data.materiel.length > 0 && (
            <Block icon={FileText} title="Matériel requis">
              <div className="flex flex-wrap gap-1.5">
                {data.materiel.map((m, i) => (
                  <span key={i} className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700">
                    {m}
                  </span>
                ))}
              </div>
            </Block>
          )}

          {data.etapes && data.etapes.length > 0 && (
            <Block icon={Activity} title="Déroulement">
              <div className="space-y-2.5">
                {data.etapes.map((e) => (
                  <div key={e.numero} className="flex gap-3 rounded-xl border border-slate-100 bg-gradient-to-br from-slate-50/80 to-white p-3.5">
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-xs font-bold text-white shadow-sm">
                      {e.numero}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900">{e.titre}</p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-600">{e.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Block>
          )}

          {data.conseils_intervenant && data.conseils_intervenant.length > 0 && (
            <div className="mt-6 rounded-xl border border-amber-200/70 bg-gradient-to-br from-amber-50/80 to-amber-50/40 p-4">
              <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-amber-900">
                <Lightbulb className="h-3.5 w-3.5" /> Conseils pour l'intervenant
              </h4>
              <ul className="mt-2.5 space-y-1.5">
                {data.conseils_intervenant.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-amber-900">
                    <span className="mt-[7px] h-1 w-1 flex-shrink-0 rounded-full bg-amber-600" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.indicateurs_succes && data.indicateurs_succes.length > 0 && (
            <Block icon={CheckCircle2} title="Indicateurs de succès" iconColor="text-emerald-600">
              <ul className="space-y-1.5">
                {data.indicateurs_succes.map((ind, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-slate-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
                    {ind}
                  </li>
                ))}
              </ul>
            </Block>
          )}

          {/* Disclaimer */}
          <div className="mt-8 flex gap-2.5 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
            <ShieldCheck className="h-4 w-4 flex-shrink-0 text-slate-500" />
            <p className="text-[11px] leading-relaxed text-slate-600">
              <strong className="font-semibold text-slate-700">Soutien clinique professionnel.</strong>{' '}
              Cet outil est généré à titre de soutien à la pratique et doit être adapté au jugement
              clinique de l'intervenant. Il ne remplace ni l'évaluation, ni la supervision professionnelle.
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          Généré avec{' '}
          <Link to="/" className="font-semibold text-indigo-600 hover:underline">IntervenIA</Link>
          {' '}— l'assistant clinique des intervenants.
        </p>
      </main>
    </div>
  );
};

const Block: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  iconColor?: string;
  children: React.ReactNode;
}> = ({ icon: Icon, title, iconColor = 'text-indigo-600', children }) => (
  <div className="mt-6">
    <div className="mb-3 flex items-center gap-2">
      <div className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent" />
      <h4 className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">
        <Icon className={`h-3.5 w-3.5 ${iconColor}`} /> {title}
      </h4>
      <div className="h-px flex-[3] bg-gradient-to-l from-slate-200 to-transparent" />
    </div>
    {children}
  </div>
);

export default SharedIntervention;
