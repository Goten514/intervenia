import React from 'react';
import { Lock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

interface AuthGateProps {
  children: React.ReactNode;
  onSignInClick: () => void;
  title?: string;
  description?: string;
}

const AuthGate: React.FC<AuthGateProps> = ({
  children,
  onSignInClick,
  title = 'Connectez-vous pour continuer',
  description = 'Cette fonctionnalité nécessite un compte IntervenIA. Créez votre compte gratuit en 30 secondes.',
}) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <section className="bg-gradient-to-b from-indigo-50/30 via-white to-white py-20 sm:py-28">
        <div className="mx-auto max-w-xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-xl shadow-indigo-500/10">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-violet-100">
              <Lock className="h-8 w-8 text-indigo-600" />
            </div>
            <h2 className="mt-5 text-2xl font-bold text-slate-900 sm:text-3xl">{title}</h2>
            <p className="mt-3 text-slate-600">{description}</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button
                size="lg"
                onClick={onSignInClick}
                className="bg-gradient-to-r from-indigo-600 to-violet-600 shadow-lg shadow-indigo-500/30 hover:from-indigo-700 hover:to-violet-700"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Créer un compte gratuit
              </Button>
              <Button size="lg" variant="outline" onClick={onSignInClick}>
                J'ai déjà un compte
              </Button>
            </div>
            <p className="mt-6 text-xs text-slate-500">
              Aucune carte de crédit requise · Annulation en 1 clic
            </p>
          </div>
        </div>
      </section>
    );
  }

  return <>{children}</>;
};

export default AuthGate;
