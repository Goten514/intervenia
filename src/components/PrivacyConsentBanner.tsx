import React from 'react';
import { ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';

const PrivacyConsentBanner: React.FC = () => {
  const { user, consentGiven, giveConsent, loading } = useAuth();
  const [dismissed, setDismissed] = React.useState(false);

  if (!user || consentGiven || dismissed || loading) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-indigo-200 bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 shadow-2xl">
      <div className="mx-auto flex max-w-5xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex items-start gap-3 text-white">
          <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0" />
          <div className="text-sm leading-relaxed">
            <strong className="font-semibold">Protection des renseignements personnels</strong>
            <p className="mt-0.5 text-indigo-100">
              IntervenIA respecte la Loi 25 du Québec. Les données que tu saisis (prénoms, âges, problématiques)
              sont stockées de façon sécurisée et ne sont jamais partagées. En utilisant la plateforme, tu consens
              à ce traitement conforme à notre{' '}
              <a href="/politique-confidentialite" className="font-medium underline underline-offset-2 hover:text-white">
                politique de confidentialité
              </a>.
            </p>
          </div>
        </div>
        <div className="flex flex-shrink-0 gap-2">
          <Button size="sm" onClick={giveConsent} className="bg-white text-indigo-700 hover:bg-indigo-50 shadow-md">
            J'accepte
          </Button>
          <button onClick={() => setDismissed(true)} className="rounded-md p-1.5 text-indigo-200 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrivacyConsentBanner;