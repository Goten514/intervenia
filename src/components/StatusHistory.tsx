import React from 'react';
import { CheckCircle2, XCircle, History } from 'lucide-react';

export interface StatusCheckRow {
  id: string;
  created_at: string;
  ai_status: string;
  pay_status: string;
  ai_ms: number | null;
  pay_ms: number | null;
}

const Pill: React.FC<{ status: string }> = ({ status }) => {
  const ok = status === 'ok';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
      }`}
    >
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {ok ? 'OK' : 'KO'}
    </span>
  );
};

const StatusHistory: React.FC<{ rows: StatusCheckRow[]; loading: boolean }> = ({ rows, loading }) => {
  // 24h uptime: a check counts as "up" when BOTH services responded ok.
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const recent = rows.filter((r) => new Date(r.created_at).getTime() >= cutoff);
  const upCount = recent.filter((r) => r.ai_status === 'ok' && r.pay_status === 'ok').length;
  const uptime = recent.length > 0 ? Math.round((upCount / recent.length) * 100) : null;

  // Build a small bar timeline (latest 24 checks, oldest -> newest left to right).
  const timeline = [...recent].slice(0, 24).reverse();

  return (
    <div className="mt-10">
      <div className="mb-3 flex items-center gap-2">
        <History className="h-5 w-5 text-slate-500" />
        <h2 className="text-lg font-semibold text-slate-900">Historique des contrôles</h2>
      </div>

      {/* Uptime card + graph */}
      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-medium text-slate-600">Disponibilité (24 h)</p>
          <p
            className={`text-2xl font-bold ${
              uptime === null
                ? 'text-slate-400'
                : uptime >= 99
                ? 'text-emerald-600'
                : uptime >= 80
                ? 'text-amber-600'
                : 'text-rose-600'
            }`}
          >
            {uptime === null ? '—' : `${uptime}%`}
          </p>
        </div>
        <div className="mt-3 flex h-12 items-end gap-1">
          {timeline.length === 0 ? (
            <p className="text-xs text-slate-400">Aucun contrôle dans les dernières 24 h.</p>
          ) : (
            timeline.map((r) => {
              const up = r.ai_status === 'ok' && r.pay_status === 'ok';
              return (
                <div
                  key={r.id}
                  title={`${new Date(r.created_at).toLocaleString('fr-CA')} — ${
                    up ? 'OK' : 'Incident'
                  }`}
                  className={`h-full flex-1 rounded-sm ${
                    up ? 'bg-emerald-400' : 'bg-rose-400'
                  }`}
                  style={{ minWidth: 4 }}
                />
              );
            })
          )}
        </div>
        <p className="mt-2 text-xs text-slate-400">
          {recent.length} contrôle{recent.length > 1 ? 's' : ''} enregistré
          {recent.length > 1 ? 's' : ''} sur les dernières 24 h.
        </p>
      </div>

      {/* Table of last 20 */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">IA</th>
                <th className="px-4 py-3 font-medium">Paiement</th>
                <th className="px-4 py-3 text-right font-medium">Latence</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                    Chargement de l'historique…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                    Aucun contrôle enregistré pour le moment.
                  </td>
                </tr>
              ) : (
                rows.slice(0, 20).map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3 text-slate-700">
                      {new Date(r.created_at).toLocaleString('fr-CA')}
                    </td>
                    <td className="px-4 py-3">
                      <Pill status={r.ai_status} />
                    </td>
                    <td className="px-4 py-3">
                      <Pill status={r.pay_status} />
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500">
                      {Math.max(r.ai_ms ?? 0, r.pay_ms ?? 0) || '—'} ms
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default StatusHistory;
