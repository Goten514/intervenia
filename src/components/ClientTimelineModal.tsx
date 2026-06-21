import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Plus, TrendingUp, Loader2, Calendar } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
}

interface SessionNote {
  id: string;
  session_date: string;
  note: string | null;
  indicators: Record<string, number>;
  created_at: string;
}

const INDICATORS = [
  { key: 'humeur', label: 'Humeur', color: '#6366f1' },
  { key: 'anxiete', label: 'Gestion anxiété', color: '#8b5cf6' },
  { key: 'social', label: 'Habiletés sociales', color: '#10b981' },
  { key: 'autonomie', label: 'Autonomie', color: '#f59e0b' },
];

const ClientTimelineModal: React.FC<Props> = ({ open, onClose, clientId, clientName }) => {
  const { user } = useAuth();
  const [notes, setNotes] = useState<SessionNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [noteText, setNoteText] = useState('');
  const [ratings, setRatings] = useState<Record<string, number>>({
    humeur: 5, anxiete: 5, social: 5, autonomie: 5,
  });

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('session_notes')
      .select('*')
      .eq('client_id', clientId)
      .order('session_date', { ascending: true });
    setNotes((data || []) as SessionNote[]);
    setLoading(false);
  };

  useEffect(() => {
    if (open) { load(); setShowForm(false); }
  }, [open, clientId]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('session_notes').insert({
        client_id: clientId,
        user_id: user.id,
        session_date: date,
        note: noteText || null,
        indicators: ratings,
      });
      if (error) throw error;
      toast.success('Note de séance enregistrée');
      setShowForm(false);
      setNoteText('');
      setRatings({ humeur: 5, anxiete: 5, social: 5, autonomie: 5 });
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const chartData = notes.map((n) => ({
    date: new Date(n.session_date).toLocaleDateString('fr-CA', { month: 'short', day: 'numeric' }),
    ...INDICATORS.reduce((acc, ind) => {
      acc[ind.key] = n.indicators?.[ind.key] ?? null;
      return acc;
    }, {} as Record<string, number | null>),
  }));

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-indigo-600" />
            Progrès — {clientName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              {notes.length} séance{notes.length !== 1 ? 's' : ''} enregistrée{notes.length !== 1 ? 's' : ''}
            </p>
            <Button size="sm" onClick={() => setShowForm(!showForm)} className="bg-gradient-to-r from-indigo-600 to-violet-600">
              <Plus className="mr-1.5 h-4 w-4" /> Nouvelle séance
            </Button>
          </div>

          {showForm && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label>Date de séance</Label>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {INDICATORS.map((ind) => (
                  <div key={ind.key}>
                    <div className="flex items-center justify-between">
                      <Label>{ind.label}</Label>
                      <span className="text-sm font-semibold" style={{ color: ind.color }}>{ratings[ind.key]}/10</span>
                    </div>
                    <Slider
                      value={[ratings[ind.key]]}
                      min={1} max={10} step={1}
                      onValueChange={(v) => setRatings((r) => ({ ...r, [ind.key]: v[0] }))}
                      className="mt-2"
                    />
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <Label>Note d'observation</Label>
                <Textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Comportements observés, objectifs travaillés..." />
              </div>
              <div className="mt-4 flex gap-2">
                <Button onClick={handleSave} disabled={saving} className="bg-gradient-to-r from-indigo-600 to-violet-600">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enregistrer'}
                </Button>
                <Button variant="outline" onClick={() => setShowForm(false)}>Annuler</Button>
              </div>
            </div>
          )}

          {/* Chart */}
          {loading ? (
            <div className="flex items-center gap-2 py-10 text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Chargement...</div>
          ) : notes.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-slate-200 p-10 text-center">
              <TrendingUp className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-2 font-medium text-slate-700">Aucune séance enregistrée</p>
              <p className="text-sm text-slate-500">Ajoutez une séance pour suivre l'évolution des indicateurs.</p>
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="mb-3 text-sm font-semibold text-slate-700">Évolution des indicateurs (sur 10)</p>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 10]} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    {INDICATORS.map((ind) => (
                      <Line key={ind.key} type="monotone" dataKey={ind.key} name={ind.label}
                        stroke={ind.color} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Notes list */}
              <div className="space-y-2">
                {[...notes].reverse().map((n) => (
                  <div key={n.id} className="rounded-lg border border-slate-200 bg-white p-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <Calendar className="h-3.5 w-3.5 text-indigo-500" />
                      {new Date(n.session_date).toLocaleDateString('fr-CA')}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {INDICATORS.map((ind) => (
                        <span key={ind.key} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                          {ind.label}: <strong>{n.indicators?.[ind.key] ?? '—'}</strong>
                        </span>
                      ))}
                    </div>
                    {n.note && <p className="mt-2 text-sm text-slate-600">{n.note}</p>}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ClientTimelineModal;
