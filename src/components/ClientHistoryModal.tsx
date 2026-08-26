import React, { useState, useEffect } from 'react';
import { X, FileText, Clock, Target, Sparkles, Calendar, Download, FileDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { exportInterventionToPDF } from '@/lib/pdf-export';

interface ClientHistoryModalProps {
  open: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
}

interface InterventionRow {
  id: string;
  titre: string;
  type: string | null;
  age: number | null;
  problematique: string | null;
  contenu: any;
  created_at: string;
}

const ClientHistoryModal: React.FC<ClientHistoryModalProps> = ({ open, onClose, clientId, clientName }) => {
  const [interventions, setInterventions] = useState<InterventionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !clientId) return;
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('interventions')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });
      if (error) toast.error('Erreur de chargement');
      setInterventions(data || []);
      setLoading(false);
    };
    load();
  }, [open, clientId]);

  const handleDownload = (intv: InterventionRow) => {
    const r = intv.contenu || {};
    const content = `${r.titre || intv.titre}\n\nDurée: ${r.duree || '-'}\n\nObjectifs:\n${(r.objectifs || []).map((o: string) => '- ' + o).join('\n')}\n\nMatériel:\n${(r.materiel || []).map((m: string) => '- ' + m).join('\n')}\n\nÉtapes:\n${(r.etapes || []).map((e: any) => `${e.numero}. ${e.titre}\n   ${e.description}`).join('\n\n')}\n\nConseils:\n${(r.conseils_intervenant || []).map((c: string) => '- ' + c).join('\n')}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(r.titre || intv.titre).replace(/\s+/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Téléchargement TXT lancé');
  };

  const handleDownloadPDF = (intv: InterventionRow) => {
    const r = intv.contenu || {};
    try {
      exportInterventionToPDF(
        {
          titre: r.titre || intv.titre,
          duree: r.duree,
          problematique: intv.problematique || undefined,
          type: intv.type || undefined,
          age: intv.age ?? undefined,
          materiel: r.materiel,
          objectifs: r.objectifs,
          etapes: r.etapes,
          conseils_intervenant: r.conseils_intervenant,
          adaptations: r.adaptations,
          indicateurs_succes: r.indicateurs_succes,
        },
        { clientName }
      );
      toast.success('PDF téléchargé');
    } catch (err: any) {
      toast.error('Erreur PDF : ' + (err?.message || 'Impossible de générer'));
    }
  };


  if (!open) return null;

  const selected = interventions.find(i => i.id === selectedId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative flex h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-violet-50 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Historique des outils</p>
            <h2 className="mt-0.5 text-xl font-bold text-slate-900">{clientName}</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-white hover:text-slate-900">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* List */}
          <div className="w-1/3 overflow-y-auto border-r border-slate-200 bg-slate-50/50">
            {loading ? (
              <div className="p-6 text-center text-sm text-slate-500">Chargement...</div>
            ) : interventions.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                <Sparkles className="h-10 w-10 text-slate-300" />
                <p className="mt-3 font-semibold text-slate-900">Aucun outil</p>
                <p className="mt-1 text-xs text-slate-500">
                  Sélectionnez ce client dans le générateur pour créer son premier outil.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {interventions.map((intv) => (
                  <button
                    key={intv.id}
                    onClick={() => setSelectedId(intv.id)}
                    className={`block w-full px-4 py-3 text-left transition-colors hover:bg-white ${
                      selectedId === intv.id ? 'bg-white border-l-4 border-indigo-600' : ''
                    }`}
                  >
                    <p className="line-clamp-2 font-semibold text-slate-900 text-sm">{intv.titre}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {intv.type && (
                        <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700">
                          {intv.type}
                        </span>
                      )}
                      {intv.problematique && (
                        <span className="rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">
                          {intv.problematique}
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-500">
                      <Calendar className="h-2.5 w-2.5" />
                      {new Date(intv.created_at).toLocaleDateString('fr-CA')}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Detail */}
          <div className="flex-1 overflow-y-auto p-6">
            {!selected ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <FileText className="h-12 w-12 text-slate-300" />
                <p className="mt-3 font-semibold text-slate-900">Sélectionnez un outil</p>
                <p className="mt-1 text-sm text-slate-500">
                  Cliquez sur un outil à gauche pour voir son contenu complet.
                </p>
              </div>
            ) : (
              <div>
                <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-2xl font-bold text-slate-900">{selected.contenu?.titre || selected.titre}</h3>
                    {selected.contenu?.duree && (
                      <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
                        <Clock className="h-3 w-3" />
                        {selected.contenu.duree}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleDownload(selected)} title="Télécharger en TXT">
                      <Download className="mr-2 h-4 w-4" /> TXT
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleDownloadPDF(selected)}
                      className="bg-gradient-to-r from-indigo-600 to-violet-600 shadow-md shadow-indigo-500/30 hover:from-indigo-700 hover:to-violet-700"
                      title="Télécharger en PDF stylisé"
                    >
                      <FileDown className="mr-2 h-4 w-4" /> Télécharger PDF
                    </Button>
                  </div>

                </div>

                {selected.contenu?.objectifs?.length > 0 && (
                  <div className="mt-5">
                    <h4 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-700">
                      <Target className="h-4 w-4 text-indigo-600" /> Objectifs
                    </h4>
                    <ul className="mt-2 space-y-1.5">
                      {selected.contenu.objectifs.map((o: string, i: number) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                          <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-indigo-500" />
                          {o}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selected.contenu?.materiel?.length > 0 && (
                  <div className="mt-5">
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Matériel</h4>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selected.contenu.materiel.map((m: string, i: number) => (
                        <span key={i} className="rounded-md bg-slate-100 px-2.5 py-1 text-xs text-slate-700">{m}</span>
                      ))}
                    </div>
                  </div>
                )}

                {selected.contenu?.etapes?.length > 0 && (
                  <div className="mt-5">
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Déroulement</h4>
                    <div className="mt-3 space-y-3">
                      {selected.contenu.etapes.map((e: any) => (
                        <div key={e.numero} className="flex gap-3 rounded-lg border border-slate-100 bg-slate-50/50 p-3">
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
                  </div>
                )}

                {selected.contenu?.conseils_intervenant?.length > 0 && (
                  <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                    <h4 className="text-sm font-semibold text-amber-900">Conseils</h4>
                    <ul className="mt-2 space-y-1.5">
                      {selected.contenu.conseils_intervenant.map((c: string, i: number) => (
                        <li key={i} className="text-sm text-amber-900">• {c}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClientHistoryModal;
