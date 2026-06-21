import React, { useState, useEffect } from 'react';
import Navbar from './Navbar';
import Hero from './Hero';
import Features from './Features';
import ClinicalTrust from './ClinicalTrust';
import InterventionGenerator from './InterventionGenerator';
import ClientsDashboard from './ClientsDashboard';
import ToolsDashboard from './ToolsDashboard';
import Pricing from './Pricing';
import Footer from './Footer';
import AuthModal from './AuthModal';
import AuthGate from './AuthGate';
import BillingPage from './BillingPage';
import WorkspacePanel from './WorkspacePanel';
import ContactPage from './ContactPage';
import LegalPage from './LegalPage';
import AboutPage from './AboutPage';
import BlogPage from './BlogPage';
import AdminMessages from './AdminMessages';
import RestGatewayBanner from './RestGatewayBanner';
import type { DossierFields } from './InterventionGenerator';

import { useAuth } from '@/contexts/AuthContext';

const AppLayout: React.FC = () => {
  const [currentPage, setCurrentPage] = useState('home');
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  // One-shot dossier handoff from ToolsDashboard ("Reprendre dans le générateur"
  // on an auto-saved draft) into the generator's form. Cleared once consumed.
  const [resumeDossier, setResumeDossier] = useState<DossierFields | null>(null);
  const { user } = useAuth();

  const handleNavigate = (section: string) => {
    setCurrentPage(section);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Load an auto-saved draft's raw fields into the generator and switch to it.
  const handleResumeDraft = (fields: DossierFields) => {
    setResumeDossier(fields);
    handleNavigate('generator');
  };

  const handleAuthClick = (mode: 'signin' | 'signup' = 'signin') => {
    setAuthMode(mode);
    setAuthOpen(true);
  };

  const handleHeroCTA = () => {
    if (user) {
      handleNavigate('generator');
    } else {
      handleAuthClick('signup');
    }
  };

  useEffect(() => {
    document.title = 'IntervenIA — Plateforme d\'intervention augmentée par IA';
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <RestGatewayBanner />
      <Navbar
        onNavigate={handleNavigate}
        currentPage={currentPage}
        onAuthClick={handleAuthClick}
      />

      <main>
        {currentPage === 'home' && (
          <>
            <Hero onCTA={handleHeroCTA} />
            <Features />
            <ClinicalTrust />
            <Pricing onRequireAuth={() => handleAuthClick('signup')} />
          </>
        )}

        {currentPage === 'features' && (
          <>
            <Features />
            <Pricing onRequireAuth={() => handleAuthClick('signup')} />
          </>
        )}

        {currentPage === 'generator' && (
          <AuthGate
            onSignInClick={() => handleAuthClick('signup')}
            title="Connectez-vous pour générer des outils"
            description="Le générateur IA est réservé aux membres. Créez un compte gratuit pour commencer."
          >
            <InterventionGenerator
              onUpgrade={() => handleNavigate('pricing')}
              initialDossier={resumeDossier}
              onDossierConsumed={() => setResumeDossier(null)}
            />
          </AuthGate>
        )}

        {currentPage === 'clients' && (
          <AuthGate
            onSignInClick={() => handleAuthClick('signup')}
            title="Connectez-vous pour gérer vos clients"
            description="Vos profils clients sont privés et sécurisés. Connectez-vous pour y accéder."
          >
            <ClientsDashboard />
          </AuthGate>
        )}

        {currentPage === 'outils' && (
          <AuthGate
            onSignInClick={() => handleAuthClick('signup')}
            title="Connectez-vous pour accéder à vos outils"
            description="Tous vos outils générés sont privés. Connectez-vous pour les retrouver."
          >
            <ToolsDashboard onResumeDraft={handleResumeDraft} />
          </AuthGate>
        )}

        {currentPage === 'equipe' && (
          <AuthGate
            onSignInClick={() => handleAuthClick('signup')}
            title="Connectez-vous pour gérer votre équipe"
            description="L'espace d'équipe collaboratif est réservé aux membres connectés."
          >
            <WorkspacePanel onUpgrade={() => handleNavigate('pricing')} />
          </AuthGate>
        )}

        {currentPage === 'billing' && (
          <AuthGate
            onSignInClick={() => handleAuthClick('signup')}
            title="Connectez-vous pour gérer votre abonnement"
            description="Consultez et gérez votre plan une fois connecté."
          >
            <BillingPage onUpgrade={() => handleNavigate('pricing')} />
          </AuthGate>
        )}

        {currentPage === 'pricing' && <Pricing onRequireAuth={() => handleAuthClick('signup')} />}

        {currentPage === 'contact' && <ContactPage />}
        {currentPage === 'about' && <AboutPage />}
        {currentPage === 'blog' && <BlogPage />}
        {currentPage === 'admin' && <AdminMessages />}
        {currentPage === 'terms' && <LegalPage type="terms" />}
        {currentPage === 'privacy' && <LegalPage type="privacy" />}
        {currentPage === 'cookies' && <LegalPage type="cookies" />}
      </main>

      <Footer onNavigate={handleNavigate} />

      <AuthModal
        open={authOpen}
        onOpenChange={setAuthOpen}
        defaultMode={authMode}
      />
    </div>
  );
};

export default AppLayout;
