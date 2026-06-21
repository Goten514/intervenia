import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Filter,
  X,
  Calendar,
  User,
  FileText,
  Trash2,
  Eye,
  FileDown,
  Sparkles,
  Clock,
  Target,
  ChevronDown,
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
  FilePlus2,
  CheckCircle2,
  Pencil,
  PlayCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { exportInterventionToPDF } from '@/lib/pdf-export';
import { warmUpService } from '@/lib/service-warmup';
import type { DossierFields } from './InterventionGenerator';

// An auto-saved waiting-room draft stores the raw typed dossier inputs (rather
// than a structured tool) under contenu._autosaved. Detect + extract them so we
// can resume editing in the generator instead of rendering an empty tool.
const isAutosavedDraft = (t: { contenu?: any }): boolean =>
  !!(t && t.contenu && t.contenu._autosaved === true);

const extractDossierFields = (t: { contenu?: any; age?: number | null; problematique?: string | null; type?: string | null }): DossierFields => {
  const c = t.contenu || {};
  return {
    age: c.age != null ? String(c.age) : (t.age != null ? String(t.age) : ''),
    problematique: c.problematique ?? t.problematique ?? '',
    contexte: c.contexte ?? '',
    objectif: c.objectif ?? '',
    type: c.type ?? t.type ?? '',
  };
};


interface ToolRow {
  id: string;
  client_id: string;
  titre: string;
  type: string | null;
  age: number | null;
  problematique: string | null;
  contenu: any;
  created_at: string;
  is_draft?: boolean;
  client_prenom?: string;
}

interface ClientLite {
  id: string;
  prenom: string;
}

const TYPE_OPTIONS = ['TCC', 'jeu', 'plan', 'psychoeducation', 'mindfulness', 'art-therapie', 'exposition', 'autre'];

interface ToolsDashboardProps {
  // Hands the raw dossier fields of an auto-saved draft back to the generator's
  // form so the intervenant can resume editing instead of viewing an empty tool.
  onResumeDraft?: (fields: DossierFields) => void;
}

const ToolsDashboard: React.FC<ToolsDashboardProps> = ({ onResumeDraft }) => {
  const { user } = useAuth();
  const [tools, setTools] = useState<ToolRow[]>([]);
  const [clients, setClients] = useState<ClientLite[]>([]);
  const [loading, setLoading] = useState(true);
  // Active tab: finalized 'tools' vs in-progress 'drafts'.
  const [tab, setTab] = useState<'tools' | 'drafts'>('tools');

  // Filters
  const [search, setSearch] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [sortAsc, setSortAsc] = useState(false); // false = récent d'abord

  // Detail modal
  const [selected, setSelected] = useState<ToolRow | null>(null);

  // Global service warm-up: wake the generation backend as soon as the
  // authenticated dashboard mounts, so the generator is already warm whichever
  // tab the intervenant opens first. Deduplicated + fire-and-forget.
  useEffect(() => {
    warmUpService();
  }, []);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const [{ data: tData, error: tErr }, { data: cData, error: cErr }] = await Promise.all([
        supabase
          .from('interventions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('client_profiles')
          .select('id, prenom')
          .eq('user_id', user.id),
      ]);
      if (tErr || cErr) {
        toast.error('Erreur de chargement');
        setLoading(false);
        return;
      }
      const clientMap = new Map((cData || []).map((c: any) => [c.id, c.prenom]));
      const enriched: ToolRow[] = (tData || []).map((t: any) => ({
        ...t,
        client_prenom: clientMap.get(t.client_id) || 'Client inconnu',
      }));
      setTools(enriched);
      setClients(cData || []);
      setLoading(false);
    };
    load();
  }, [user]);

  const handlePromote = async (id: string) => {
    const { error } = await supabase
      .from('interventions')
      .update({ is_draft: false })
      .eq('id', id)
      .eq('user_id', user!.id);
    if (error) { toast.error('Erreur lors de la finalisation'); return; }
    setTools((prev) => prev.map((t) => (t.id === id ? { ...t, is_draft: false } : t)));
    if (selected?.id === id) setSelected(null);
    toast.success('Brouillon promu en outil finalisé');
  };

  const filtered = useMemo(() => {
    const out = tools.filter((t) => {
      // Tab: finalized vs drafts
      if (!!t.is_draft !== (tab === 'drafts')) return false;
      // Search
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hay = `${t.titre || ''} ${t.problematique || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      // Type
      if (selectedTypes.length > 0) {
        if (!t.type || !selectedTypes.includes(t.type)) return false;
      }
      // Client
      if (clientFilter !== 'all' && t.client_id !== clientFilter) return false;
      // Dates
      if (dateFrom) {
        if (new Date(t.created_at) < new Date(dateFrom)) return false;
      }
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        if (new Date(t.created_at) > end) return false;
      }
      return true;
    });
    // Sort by created_at
    out.sort((a, b) => {
      const av = new Date(a.created_at).getTime();
      const bv = new Date(b.created_at).getTime();
      return sortAsc ? av - bv : bv - av;
    });
    return out;
  }, [tools, tab, search, selectedTypes, clientFilter, dateFrom, dateTo, sortAsc]);

  // Tab buttons (finalized tools vs drafts) rendered just below the header.
  const TabBar = (
    <div className="mb-5 inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
      <button
        onClick={() => setTab('tools')}
        className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${tab === 'tools' ? 'bg-indigo-600 text-white shadow' : 'text-slate-600 hover:text-slate-900'}`}
      >
        <CheckCircle2 className="h-4 w-4" /> Outils ({tools.filter((t) => !t.is_draft).length})
      </button>
      <button
        onClick={() => setTab('drafts')}
        className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${tab === 'drafts' ? 'bg-indigo-600 text-white shadow' : 'text-slate-600 hover:text-slate-900'}`}
      >
        <FilePlus2 className="h-4 w-4" /> Brouillons ({tools.filter((t) => t.is_draft).length})
      </button>
    </div>
  );

  const allTypesInData = useMemo(() => {
    const set = new Set<string>();
    tools.forEach((t) => t.type && set.add(t.type));
    TYPE_OPTIONS.forEach((t) => set.add(t));
    return Array.from(set).sort();
  }, [tools]);

  const toggleType = (t: string) => {
    setSelectedTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  };

  const resetFilters = () => {
    setSearch('');
    setSelectedTypes([]);
    setClientFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  const hasActiveFilters =
    search || selectedTypes.length > 0 || clientFilter !== 'all' || dateFrom || dateTo;

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer définitivement cet outil ?')) return;
    const { error } = await supabase
      .from('interventions')
      .delete()
      .eq('id', id)
      .eq('user_id', user!.id);
    if (error) {
      toast.error('Erreur de suppression');
      return;
    }
    setTools((prev) => prev.filter((t) => t.id !== id));
    if (selected?.id === id) setSelected(null);
    toast.success('Outil supprimé');
  };
  const handleDuplicate = async (t: ToolRow) => {
    const { data, error } = await supabase
      .from('interventions')
      .insert({
        user_id: user!.id,
        client_id: t.client_id || null,
        titre: `${t.titre} (copie)`,
        type: t.type,
        age: t.age,
        problematique: t.problematique,
        contenu: t.contenu,
      })
      .select('*')
      .single();
    if (error || !data) {
      toast.error('Erreur lors de la duplication');
      return;
    }
    setTools((prev) => [{ ...data, client_prenom: t.client_prenom }, ...prev]);
    toast.success('Outil dupliqué');
  };


  const handleDownloadPDF = (t: ToolRow) => {
    const r = t.contenu || {};
    try {
      exportInterventionToPDF(
        {
          titre: r.titre || t.titre,
          duree: r.duree,
          problematique: t.problematique || undefined,
          type: t.type || undefined,
          age: t.age ?? undefined,
          materiel: r.materiel,
          objectifs: r.objectifs,
          etapes: r.etapes,
          conseils_intervenant: r.conseils_intervenant,
          adaptations: r.adaptations,
          indicateurs_succes: r.indicateurs_succes,
        },
        { clientName: t.client_prenom || 'Client' }
      );
      toast.success('PDF téléchargé');
    } catch (err: any) {
      toast.error('Erreur PDF : ' + (err?.message || 'Impossible de générer'));
    }
  };

  // Resume an auto-saved draft in the generator: extract the raw dossier fields
  // and hand them to the parent, which loads them into the generator's form.
  const handleResume = (t: ToolRow) => {
    if (!onResumeDraft) return;
    onResumeDraft(extractDossierFields(t));
    setSelected(null);
  };


  return (
    <section className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-10 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
              Bibliothèque
            </p>
            <h1 className="mt-1 text-3xl font-bold text-slate-900 sm:text-4xl">Mes outils</h1>
            <p className="mt-2 text-sm text-slate-600">
              Retrouvez toutes les interventions générées pour vos clients, en un seul endroit.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">
            <Sparkles className="h-4 w-4 text-indigo-600" />
            <span className="font-semibold text-slate-900">{filtered.length}</span>
            <span>
              {filtered.length === tools.length
                ? `outil${tools.length > 1 ? 's' : ''} au total`
                : `sur ${tools.length}`}
            </span>
          </div>
        </div>

        {/* Filters bar */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-12">
            {/* Search */}
            <div className="relative md:col-span-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Rechercher titre ou problématique..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Client filter */}
            <div className="md:col-span-3">
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <select
                  value={clientFilter}
                  onChange={(e) => setClientFilter(e.target.value)}
                  className="h-10 w-full appearance-none rounded-md border border-slate-200 bg-white pl-9 pr-9 text-sm font-medium text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value="all">Tous les clients</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.prenom}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
            </div>

            {/* Type multi-select */}
            <div className="relative md:col-span-2">
              <button
                type="button"
                onClick={() => setTypeMenuOpen((v) => !v)}
                className="flex h-10 w-full items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-300"
              >
                <span className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-slate-400" />
                  Type
                  {selectedTypes.length > 0 && (
                    <span className="rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      {selectedTypes.length}
                    </span>
                  )}
                </span>
                <ChevronDown className="h-4 w-4 text-slate-400" />
              </button>
              {typeMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setTypeMenuOpen(false)}
                  />
                  <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-64 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1.5 shadow-xl">
                    {allTypesInData.map((t) => {
                      const active = selectedTypes.includes(t);
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => toggleType(t)}
                          className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${
                            active ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span className="capitalize">{t}</span>
                          <span
                            className={`h-4 w-4 rounded border ${
                              active
                                ? 'border-indigo-600 bg-indigo-600'
                                : 'border-slate-300 bg-white'
                            } flex items-center justify-center`}
                          >
                            {active && (
                              <svg viewBox="0 0 24 24" className="h-3 w-3 text-white" fill="none" stroke="currentColor" strokeWidth="3">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Date range */}
            <div className="flex items-center gap-2 md:col-span-3">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-10 text-xs"
                aria-label="Date début"
              />
              <span className="text-xs text-slate-400">→</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-10 text-xs"
                aria-label="Date fin"
              />
            </div>
          </div>

          {/* Sort toggle */}
          <div className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-3">
            <span className="text-xs font-semibold text-slate-500">Trier :</span>
            <button
              type="button"
              onClick={() => setSortAsc((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:border-indigo-300 hover:text-indigo-700"
              title="Changer l'ordre de tri"
            >
              {sortAsc ? (
                <ArrowUpWideNarrow className="h-3.5 w-3.5 text-indigo-600" />
              ) : (
                <ArrowDownWideNarrow className="h-3.5 w-3.5 text-indigo-600" />
              )}
              {sortAsc ? 'Plus ancien d\'abord' : 'Plus récent d\'abord'}
            </button>
          </div>

          {/* Active filter chips + reset */}
          {hasActiveFilters && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
              <span className="text-xs font-semibold text-slate-500">Filtres actifs :</span>
              {search && (
                <FilterChip label={`"${search}"`} onClear={() => setSearch('')} />
              )}
              {selectedTypes.map((t) => (
                <FilterChip
                  key={t}
                  label={`Type: ${t}`}
                  onClear={() => toggleType(t)}
                />
              ))}
              {clientFilter !== 'all' && (
                <FilterChip
                  label={`Client: ${clients.find((c) => c.id === clientFilter)?.prenom || ''}`}
                  onClear={() => setClientFilter('all')}
                />
              )}
              {dateFrom && (
                <FilterChip label={`Depuis ${dateFrom}`} onClear={() => setDateFrom('')} />
              )}
              {dateTo && <FilterChip label={`Jusqu'au ${dateTo}`} onClear={() => setDateTo('')} />}
              <button
                onClick={resetFilters}
                className="ml-auto text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
              >
                Tout effacer
              </button>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {loading ? (
            <div className="p-12 text-center text-sm text-slate-500">Chargement de vos outils...</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                <FileText className="h-7 w-7 text-slate-400" />
              </div>
              <p className="mt-4 text-base font-semibold text-slate-900">
                {tools.length === 0 ? 'Aucun outil pour l\'instant' : 'Aucun résultat'}
              </p>
              <p className="mt-1 max-w-sm text-sm text-slate-500">
                {tools.length === 0
                  ? 'Les interventions que vous générez dans le générateur IA apparaîtront ici.'
                  : 'Essayez d\'ajuster ou de réinitialiser vos filtres pour voir plus de résultats.'}
              </p>
              {hasActiveFilters && (
                <Button variant="outline" size="sm" onClick={resetFilters} className="mt-4">
                  Réinitialiser les filtres
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Titre</th>
                    <th className="px-4 py-3">Client</th>
                    <th className="hidden px-4 py-3 md:table-cell">Problématique</th>
                    <th className="hidden px-4 py-3 lg:table-cell">Type</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((t) => (
                    <tr key={t.id} className="group transition-colors hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelected(t)}
                          className="line-clamp-2 max-w-xs text-left font-semibold text-slate-900 hover:text-indigo-700"
                        >
                          {t.titre}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700">
                          <User className="h-3 w-3" />
                          {t.client_prenom}
                        </span>
                      </td>
                      <td className="hidden max-w-xs px-4 py-3 md:table-cell">
                        {t.problematique ? (
                          <span className="line-clamp-1 text-xs text-slate-600">{t.problematique}</span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="hidden px-4 py-3 lg:table-cell">
                        {t.type ? (
                          <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold uppercase text-indigo-700">
                            {t.type}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(t.created_at).toLocaleDateString('fr-CA')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {isAutosavedDraft(t) && onResumeDraft && (
                            <button
                              onClick={() => handleResume(t)}
                              title="Reprendre dans le générateur"
                              className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-indigo-700"
                            >
                              <PlayCircle className="h-3.5 w-3.5" />
                              Reprendre
                            </button>
                          )}
                          <button
                            onClick={() => setSelected(t)}
                            title="Voir le détail"
                            className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDownloadPDF(t)}
                            title="Télécharger PDF"
                            className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-emerald-50 hover:text-emerald-700"
                          >
                            <FileDown className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDuplicate(t)}
                            title="Dupliquer"
                            className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-violet-50 hover:text-violet-700"
                          >
                            <Sparkles className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(t.id)}
                            title="Supprimer"
                            className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>

                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Detail modal */}
      {selected && (
        <ToolDetailModal
          tool={selected}
          onClose={() => setSelected(null)}
          onDownloadPDF={() => handleDownloadPDF(selected)}
          onDelete={() => handleDelete(selected.id)}
        />
      )}
    </section>
  );
};

const FilterChip: React.FC<{ label: string; onClear: () => void }> = ({ label, onClear }) => (
  <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
    {label}
    <button
      onClick={onClear}
      className="rounded-full p-0.5 transition-colors hover:bg-indigo-200/60"
      aria-label="Retirer le filtre"
    >
      <X className="h-3 w-3" />
    </button>
  </span>
);

interface DetailProps {
  tool: ToolRow;
  onClose: () => void;
  onDownloadPDF: () => void;
  onDelete: () => void;
}

const ToolDetailModal: React.FC<DetailProps> = ({ tool, onClose, onDownloadPDF, onDelete }) => {
  const r = tool.contenu || {};
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-violet-50 px-6 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700">
                <User className="h-3 w-3" />
                {tool.client_prenom}
              </span>
              {tool.type && (
                <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold uppercase text-indigo-700">
                  {tool.type}
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <Calendar className="h-3 w-3" />
                {new Date(tool.created_at).toLocaleDateString('fr-CA')}
              </span>
            </div>
            <h2 className="mt-2 text-2xl font-bold text-slate-900">{r.titre || tool.titre}</h2>
            {r.duree && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-medium text-indigo-700 ring-1 ring-indigo-200">
                <Clock className="h-3 w-3" />
                {r.duree}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-white hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {tool.problematique && (
            <div className="mb-5 rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
                Problématique
              </p>
              <p className="mt-1 text-sm text-slate-700">{tool.problematique}</p>
            </div>
          )}

          {r.objectifs?.length > 0 && (
            <Section icon={<Target className="h-4 w-4 text-indigo-600" />} title="Objectifs">
              <ul className="space-y-1.5">
                {r.objectifs.map((o: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-indigo-500" />
                    {o}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {r.materiel?.length > 0 && (
            <Section title="Matériel">
              <div className="flex flex-wrap gap-2">
                {r.materiel.map((m: string, i: number) => (
                  <span
                    key={i}
                    className="rounded-md bg-slate-100 px-2.5 py-1 text-xs text-slate-700"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {r.etapes?.length > 0 && (
            <Section title="Déroulement">
              <div className="space-y-3">
                {r.etapes.map((e: any) => (
                  <div
                    key={e.numero}
                    className="flex gap-3 rounded-lg border border-slate-100 bg-slate-50/50 p-3"
                  >
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-xs font-bold text-white">
                      {e.numero}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{e.titre}</p>
                      <p className="mt-1 text-sm text-slate-600">{e.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {r.conseils_intervenant?.length > 0 && (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
              <h4 className="text-sm font-semibold text-amber-900">Conseils</h4>
              <ul className="mt-2 space-y-1.5">
                {r.conseils_intervenant.map((c: string, i: number) => (
                  <li key={i} className="text-sm text-amber-900">
                    • {c}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/60 px-6 py-3">
          <Button variant="outline" size="sm" onClick={onDelete} className="text-rose-600 hover:bg-rose-50 hover:text-rose-700">
            <Trash2 className="mr-2 h-4 w-4" />
            Supprimer
          </Button>
          <Button
            size="sm"
            onClick={onDownloadPDF}
            className="bg-gradient-to-r from-indigo-600 to-violet-600 shadow-md shadow-indigo-500/30 hover:from-indigo-700 hover:to-violet-700"
          >
            <FileDown className="mr-2 h-4 w-4" />
            Télécharger PDF
          </Button>
        </div>
      </div>
    </div>
  );
};

const Section: React.FC<{ title: string; icon?: React.ReactNode; children: React.ReactNode }> = ({
  title,
  icon,
  children,
}) => (
  <div className="mt-5">
    <h4 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-700">
      {icon}
      {title}
    </h4>
    <div className="mt-2">{children}</div>
  </div>
);

export default ToolsDashboard;
