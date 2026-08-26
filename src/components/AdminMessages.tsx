import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Mail, RefreshCw, Inbox, CheckCheck, Lock, FileText, Reply, Send, CheckCircle2, AlertTriangle, Activity, Search, RotateCw, Share2, ServerCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import BlogManager from '@/components/BlogManager';
import SocialLinksManager from '@/components/SocialLinksManager';
import AdminGenerationErrors from '@/components/AdminGenerationErrors';
import AdminGatewayLogs from '@/components/AdminGatewayLogs';

interface Message {
  id: string;
  name: string;
  email: string;
  message: string;
  is_read: boolean;
  created_at: string;
  reply_body?: string | null;
  replied_at?: string | null;
}

interface EmailLog {
  id: string;
  type: string;
  recipient: string;
  subject: string | null;
  status: string;
  error: string | null;
  created_at: string;
  message_id?: string | null;
}

const ADMIN_PASSWORD = 'intervenia2026';

const AdminMessages: React.FC = () => {
  const [authed, setAuthed] = useState(false);
  const [pwd, setPwd] = useState('');
  const [tab, setTab] = useState<'messages' | 'blog' | 'logs' | 'social' | 'errors' | 'gateway'>('messages');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [replyingId, setReplyingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  // Tracks reply send failures per message, so admin can retry.
  const [replyError, setReplyError] = useState<{ id: string; error: string } | null>(null);
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);


  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('contact_messages')
      .select('*')
      .order('created_at', { ascending: false });
    setMessages((data as Message[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (authed) load();
  }, [authed]);

  const markRead = async (id: string) => {
    await supabase.from('contact_messages').update({ is_read: true }).eq('id', id);
    setMessages((m) => m.map((x) => (x.id === id ? { ...x, is_read: true } : x)));
  };

  const openReply = (m: Message) => {
    setReplyingId(m.id);
    setReplyText(m.reply_body || '');
  };

  const loadLogs = async () => {
    setLogsLoading(true);
    const { data } = await supabase
      .from('email_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    setLogs((data as EmailLog[]) || []);
    setLogsLoading(false);
  };

  useEffect(() => {
    if (authed && tab === 'logs') loadLogs();
  }, [authed, tab]);

  // --- Filters for the email log ---
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'confirmation' | 'reply'>('all');
  const [logSearch, setLogSearch] = useState('');
  const [resendingAll, setResendingAll] = useState(false);

  const filteredLogs = logs.filter((l) => {
    const ok = l.status === 'success';
    if (statusFilter === 'success' && !ok) return false;
    if (statusFilter === 'failed' && ok) return false;
    if (typeFilter !== 'all') {
      const t = l.type === 'reply' ? 'reply' : 'confirmation';
      if (t !== typeFilter) return false;
    }
    if (logSearch.trim() && !l.recipient.toLowerCase().includes(logSearch.trim().toLowerCase())) {
      return false;
    }
    return true;
  });

  // Re-invoke send-contact-email for a single failed log entry.
  const retryLog = async (l: EmailLog): Promise<boolean> => {
    if (!l.message_id) {
      toast.error(`Impossible de retrouver le message d'origine pour ${l.recipient}.`);
      return false;
    }
    const { data: msg } = await supabase
      .from('contact_messages')
      .select('*')
      .eq('id', l.message_id)
      .maybeSingle();
    if (!msg) {
      toast.error(`Message introuvable pour ${l.recipient}.`);
      return false;
    }
    const isReply = l.type === 'reply';
    const body = isReply
      ? { action: 'reply', id: msg.id, email: msg.email, name: msg.name, reply: msg.reply_body || '' }
      : { action: 'confirm', id: msg.id, email: msg.email, name: msg.name, message: msg.message };
    try {
      const { data, error } = await supabase.functions.invoke('send-contact-email', { body });
      if (error) throw new Error(error.message);
      if (data && data.success === false) throw new Error(data.error || 'Échec');
      return true;
    } catch (err: any) {
      toast.error(`Échec du renvoi à ${l.recipient} : ${err?.message || 'erreur'}`);
      return false;
    }
  };

  // Retry every failed entry in the email log.
  const resendAllFailures = async () => {
    const failures = logs.filter((l) => l.status !== 'success' && l.type !== 'alert');
    if (failures.length === 0) {
      toast.info('Aucun échec à renvoyer.');
      return;
    }
    setResendingAll(true);
    let success = 0;
    let failed = 0;
    for (const l of failures) {
      const ok = await retryLog(l);
      ok ? success++ : failed++;
    }
    setResendingAll(false);
    await loadLogs();
    if (failed === 0) {
      toast.success(`${success} courriel(s) renvoyé(s) avec succès.`);
    } else {
      toast.warning(`${success} réussi(s), ${failed} encore en échec.`);
    }
  };

  const sendReply = async (m: Message) => {
    if (!replyText.trim()) {
      toast.error('Veuillez écrire une réponse.');
      return;
    }
    setSending(true);
    setReplyError(null);
    try {
      const { data, error } = await supabase.functions.invoke('send-contact-email', {
        body: {
          action: 'reply',
          id: m.id,
          email: m.email,
          name: m.name,
          reply: replyText.trim(),
        },
      });
      if (error) throw new Error(error.message || "Échec de l'envoi");
      if (data && data.success === false) throw new Error(data.error || "Échec de l'envoi");
      toast.success(`Réponse envoyée à ${m.email}`);
      setMessages((list) =>
        list.map((x) =>
          x.id === m.id
            ? { ...x, reply_body: replyText.trim(), replied_at: new Date().toISOString(), is_read: true }
            : x
        )
      );
      setReplyingId(null);
      setReplyText('');
    } catch (err: any) {
      const msg = err?.message || 'erreur';
      setReplyError({ id: m.id, error: msg });
      toast.error(`Échec de l'envoi : ${msg}`);
    } finally {
      setSending(false);
    }
  };


  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd === ADMIN_PASSWORD) {
      setAuthed(true);
      // Persist an admin marker so the site-wide RestGatewayBanner knows to
      // surface platform (REST gateway) warnings to this operator only.
      try {
        localStorage.setItem('intervenia_admin', '1');
      } catch {
        /* ignore */
      }
    } else {
      toast.error('Mot de passe incorrect');
    }
  };

  if (!authed) {
    return (
      <section className="flex min-h-[60vh] items-center justify-center bg-slate-50 px-4 py-20">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
            <Lock className="h-5 w-5" />
          </span>
          <h1 className="mt-4 text-xl font-bold text-slate-900">Panneau d'administration</h1>
          <p className="mt-1 text-sm text-slate-600">Accès réservé à l'équipe IntervenIA.</p>
          <Input
            type="password"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            placeholder="Mot de passe administrateur"
            className="mt-5"
          />
          <Button type="submit" className="mt-4 w-full gradient-brand">
            Accéder
          </Button>
        </form>
      </section>
    );
  }

  const unread = messages.filter((m) => !m.is_read).length;

  return (
    <section className="bg-slate-50 py-12">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-slate-900">Panneau d'administration</h1>

        {/* Tabs */}
        <div className="mt-5 inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          <button
            onClick={() => setTab('messages')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === 'messages'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Inbox className="h-4 w-4" /> Messages
            {unread > 0 && (
              <span
                className={`rounded-full px-1.5 text-xs font-semibold ${
                  tab === 'messages' ? 'bg-white/25 text-white' : 'bg-indigo-100 text-indigo-700'
                }`}
              >
                {unread}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('blog')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === 'blog' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileText className="h-4 w-4" /> Blog
          </button>
          <button
            onClick={() => setTab('logs')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === 'logs' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Activity className="h-4 w-4" /> Journal courriels
          </button>
          <button
            onClick={() => setTab('social')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === 'social' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Share2 className="h-4 w-4" /> Réseaux sociaux
          </button>
          <button
            onClick={() => setTab('errors')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === 'errors' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <AlertTriangle className="h-4 w-4" /> Échecs génération
          </button>
          <button
            onClick={() => setTab('gateway')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              tab === 'gateway' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ServerCog className="h-4 w-4" /> Passerelle REST
          </button>
        </div>


        {tab === 'gateway' ? (
          <AdminGatewayLogs />
        ) : tab === 'errors' ? (
          <AdminGenerationErrors />

        ) : tab === 'social' ? (
          <SocialLinksManager />
        ) : tab === 'blog' ? (
          <div className="mt-8">
            <BlogManager />
          </div>
        ) : tab === 'logs' ? (
          <>
            <div className="mt-8 flex items-center justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
                  <Activity className="h-5 w-5 text-indigo-600" /> Journal des courriels
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Suivez si les courriels (confirmations et réponses) partent bien.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={resendAllFailures}
                  disabled={resendingAll || logs.filter((l) => l.status !== 'success' && l.type !== 'alert').length === 0}
                  className="border-red-300 text-red-700 hover:bg-red-50"
                >
                  <RotateCw className={`mr-2 h-4 w-4 ${resendingAll ? 'animate-spin' : ''}`} />
                  {resendingAll ? 'Renvoi en cours...' : 'Renvoyer tous les échecs'}
                </Button>
                <Button variant="outline" size="sm" onClick={loadLogs} disabled={logsLoading}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${logsLoading ? 'animate-spin' : ''}`} /> Actualiser
                </Button>
              </div>
            </div>

            {/* Summary counts */}
            <div className="mt-6 grid grid-cols-3 gap-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-2xl font-bold text-slate-900">{logs.length}</p>
                <p className="text-xs text-slate-500">Tentatives</p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-2xl font-bold text-emerald-700">
                  {logs.filter((l) => l.status === 'success').length}
                </p>
                <p className="text-xs text-emerald-600">Réussis</p>
              </div>
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="text-2xl font-bold text-red-700">
                  {logs.filter((l) => l.status !== 'success').length}
                </p>
                <p className="text-xs text-red-600">Échecs</p>
              </div>
            </div>

            {/* Filters + search */}
            <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-slate-500">Statut :</span>
                {(['all', 'success', 'failed'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                      statusFilter === s ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {s === 'all' ? 'Tous' : s === 'success' ? 'Réussis' : 'Échecs'}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-slate-500">Type :</span>
                {(['all', 'confirmation', 'reply'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTypeFilter(t)}
                    className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                      typeFilter === t ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {t === 'all' ? 'Tous' : t === 'confirmation' ? 'Confirmation' : 'Réponse'}
                  </button>
                ))}
              </div>
              <div className="relative ml-auto min-w-[200px] flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                  placeholder="Rechercher un destinataire..."
                  className="h-9 pl-8 text-sm"
                />
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {filteredLogs.length === 0 && !logsLoading && (
                <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
                  {logs.length === 0
                    ? 'Aucun envoi de courriel enregistré pour le moment.'
                    : 'Aucun résultat pour ces filtres.'}
                </p>
              )}
              {filteredLogs.map((l) => {
                const ok = l.status === 'success';
                const isAlert = l.type === 'alert';
                return (
                  <div
                    key={l.id}
                    className={`rounded-xl border bg-white p-4 ${ok ? 'border-slate-200' : 'border-red-200'}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {ok ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                            <CheckCircle2 className="h-3 w-3" /> Réussi
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                            <AlertTriangle className="h-3 w-3" /> Échec
                          </span>
                        )}
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                          {isAlert ? 'Alerte' : l.type === 'reply' ? 'Réponse' : 'Confirmation'}
                        </span>
                        <span className="text-sm font-medium text-slate-800">{l.recipient}</span>
                      </div>
                      <span className="text-xs text-slate-400">
                        {new Date(l.created_at).toLocaleString('fr-CA')}
                      </span>
                    </div>
                    {l.subject && <p className="mt-1.5 text-xs text-slate-500">{l.subject}</p>}
                    {!ok && l.error && (
                      <p className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-700">{l.error}</p>
                    )}
                    {!ok && !isAlert && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={resendingAll}
                        onClick={async () => {
                          const success = await retryLog(l);
                          if (success) toast.success(`Renvoyé à ${l.recipient}`);
                          await loadLogs();
                        }}
                        className="mt-2 border-red-400 text-red-700 hover:bg-red-100"
                      >
                        <RotateCw className="mr-1.5 h-4 w-4" /> Réessayer
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (

          <>
            <div className="mt-8 flex items-center justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
                  <Inbox className="h-5 w-5 text-indigo-600" /> Messages reçus
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {messages.length} message(s) · {unread} non lu(s)
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={load} disabled={loading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Actualiser
              </Button>
            </div>

            <div className="mt-6 space-y-4">
              {messages.length === 0 && !loading && (
                <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
                  Aucun message pour le moment.
                </p>
              )}
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`rounded-2xl border bg-white p-5 shadow-sm ${
                    m.is_read ? 'border-slate-200' : 'border-indigo-300 ring-1 ring-indigo-100'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-900">{m.name}</h3>
                        {!m.is_read && (
                          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                            Nouveau
                          </span>
                        )}
                        {m.replied_at && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                            <CheckCircle2 className="h-3 w-3" /> Répondu
                          </span>
                        )}
                      </div>
                      <a
                        href={`mailto:${m.email}`}
                        className="flex items-center gap-1.5 text-sm text-indigo-600 hover:underline"
                      >
                        <Mail className="h-3.5 w-3.5" /> {m.email}
                      </a>
                    </div>
                    <span className="text-xs text-slate-400">
                      {new Date(m.created_at).toLocaleString('fr-CA')}
                    </span>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{m.message}</p>

                  {m.reply_body && (
                    <div className="mt-3 rounded-xl border-l-4 border-emerald-400 bg-emerald-50 p-3">
                      <p className="text-xs font-semibold text-emerald-700">
                        Votre réponse · {m.replied_at ? new Date(m.replied_at).toLocaleString('fr-CA') : ''}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{m.reply_body}</p>
                    </div>
                  )}

                  {replyingId === m.id ? (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <Textarea
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        rows={4}
                        placeholder={`Votre réponse à ${m.name}...`}
                        className="bg-white"
                      />
                      <div className="mt-3 flex items-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => sendReply(m)}
                          disabled={sending}
                          className="gradient-brand"
                        >
                          {sending ? (
                            'Envoi...'
                          ) : (
                            <span className="flex items-center gap-1.5">
                              <Send className="h-4 w-4" /> Envoyer la réponse
                            </span>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setReplyingId(null);
                            setReplyText('');
                          }}
                        >
                          Annuler
                        </Button>
                      </div>

                      {replyError && replyError.id === m.id && (
                        <div className="mt-3 rounded-lg border border-red-300 bg-red-50 p-3">
                          <p className="flex items-center gap-1.5 text-sm font-semibold text-red-700">
                            <AlertTriangle className="h-4 w-4" /> Le courriel n'a pas pu être envoyé
                          </p>
                          <p className="mt-1 text-xs text-red-600">{replyError.error}</p>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={sending}
                            onClick={() => sendReply(m)}
                            className="mt-2 border-red-400 text-red-700 hover:bg-red-100"
                          >
                            <RefreshCw className={`mr-1.5 h-4 w-4 ${sending ? 'animate-spin' : ''}`} /> Réessayer
                          </Button>
                        </div>
                      )}
                    </div>

                  ) : (
                    <div className="mt-3 flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openReply(m)}
                        className="text-indigo-600"
                      >
                        <Reply className="mr-1.5 h-4 w-4" />
                        {m.reply_body ? 'Répondre à nouveau' : 'Répondre'}
                      </Button>
                      {!m.is_read && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => markRead(m.id)}
                          className="text-slate-600"
                        >
                          <CheckCheck className="mr-1.5 h-4 w-4" /> Marquer comme lu
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export default AdminMessages;
