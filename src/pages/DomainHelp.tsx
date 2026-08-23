import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ChevronDown,
  Copy,
  Check,
  ShieldCheck,
  Globe,
  Lock,
  FileCode2,
  Info,
  ListChecks,
  Circle,
  Clock,
} from 'lucide-react';
import { OFFICIAL_SECURE_URL } from '@/lib/domain-config';

const OFFICIAL_PREVIEW_URL = OFFICIAL_SECURE_URL;

interface ChecklistStep {
  title: string;
  detail: string;
  eta: string;
}

const CHECKLIST: ChecklistStep[] = [
  {
    title: 'Vérifier les enregistrements DNS (A / CNAME)',
    detail:
      "Chez le registraire d'intervenia.ca, confirmer que l'apex (@) pointe vers la bonne IP (A) ou l'hôte (ALIAS/CNAME) et que www pointe vers le même hôte (CNAME).",
    eta: '5 min',
  },
  {
    title: 'Confirmer que le DNS résout vers le bon serveur',
    detail:
      'Lancer « dig +short intervenia.ca » et « dig +short www.intervenia.ca ». Les valeurs retournées doivent correspondre exactement à celles fournies par l’hébergeur.',
    eta: '2 min',
  },
  {
    title: 'Provisionner / réémettre le certificat SSL',
    detail:
      'Émettre un certificat Let’s Encrypt couvrant EXACTEMENT intervenia.ca ET www.intervenia.ca (Certbot, ou bouton SSL/TLS dans cPanel/Plesk). Un certificat qui ne couvre pas les deux noms cause ERR_CERT_COMMON_NAME_INVALID.',
    eta: '5–10 min',
  },
  {
    title: 'Forcer le HTTPS et le fallback SPA',
    detail:
      'Activer la redirection HTTP → HTTPS et le renvoi de toutes les routes vers index.html (.htaccess pour Apache, try_files pour Nginx — voir sections détaillées plus bas).',
    eta: '5 min',
  },
  {
    title: 'Attendre la propagation DNS / TLS',
    detail:
      'La propagation peut prendre de quelques minutes à 48 h. Vider le cache du navigateur ou tester en navigation privée pour éviter un ancien certificat mis en cache.',
    eta: '0–48 h',
  },
  {
    title: 'Valider le certificat de bout en bout',
    detail:
      'Vérifier le nom commun avec openssl, ouvrir https://intervenia.ca (le cadenas doit apparaître sans avertissement) puis confirmer le badge « Sécurisé » sur la page d’état.',
    eta: '3 min',
  },
];

const Checklist: React.FC = () => (
  <div className="mt-6 overflow-hidden rounded-2xl border border-indigo-200 bg-white shadow-sm">
    <div className="flex items-center gap-3 border-b border-indigo-100 bg-indigo-50/60 px-5 py-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100">
        <ListChecks className="h-5 w-5 text-indigo-600" />
      </div>
      <div>
        <h2 className="font-semibold text-slate-900">Checklist de correction (étape par étape)</h2>
        <p className="text-xs text-slate-500">
          À cocher dans l'ordre pour rétablir un certificat valide sur intervenia.ca.
        </p>
      </div>
    </div>
    <ol className="divide-y divide-slate-100">
      {CHECKLIST.map((step, i) => (
        <li key={i} className="flex gap-4 px-5 py-4">
          <div className="flex flex-col items-center">
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
              {i + 1}
            </span>
            {i < CHECKLIST.length - 1 && <span className="mt-1 w-px flex-1 bg-slate-200" />}
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Circle className="h-3.5 w-3.5 text-slate-300" />
              <p className="font-medium text-slate-900">{step.title}</p>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                <Clock className="h-3 w-3" /> {step.eta}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600">{step.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  </div>
);


const CodeBlock: React.FC<{ code: string; label?: string }> = ({ code, label }) => {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };
  return (
    <div className="relative mt-3 overflow-hidden rounded-lg border border-slate-700 bg-slate-900">
      {label && (
        <div className="border-b border-slate-700 px-4 py-1.5 text-xs font-medium text-slate-400">
          {label}
        </div>
      )}
      <button
        onClick={copy}
        className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-slate-700/70 px-2 py-1 text-xs font-medium text-slate-100 transition hover:bg-slate-600"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? 'Copié' : 'Copier'}
      </button>
      <pre className="overflow-x-auto px-4 py-3 text-xs leading-relaxed text-slate-100">
        <code>{code}</code>
      </pre>
    </div>
  );
};

interface SectionProps {
  icon: React.ElementType;
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ icon: Icon, title, defaultOpen, children }) => {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-slate-50"
      >
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-50">
          <Icon className="h-5 w-5 text-indigo-600" />
        </div>
        <span className="flex-1 font-semibold text-slate-900">{title}</span>
        <ChevronDown
          className={`h-5 w-5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <div className="border-t border-slate-100 px-5 py-4 text-sm text-slate-600">{children}</div>}
    </div>
  );
};

const DomainHelp: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:py-16">
        <Link
          to="/status"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" /> Retour à l'état des services
        </Link>

        <div className="mt-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-100 to-violet-100">
            <ShieldCheck className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Corriger le certificat SSL d'intervenia.ca
            </h1>
            <p className="text-sm text-slate-500">
              Guide pas à pas pour rendre votre domaine sécurisé (HTTPS).
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
          <p>
            En attendant la correction, l'application reste 100&nbsp;% fonctionnelle sur l'URL
            officielle&nbsp;:{' '}
            <a
              href={OFFICIAL_PREVIEW_URL}
              className="font-semibold underline decoration-amber-400 underline-offset-2"
            >
              {OFFICIAL_PREVIEW_URL.replace('https://', '')}
            </a>
            .
          </p>
        </div>

        {/* Quick step-by-step checklist */}
        <Checklist />

        <div className="mt-6 space-y-3">

          <Section icon={Globe} title="1. Configurer les enregistrements DNS (A / CNAME)" defaultOpen>
            <p>
              Chez votre registraire de domaine (où vous avez acheté intervenia.ca), ouvrez la zone
              DNS et pointez le domaine vers votre hébergeur. Deux cas typiques&nbsp;:
            </p>
            <p className="mt-3 font-medium text-slate-800">A. Pointer vers une adresse IP (enregistrement A)</p>
            <CodeBlock
              label="Zone DNS"
              code={`Type    Nom (Host)    Valeur              TTL
A       @             123.45.67.89        3600
A       www           123.45.67.89        3600`}
            />
            <p className="mt-4 font-medium text-slate-800">B. Pointer vers un hôte (enregistrement CNAME)</p>
            <CodeBlock
              label="Zone DNS"
              code={`Type     Nom (Host)    Valeur                         TTL
CNAME    www           votre-app.hebergeur.com.       3600
ALIAS    @             votre-app.hebergeur.com.       3600`}
            />
            <p className="mt-3 text-xs text-slate-500">
              Remplacez l'IP ou l'hôte par ceux fournis par votre hébergeur. La propagation DNS peut
              prendre de quelques minutes à 48&nbsp;h.
            </p>
          </Section>

          <Section icon={Lock} title="2. Émettre un certificat HTTPS (Let's Encrypt)">
            <p>
              Une fois le DNS pointé, générez un certificat gratuit Let's Encrypt. Sur un serveur
              Linux avec Certbot&nbsp;:
            </p>
            <CodeBlock
              label="Terminal (serveur)"
              code={`# Installer Certbot
sudo apt update
sudo apt install certbot python3-certbot-apache -y

# Émettre + installer le certificat pour les deux noms
sudo certbot --apache -d intervenia.ca -d www.intervenia.ca

# Tester le renouvellement automatique
sudo certbot renew --dry-run`}
            />
            <p className="mt-3">
              Pour Nginx, remplacez <code className="rounded bg-slate-100 px-1">--apache</code> par{' '}
              <code className="rounded bg-slate-100 px-1">--nginx</code>. Sur un hébergement mutualisé
              (cPanel/Plesk), cherchez la section «&nbsp;SSL/TLS&nbsp;» ou «&nbsp;Let's Encrypt&nbsp;»
              et activez le certificat en un clic.
            </p>
            <p className="mt-3 text-xs text-slate-500">
              Important&nbsp;: le certificat doit couvrir EXACTEMENT intervenia.ca ET
              www.intervenia.ca, sinon le navigateur affichera ERR_CERT_COMMON_NAME_INVALID.
            </p>
          </Section>

          <Section icon={FileCode2} title="3. Router une application SPA (.htaccess)">
            <p>
              Comme l'application est une SPA React (routage côté client), toutes les URL doivent
              renvoyer vers <code className="rounded bg-slate-100 px-1">index.html</code>. Sur Apache,
              placez ce fichier à la racine du site&nbsp;:
            </p>
            <CodeBlock
              label=".htaccess"
              code={`<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /

  # Forcer le HTTPS
  RewriteCond %{HTTPS} off
  RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

  # Forcer www -> non-www (optionnel)
  # RewriteCond %{HTTP_HOST} ^www\\.(.*)$ [NC]
  # RewriteRule ^ https://%1%{REQUEST_URI} [L,R=301]

  # SPA fallback : tout vers index.html
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule ^ index.html [L]
</IfModule>`}
            />
            <p className="mt-4 font-medium text-slate-800">Équivalent Nginx</p>
            <CodeBlock
              label="nginx.conf"
              code={`server {
  listen 443 ssl;
  server_name intervenia.ca www.intervenia.ca;

  ssl_certificate     /etc/letsencrypt/live/intervenia.ca/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/intervenia.ca/privkey.pem;

  root /var/www/intervenia;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }
}

# Redirection HTTP -> HTTPS
server {
  listen 80;
  server_name intervenia.ca www.intervenia.ca;
  return 301 https://$host$request_uri;
}`}
            />
          </Section>

          <Section icon={ShieldCheck} title="4. Vérifier que tout fonctionne">
            <p>Après les changements, validez avec ces commandes&nbsp;:</p>
            <CodeBlock
              label="Terminal"
              code={`# Vérifier la résolution DNS
dig +short intervenia.ca
dig +short www.intervenia.ca

# Vérifier le certificat et son nom commun
echo | openssl s_client -connect intervenia.ca:443 -servername intervenia.ca 2>/dev/null | openssl x509 -noout -subject -dates`}
            />
            <p className="mt-3">
              Puis ouvrez{' '}
              <a
                href="https://intervenia.ca"
                className="font-semibold text-indigo-600 underline underline-offset-2"
              >
                https://intervenia.ca
              </a>{' '}
              dans une fenêtre privée. Le cadenas doit apparaître sans avertissement. Vous pouvez
              aussi revenir sur la{' '}
              <Link to="/status" className="font-semibold text-indigo-600 underline underline-offset-2">
                page d'état
              </Link>{' '}
              pour confirmer que le backend répond.
            </p>
          </Section>
        </div>

        <p className="mt-8 text-center text-xs text-slate-400">
          Ces étapes se réalisent chez votre hébergeur / registraire de domaine — elles ne dépendent
          pas du code de l'application.
        </p>
      </div>
    </div>
  );
};

export default DomainHelp;
