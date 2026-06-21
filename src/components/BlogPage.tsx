import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Calendar, User, ArrowLeft, ArrowRight, BookOpen, Facebook, Linkedin, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// Icône X (Twitter) personnalisée (absente de lucide-react sous ce nom).
const XIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
  </svg>
);

// Boutons de partage social pour un article.
const ShareButtons: React.FC<{ title: string }> = ({ title }) => {
  const url = typeof window !== 'undefined' ? window.location.href : 'https://intervenia.ca';
  const encUrl = encodeURIComponent(url);
  const encTitle = encodeURIComponent(title);

  const links = [
    {
      label: 'Partager sur Facebook',
      Icon: Facebook,
      href: `https://www.facebook.com/sharer/sharer.php?u=${encUrl}`,
      cls: 'hover:bg-[#1877F2] hover:border-[#1877F2]',
    },
    {
      label: 'Partager sur LinkedIn',
      Icon: Linkedin,
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encUrl}`,
      cls: 'hover:bg-[#0A66C2] hover:border-[#0A66C2]',
    },
    {
      label: 'Partager sur X',
      Icon: XIcon,
      href: `https://twitter.com/intent/tweet?url=${encUrl}&text=${encTitle}`,
      cls: 'hover:bg-black hover:border-black',
    },
  ];

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Lien copié dans le presse-papier.');
    } catch {
      toast.error('Impossible de copier le lien.');
    }
  };

  return (
    <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-6">
      <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
        <Share2 className="h-4 w-4 text-indigo-600" /> Partager :
      </span>
      {links.map(({ label, Icon, href, cls }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          title={label}
          className={`flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 text-slate-600 transition-colors hover:text-white ${cls}`}
        >
          <Icon className="h-4 w-4" />
        </a>
      ))}
      <button
        onClick={copyLink}
        className="ml-1 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-indigo-400 hover:text-indigo-600"
      >
        Copier le lien
      </button>
    </div>
  );
};

interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  author: string;
  image_url: string | null;
  category: string;
  published_at: string;
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' });

const renderContent = (content: string) =>
  content.split('\n').map((line, i) => {
    if (line.startsWith('## ')) {
      return (
        <h2 key={i} className="mt-8 text-xl font-bold text-slate-900">
          {line.replace('## ', '')}
        </h2>
      );
    }
    if (!line.trim()) return null;
    return (
      <p key={i} className="mt-4 leading-relaxed text-slate-700">
        {line}
      </p>
    );
  });

const BlogPage: React.FC = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Post | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('blog_posts')
        .select('*')
        .order('published_at', { ascending: false });
      setPosts((data as Post[]) || []);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (selected) window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [selected]);

  if (selected) {
    return (
      <article className="bg-white py-12 sm:py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <button
            onClick={() => setSelected(null)}
            className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-800"
          >
            <ArrowLeft className="h-4 w-4" /> Retour au blog
          </button>

          <span className="mt-6 inline-block rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-700">
            {selected.category}
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            {selected.title}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-slate-500">
            <span className="flex items-center gap-1.5">
              <User className="h-4 w-4" /> {selected.author}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" /> {formatDate(selected.published_at)}
            </span>
          </div>

          {selected.image_url && (
            <img
              src={selected.image_url}
              alt={selected.title}
              className="mt-8 aspect-video w-full rounded-2xl object-cover"
            />
          )}

          <div className="mt-8">{renderContent(selected.content)}</div>

          <ShareButtons title={selected.title} />
        </div>
      </article>
    );
  }

  return (
    <section className="bg-gradient-to-b from-slate-50 to-white py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="flex items-center justify-center gap-2 text-sm font-semibold text-indigo-600">
            <BookOpen className="h-4 w-4" /> Le blog IntervenIA
          </span>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Conseils et réflexions pour les intervenants
          </h1>
          <p className="mt-3 text-slate-600">
            Stratégies cliniques, innovation et bonnes pratiques pour enrichir votre quotidien.
          </p>
        </div>

        {loading ? (
          <p className="mt-12 text-center text-slate-500">Chargement des articles…</p>
        ) : posts.length === 0 ? (
          <p className="mt-12 text-center text-slate-500">Aucun article pour le moment.</p>
        ) : (
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <button
                key={post.id}
                onClick={() => setSelected(post)}
                className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
              >
                {post.image_url && (
                  <div className="overflow-hidden">
                    <img
                      src={post.image_url}
                      alt={post.title}
                      className="aspect-video w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                )}
                <div className="flex flex-1 flex-col p-5">
                  <span className="inline-block w-fit rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                    {post.category}
                  </span>
                  <h2 className="mt-3 text-lg font-semibold text-slate-900 group-hover:text-indigo-700">
                    {post.title}
                  </h2>
                  <p className="mt-2 flex-1 text-sm text-slate-600">{post.excerpt}</p>
                  <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5" /> {post.author}
                    </span>
                    <span>{formatDate(post.published_at)}</span>
                  </div>
                  <span className="mt-4 flex items-center gap-1 text-sm font-medium text-indigo-600">
                    Lire l'article <ArrowRight className="h-4 w-4" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default BlogPage;
