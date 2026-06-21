import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import UserMenu from './UserMenu';

const LOGO_URL = 'https://d64gsuwffb70l.cloudfront.net/6a1239d51c177f23b96999b8_1780137517404_ab5848bc.png';


interface NavbarProps {
  onNavigate: (section: string) => void;
  currentPage: string;
  onAuthClick: (mode?: 'signin' | 'signup') => void;
}

const Navbar: React.FC<NavbarProps> = ({ onNavigate, currentPage, onAuthClick }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useAuth();

  const links = [
    { id: 'home', label: 'Accueil' },
    { id: 'features', label: 'Fonctionnalités' },
    { id: 'generator', label: 'Générateur IA' },
    { id: 'clients', label: 'Mes Clients' },
    { id: 'outils', label: 'Mes Outils' },
    { id: 'pricing', label: 'Tarifs' },
    { id: 'contact', label: 'Contact' },
  ];


  const handleClick = (id: string) => {
    onNavigate(id);
    setMobileOpen(false);
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-slate-200/60 bg-white/75 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <button
          onClick={() => handleClick('home')}
          className="group flex items-center transition-opacity hover:opacity-90"
          aria-label="InterventIA - Accueil"
        >
          <img
            src={LOGO_URL}
            alt="InterventIA"
            className="h-16 w-auto object-contain object-left sm:h-20 lg:h-24"
            style={{ maxWidth: '360px' }}
          />
        </button>


        <div className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <button
              key={link.id}
              onClick={() => handleClick(link.id)}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                currentPage === link.id
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {link.label}
            </button>
          ))}
        </div>

        <div className="hidden md:flex md:items-center md:gap-3">
          {user ? (
            <UserMenu onNavigate={onNavigate} />
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => onAuthClick('signin')}>
                Se connecter
              </Button>
              <Button
                size="sm"
                onClick={() => onAuthClick('signup')}
                className="gradient-brand shadow-brand hover:opacity-95 hover:shadow-brand-lg transition-all"
              >
                Essai gratuit
              </Button>

            </>
          )}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          {user && <UserMenu onNavigate={onNavigate} />}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menu"
            className="p-1"
          >
            {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-slate-200 bg-white md:hidden">
          <div className="space-y-1 px-4 py-3">
            {links.map((link) => (
              <button
                key={link.id}
                onClick={() => handleClick(link.id)}
                className={`block w-full rounded-lg px-3 py-2 text-left text-sm font-medium ${
                  currentPage === link.id
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {link.label}
              </button>
            ))}
            {!user && (
              <>
                <Button
                  variant="outline"
                  onClick={() => { onAuthClick('signin'); setMobileOpen(false); }}
                  className="mt-2 w-full"
                >
                  Se connecter
                </Button>
                <Button
                  onClick={() => { onAuthClick('signup'); setMobileOpen(false); }}
                  className="w-full bg-gradient-to-r from-indigo-600 to-violet-600"
                >
                  Essai gratuit
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
