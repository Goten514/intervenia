import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles, Loader2, FileText, Clock, Target, CheckCircle2, Lightbulb,
  RefreshCw, Download, User, X, FileDown, Copy, ShieldCheck, Stethoscope,
  Hash, BookOpen, Activity, History, Pencil, Save, Link2, Zap, ArrowUpRight,
  ShieldAlert, ExternalLink, Search, Share2, FilePlus2
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { generateIntervention } from '@/lib/ai';
import { supabase as db } from '@/lib/local-db';
import { buildSecureTarget } from '@/lib/domain-config';
import { useAuth } from '@/contexts/AuthContext';
import { usePlan } from '@/contexts/PlanContext';
import { toast } from 'sonner';
import { exportInterventionToPDF } from '@/lib/pdf-export';
import ShareInterventionModal from '@/components/ShareInterventionModal';

// Persisted clinical dossier inputs survive a failed generation or page refresh
// so the intervenant never loses what they typed and can retry instantly.
const FORM_STORAGE_KEY = 'intervenia:dossier-form:v1';

interface Etape { numero: number; titre: string; description: string }

interface Intervention {
  titre: string;
  duree?: string;
  materiel?: string[];
  objectifs?: string[];
  etapes?: Etape[];
  conseils_intervenant?: string[];
  adaptations?: string[];
  indicateurs_succes?: string[];
  raw?: string;
}

interface ClientProfile {
  id: string;
  prenom: string;
  age: number;
  problematiques: string[];
  contexte: string | null;
}

// Three "wow" templates — the showcase scenarios
const TEMPLATES = [
  {
    label: 'TDAH — primaire',
    icon: Activity,
    accent: 'from-sky-500 to-indigo-500',
    data: {
      age: '9',
      problematique: 'TDAH — difficulté d\'attention et impulsivité en classe',
      objectif: 'Améliorer le maintien de l\'attention et réduire les comportements impulsifs',
      type: 'Plan d\'intervention TCC + activité ludique',
      contexte: 'En classe régulière, 3e année. Famille engagée. Pas de médication.',
    },
  },
  {
    label: 'Anxiété scolaire',
    icon: BookOpen,
    accent: 'from-violet-500 to-fuchsia-500',
    data: {
      age: '11',
      problematique: 'Anxiété de performance et refus scolaire',
      objectif: 'Réduire l\'évitement et restaurer le sentiment de sécurité en milieu scolaire',
      type: 'Exposition graduée + psychoéducation',
      contexte: 'Refus d\'aller à l\'école depuis 3 semaines. Maux de ventre matinaux.',
    },
  },
  {
    label: 'Colère — adolescent',
    icon: Target,
    accent: 'from-rose-500 to-orange-500',
    data: {
      age: '14',
      problematique: 'Gestion de la colère et explosions émotionnelles',
      objectif: 'Reconnaître les déclencheurs et développer des stratégies de régulation',
      type: 'TCC + plan de crise personnalisé',
      contexte: 'Conflits récurrents à la maison et à l\'école. Bonne capacité d\'introspection.',
    },
  },
];

interface RecentTool {
  id: string;
  titre: string;
  problematique: string | null;
  type: string | null;
  age: number | null;
  contenu: any;
  created_at: string;
  is_draft?: boolean;
  shared_with?: string[];
}

// --- helpers for list <-> textarea (one item per line) ---
const linesToList = (s: string): string[] =>
  s.split('\n').map(l => l.trim()).filter(Boolean);
const listToLines = (list?: string[]): string => (list || []).join('\n');

// Free plan: number of AI generations allowed per calendar month.
const FREE_MONTHLY_LIMIT = 5;

const isSameMonth = (iso: string) => {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
};

// Encode an intervention into a compact, URL-safe base64 payload so a copied
// share link carries its data and works across browsers/devices.
const encodePayload = (obj: any): string => {
  try {
    return encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(obj)))));
  } catch {
    return '';
  }
};
// Detects a failure that almost certainly comes from the BROWSER blocking the
// request (invalid TLS certificate on a custom domain, mixed content, an
// extension/firewall blocking fetch, or being offline) rather than a real
// server-side error. In these cases `fetch` throws a `TypeError` with a
// "Failed to fetch" / "Load failed" / "NetworkError" message and never reaches
// our edge function — so NO billed operation happened.
const isBrowserBlockedError = (err: any): boolean => {
  const msg = String(err?.message || err || '').toLowerCase();
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  return (
    err?.name === 'TypeError' ||
    msg.includes('failed to fetch') ||
    msg.includes('load failed') ||
    msg.includes('networkerror') ||
    msg.includes('network error') ||
    msg.includes('err_cert') ||
    msg.includes('ssl') ||
    msg.includes('certificate') ||
    msg.includes('cors')
  );
};

// A transient infrastructure error (the hosted project momentarily reported
// "project_not_found" / paused / 5xx while waking up). These resolve on their
// own after a moment, so we show a calm "réessayez" message instead of a scary
// raw technical code.
const isTransientInfraError = (msg: string): boolean => {
  const m = (msg || '').toLowerCase();
  return (
    m.includes('project_not_found') ||
    m.includes('project not found') ||
    m.includes('not_found') ||
    m.includes('paused') ||
    m.includes('initialisation') ||
    m.includes('momentanément') ||
    m.includes('unavailable') ||
    m.includes('502') ||
    m.includes('503') ||
    m.includes('504')
  );
};

export interface DossierFields {
  age?: string;
  problematique?: string;
  contexte?: string;
  objectif?: string;
  type?: string;
}

interface Props {
  onUpgrade?: () => void;
  // When set (e.g. resuming an auto-saved draft from ToolsDashboard), these
  // fields are loaded into the form on mount. `onDossierConsumed` is called once
  // they've been applied so the parent can clear the one-shot handoff.
  initialDossier?: DossierFields | null;
  onDossierConsumed?: () => void;
}

const InterventionGenerator: React.FC<Props> = ({ onUpgrade, initialDossier, onDossierConsumed }) => {
  // Restore any previously-typed dossier from localStorage ONCE (lazy init), so a
  // failed generation or a page refresh never loses the intervenant's input.
  const saved = (() => {
    try {
      return JSON.parse(localStorage.getItem(FORM_STORAGE_KEY) || '{}') || {};
    } catch {
      return {} as Record<string, string>;
    }
  })();

  const [age, setAge] = useState<string>(saved.age || '');
  const [niveau, setNiveau] = useState('');
  const [problematique, setProblematique] = useState<string>(saved.problematique || '');
  const [contexte, setContexte] = useState<string>(saved.contexte || '');
  const [objectif, setObjectif] = useState<string>(saved.objectif || '');
  const [type, setType] = useState<string>(saved.type || '');
  const [loading, setLoading] = useState(false);
  // True while we are automatically retrying because the backend is cold-starting
  // (no billed operation has occurred yet). Lets us show a calm "préchauffage" message.
  const [warming, setWarming] = useState(false);
  const [result, setResult] = useState<Intervention | null>(null);
  const [clients, setClients] = useState<ClientProfile[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [recents, setRecents] = useState<RecentTool[]>([]);
  const [justSaved, setJustSaved] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [lastSavedId, setLastSavedId] = useState<string | null>(null);
  const [savingEdits, setSavingEdits] = useState(false);
  const [monthlyCount, setMonthlyCount] = useState(0);
  // Explicit, persistent error shown in the result panel when a generation
  // fails. `kind` distinguishes a real server error from a connectivity block,
  // and `blockedOn` (for blocked errors) records WHETHER the custom domain's
  // SSL is to blame — so we never wrongly accuse a valid certificate.
  const [genError, setGenError] = useState<
    { kind: 'blocked' | 'server'; message: string; blockedOn?: 'ssl' | 'connectivity' } | null
  >(null);
  // Full-text search over saved tools (title / problématique / type) on the
  // "Générations récentes" panel. When the query is non-empty we query the
  // interventions table directly so results aren't limited to the 5 most recent.
  const [recentSearch, setRecentSearch] = useState('');
  const [searchResults, setSearchResults] = useState<RecentTool[]>([]);
  const [searchingRecents, setSearchingRecents] = useState(false);
  // Sharing state for the currently-displayed result.
  const [shareOpen, setShareOpen] = useState(false);
  const [sharedWith, setSharedWith] = useState<string[]>([]);
  // Saving the result as a draft (in-progress, not finalized).
  const [savingDraft, setSavingDraft] = useState(false);
  // After a transient SERVER failure we arm an automatic retry tied to
  // health-check. To avoid a frustrating infinite loop when the AI gateway is
  // genuinely down, we cap automatic retries at MAX_AUTO_RETRIES. Once that cap
  // is reached we STOP retrying, hand the dossier to the background queue (which
  // will email the user when their tool is ready), and show a clear final state
  // with a manual "Réessayer" button.
  const MAX_AUTO_RETRIES = 2;
  const [autoRetryArmed, setAutoRetryArmed] = useState(false);
  const autoRetryRef = useRef(false);
  // How many AUTOMATIC retries we've already spent for the current failure cycle.
  const autoAttemptsRef = useRef(0);
  // True once we've given up auto-retrying and queued the dossier for the
  // background worker; we then show "vous serez notifié par courriel".
  const [queued, setQueued] = useState(false);
  // True only while THE automatic retry is executing.
  const autoRunningRef = useRef(false);
  // While we wait (auto-retry) for the service to come back, we silently persist
  // the typed dossier as a DRAFT (is_draft=true) so no work is lost even if the
  // intervenant closes the tab before the automatic relance fires. This ref holds
  // that draft's id so we update (not duplicate) it and can clean it up on success.
  const autoDraftIdRef = useRef<string | null>(null);


  const { user } = useAuth();
  const { isPro } = usePlan();
  const [serviceDown, setServiceDown] = useState(false);

  const quotaReached = !isPro && monthlyCount >= FREE_MONTHLY_LIMIT;

  // Persist the clinical dossier inputs whenever they change so they survive a
  // failed generation or a refresh. Only the typed fields are stored (no result).
  useEffect(() => {
    try {
      localStorage.setItem(
        FORM_STORAGE_KEY,
        JSON.stringify({ age, problematique, contexte, objectif, type })
      );
    } catch {
      /* localStorage unavailable (private mode / quota) — ignore. */
    }
  }, [age, problematique, contexte, objectif, type]);

  // One-shot consumption of an externally-provided dossier (e.g. "Reprendre dans
  // le générateur" on an auto-saved draft from ToolsDashboard). We load the raw
  // typed fields straight into the form instead of trying to render an empty
  // structured tool, clear any stale result/error, then tell the parent it's
  // been consumed so the handoff fires only once.
  const dossierConsumedRef = useRef(false);
  useEffect(() => {
    if (!initialDossier || dossierConsumedRef.current) return;
    dossierConsumedRef.current = true;
    const d = initialDossier;
    setAge(d.age ? String(d.age) : '');
    setProblematique(d.problematique || '');
    setContexte(d.contexte || '');
    setObjectif(d.objectif || '');
    setType(d.type || '');
    // Clear any previously-displayed result/error so the form is the focus.
    setResult(null);
    setGenError(null);
    setEditMode(false);
    setLastSavedId(null);
    setJustSaved(false);
    toast.success('Brouillon repris — complétez le dossier puis générez.');
    onDossierConsumed?.();
  }, [initialDossier, onDossierConsumed]);



  const loadRecents = async (uid: string) => {
    const { data } = await db.from('interventions')
      .select()
      .eq('user_id', uid)
      .order('created_at', { ascending: false });
    const all = (data || []) as RecentTool[];
    setRecents(all.filter((r) => !r.is_draft).slice(0, 5));
    setMonthlyCount(all.filter((r: any) => r.created_at && isSameMonth(r.created_at)).length);
  };

  // Debounced full-text search over the user's saved tools by title /
  // problématique / type. Queries the table directly so results aren't limited
  // to the 5 most-recent shown by default.
  useEffect(() => {
    const q = recentSearch.trim();
    if (!user || !q) {
      setSearchResults([]);
      setSearchingRecents(false);
      return;
    }
    setSearchingRecents(true);
    const handle = setTimeout(async () => {
      const { data } = await db.from('interventions')
        .select()
        .eq('user_id', user.id);
      const filtered = (data || []).filter((r: any) =>
        !r.is_draft && (
          (r.titre || '').toLowerCase().includes(q.toLowerCase()) ||
          (r.problematique || '').toLowerCase().includes(q.toLowerCase()) ||
          (r.type || '').toLowerCase().includes(q.toLowerCase())
        )
      ).slice(0, 15);
      setSearchResults(filtered as RecentTool[]);
      setSearchingRecents(false);
    }, 300);
    return () => clearTimeout(handle);
  }, [recentSearch, user]);

  useEffect(() => {
    const loadAll = async () => {
      if (!user) return;
      const { data } = await db.from('client_profiles')
        .select()
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setClients(data || []);
      await loadRecents(user.id);
    };
    loadAll();
  }, [user]);



  // Auto-derive niveau scolaire from age for the "clinical dossier" feel
  useEffect(() => {
    const n = parseInt(age);
    if (!n) { setNiveau(''); return; }
    if (n <= 5) setNiveau('Préscolaire');
    else if (n <= 11) setNiveau('Primaire');
    else if (n <= 17) setNiveau('Secondaire');
    else setNiveau('Adulte');
  }, [age]);

  const handleSelectClient = (clientId: string) => {
    setSelectedClientId(clientId);
    if (!clientId) return;
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    setAge(String(client.age));
    setProblematique(client.problematiques?.join(', ') || '');
    setContexte(client.contexte || '');
    toast.success(`Profil de ${client.prenom} chargé`);
  };

  const handleClearClient = () => {
    setSelectedClientId('');
    setAge('');
    setProblematique('');
    setContexte('');
    setObjectif('');
    setType('');
  };

  // Persist every generation failure so the admin can distinguish a SERVICE
  // problem (server/ssl) from a NETWORK problem (blocked) and gauge real
  // frequency. Fire-and-forget — never blocks the UI.
  const logGenError = (
    error_type: 'blocked' | 'server' | 'ssl' | 'connectivity',
    message: string
  ) => {
    try {
      db.from('generation_errors')
        .insert({
          user_id: user?.id ?? null,
          error_type,
          message: (message || '').slice(0, 500),
          domain: window.location.hostname,
        });
    } catch {
    }
  };

  // Persist the CURRENTLY-TYPED dossier as an auto-saved DRAFT (is_draft=true)
  // while we wait for the auto-retry. This guarantees the intervenant's input is
  // never lost — even if they close the tab before the relance fires. We upsert a
  // single draft row (tracked by autoDraftIdRef) so repeated waits don't pile up.
  const saveAutoDraft = async () => {
    if (!user) return;
    const titre = `Brouillon — ${(problematique || 'dossier').slice(0, 60)}`;
    const contenu = {
      _autosaved: true,
      age, problematique, contexte, objectif, type,
    };
    try {
      if (autoDraftIdRef.current) {
        await db.from('interventions')
          .update({ titre, contenu, problematique, type: type || 'Général', age: age ? parseInt(age) : null })
          .eq('id', autoDraftIdRef.current);
      } else {
        const { data: inserted } = await db.from('interventions')
          .insert({
            user_id: user.id,
            client_id: selectedClientId || null,
            titre,
            type: type || 'Général',
            age: age ? parseInt(age) : null,
            problematique,
            contenu,
            is_draft: true,
          });
        autoDraftIdRef.current = inserted?.[0]?.id ?? null;
        if (autoDraftIdRef.current) {
          await loadRecents(user.id);
          toast.info('Dossier enregistré en brouillon — rien ne sera perdu pendant la relance.');
        }
      }
    } catch {
    }
  };

  // Give up auto-retrying: hand the dossier to the background queue so the cron
  // worker keeps trying when the gateway is back and EMAILS the user the finished
  // tool. The auto-saved draft is preserved so nothing is lost. We surface a calm
  // "vous serez notifié par courriel" final state (handled in the error panel).
  const enqueueForBackground = async () => {
    setAutoRetryArmed(false);
    await saveAutoDraft();
    if (!user) return;
    try {
      await db.from('generation_queue').insert({
        user_id: user.id,
        client_id: selectedClientId || null,
        email: user.email,
        dossier: { age, problematique, contexte, objectif, type },
      });
      setQueued(true);
      toast.info('Génération mise en file d\'attente — vous recevrez un courriel dès que l\'outil sera prêt.');
    } catch {
    }
  };

  // Arm an automatic retry (simplified — just save the draft and retry after a short delay).
  const armAutoRetry = () => {
    if (autoRunningRef.current) return;
    if (autoAttemptsRef.current >= MAX_AUTO_RETRIES) {
      enqueueForBackground();
      return;
    }
    saveAutoDraft();
    setTimeout(() => {
      if (autoAttemptsRef.current < MAX_AUTO_RETRIES) {
        autoAttemptsRef.current += 1;
        autoRunningRef.current = true;
        handleGenerate(true).finally(() => {
          autoRunningRef.current = false;
        });
      }
    }, 2000);
  };



  const handleGenerate = async (isAuto = false) => {
    if (!age || !problematique) {
      toast.error('Veuillez renseigner au moins l\'âge et la problématique');
      return;
    }
    if (user && quotaReached) {
      toast.error(`Limite gratuite atteinte : ${FREE_MONTHLY_LIMIT} générations / mois`);
      onUpgrade?.();
      return;
    }
    if (!isAuto) {
      autoAttemptsRef.current = 0;
      setQueued(false);
    }
    setLoading(true);
    setResult(null);
    setGenError(null);
    setJustSaved(false);
    setEditMode(false);
    setLastSavedId(null);
    setWarming(false);

    try {
      const result = await generateIntervention({
        age,
        problematique,
        contexte,
        objectif,
        type,
      });

      if (!result.success || !result.intervention) {
        throw new Error(result.error || 'Échec de la génération');
      }

      setWarming(false);

      const intervention = result.intervention;

      if (user) {
        try {
          const { data: inserted } = await db.from('interventions')
            .insert({
              user_id: user.id,
              client_id: selectedClientId || null,
              titre: intervention.titre || 'Sans titre',
              type: type || 'Général',
              age: parseInt(age),
              problematique,
              contenu: intervention,
            });
          setLastSavedId(inserted?.[0]?.id ?? null);
          setJustSaved(true);
          if (autoDraftIdRef.current) {
            const draftId = autoDraftIdRef.current;
            autoDraftIdRef.current = null;
            db.from('interventions')
              .delete()
              .eq('id', draftId);
          }
          await loadRecents(user.id);
        } catch (saveErr: any) {
          console.warn('Sauvegarde locale échouée:', saveErr?.message);
          toast.warning('Outil généré, mais non sauvegardé dans l\'historique.');
        }
      }
      setResult(intervention);
    } catch (err: any) {
      const msg = err?.message || 'Impossible de générer';
      setGenError({ kind: 'server', message: msg });
      logGenError('server', msg);
      toast.error('Erreur : ' + msg);
    } finally {
      setWarming(false);
      setLoading(false);
    }
  };




  const useTemplate = (t: typeof TEMPLATES[0]) => {
    setAge(t.data.age);
    setProblematique(t.data.problematique);
    setObjectif(t.data.objectif);
    setType(t.data.type);
    setContexte(t.data.contexte);
    toast.success(`Modèle « ${t.label} » chargé`);
  };

  const loadRecent = (r: RecentTool) => {
    // Restore form context so badges/recap match the loaded tool
    if (r.age != null) setAge(String(r.age));
    setProblematique(r.problematique || '');
    setType(r.type || '');
    setResult(r.contenu);
    setLastSavedId(r.id);
    setJustSaved(true);
    setEditMode(false);
    setGenError(null);
    setSharedWith(r.shared_with || []);
    // Scroll the right panel into view on mobile
    setTimeout(() => {
      window.scrollBy({ top: 200, behavior: 'smooth' });
    }, 50);
  };

  // Save the currently-displayed result as a DRAFT (in-progress, not finalized)
  // so the intervenant can resume editing it later from the Brouillons tab.
  const handleSaveDraft = async () => {
    if (!result || !user) {
      toast.error('Connectez-vous pour enregistrer un brouillon');
      return;
    }
    setSavingDraft(true);
    try {
      if (lastSavedId) {
        // Demote the existing record to a draft (and persist current edits).
        const { error } = await supabase
          .from('interventions')
          .update({ is_draft: true, titre: result.titre || 'Sans titre', contenu: result })
          .eq('id', lastSavedId)
          .eq('user_id', user.id);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase
          .from('interventions')
          .insert({
            user_id: user.id,
            client_id: selectedClientId || null,
            titre: result.titre || 'Brouillon sans titre',
            type: type || 'Général',
            age: age ? parseInt(age) : null,
            problematique,
            contenu: result,
            is_draft: true,
          })
          .select('id')
          .single();
        if (error) throw error;
        setLastSavedId(inserted?.id ?? null);
      }
      setJustSaved(false);
      await loadRecents(user.id);
      toast.success('Brouillon enregistré — retrouvez-le dans l\'onglet Brouillons');
    } catch (err: any) {
      toast.error('Erreur brouillon : ' + (err?.message || 'inconnue'));
    } finally {
      setSavingDraft(false);
    }
  };

  // Build the read-only share URL for the current result.
  const buildShareUrl = (): string => {
    if (!result) return '';
    const payload = {
      titre: result.titre,
      duree: result.duree,
      type: type || null,
      age: age ? parseInt(age) : null,
      problematique: problematique || null,
      materiel: result.materiel,
      objectifs: result.objectifs,
      etapes: result.etapes,
      conseils_intervenant: result.conseils_intervenant,
      indicateurs_succes: result.indicateurs_succes,
    };
    const encoded = encodePayload(payload);
    const idPart = lastSavedId || 'apercu';
    return `${window.location.origin}/share/${idPart}#d=${encoded}`;
  };

  const formatRelativeDate = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'à l\'instant';
    if (diffMin < 60) return `il y a ${diffMin} min`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `il y a ${diffH} h`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `il y a ${diffD} j`;
    return d.toLocaleDateString('fr-CA');
  };

  // --- Edit mode helpers ---
  const updateResult = (patch: Partial<Intervention>) => {
    setResult((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const updateEtape = (idx: number, patch: Partial<Etape>) => {
    setResult((prev) => {
      if (!prev || !prev.etapes) return prev;
      const next = [...prev.etapes];
      next[idx] = { ...next[idx], ...patch };
      return { ...prev, etapes: next };
    });
  };

  const handleSaveEdits = async () => {
    if (!result) return;
    if (!user || !lastSavedId) {
      // No backing record (not signed in or never saved) — just exit edit mode locally.
      setEditMode(false);
      toast.success('Modifications appliquées localement');
      return;
    }
    setSavingEdits(true);
    try {
      await supabase
        .from('interventions')
        .update({
          titre: result.titre || 'Sans titre',
          contenu: result,
        })
        .eq('id', lastSavedId)
        .eq('user_id', user.id);
      await loadRecents(user.id);
      setEditMode(false);
      toast.success('Modifications enregistrées');
    } catch (err: any) {
      toast.error('Erreur enregistrement : ' + (err?.message || 'inconnue'));
    } finally {
      setSavingEdits(false);
    }
  };


  const handleDownloadTXT = () => {
    if (!result) return;
    const content = `${result.titre}\n\nDurée: ${result.duree}\n\nObjectifs:\n${(result.objectifs || []).map(o => '- ' + o).join('\n')}\n\nMatériel:\n${(result.materiel || []).map(m => '- ' + m).join('\n')}\n\nÉtapes:\n${(result.etapes || []).map(e => `${e.numero}. ${e.titre}\n   ${e.description}`).join('\n\n')}\n\nConseils:\n${(result.conseils_intervenant || []).map(c => '- ' + c).join('\n')}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.titre.replace(/\s+/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Téléchargement TXT lancé');
  };

  const handleCopy = async () => {
    if (!result) return;
    const content = `${result.titre}\n\n${result.duree ? `Durée: ${result.duree}\n\n` : ''}OBJECTIFS\n${(result.objectifs || []).map(o => '• ' + o).join('\n')}\n\nMATÉRIEL\n${(result.materiel || []).map(m => '• ' + m).join('\n')}\n\nDÉROULEMENT\n${(result.etapes || []).map(e => `${e.numero}. ${e.titre}\n   ${e.description}`).join('\n\n')}\n\nCONSEILS\n${(result.conseils_intervenant || []).map(c => '• ' + c).join('\n')}`;
    try {
      await navigator.clipboard.writeText(content);
      toast.success('Copié dans le presse-papiers');
    } catch {
      toast.error('Impossible de copier');
    }
  };

  const handleCopyLink = async () => {
    if (!result) return;
    const payload = {
      titre: result.titre,
      duree: result.duree,
      type: type || null,
      age: age ? parseInt(age) : null,
      problematique: problematique || null,
      materiel: result.materiel,
      objectifs: result.objectifs,
      etapes: result.etapes,
      conseils_intervenant: result.conseils_intervenant,
      indicateurs_succes: result.indicateurs_succes,
    };
    const encoded = encodePayload(payload);
    const idPart = lastSavedId || 'apercu';
    const url = `${window.location.origin}/share/${idPart}#d=${encoded}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Lien de partage copié — lecture seule');
    } catch {
      toast.error('Impossible de copier le lien');
    }
  };

  const handleDownloadPDF = () => {
    if (!result) return;
    try {
      exportInterventionToPDF(
        {
          titre: result.titre,
          duree: result.duree,
          problematique,
          type,
          age,
          materiel: result.materiel,
          objectifs: result.objectifs,
          etapes: result.etapes,
          conseils_intervenant: result.conseils_intervenant,
          adaptations: result.adaptations,
          indicateurs_succes: result.indicateurs_succes,
        },
        { clientName: selectedClient?.prenom }
      );
      toast.success('PDF téléchargé');
    } catch (err: any) {
      toast.error('Erreur PDF : ' + (err?.message || 'Impossible de générer le PDF'));
    }
  };

  const selectedClient = clients.find(c => c.id === selectedClientId);

  return (
    <section className="bg-gradient-to-b from-indigo-50/30 via-white to-white py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-200/70 bg-white px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-indigo-700 shadow-sm">
            <Stethoscope className="h-3.5 w-3.5" />
            Assistant clinique
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
            Décrivez la situation,
            <span className="block bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              recevez un outil prêt à l'usage.
            </span>
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">
            Renseignez le profil clinique. IntervenIA structure un outil adapté à la situation,
            en moins de 60 secondes.
          </p>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-5">
          {/* Clinical dossier — LEFT */}
          <div className="lg:col-span-2">
            <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xl shadow-indigo-500/5">
              {/* Dossier header */}
              <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 shadow-md shadow-indigo-500/30">
                    <User className="h-4 w-4 text-white" strokeWidth={2.25} />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-600">Dossier</p>
                    <h3 className="text-sm font-bold text-slate-900">Profil d'intervention</h3>
                  </div>
                </div>
                <div className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 sm:flex">
                  <ShieldCheck className="h-3 w-3" /> Confidentiel
                </div>
              </div>

              <div className="p-5 sm:p-6">
                {/* Existing client picker */}
                {clients.length > 0 && (
                  <div className="mb-5 rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50/60 to-violet-50/30 p-3">
                    <Label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-700">
                      <User className="h-3 w-3" />
                      Reprendre un client existant
                    </Label>
                    <div className="mt-2 flex gap-2">
                      <select
                        value={selectedClientId}
                        onChange={(e) => handleSelectClient(e.target.value)}
                        className="flex-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="">— Saisie libre —</option>
                        {clients.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.prenom} ({c.age} ans)
                          </option>
                        ))}
                      </select>
                      {selectedClientId && (
                        <button
                          onClick={handleClearClient}
                          title="Effacer la sélection"
                          className="rounded-md border border-slate-200 bg-white p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    {selectedClient && (
                      <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-indigo-700">
                        <CheckCircle2 className="h-3 w-3" />
                        Lié au profil de <strong className="font-semibold">{selectedClient.prenom}</strong>
                      </p>
                    )}
                  </div>
                )}

                {/* Clinical fields */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="age" className="text-xs font-semibold text-slate-700">
                        Âge <span className="text-rose-500">*</span>
                      </Label>
                      <Input
                        id="age"
                        type="number"
                        placeholder="ex: 12"
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-slate-700">Niveau</Label>
                      <div className="mt-1.5 flex h-10 items-center rounded-md border border-slate-200 bg-slate-50/60 px-3 text-sm text-slate-600">
                        {niveau || <span className="text-slate-400">Auto</span>}
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="problematique" className="text-xs font-semibold text-slate-700">
                      Difficulté principale <span className="text-rose-500">*</span>
                    </Label>
                    <Input
                      id="problematique"
                      placeholder="ex: Gestion émotionnelle"
                      value={problematique}
                      onChange={(e) => setProblematique(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>

                  <div>
                    <Label htmlFor="objectif" className="text-xs font-semibold text-slate-700">
                      Objectif clinique
                    </Label>
                    <Input
                      id="objectif"
                      placeholder="ex: Réduire l'impulsivité en classe"
                      value={objectif}
                      onChange={(e) => setObjectif(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>

                  <div>
                    <Label htmlFor="type" className="text-xs font-semibold text-slate-700">
                      Type d'outil souhaité
                    </Label>
                    <Input
                      id="type"
                      placeholder="TCC, jeu, plan, exposition…"
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>

                  <div>
                    <Label htmlFor="contexte" className="text-xs font-semibold text-slate-700">
                      Contexte (optionnel)
                    </Label>
                    <Textarea
                      id="contexte"
                      placeholder="ex: Famille recomposée, déménagement récent…"
                      value={contexte}
                      onChange={(e) => setContexte(e.target.value)}
                      className="mt-1.5 min-h-[72px] resize-none"
                    />
                  </div>

                  <Button
                    onClick={() => handleGenerate()}
                    disabled={loading || serviceDown}
                    title={serviceDown ? 'Le service de génération démarre — la génération se réactivera automatiquement dès qu\'il sera prêt.' : undefined}
                    className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 shadow-lg shadow-indigo-500/30 hover:from-indigo-700 hover:to-violet-700"
                    size="lg"
                  >
                    {loading ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Génération en cours…</>
                    ) : serviceDown ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Service en démarrage…</>
                    ) : (
                      <><Sparkles className="mr-2 h-4 w-4" /> Générer l'outil</>
                    )}
                  </Button>
                  {serviceDown && (
                    <p className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-700">
                      <ShieldAlert className="h-3.5 w-3.5" />
                      Le service de génération démarre. Le bouton se réactivera tout seul dès qu'il sera prêt.
                    </p>
                  )}

                  {user && isPro && (
                    <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-700">
                      <Sparkles className="h-3.5 w-3.5" />
                      Générations illimitées · plan {' '}
                      <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-white">Pro</span>
                    </div>
                  )}
                  {user && !isPro && (
                    <div className={`flex items-center justify-between rounded-lg px-3 py-2 text-[11px] font-medium ${quotaReached ? 'bg-rose-50 text-rose-700' : 'bg-slate-50 text-slate-600'}`}>
                      <span className="flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5" />
                        {Math.min(monthlyCount, FREE_MONTHLY_LIMIT)} / {FREE_MONTHLY_LIMIT} générations ce mois (gratuit)
                      </span>
                      {quotaReached && onUpgrade && (
                        <button onClick={onUpgrade} className="inline-flex items-center gap-0.5 font-semibold text-indigo-600 hover:underline">
                          Passer Pro <ArrowUpRight className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  )}
                  {user && !isPro && quotaReached && (
                    <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-violet-50 p-3.5">
                      <p className="text-[12px] font-semibold text-indigo-900">Limite gratuite atteinte</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-indigo-800">
                        Vous avez utilisé vos {FREE_MONTHLY_LIMIT} générations du mois. Passez au plan Pro
                        pour des générations illimitées.
                      </p>
                      {onUpgrade && (
                        <Button size="sm" onClick={onUpgrade} className="mt-2.5 w-full bg-gradient-to-r from-indigo-600 to-violet-600">
                          Voir les forfaits
                        </Button>
                      )}
                    </div>
                  )}
                </div>


                {/* Templates wow */}
                <div className="mt-6 border-t border-slate-100 pt-5">
                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Cas cliniques modèles
                  </p>
                  <div className="space-y-2">
                    {TEMPLATES.map((t, i) => {
                      const Icon = t.icon;
                      return (
                        <button
                          key={i}
                          onClick={() => useTemplate(t)}
                          className="group flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-2.5 text-left transition-all hover:border-indigo-300 hover:shadow-md hover:shadow-indigo-500/10"
                        >
                          <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${t.accent} text-white shadow-sm`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-900">{t.label}</p>
                            <p className="truncate text-[11px] text-slate-500">{t.data.problematique}</p>
                          </div>
                          <Hash className="h-3.5 w-3.5 flex-shrink-0 text-slate-300 group-hover:text-indigo-500" />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Générations récentes — quick access + full-text search */}
                {recents.length > 0 && (
                  <div className="mt-6 border-t border-slate-100 pt-5">
                    <p className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      <History className="h-3 w-3" />
                      Générations récentes
                    </p>
                    {/* Full-text search box (title / problématique / type) */}
                    <div className="relative mb-3">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                      <Input
                        value={recentSearch}
                        onChange={(e) => setRecentSearch(e.target.value)}
                        placeholder="Rechercher (titre, problématique, type)…"
                        className="h-9 pl-8 pr-8 text-[12px]"
                      />
                      {recentSearch && (
                        <button
                          onClick={() => setRecentSearch('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-700"
                          title="Effacer la recherche"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    {(() => {
                      const isSearching = recentSearch.trim().length > 0;
                      const list = isSearching ? searchResults : recents;
                      if (isSearching && searchingRecents) {
                        return (
                          <p className="flex items-center gap-1.5 px-1 py-2 text-[11px] text-slate-400">
                            <Loader2 className="h-3 w-3 animate-spin" /> Recherche…
                          </p>
                        );
                      }
                      if (isSearching && list.length === 0) {
                        return (
                          <p className="px-1 py-2 text-[11px] text-slate-400">
                            Aucun outil ne correspond à « {recentSearch.trim()} ».
                          </p>
                        );
                      }
                      return (
                        <div className="space-y-1.5">
                          {list.map((r) => (
                            <button
                              key={r.id}
                              onClick={() => loadRecent(r)}
                              className="group flex w-full items-start gap-2.5 rounded-lg border border-transparent bg-slate-50/60 p-2.5 text-left transition-all hover:border-indigo-200 hover:bg-white hover:shadow-sm"
                            >
                              <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-indigo-100 to-violet-100 text-indigo-600">
                                <FileText className="h-3 w-3" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="line-clamp-1 text-[12px] font-semibold text-slate-900 group-hover:text-indigo-700">
                                  {r.titre}
                                </p>
                                <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-500">
                                  <span>{formatRelativeDate(r.created_at)}</span>
                                  {r.age != null && <><span>·</span><span>{r.age} ans</span></>}
                                  {r.type && <><span>·</span><span className="truncate">{r.type}</span></>}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}

              </div>
            </div>
          </div>

          {/* Result — RIGHT */}
          <div className="lg:col-span-3">
            <div className="min-h-[560px] rounded-2xl border border-slate-200/80 bg-white p-6 shadow-xl shadow-indigo-500/5 lg:p-8">
              {genError && !loading && (
                <div className="flex h-full min-h-[480px] flex-col items-center justify-center px-2 text-center">
                  <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${genError.kind === 'blocked' ? 'bg-amber-100' : 'bg-rose-100'}`}>
                    <ShieldAlert className={`h-8 w-8 ${genError.kind === 'blocked' ? 'text-amber-600' : 'text-rose-600'}`} />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-slate-900">
                    {genError.kind === 'blocked'
                      ? (genError.blockedOn === 'ssl'
                          ? 'Connexion sécurisée requise'
                          : 'Connexion au service impossible')
                      : 'La génération a échoué'}
                  </h3>

                  {genError.kind === 'blocked' && genError.blockedOn === 'ssl' ? (
                    <div className="mt-3 max-w-md space-y-3 text-sm leading-relaxed text-slate-600">
                      <p>
                        Vous utilisez le domaine personnalisé{' '}
                        <strong className="font-semibold text-slate-800">{window.location.hostname}</strong>,
                        dont le certificat SSL n'est pas encore valide — votre navigateur a donc
                        bloqué la requête avant qu'elle n'atteigne nos serveurs.
                      </p>
                      <p className="font-medium text-amber-800">
                        Aucune opération n'a été facturée — la demande n'a jamais été envoyée.
                      </p>
                      <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-left">
                        <p className="text-[12px] font-semibold text-amber-900">Que faire&nbsp;:</p>
                        <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-[12px] text-amber-900">
                          <li>Ouvrez l'application via l'<strong>URL officielle sécurisée</strong> (bouton ci-dessous) plutôt que le domaine personnalisé.</li>
                          <li>Vérifiez le cadenas <span className="font-semibold">https</span> dans la barre d'adresse.</li>
                          <li>Désactivez temporairement les extensions de blocage, puis réessayez.</li>
                        </ol>
                      </div>
                    </div>
                  ) : genError.kind === 'blocked' ? (
                    <div className="mt-3 max-w-md space-y-3 text-sm leading-relaxed text-slate-600">
                      <p>
                        Le service n'a pas pu être joint depuis votre appareil. Le serveur est
                        pourtant sécurisé&nbsp;: il s'agit presque toujours d'un problème
                        <strong className="font-semibold text-slate-800"> local</strong> —
                        connexion Internet coupée, VPN, pare-feu d'entreprise ou extension de
                        navigateur qui bloque la requête.
                      </p>
                      <p className="font-medium text-emerald-700">
                        Aucune opération n'a été facturée — la demande n'a jamais abouti.
                      </p>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-left">
                        <p className="text-[12px] font-semibold text-slate-700">Que faire&nbsp;:</p>
                        <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-[12px] text-slate-700">
                          <li>Vérifiez votre connexion Internet, puis réessayez.</li>
                          <li>Désactivez VPN / pare-feu / extensions de blocage le temps d'un test.</li>
                          <li>Si le problème persiste, réessayez dans quelques instants.</li>
                        </ol>
                      </div>
                    </div>
                  ) : genError.message.toLowerCase().includes('initialisation') ? (
                    <div className="mt-3 max-w-md space-y-2 text-sm leading-relaxed text-slate-600">
                      <p>
                        Le service de génération vient d'être réveillé et n'était pas encore tout à
                        fait prêt. Nous avons déjà réessayé automatiquement plusieurs fois pendant son
                        préchauffage.
                      </p>
                      <p className="font-medium text-emerald-700">
                        Aucune opération n'a été facturée — la requête n'a jamais atteint le modèle.
                      </p>
                      <p>
                        Patientez ~15&nbsp;secondes, puis cliquez sur <strong>Réessayer</strong>&nbsp;:
                        le service devrait maintenant être chaud.
                      </p>
                    </div>
                  ) : (
                    <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-600">
                      Une erreur est survenue côté service. Vous pouvez réessayer&nbsp;; aucune
                      nouvelle requête n'est lancée automatiquement.
                    </p>
                  )}


                  {/* Automatic one-shot retry banner: while armed, a watcher is
                      polling health-check and will re-run the generation by itself
                      the moment the service reports 'ready' — no re-click needed. */}
                  {genError.kind === 'server' && autoRetryArmed && (
                    <div className="mt-4 flex max-w-md items-center gap-2.5 rounded-xl border border-indigo-200 bg-indigo-50/70 px-4 py-3 text-left">
                      <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-indigo-600" />
                      <p className="text-[12px] leading-relaxed text-indigo-900">
                        <strong className="font-semibold">Relance automatique en cours.</strong>{' '}
                        Dès que le service répond « prêt », nous régénérons l'outil avec votre dossier —
                        vous n'avez rien à recliquer.
                      </p>
                    </div>
                  )}

                  {/* Final state after MAX_AUTO_RETRIES: we stopped the loop and
                      queued the dossier for background processing. The user will
                      get an email when ready and can also retry manually. */}
                  {queued && !autoRetryArmed && (
                    <div className="mt-4 flex max-w-md items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
                      <p className="text-[12px] leading-relaxed text-emerald-900">
                        <strong className="font-semibold">Mis en file d'attente.</strong>{' '}
                        Le moteur IA est indisponible pour l'instant. Nous avons arrêté les relances
                        automatiques pour ne pas vous faire patienter en boucle&nbsp;: dès que le service
                        revient, nous générons l'outil et vous l'<strong>envoyons par courriel</strong>.
                        Votre dossier est conservé en brouillon — vous pouvez aussi réessayer manuellement.
                      </p>
                    </div>
                  )}

                  <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                    {genError.kind === 'blocked' && genError.blockedOn === 'ssl' && (
                      <a
                        href={buildSecureTarget()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-white px-3.5 py-2 text-sm font-semibold text-amber-800 shadow-sm hover:bg-amber-50"
                      >
                        <ExternalLink className="h-4 w-4" /> Ouvrir l'URL sécurisée
                      </a>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setGenError(null)}>
                      Fermer
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleGenerate()}
                      className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700"
                    >
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                      {autoRetryArmed ? 'Réessayer maintenant' : 'Réessayer manuellement'}
                    </Button>
                  </div>
                  {genError.message && (
                    <p className="mt-3 max-w-md text-[11px] italic text-slate-400 break-all">
                      Détail technique&nbsp;: {genError.message}
                    </p>
                  )}
                </div>
              )}


              {!result && !loading && !genError && (
                <div className="flex h-full min-h-[480px] flex-col items-center justify-center text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100">
                    <Sparkles className="h-8 w-8 text-indigo-600" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-slate-900">
                    Votre outil apparaîtra ici
                  </h3>
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-600">
                    Renseignez le profil à gauche — l'assistant clinique générera un outil structuré,
                    nuancé et prêt à utiliser.
                  </p>
                </div>
              )}

              {loading && (
                <div className="flex h-full min-h-[480px] flex-col items-center justify-center text-center">
                  <Loader2 className="h-12 w-12 animate-spin text-indigo-600" />
                  {warming ? (
                    <>
                      <p className="mt-4 font-medium text-slate-900">Démarrage du service clinique…</p>
                      <p className="mt-1 max-w-xs text-sm text-slate-500">
                        Le service se réveille (préchauffage). Nouvelle tentative automatique en cours —
                        aucune opération n'est facturée tant qu'il n'est pas prêt.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="mt-4 font-medium text-slate-900">L'assistant clinique réfléchit…</p>
                      <p className="mt-1 text-sm text-slate-500">Mise en forme de l'outil en cours</p>
                    </>
                  )}
                </div>
              )}


              {result && (
                <div className="space-y-6">
                  {/* Title + actions */}
                  <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1 min-w-0">
                      {editMode ? (
                        <Input
                          value={result.titre}
                          onChange={(e) => updateResult({ titre: e.target.value })}
                          className="text-xl font-bold !h-auto !py-2"
                          placeholder="Titre de l'outil"
                        />
                      ) : (
                        <h3 className="text-2xl font-bold leading-tight text-slate-900">{result.titre}</h3>
                      )}
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        {result.duree && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700">
                            <Clock className="h-3 w-3" />
                            {result.duree}
                          </span>
                        )}
                        {type && (
                          <span className="rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700">
                            {type}
                          </span>
                        )}
                        {niveau && (
                          <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
                            {niveau}
                          </span>
                        )}
                        {selectedClient && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                            <User className="h-3 w-3" />
                            {selectedClient.prenom}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {justSaved && user && !editMode && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700"
                          title="Sauvegardé dans Mes Outils"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          Sauvegardé
                        </span>
                      )}

                      {editMode ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditMode(false)}
                            title="Annuler les modifications"
                          >
                            Annuler
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleSaveEdits}
                            disabled={savingEdits}
                            className="bg-gradient-to-r from-emerald-600 to-emerald-500 shadow-md shadow-emerald-500/30 hover:from-emerald-700 hover:to-emerald-600"
                            title="Enregistrer les modifications"
                          >
                            {savingEdits ? (
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Save className="mr-1.5 h-3.5 w-3.5" />
                            )}
                            Enregistrer
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditMode(true)}
                            title="Modifier l'outil"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={handleCopy} title="Copier le contenu">
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={handleCopyLink} title="Copier le lien de partage (lecture seule)">
                            <Link2 className="mr-1.5 h-3.5 w-3.5" /> Lien
                          </Button>
                          {user && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleSaveDraft}
                              disabled={savingDraft}
                              title="Enregistrer comme brouillon (à finaliser plus tard)"
                            >
                              {savingDraft ? (
                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <FilePlus2 className="mr-1.5 h-3.5 w-3.5" />
                              )}
                              Brouillon
                            </Button>
                          )}
                          {user && isPro && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setShareOpen(true)}
                              title="Partager avec un collègue (Pro)"
                              className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                            >
                              <Share2 className="mr-1.5 h-3.5 w-3.5" />
                              Partager{sharedWith.length > 0 ? ` (${sharedWith.length})` : ''}
                            </Button>
                          )}

                          <Button size="sm" variant="outline" onClick={() => handleGenerate()} title="Régénérer">
                            <RefreshCw className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={handleDownloadTXT} title="Télécharger en TXT">
                            <Download className="mr-1.5 h-3.5 w-3.5" /> TXT
                          </Button>
                          <Button
                            size="sm"
                            onClick={handleDownloadPDF}
                            className="bg-gradient-to-r from-indigo-600 to-violet-600 shadow-md shadow-indigo-500/30 hover:from-indigo-700 hover:to-violet-700"
                            title="Télécharger en PDF stylisé"
                          >
                            <FileDown className="mr-1.5 h-3.5 w-3.5" /> PDF
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Edit mode hint banner */}
                  {editMode && (
                    <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5">
                      <Pencil className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-700" />
                      <div className="text-[12px] leading-relaxed text-amber-900">
                        <strong className="font-semibold">Mode édition.</strong>{' '}
                        Ajustez le titre, les objectifs, les étapes et les conseils. Une ligne = un item dans les listes.
                        Vos modifications seront enregistrées dans votre historique.
                      </div>
                    </div>
                  )}

                  {/* Problématique recap */}
                  {problematique && !editMode && (
                    <div className="rounded-xl bg-slate-50/80 p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        Problématique ciblée
                      </p>
                      <p className="mt-1 text-sm font-medium text-slate-800">{problematique}</p>
                    </div>
                  )}

                  {result.raw && !editMode && (
                    <div className="rounded-lg bg-slate-50 p-4 text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
                      {result.raw}
                    </div>
                  )}

                  {/* Objectifs */}
                  {(editMode || (result.objectifs && result.objectifs.length > 0)) && (
                    <SectionBlock icon={Target} title="Objectifs cliniques">
                      {editMode ? (
                        <Textarea
                          value={listToLines(result.objectifs)}
                          onChange={(e) => updateResult({ objectifs: linesToList(e.target.value) })}
                          placeholder="Un objectif par ligne"
                          className="min-h-[96px] text-sm"
                        />
                      ) : (
                        <ul className="space-y-2">
                          {result.objectifs!.map((o, i) => (
                            <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-slate-700">
                              <span className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-indigo-500" />
                              {o}
                            </li>
                          ))}
                        </ul>
                      )}
                    </SectionBlock>
                  )}

                  {/* Matériel */}
                  {(editMode || (result.materiel && result.materiel.length > 0)) && (
                    <SectionBlock icon={FileText} title="Matériel requis">
                      {editMode ? (
                        <Textarea
                          value={listToLines(result.materiel)}
                          onChange={(e) => updateResult({ materiel: linesToList(e.target.value) })}
                          placeholder="Un élément par ligne"
                          className="min-h-[72px] text-sm"
                        />
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {result.materiel!.map((m, i) => (
                            <span key={i} className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700">
                              {m}
                            </span>
                          ))}
                        </div>
                      )}
                    </SectionBlock>
                  )}

                  {/* Déroulement */}
                  {result.etapes && result.etapes.length > 0 && (
                    <SectionBlock icon={Activity} title="Déroulement">
                      <div className="space-y-2.5">
                        {result.etapes.map((e, idx) => (
                          <div key={e.numero} className="flex gap-3 rounded-xl border border-slate-100 bg-gradient-to-br from-slate-50/80 to-white p-3.5">
                            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-xs font-bold text-white shadow-sm">
                              {e.numero}
                            </div>
                            <div className="flex-1 min-w-0">
                              {editMode ? (
                                <div className="space-y-2">
                                  <Input
                                    value={e.titre}
                                    onChange={(ev) => updateEtape(idx, { titre: ev.target.value })}
                                    placeholder="Titre de l'étape"
                                    className="font-semibold"
                                  />
                                  <Textarea
                                    value={e.description}
                                    onChange={(ev) => updateEtape(idx, { description: ev.target.value })}
                                    placeholder="Description de l'étape"
                                    className="min-h-[72px] text-sm"
                                  />
                                </div>
                              ) : (
                                <>
                                  <p className="font-semibold text-slate-900">{e.titre}</p>
                                  <p className="mt-1 text-sm leading-relaxed text-slate-600">{e.description}</p>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </SectionBlock>
                  )}

                  {/* Conseils */}
                  {(editMode || (result.conseils_intervenant && result.conseils_intervenant.length > 0)) && (
                    <div className="rounded-xl border border-amber-200/70 bg-gradient-to-br from-amber-50/80 to-amber-50/40 p-4">
                      <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-amber-900">
                        <Lightbulb className="h-3.5 w-3.5" /> Conseils pour l'intervenant
                      </h4>
                      {editMode ? (
                        <Textarea
                          value={listToLines(result.conseils_intervenant)}
                          onChange={(ev) => updateResult({ conseils_intervenant: linesToList(ev.target.value) })}
                          placeholder="Un conseil par ligne"
                          className="mt-2.5 min-h-[96px] bg-white text-sm"
                        />
                      ) : (
                        <ul className="mt-2.5 space-y-1.5">
                          {result.conseils_intervenant!.map((c, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-amber-900">
                              <span className="mt-[7px] h-1 w-1 flex-shrink-0 rounded-full bg-amber-600" />
                              {c}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {/* Indicateurs */}
                  {(editMode || (result.indicateurs_succes && result.indicateurs_succes.length > 0)) && (
                    <SectionBlock icon={CheckCircle2} title="Indicateurs de succès" iconColor="text-emerald-600">
                      {editMode ? (
                        <Textarea
                          value={listToLines(result.indicateurs_succes)}
                          onChange={(ev) => updateResult({ indicateurs_succes: linesToList(ev.target.value) })}
                          placeholder="Un indicateur par ligne"
                          className="min-h-[72px] text-sm"
                        />
                      ) : (
                        <ul className="space-y-1.5">
                          {result.indicateurs_succes!.map((ind, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-slate-700">
                              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
                              {ind}
                            </li>
                          ))}
                        </ul>
                      )}
                    </SectionBlock>
                  )}

                  {/* Clinical disclaimer */}
                  <div className="mt-2 flex gap-2.5 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
                    <ShieldCheck className="h-4 w-4 flex-shrink-0 text-slate-500" />
                    <p className="text-[11px] leading-relaxed text-slate-600">
                      <strong className="font-semibold text-slate-700">Soutien clinique professionnel.</strong>{' '}
                      Cet outil est généré à titre de soutien à votre pratique et doit être adapté au jugement
                      clinique de l'intervenant. Il ne remplace ni l'évaluation, ni la supervision professionnelle.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {shareOpen && result && (
        <ShareInterventionModal
          interventionId={lastSavedId}
          shareUrl={buildShareUrl()}
          title={result.titre}
          alreadyShared={sharedWith}
          onClose={() => setShareOpen(false)}
          onShared={(emails) => setSharedWith(emails)}
        />
      )}
    </section>
  );
};

// Small section block with consistent header + breathing room
const SectionBlock: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  iconColor?: string;
  children: React.ReactNode;
}> = ({ icon: Icon, title, iconColor = 'text-indigo-600', children }) => (
  <div>
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

export default InterventionGenerator;
