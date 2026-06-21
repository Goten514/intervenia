import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Facebook, Youtube, Linkedin, Save, RefreshCw, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const TikTokIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M16.6 5.82a4.28 4.28 0 0 1-1.02-2.82h-3.1v12.4a2.5 2.5 0 1 1-2.5-2.5c.18 0 .35.02.52.05V9.78a5.6 5.6 0 0 0-.52-.02 5.6 5.6 0 1 0 5.6 5.6V8.96a7.3 7.3 0 0 0 4.27 1.37V7.23a4.28 4.28 0 0 1-3.25-1.41z" />
  </svg>
);

const FIELDS = [
  { key: 'social_facebook', label: 'Facebook', Icon: Facebook, placeholder: 'https://www.facebook.com/votre-page' },
  { key: 'social_youtube', label: 'YouTube', Icon: Youtube, placeholder: 'https://www.youtube.com/@votre-chaine' },
  { key: 'social_linkedin', label: 'LinkedIn', Icon: Linkedin, placeholder: 'https://www.linkedin.com/company/votre-entreprise' },
  { key: 'social_tiktok', label: 'TikTok', Icon: TikTokIcon, placeholder: 'https://www.tiktok.com/@votre-compte' },
];

const SocialLinksManager: React.FC = () => {
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('site_settings')
      .select('key, value')
      .in('key', FIELDS.map((f) => f.key));
    const map: Record<string, string> = {};
    (data || []).forEach((row: { key: string; value: string }) => {
      map[row.key] = row.value;
    });
    setValues(map);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const rows = FIELDS.map((f) => ({
        key: f.key,
        value: (values[f.key] || '').trim(),
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase
        .from('site_settings')
        .upsert(rows, { onConflict: 'key' });
      if (error) throw error;
      toast.success('Liens des réseaux sociaux enregistrés.');
    } catch (err: any) {
      toast.error(`Échec de l'enregistrement : ${err?.message || 'erreur'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <Share2 className="h-5 w-5 text-indigo-600" /> Réseaux sociaux
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Configurez les URL officielles affichées dans le pied de page du site.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Actualiser
        </Button>
      </div>

      <div className="mt-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {FIELDS.map(({ key, label, Icon, placeholder }) => (
          <div key={key}>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Icon className="h-4 w-4 text-indigo-600" /> {label}
            </label>
            <Input
              type="url"
              value={values[key] || ''}
              onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
              placeholder={placeholder}
              className="mt-1.5"
              disabled={loading}
            />
          </div>
        ))}

        <Button onClick={save} disabled={saving || loading} className="gradient-brand">
          {saving ? (
            'Enregistrement...'
          ) : (
            <span className="flex items-center gap-1.5">
              <Save className="h-4 w-4" /> Enregistrer
            </span>
          )}
        </Button>
      </div>
    </div>
  );
};

export default SocialLinksManager;
