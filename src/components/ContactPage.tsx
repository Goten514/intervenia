import React, { useState } from 'react';
import { Mail, User, MessageSquare, Send, CheckCircle2, MapPin, Phone, AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface LastSubmission {
  id?: string;
  name: string;
  email: string;
  message: string;
}


interface Errors {
  name?: string;
  email?: string;
  message?: string;
}

const ContactPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  // Tracks whether the confirmation email failed (e.g. domain not yet verified)
  const [emailFailed, setEmailFailed] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [lastSubmission, setLastSubmission] = useState<LastSubmission | null>(null);

  const validate = (): boolean => {
    const next: Errors = {};
    if (!name.trim()) next.name = 'Veuillez entrer votre nom.';
    if (!email.trim()) {
      next.email = 'Veuillez entrer votre courriel.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = 'Adresse courriel invalide.';
    }
    if (!message.trim()) {
      next.message = 'Veuillez écrire un message.';
    } else if (message.trim().length < 10) {
      next.message = 'Votre message doit contenir au moins 10 caractères.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  // Sends the confirmation email and returns an error string if it failed.
  const sendConfirmation = async (payload: LastSubmission): Promise<string | null> => {
    try {
      const { data, error } = await supabase.functions.invoke('send-contact-email', {
        body: {
          action: 'confirm',
          id: payload.id,
          name: payload.name,
          email: payload.email,
          message: payload.message,
        },
      });
      if (error) return error.message || "Échec de l'envoi du courriel.";
      if (data && data.success === false) {
        return data.error || "Échec de l'envoi du courriel.";
      }
      return null;
    } catch (err: any) {
      return err?.message || "Échec de l'envoi du courriel.";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setEmailFailed(null);
    try {
      // Save to database
      const { data: inserted } = await supabase
        .from('contact_messages')
        .insert({
          name: name.trim(),
          email: email.trim(),
          message: message.trim(),
        })
        .select('id')
        .single();

      const payload: LastSubmission = {
        id: inserted?.id,
        name: name.trim(),
        email: email.trim(),
        message: message.trim(),
      };
      setLastSubmission(payload);

      // Also subscribe to CRM
      await fetch('https://famous.ai/api/crm/6a1250619fe351fa51c4d4cd/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim(),
          source: 'contact-form',
          tags: ['contact', 'intervenia'],
          message: message.trim(),
        }),
      }).catch(() => {});

      // Send the confirmation email and surface a clear message if it fails.
      const emailErr = await sendConfirmation(payload);

      setSent(true);
      setName('');
      setEmail('');
      setMessage('');

      if (emailErr) {
        setEmailFailed(emailErr);
        toast.warning("Votre message a été enregistré, mais le courriel de confirmation n'a pas pu être envoyé.");
      } else {
        toast.success('Message envoyé ! Un courriel de confirmation vous a été envoyé.');
      }
    } catch {
      toast.error("Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  const retryEmail = async () => {
    if (!lastSubmission) return;
    setRetrying(true);
    const emailErr = await sendConfirmation(lastSubmission);
    setRetrying(false);
    if (emailErr) {
      setEmailFailed(emailErr);
      toast.error("Le courriel n'a toujours pas pu être envoyé.");
    } else {
      setEmailFailed(null);
      toast.success('Courriel de confirmation envoyé avec succès !');
    }
  };


  return (
    <section className="bg-gradient-to-b from-slate-50 to-white py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-700">
            Contactez-nous
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Une question ? Parlons-en.
          </h1>
          <p className="mt-3 text-slate-600">
            Notre équipe répond généralement en moins de 24 heures ouvrables.
          </p>
        </div>

        <div className="mt-12 grid gap-10 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Coordonnées</h3>
              <ul className="mt-5 space-y-4 text-sm">
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                    <Mail className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="font-medium text-slate-900">Courriel</p>
                    <a href="mailto:info@intervenia.ca" className="text-slate-600 hover:text-indigo-600">
                      info@intervenia.ca
                    </a>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                    <Phone className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="font-medium text-slate-900">Téléphone</p>
                    <a href="tel:+15140000000" className="text-slate-600 hover:text-indigo-600">
                      +1 (514) 000-0000
                    </a>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                    <MapPin className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="font-medium text-slate-900">Bureau</p>
                    <p className="text-slate-600">Montréal, Québec, Canada</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>

          <div className="lg:col-span-3">
            {sent ? (
              <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 p-10 text-center">
                <CheckCircle2 className="h-12 w-12 text-emerald-600" />
                <h3 className="mt-4 text-xl font-semibold text-slate-900">Message envoyé !</h3>
                <p className="mt-2 max-w-sm text-slate-600">
                  Merci de nous avoir contactés. Notre équipe vous répondra dans les plus brefs délais.
                </p>

                {emailFailed && (
                  <div className="mt-6 w-full max-w-md rounded-xl border border-amber-300 bg-amber-50 p-4 text-left">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
                      <div>
                        <p className="text-sm font-semibold text-amber-800">
                          Courriel de confirmation non envoyé
                        </p>
                        <p className="mt-1 text-xs text-amber-700">{emailFailed}</p>
                        <p className="mt-1 text-xs text-amber-700">
                          Pas d'inquiétude : votre message a bien été enregistré et notre équipe l'a reçu.
                        </p>
                        <Button
                          onClick={retryEmail}
                          disabled={retrying}
                          size="sm"
                          variant="outline"
                          className="mt-3 border-amber-400 text-amber-800 hover:bg-amber-100"
                        >
                          <RefreshCw className={`mr-1.5 h-4 w-4 ${retrying ? 'animate-spin' : ''}`} />
                          {retrying ? 'Nouvelle tentative...' : "Réessayer l'envoi du courriel"}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                <Button onClick={() => { setSent(false); setEmailFailed(null); }} variant="outline" className="mt-6">
                  Envoyer un autre message
                </Button>
              </div>
            ) : (

              <form
                onSubmit={handleSubmit}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
                noValidate
              >
                <div className="space-y-5">
                  <div>
                    <Label htmlFor="contact-name">Nom complet</Label>
                    <div className="relative mt-1.5">
                      <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        id="contact-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Marie Tremblay"
                        className={`pl-9 ${errors.name ? 'border-red-400' : ''}`}
                      />
                    </div>
                    {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name}</p>}
                  </div>

                  <div>
                    <Label htmlFor="contact-email">Courriel</Label>
                    <div className="relative mt-1.5">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input
                        id="contact-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="marie@exemple.com"
                        className={`pl-9 ${errors.email ? 'border-red-400' : ''}`}
                      />
                    </div>
                    {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email}</p>}
                  </div>

                  <div>
                    <Label htmlFor="contact-message">Message</Label>
                    <div className="relative mt-1.5">
                      <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <Textarea
                        id="contact-message"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Comment pouvons-nous vous aider ?"
                        rows={5}
                        className={`pl-9 ${errors.message ? 'border-red-400' : ''}`}
                      />
                    </div>
                    {errors.message && <p className="mt-1 text-xs text-red-500">{errors.message}</p>}
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full gradient-brand shadow-brand hover:opacity-95"
                  >
                    {loading ? (
                      'Envoi en cours...'
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <Send className="h-4 w-4" /> Envoyer le message
                      </span>
                    )}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ContactPage;
