import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { AlertTriangle, RefreshCw, ShieldAlert, Wifi, ServerCrash } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface GenError {
  id: string;
  error_type: string;
  message: string | null;
  domain: string | null;
  created_at: string;
}

// Admin view of the `generation_errors` table — lets the team see the REAL
// frequency of SERVICE problems (server/ssl) vs NETWORK problems (connectivity).
const AdminGenerationErrors: React.FC = () => {
  const [rows, setRows] = useState<GenError[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('generation_errors')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    setRows((data as GenError[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const count = (t: string) => rows.filter((r) => r.error_type === t).length;
  const serviceTotal = count('server') + count('ssl');
  const networkTotal = count('connectivity') + count('blocked');

  const badge = (t: string) => {
    if (t === 'ssl') return 'bg-amber-100 text-amber-700';
    if (t === 'server') return 'bg-rose-100 text-rose-700';
    if (t === 'connectivity') return 'bg-sky-100 text-sky-700';
    return 'bg-slate-100 text-slate-600';
  };

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <ShieldAlert className="h-5 w-5 text-indigo-600" /> Échecs de génération
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Distinguer les problèmes de <strong>service</strong> (serveur/SSL) des problèmes de{' '}
            <strong>réseau</strong> (connexion locale).
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Actualiser
        </Button>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-2xl font-bold text-slate-900">{rows.length}</p>
          <p className="text-xs text-slate-500">Total</p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <p className="flex items-center gap-1.5 text-2xl font-bold text-rose-700">
            <ServerCrash className="h-5 w-5" /> {serviceTotal}
          </p>
          <p className="text-xs text-rose-600">Service (serveur/SSL)</p>
        </div>
        <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
          <p className="flex items-center gap-1.5 text-2xl font-bold text-sky-700">
            <Wifi className="h-5 w-5" /> {networkTotal}
          </p>
          <p className="text-xs text-sky-600">Réseau (local)</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-2xl font-bold text-amber-700">{count('ssl')}</p>
          <p className="text-xs text-amber-600">Bloqués SSL</p>
        </div>
      </div>

      <div className="mt-6 space-y-2">
        {rows.length === 0 && !loading && (
          <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
            Aucun échec enregistré — tout fonctionne.
          </p>
        )}
        {rows.map((r) => (
          <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${badge(r.error_type)}`}>
                  <AlertTriangle className="h-3 w-3" /> {r.error_type}
                </span>
                {r.domain && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {r.domain}
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-400">
                {new Date(r.created_at).toLocaleString('fr-CA')}
              </span>
            </div>
            {r.message && <p className="mt-2 break-words text-xs text-slate-600">{r.message}</p>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminGenerationErrors;
