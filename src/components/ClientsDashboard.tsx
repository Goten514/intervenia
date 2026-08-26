import React, { useState, useEffect } from 'react';
import { Plus, User, Calendar, FileText, Trash2, X, Eye, Pencil, TrendingUp, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import ClientHistoryModal from './ClientHistoryModal';
import ClientTimelineModal from './ClientTimelineModal';
import ServiceHealthIndicator from './ServiceHealthIndicator';
import { warmUpService } from '@/lib/service-warmup';


interface ClientProfile {
  id: string;
  prenom: string;
  age: number;
  problematiques: string[];
  contexte: string | null;
  notes: string | null;
  created_at: string;
}

const ClientsDashboard: React.FC = () => {
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [interventionsCount, setInterventionsCount] = useState(0);
  const [interventionsByClient, setInterventionsByClient] = useState<Record<string, number>>({});
  const [historyClient, setHistoryClient] = useState<ClientProfile | null>(null);
  const [timelineClient, setTimelineClient] = useState<ClientProfile | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const { user } = useAuth();

  // Form state
  const [prenom, setPrenom] = useState('');
  const [age, setAge] = useState('');
  const [problematiques, setProblematiques] = useState('');
  const [contexte, setContexte] = useState('');
  const [notes, setNotes] = useState('');

  const resetForm = () => {
    setPrenom(''); setAge(''); setProblematiques(''); setContexte(''); setNotes('');
    setEditingId(null);
  };

  const loadClients = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('client_profiles')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setClients(data || []);

    const { count } = await supabase
      .from('interventions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);
    setInterventionsCount(count || 0);

    // Per-client counts
    const { data: intvs } = await supabase
      .from('interventions')
      .select('client_id')
      .eq('user_id', user.id)
      .not('client_id', 'is', null);
    const counts: Record<string, number> = {};
    (intvs || []).forEach((row: any) => {
      if (row.client_id) counts[row.client_id] = (counts[row.client_id] || 0) + 1;
    });
    setInterventionsByClient(counts);
  };

  useEffect(() => {
    loadClients();
  }, [user]);

  // Global service warm-up: wake the generation backend as soon as this
  // authenticated dashboard mounts so the generator is already warm whichever
  // tab the intervenant opens first. Deduplicated + fire-and-forget.
  useEffect(() => {
    warmUpService();
  }, []);


  const handleSubmit = async () => {
    if (!prenom || !age) {
      toast.error('Prénom et âge requis');
      return;
    }
    if (!user) {
      toast.error('Vous devez être connecté');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        prenom,
        age: parseInt(age),
        problematiques: problematiques.split(',').map(s => s.trim()).filter(Boolean),
        contexte: contexte || null,
        notes: notes || null,
      };

      if (editingId) {
        const { error } = await supabase
          .from('client_profiles')
          .update(payload)
          .eq('id', editingId)
          .eq('user_id', user.id);
        if (error) throw error;
        toast.success('Client mis à jour');
      } else {
        const { error } = await supabase
          .from('client_profiles')
          .insert({ ...payload, user_id: user.id });
        if (error) throw error;
        toast.success('Client ajouté');
      }
      setShowForm(false);
      resetForm();
      loadClients();
    } catch (e: any) {
      const msg = String(e?.message || '').toLowerCase();
      if (msg.includes('project_not_found') || msg.includes('not_found') || msg.includes('unavailable') || msg.includes('paused')) {
        toast.error('Service en cours d\'initialisation — réessayez dans quelques secondes.');
      } else {
        toast.error(e?.message || 'Une erreur est survenue');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (c: ClientProfile) => {
    setEditingId(c.id);
    setPrenom(c.prenom);
    setAge(String(c.age));
    setProblematiques((c.problematiques || []).join(', '));
    setContexte(c.contexte || '');
    setNotes(c.notes || '');
    setShowForm(true);
    // smooth scroll to form
    setTimeout(() => {
      window.scrollTo({ top: 200, behavior: 'smooth' });
    }, 50);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce client ? Les outils générés seront conservés mais détachés.')) return;
    await supabase.from('client_profiles').delete().eq('id', id);
    toast.success('Client supprimé');
    loadClients();
  };

  const handleNewClient = () => {
    if (showForm && editingId) {
      // already editing — cancel edit and open fresh form
      resetForm();
    } else {
      resetForm();
      setShowForm(!showForm);
    }
  };

  const escapeCsv = (val: string) => {
    const v = String(val ?? '');
    if (/[",\n\r]/.test(v)) {
      return '"' + v.replace(/"/g, '""') + '"';
    }
    return v;
  };

  const handleExportCsv = () => {
    if (clients.length === 0) {
      toast.error('Aucun client à exporter');
      return;
    }
    const headers = ['Prénom', 'Âge', 'Problématiques', 'Contexte', "Nombre d'outils générés", 'Ajouté le'];
    const rows = clients.map((c) => [
      escapeCsv(c.prenom),
      escapeCsv(String(c.age)),
      escapeCsv((c.problematiques || []).join('; ')),
      escapeCsv(c.contexte || ''),
      escapeCsv(String(interventionsByClient[c.id] || 0)),
      escapeCsv(new Date(c.created_at).toLocaleDateString('fr-CA')),
    ].join(','));

    // Prepend BOM so Excel reads accents correctly
    const csv = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `mes-clients-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`${clients.length} client${clients.length > 1 ? 's' : ''} exporté${clients.length > 1 ? 's' : ''} en CSV`);
  };

  return (
    <section className="bg-white py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600">
                Dashboard
              </p>
              <ServiceHealthIndicator />
            </div>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Mes clients
            </h2>
            <p className="mt-2 text-slate-600">
              Gérez vos profils clients et suivez chaque intervention.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleExportCsv}
              variant="outline"
              disabled={clients.length === 0}
              className="border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800"
              title="Télécharger tous vos clients au format CSV"
            >
              <Download className="mr-2 h-4 w-4" /> Exporter en CSV
            </Button>
            <Button
              onClick={handleNewClient}
              className="bg-gradient-to-r from-indigo-600 to-violet-600 shadow-lg shadow-indigo-500/30"
            >
              <Plus className="mr-2 h-4 w-4" /> Nouveau client
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-indigo-50 to-white p-5">
            <p className="text-sm font-medium text-slate-600">Clients actifs</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{clients.length}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-violet-50 to-white p-5">
            <p className="text-sm font-medium text-slate-600">Interventions générées</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{interventionsCount}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-emerald-50 to-white p-5">
            <p className="text-sm font-medium text-slate-600">Heures gagnées</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{interventionsCount * 2}h</p>
          </div>
        </div>

        {/* Form */}
        {showForm && (
          <div className={`mt-6 rounded-2xl border p-6 ${editingId ? 'border-amber-200 bg-amber-50/30' : 'border-indigo-200 bg-indigo-50/30'}`}>
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {editingId && (
                  <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider text-amber-800">
                    Mode édition
                  </span>
                )}
                <h3 className="text-lg font-semibold">
                  {editingId ? `Modifier ${prenom || 'le client'}` : 'Nouveau profil client'}
                </h3>
              </div>
              <button onClick={() => { setShowForm(false); resetForm(); }}>
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Prénom *</Label>
                <Input value={prenom} onChange={e => setPrenom(e.target.value)} placeholder="ex: Léo" />
              </div>
              <div>
                <Label>Âge *</Label>
                <Input type="number" value={age} onChange={e => setAge(e.target.value)} placeholder="ex: 9" />
              </div>
              <div className="sm:col-span-2">
                <Label>Problématiques (séparées par virgules)</Label>
                <Input value={problematiques} onChange={e => setProblematiques(e.target.value)} placeholder="ex: Anxiété, Difficultés sociales" />
              </div>
              <div className="sm:col-span-2">
                <Label>Contexte</Label>
                <Textarea value={contexte} onChange={e => setContexte(e.target.value)} placeholder="Situation familiale, scolaire..." />
              </div>
              <div className="sm:col-span-2">
                <Label>Notes</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observations, objectifs..." />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                onClick={handleSubmit}
                disabled={loading}
                className={editingId
                  ? 'bg-gradient-to-r from-amber-600 to-orange-600'
                  : 'bg-gradient-to-r from-indigo-600 to-violet-600'}
              >
                {loading
                  ? (editingId ? 'Mise à jour...' : 'Ajout...')
                  : (editingId ? 'Enregistrer les modifications' : 'Ajouter le client')}
              </Button>
              {editingId && (
                <Button variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>
                  Annuler
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Clients list */}
        <div className="mt-8">
          {clients.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center">
              <User className="mx-auto h-12 w-12 text-slate-300" />
              <h3 className="mt-3 font-semibold text-slate-900">Aucun client pour l'instant</h3>
              <p className="mt-1 text-sm text-slate-500">
                Ajoutez votre premier profil pour commencer à organiser votre pratique.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {clients.map((c) => {
                const intvCount = interventionsByClient[c.id] || 0;
                const isEditing = editingId === c.id;
                return (
                  <div
                    key={c.id}
                    className={`group flex flex-col rounded-2xl border bg-white p-5 transition-all hover:shadow-lg hover:shadow-indigo-500/10 ${
                      isEditing
                        ? 'border-amber-400 ring-2 ring-amber-200'
                        : 'border-slate-200 hover:border-indigo-300'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-100 to-violet-100 font-bold text-indigo-700">
                          {c.prenom[0]?.toUpperCase()}
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900">{c.prenom}</h3>
                          <p className="text-xs text-slate-500">{c.age} ans</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 transition-all group-hover:opacity-100">
                        <button
                          onClick={() => handleEdit(c)}
                          title="Modifier ce client"
                          className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-amber-50 hover:text-amber-600"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(c.id)}
                          title="Supprimer ce client"
                          className="rounded-lg p-1.5 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {c.problematiques && c.problematiques.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {c.problematiques.map((p, i) => (
                          <span key={i} className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                            {p}
                          </span>
                        ))}
                      </div>
                    )}

                    {c.contexte && (
                      <p className="mt-3 line-clamp-2 text-sm text-slate-600">{c.contexte}</p>
                    )}

                    {/* Intervention count badge */}
                    <div className="mt-4 flex items-center justify-between rounded-lg bg-gradient-to-r from-indigo-50 to-violet-50 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-indigo-600" />
                        <span className="text-sm font-semibold text-slate-900">
                          {intvCount} outil{intvCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <span className="text-xs text-indigo-700">
                        {intvCount === 0 ? 'Aucun encore' : 'généré' + (intvCount !== 1 ? 's' : '')}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                      <Calendar className="h-3 w-3" />
                      Ajouté le {new Date(c.created_at).toLocaleDateString('fr-CA')}
                    </div>

                    {/* CTAs */}
                    <div className="mt-4 flex gap-2">
                      <Button
                        onClick={() => setHistoryClient(c)}
                        variant="outline"
                        size="sm"
                        className="flex-1 border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800"
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        Outils
                      </Button>
                      <Button
                        onClick={() => setTimelineClient(c)}
                        variant="outline"
                        size="sm"
                        className="flex-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
                        title="Suivi de progrès"
                      >
                        <TrendingUp className="mr-2 h-4 w-4" />
                        Progrès
                      </Button>
                      <Button
                        onClick={() => handleEdit(c)}
                        variant="outline"
                        size="sm"
                        className="border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
                        title="Modifier"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* History modal */}
      {historyClient && (
        <ClientHistoryModal
          open={!!historyClient}
          onClose={() => {
            setHistoryClient(null);
            loadClients(); // refresh counts when closing
          }}
          clientId={historyClient.id}
          clientName={`${historyClient.prenom} • ${historyClient.age} ans`}
        />
      )}

      {/* Timeline modal */}
      {timelineClient && (
        <ClientTimelineModal
          open={!!timelineClient}
          onClose={() => setTimelineClient(null)}
          clientId={timelineClient.id}
          clientName={`${timelineClient.prenom} • ${timelineClient.age} ans`}
        />
      )}
    </section>
  );
};

export default ClientsDashboard;
