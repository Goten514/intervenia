import React, { useState } from 'react';
import { X, Mail, Link2, Loader2, Send, CheckCircle2, Copy, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const CRM_SUBSCRIBE_URL =
  'https://famous.ai/api/crm/6a1250619fe351fa51c4d4cd/subscribe';

interface Props {
  /** The interventions row id (must be a real saved record to persist shared_with). */
  interventionId: string | null;
  /** The read-only shareable link to the intervention. */
  shareUrl: string;
  /** Title shown in the modal header for context. */
  title: string;
  /** Already-shared colleague emails so we can show + append. */
  alreadyShared: string[];
  onClose: () => void;
  /** Called after a successful share so the parent can refresh shared_with. */
  onShared?: (emails: string[]) => void;
}

const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

const ShareInterventionModal: React.FC<Props> = ({
  interventionId,
  shareUrl,
  title,
  alreadyShared,
  onClose,
  onShared,
}) => {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [sending, setSending] = useState(false);
  const [shared, setShared] = useState<string[]>(alreadyShared || []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Lien de partage copié — lecture seule');
    } catch {
      toast.error('Impossible de copier le lien');
    }
  };

  const handleShare = async () => {
    const target = email.trim().toLowerCase();
    if (!isValidEmail(target)) {
      toast.error('Adresse courriel invalide');
      return;
    }
    if (shared.includes(target)) {
      toast.info('Déjà partagé avec ce collègue');
      return;
    }
    setSending(true);
    try {
      // 1) Add the colleague to the CRM contact list (mandatory for all email
      //    collection). Fire to the public CRM subscribe endpoint.
      await fetch(CRM_SUBSCRIBE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: target,
          name: name.trim() || undefined,
          source: 'intervention-share',
          tags: ['colleague', 'shared-intervention'],
        }),
      }).catch(() => {});

      const next = [...shared, target];

      // 2) Persist who it was shared with on the intervention record.
      if (user && interventionId && interventionId !== 'apercu') {
        const { error } = await supabase
          .from('interventions')
          .update({ shared_with: next })
          .eq('id', interventionId)
          .eq('user_id', user.id);
        if (error) throw error;
      }

      setShared(next);
      setEmail('');
      setName('');
      onShared?.(next);
      toast.success(`Partagé avec ${target}`);
    } catch (err: any) {
      toast.error('Erreur de partage : ' + (err?.message || 'inconnue'));
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-violet-50 px-6 py-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-600">
              Partager — lecture seule
            </p>
            <h2 className="mt-0.5 line-clamp-1 text-lg font-bold text-slate-900">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-white hover:text-slate-900"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-6">
          {/* Read-only link */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <Link2 className="h-3.5 w-3.5 text-indigo-600" /> Lien partageable
            </label>
            <div className="mt-1.5 flex gap-2">
              <Input value={shareUrl} readOnly className="text-xs text-slate-600" />
              <Button variant="outline" size="sm" onClick={handleCopy} title="Copier le lien">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Le destinataire pourra consulter l'outil en lecture seule, sans modifier vos données.
            </p>
          </div>

          {/* Email invite */}
          <div className="border-t border-slate-100 pt-5">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <Mail className="h-3.5 w-3.5 text-indigo-600" /> Inviter un collègue par courriel
            </label>
            <div className="mt-1.5 space-y-2">
              <Input
                placeholder="Nom du collègue (optionnel)"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="collegue@exemple.ca"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleShare()}
                />
                <Button
                  onClick={handleShare}
                  disabled={sending}
                  className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700"
                >
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Shared with list */}
          {shared.length > 0 && (
            <div className="border-t border-slate-100 pt-4">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <Users className="h-3.5 w-3.5" /> Partagé avec ({shared.length})
              </p>
              <ul className="mt-2 space-y-1.5">
                {shared.map((e) => (
                  <li
                    key={e}
                    className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-emerald-600" />
                    {e}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShareInterventionModal;
