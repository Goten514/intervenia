import React, { useState, useEffect } from 'react';
import { Mail, Facebook, Youtube, Linkedin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

const LOGO_URL = 'https://d64gsuwffb70l.cloudfront.net/6a1239d51c177f23b96999b8_1780137517404_ab5848bc.png';

interface FooterProps {
  onNavigate: (section: string) => void;
}

// TikTok n'existe pas dans lucide-react : on utilise un SVG personnalisé.
const TikTokIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M16.6 5.82a4.28 4.28 0 0 1-1.02-2.82h-3.1v12.4a2.5 2.5 0 1 1-2.5-2.5c.18 0 .35.02.52.05V9.78a5.6 5.6 0 0 0-.52-.02 5.6 5.6 0 1 0 5.6 5.6V8.96a7.3 7.3 0 0 0 4.27 1.37V7.23a4.28 4.28 0 0 1-3.25-1.41z" />
  </svg>
);

// URL par défaut, surchargées par les valeurs configurées dans l'admin (table site_settings).
const DEFAULT_SOCIALS: Record<string, string> = {
  social_facebook: 'https://www.facebook.com/intervenia',
  social_youtube: 'https://www.youtube.com/@intervenia',
  social_linkedin: 'https://www.linkedin.com/company/intervenia',
  social_tiktok: 'https://www.tiktok.com/@intervenia',
};

const SOCIAL_META = [
  { key: 'social_facebook', Icon: Facebook, label: 'Facebook' },
  { key: 'social_youtube', Icon: Youtube, label: 'YouTube' },
  { key: 'social_linkedin', Icon: Linkedin, label: 'LinkedIn' },
  { key: 'social_tiktok', Icon: TikTokIcon, label: 'TikTok' },
];



const Footer: React.FC<FooterProps> = ({ onNavigate }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialUrls, setSocialUrls] = useState<Record<string, string>>(DEFAULT_SOCIALS);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('site_settings')
        .select('key, value')
        .in('key', Object.keys(DEFAULT_SOCIALS));
      if (data && data.length) {
        setSocialUrls((prev) => {
          const next = { ...prev };
          (data as { key: string; value: string }[]).forEach((row) => {
            if (row.value && row.value.trim()) next[row.key] = row.value.trim();
          });
          return next;
        });
      }
    })();
  }, []);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      toast.error('Email invalide');
      return;
    }
    setLoading(true);
    try {
      await fetch('https://famous.ai/api/crm/6a1250619fe351fa51c4d4cd/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          source: 'footer-signup',
          tags: ['newsletter', 'intervenia'],
        }),
      });
      toast.success('Merci ! Vous recevrez nos meilleurs conseils.');
      setEmail('');
    } catch {
      toast.error('Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const productLinks = [
    { label: 'Générateur IA', target: 'generator' },
    { label: 'Profils clients', target: 'clients' },
    { label: 'Mes Outils', target: 'outils' },
    { label: 'Fonctionnalités', target: 'features' },
    { label: 'Tarifs', target: 'pricing' },
  ];

  const companyLinks = [
    { label: 'À propos', target: 'about' },
    { label: 'Blog', target: 'blog' },
    { label: 'Accueil', target: 'home' },
    { label: 'Contact', target: 'contact' },
    { label: 'Confidentialité', target: 'privacy' },
  ];

  return (
    <footer className="bg-slate-950 text-slate-300">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <button
              onClick={() => onNavigate('home')}
              className="flex items-center transition-opacity hover:opacity-90"
              aria-label="InterventIA - Accueil"
            >
              <img
                src={LOGO_URL}
                alt="InterventIA"
                className="h-20 w-auto object-contain object-left sm:h-24"
                style={{ maxWidth: '360px', filter: 'brightness(1.05)' }}
              />
            </button>

            <p className="mt-4 max-w-md text-sm text-slate-400">
              La première plateforme d'intervention augmentée par IA pour les TES, les
              psychoéducateurs, les enseignants et intervenants au Québec.
            </p>


            <form onSubmit={handleSubscribe} className="mt-6 flex max-w-sm gap-2">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  type="email"
                  placeholder="Votre courriel"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="border-slate-700 bg-slate-900 pl-9 text-white placeholder:text-slate-500"
                />
              </div>
              <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700">
                {loading ? '...' : 'S\'abonner'}
              </Button>
            </form>

            <div className="mt-6 flex gap-3">
              {SOCIAL_META.map(({ Icon, key, label }) => (
                <a
                  key={label}
                  href={socialUrls[key] || DEFAULT_SOCIALS[key]}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 text-slate-400 transition-colors hover:border-indigo-500 hover:text-indigo-400"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-white">Produit</h4>
            <ul className="mt-4 space-y-2 text-sm">
              {productLinks.map((l) => (
                <li key={l.label}>
                  <button onClick={() => onNavigate(l.target)} className="hover:text-white">
                    {l.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-white">Entreprise</h4>
            <ul className="mt-4 space-y-2 text-sm">
              {companyLinks.map((l) => (
                <li key={l.label}>
                  <button onClick={() => onNavigate(l.target)} className="hover:text-white">
                    {l.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-slate-800 pt-8 sm:flex-row sm:items-center">
          <p className="text-xs text-slate-500">
            © 2026 IntervenIA. Tous droits réservés. Conçu au Québec avec passion.
          </p>
          <div className="flex flex-wrap gap-6 text-xs text-slate-500">
            <button onClick={() => onNavigate('terms')} className="hover:text-white">Conditions</button>
            <button onClick={() => onNavigate('privacy')} className="hover:text-white">Confidentialité</button>
            <button onClick={() => onNavigate('cookies')} className="hover:text-white">Cookies</button>
            <button onClick={() => onNavigate('admin')} className="hover:text-white">Admin</button>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
