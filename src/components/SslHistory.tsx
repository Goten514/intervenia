import React from 'react';
import { ShieldCheck, ShieldAlert, History } from 'lucide-react';

export interface SslCheckRow {
  id: string;
  created_at: string;
  status: string; // 'secure' | 'invalid'
  domain: string;
}

const uptimeFor = (rows: SslCheckRow[], windowMs: number): number | null => {
  const cutoff = Date.now() - windowMs;
  const recent = rows.filter((r) => new Date(r.created_at).getTime() >= cutoff);
  if (recent.length === 0) return null;
  const secure = recent.filter((r) => r.status === 'secure').length;
  return Math.round((secure / recent.length) * 100);
};

const recentCount = (rows: SslCheckRow[], windowMs: number): number => {
  const cutoff = Date.now() - windowMs;
  return rows.filter((r) => new Date(r.created_at).getTime() >= cutoff).length;
};

const UptimePill: React.FC<{ label: string; value: number | null; count: number }> = ({
  label,
  value,
  count,
}) => (
  <div className="flex-1 rounded-xl border border-slate-200 bg-white p-4">
    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
    <p
      className={`mt-1 text-2xl font-bold ${
        value === null
          ? 'text-slate-400'
          : value >= 99
          ? 'text-emerald-600'
          : value >= 80
          ? 'text-amber-600'
          : 'text-rose-600'
      }`}
    >
      {value === null ? '—' : `${value}%`}
    </p>
    <p className="mt-0.5 text-xs text-slate-400">
      {count} vérification{count > 1 ? 's' : ''}
    </p>
  </div>
);

const SslHistory: React.FC<{ rows: SslCheckRow[]; loading: boolean }> = ({ rows, loading }) => {
  const DAY = 24 * 60 * 60 * 1000;
  const uptime24 = uptimeFor(rows, DAY);
  const uptime7d = uptimeFor(rows, 7 * DAY);
  const count24 = recentCount(rows, DAY);
  const count7d = recentCount(rows, 7 * DAY);

  // Timeline: last 30 checks in the past 7 days, oldest -> newest left to right.
  const cutoff = Date.now() - 7 * DAY;
  const recent = rows.filter((r) => new Date(r.created_at).getTime() >= cutoff);
  const timeline = [...recent].slice(0, 30).reverse();

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
      <div className="mb-3 flex items-center gap-2">
        <History className="h-4 w-4 text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-900">
          Historique de disponibilité du certificat
        </h3>
      </div>

      <div className="flex gap-3">
        <UptimePill label="24 h" value={uptime24} count={count24} />
        <UptimePill label="7 jours" value={uptime7d} count={count7d} />
      </div>

      <div className="mt-4">
        <p className="mb-1.5 text-xs font-medium text-slate-500">
          Dernières vérifications (7 jours)
        </p>
        <div className="flex h-10 items-end gap-1">
          {loading ? (
            <p className="text-xs text-slate-400">Chargement de l'historique…</p>
          ) : timeline.length === 0 ? (
            <p className="text-xs text-slate-400">
              Aucune vérification enregistrée pour le moment.
            </p>
          ) : (
            timeline.map((r) => {
              const secure = r.status === 'secure';
              return (
                <div
                  key={r.id}
                  title={`${new Date(r.created_at).toLocaleString('fr-CA')} — ${
                    secure ? 'Sécurisé' : 'Certificat invalide'
                  }`}
                  className={`h-full flex-1 rounded-sm ${
                    secure ? 'bg-emerald-400' : 'bg-rose-400'
                  }`}
                  style={{ minWidth: 4 }}
                />
              );
            })
          )}
        </div>
      </div>

      {!loading && rows.length > 0 && (
        <div className="mt-4 flex items-center gap-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Sécurisé
          </span>
          <span className="inline-flex items-center gap-1">
            <ShieldAlert className="h-3.5 w-3.5 text-rose-500" /> Certificat invalide
          </span>
        </div>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
        Surveillance automatique côté serveur toutes les 15 minutes. L'historique se
        remplit même quand cette page est fermée, et l'équipe est alertée par courriel
        à chaque changement d'état du certificat.
      </p>

    </div>
  );
};

export default SslHistory;
