import React, { useEffect, useState } from 'react';
import { Users, Plus, Mail, Shield, User as UserIcon, Trash2, Loader2, Crown, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { usePlan } from '@/contexts/PlanContext';
import { toast } from 'sonner';

interface WorkspacePanelProps {
  onUpgrade?: () => void;
}

interface Member {
  id: string;
  email: string;
  role: string;
  status: string;
  user_id: string | null;
  created_at: string;
}

const MAX_MEMBERS = 5;

const WorkspacePanel: React.FC<WorkspacePanelProps> = ({ onUpgrade }) => {
  const { user } = useAuth();
  const { plan } = usePlan();
  const [workspace, setWorkspace] = useState<any>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [wsName, setWsName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');

  const isEquipe = plan === 'equipe';

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: ws } = await supabase
      .from('workspaces')
      .select('*')
      .eq('owner_id', user.id)
      .maybeSingle();
    setWorkspace(ws);
    if (ws) {
      const { data: m } = await supabase
        .from('workspace_members')
        .select('*')
        .eq('workspace_id', ws.id)
        .order('created_at', { ascending: true });
      setMembers((m || []) as Member[]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [user, plan]);

  const createWorkspace = async () => {
    if (!user || !wsName.trim()) { toast.error('Nom requis'); return; }
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from('workspaces')
        .insert({ name: wsName.trim(), owner_id: user.id })
        .select().single();
      if (error) throw error;
      // add owner as admin member
      await supabase.from('workspace_members').insert({
        workspace_id: data.id, user_id: user.id, email: user.email,
        role: 'admin', status: 'active',
      });
      toast.success('Espace d\'équipe créé');
      setWsName('');
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const invite = async () => {
    if (!workspace) return;
    const email = inviteEmail.trim().toLowerCase();
    if (!email || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) { toast.error('Courriel invalide'); return; }
    if (members.length >= MAX_MEMBERS) { toast.error(`Maximum ${MAX_MEMBERS} membres`); return; }
    if (members.some(m => m.email.toLowerCase() === email)) { toast.error('Déjà invité'); return; }
    setBusy(true);
    try {
      const { error } = await supabase.from('workspace_members').insert({
        workspace_id: workspace.id, email, role: 'member', status: 'pending',
      });
      if (error) throw error;
      // register invite email in CRM
      fetch('https://famous.ai/api/crm/6a1250619fe351fa51c4d4cd/subscribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'team-invite', tags: ['equipe-invite'] }),
      }).catch(() => {});
      toast.success(`Invitation envoyée à ${email}`);
      setInviteEmail('');
      load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const toggleRole = async (m: Member) => {
    if (m.user_id === user?.id) return; // can't change own owner role
    const newRole = m.role === 'admin' ? 'member' : 'admin';
    await supabase.from('workspace_members').update({ role: newRole }).eq('id', m.id);
    toast.success(`Rôle: ${newRole === 'admin' ? 'Administrateur (lecture/écriture)' : 'Membre (lecture)'}`);
    load();
  };

  const removeMember = async (m: Member) => {
    if (m.user_id === user?.id) return;
    if (!confirm(`Retirer ${m.email} de l'équipe ?`)) return;
    await supabase.from('workspace_members').delete().eq('id', m.id);
    toast.success('Membre retiré');
    load();
  };

  return (
    <section className="bg-gradient-to-b from-slate-50 to-white py-20 sm:py-24">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <p className="text-sm font-semibold uppercase tracking-wider text-indigo-600">Plan Équipe</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Espace d'équipe partagé
        </h2>
        <p className="mt-2 text-slate-600">
          Invitez jusqu'à {MAX_MEMBERS} intervenants et partagez profils clients et outils générés.
        </p>

        {!isEquipe ? (
          <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50/50 p-8 text-center">
            <Lock className="mx-auto h-10 w-10 text-amber-500" />
            <h3 className="mt-3 text-lg font-semibold text-slate-900">Réservé au plan Équipe</h3>
            <p className="mt-1 text-sm text-slate-600">
              Passez au plan Équipe pour créer un espace de travail collaboratif.
            </p>
            <Button onClick={onUpgrade} className="mt-5 bg-gradient-to-r from-indigo-600 to-violet-600">
              Voir les tarifs
            </Button>
          </div>
        ) : loading ? (
          <div className="mt-10 flex items-center gap-2 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Chargement...
          </div>
        ) : !workspace ? (
          <div className="mt-8 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-6">
            <h3 className="text-lg font-semibold text-slate-900">Créer votre espace d'équipe</h3>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <Input value={wsName} onChange={(e) => setWsName(e.target.value)} placeholder="ex: Clinique du Plateau" />
              <Button onClick={createWorkspace} disabled={busy} className="bg-gradient-to-r from-indigo-600 to-violet-600">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="mr-1.5 h-4 w-4" /> Créer</>}
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            {/* Workspace header */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-100 to-violet-100">
                  <Users className="h-6 w-6 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{workspace.name}</h3>
                  <p className="text-sm text-slate-500">{members.length}/{MAX_MEMBERS} membres</p>
                </div>
              </div>
            </div>

            {/* Invite */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Inviter un intervenant</h3>
              <p className="mt-1 text-sm text-slate-500">Par courriel — rôle « membre » (lecture) par défaut.</p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <Input
                  type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="collegue@clinique.ca"
                  disabled={members.length >= MAX_MEMBERS}
                />
                <Button onClick={invite} disabled={busy || members.length >= MAX_MEMBERS}
                  className="bg-gradient-to-r from-indigo-600 to-violet-600">
                  <Mail className="mr-1.5 h-4 w-4" /> Inviter
                </Button>
              </div>
              {members.length >= MAX_MEMBERS && (
                <p className="mt-2 text-xs text-amber-600">Limite de {MAX_MEMBERS} membres atteinte.</p>
              )}
            </div>

            {/* Members list */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-semibold text-slate-900">Membres &amp; permissions</h3>
              <div className="space-y-2">
                {members.map((m) => {
                  const isOwner = m.user_id === workspace.owner_id;
                  return (
                    <div key={m.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 text-sm font-semibold text-indigo-700">
                          {m.email[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{m.email}</p>
                          <span className={`text-xs ${m.status === 'pending' ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {m.status === 'pending' ? 'Invitation en attente' : 'Actif'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleRole(m)}
                          disabled={isOwner}
                          title={isOwner ? 'Propriétaire' : 'Changer le rôle'}
                          className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium ${
                            isOwner ? 'bg-violet-100 text-violet-700'
                            : m.role === 'admin' ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                            : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                          }`}
                        >
                          {isOwner ? <Crown className="h-3.5 w-3.5" /> : m.role === 'admin' ? <Shield className="h-3.5 w-3.5" /> : <UserIcon className="h-3.5 w-3.5" />}
                          {isOwner ? 'Propriétaire' : m.role === 'admin' ? 'Admin' : 'Membre'}
                        </button>
                        {!isOwner && (
                          <button onClick={() => removeMember(m)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 rounded-lg bg-indigo-50 p-3 text-xs text-indigo-700">
                <strong>Admin</strong> : lecture &amp; écriture sur les profils clients et outils partagés.
                <strong className="ml-2">Membre</strong> : lecture seule.
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default WorkspacePanel;
