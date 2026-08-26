import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Mail, Lock, User as UserIcon, Sparkles, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultMode?: 'signin' | 'signup';
}

const GoogleIcon = ({ className = 'h-5 w-5' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.972 32.91 29.418 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.197l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.392 0-9.93-3.063-11.281-7.466l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.001-.001 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
  </svg>
);

type View = 'main' | 'google';

const AuthModal: React.FC<AuthModalProps> = ({ open, onOpenChange, defaultMode = 'signin' }) => {
  const [view, setView] = useState<View>('main');
  const [mode, setMode] = useState<'signin' | 'signup'>(defaultMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [googleEmail, setGoogleEmail] = useState('');
  const [googleName, setGoogleName] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, signInWithGoogle } = useAuth();

  React.useEffect(() => {
    if (open) {
      setMode(defaultMode);
      setView('main');
    }
  }, [open, defaultMode]);

  const subscribeToCrm = async (em: string, name?: string, source = 'signin', tags: string[] = ['user', 'intervenia']) => {
    await fetch('https://famous.ai/api/crm/6a1250619fe351fa51c4d4cd/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: em, name: name || undefined, source, tags }),
    }).catch(() => {});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }
    if (password.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signin') {
        const { error } = await signIn(email, password);
        if (error) throw error;
        toast.success('Bienvenue !');
        onOpenChange(false);
        await subscribeToCrm(email, undefined, 'signin', ['user', 'intervenia']);
      } else {
        const { error } = await signUp(email, password, fullName);
        if (error) throw error;
        toast.success('Compte créé ! Bienvenue sur IntervenIA.');
        await subscribeToCrm(email, fullName, 'signup', ['new-user', 'intervenia']);
        onOpenChange(false);
      }
      setEmail(''); setPassword(''); setFullName('');
    } catch (err: any) {
      const msg = err.message?.includes('Invalid login')
        ? 'Courriel ou mot de passe incorrect'
        : err.message?.includes('already registered')
        ? 'Ce courriel est déjà utilisé'
        : err.message || 'Une erreur est survenue';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleEmail || !googleEmail.includes('@')) {
      toast.error('Entrez un courriel Google valide');
      return;
    }
    setLoading(true);
    try {
      const { error } = await signInWithGoogle(googleEmail, googleName);
      if (error) throw error;
      toast.success('Connecté avec Google !');
      onOpenChange(false);
      await subscribeToCrm(googleEmail, googleName, 'google-signin', ['user', 'google', 'intervenia']);
      setGoogleEmail(''); setGoogleName('');
    } catch (err: any) {
      toast.error(err.message || 'La connexion Google a échoué');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 shadow-lg shadow-indigo-500/30">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <DialogTitle className="text-center text-2xl">
            {view === 'google'
              ? 'Se connecter avec Google'
              : mode === 'signin'
              ? 'Bon retour !'
              : 'Créer un compte'}
          </DialogTitle>
          <DialogDescription className="text-center">
            {view === 'google'
              ? 'Choisissez le compte Google avec lequel continuer'
              : mode === 'signin'
              ? 'Connectez-vous pour accéder à votre espace IntervenIA'
              : 'Commencez gratuitement, sans carte de crédit'}
          </DialogDescription>
        </DialogHeader>

        {view === 'google' ? (
          <form onSubmit={handleGoogle} className="space-y-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              Démonstration : entrez votre adresse Google pour vous connecter ou créer un compte automatiquement.
            </div>
            <div>
              <Label htmlFor="googleName">Nom (optionnel)</Label>
              <div className="relative mt-1">
                <UserIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="googleName"
                  value={googleName}
                  onChange={(e) => setGoogleName(e.target.value)}
                  className="pl-9"
                  placeholder="Marie Tremblay"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="googleEmail">Adresse Gmail</Label>
              <div className="relative mt-1">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="googleEmail"
                  type="email"
                  value={googleEmail}
                  onChange={(e) => setGoogleEmail(e.target.value)}
                  className="pl-9"
                  placeholder="marie@gmail.com"
                  required
                  autoFocus
                />
              </div>
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="h-11 w-full bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 shadow-sm"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <GoogleIcon />
                  Continuer avec Google
                </span>
              )}
            </Button>
            <button
              type="button"
              onClick={() => setView('main')}
              className="flex w-full items-center justify-center gap-1 text-sm text-slate-500 hover:text-slate-700"
            >
              <ArrowLeft className="h-3 w-3" /> Retour
            </button>
          </form>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setView('google')}
              className="h-11 w-full bg-white text-slate-800 border-slate-300 hover:bg-slate-50"
            >
              <span className="flex items-center justify-center gap-2">
                <GoogleIcon />
                Continuer avec Google
              </span>
            </Button>

            <div className="relative my-1">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-slate-200" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-2 text-slate-500">ou par courriel</span>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === 'signup' && (
                <div>
                  <Label htmlFor="fullName">Nom complet</Label>
                  <div className="relative mt-1">
                    <UserIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="pl-9"
                      placeholder="Marie Tremblay"
                    />
                  </div>
                </div>
              )}
              <div>
                <Label htmlFor="email">Courriel</Label>
                <div className="relative mt-1">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
                    placeholder="marie@exemple.com"
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="password">Mot de passe</Label>
                <div className="relative mt-1">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9"
                    placeholder="Minimum 6 caractères"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="h-11 w-full bg-gradient-to-r from-indigo-600 to-violet-600 shadow-lg shadow-indigo-500/30 hover:from-indigo-700 hover:to-violet-700"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (mode === 'signin' ? 'Se connecter' : 'Créer mon compte')}
              </Button>
            </form>

            <p className="text-center text-sm text-slate-600">
              {mode === 'signin' ? 'Pas encore de compte ? ' : 'Déjà inscrit ? '}
              <button
                type="button"
                onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
                className="font-semibold text-indigo-600 hover:underline"
              >
                {mode === 'signin' ? "S'inscrire" : 'Se connecter'}
              </button>
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AuthModal;
