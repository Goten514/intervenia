import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  Upload,
  X,
  Save,
  ImageIcon,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

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

type FormState = {
  id: string | null;
  title: string;
  excerpt: string;
  content: string;
  author: string;
  category: string;
  image_url: string;
  published_at: string;
};

const emptyForm: FormState = {
  id: null,
  title: '',
  excerpt: '',
  content: '',
  author: '',
  category: '',
  image_url: '',
  published_at: new Date().toISOString().slice(0, 10),
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' });

const BlogManager: React.FC = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('blog_posts')
      .select('*')
      .order('published_at', { ascending: false });
    setPosts((data as Post[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const startCreate = () => {
    setForm(emptyForm);
    setEditing(true);
  };

  const startEdit = (p: Post) => {
    setForm({
      id: p.id,
      title: p.title,
      excerpt: p.excerpt,
      content: p.content,
      author: p.author,
      category: p.category || '',
      image_url: p.image_url || '',
      published_at: p.published_at ? p.published_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
    });
    setEditing(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Veuillez sélectionner une image.');
      return;
    }
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from('blog-images').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });
    if (error) {
      toast.error("Échec du téléversement de l'image.");
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from('blog-images').getPublicUrl(path);
    setForm((f) => ({ ...f, image_url: data.publicUrl }));
    setUploading(false);
    toast.success('Image téléversée.');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.excerpt.trim() || !form.content.trim() || !form.author.trim()) {
      toast.error('Veuillez remplir tous les champs obligatoires.');
      return;
    }
    setSaving(true);
    const payload = {
      slug: slugify(form.title) || `article-${Date.now()}`,
      title: form.title.trim(),
      excerpt: form.excerpt.trim(),
      content: form.content.trim(),
      author: form.author.trim(),
      category: form.category.trim() || 'Général',
      image_url: form.image_url.trim() || null,
      published_at: new Date(form.published_at).toISOString(),
    };

    if (form.id) {
      const { error } = await supabase.from('blog_posts').update(payload).eq('id', form.id);
      if (error) {
        toast.error('Échec de la mise à jour.');
        setSaving(false);
        return;
      }
      toast.success('Article mis à jour.');
    } else {
      const { error } = await supabase.from('blog_posts').insert(payload);
      if (error) {
        toast.error("Échec de la création de l'article.");
        setSaving(false);
        return;
      }
      toast.success('Article créé.');
    }
    setSaving(false);
    setEditing(false);
    setForm(emptyForm);
    load();
  };

  const handleDelete = async (p: Post) => {
    if (!window.confirm(`Supprimer l'article « ${p.title} » ?`)) return;
    const { error } = await supabase.from('blog_posts').delete().eq('id', p.id);
    if (error) {
      toast.error('Échec de la suppression.');
      return;
    }
    toast.success('Article supprimé.');
    setPosts((list) => list.filter((x) => x.id !== p.id));
  };

  if (editing) {
    return (
      <form
        onSubmit={handleSave}
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">
            {form.id ? "Modifier l'article" : 'Nouvel article'}
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditing(false);
              setForm(emptyForm);
            }}
          >
            <X className="mr-1.5 h-4 w-4" /> Annuler
          </Button>
        </div>

        <div className="mt-6 grid gap-5">
          <div>
            <label className="text-sm font-medium text-slate-700">Titre *</label>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Titre de l'article"
              className="mt-1.5"
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-700">Auteur *</label>
              <Input
                value={form.author}
                onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))}
                placeholder="Nom de l'auteur"
                className="mt-1.5"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Catégorie</label>
              <Input
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="Ex. Clinique"
                className="mt-1.5"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Date de publication</label>
            <Input
              type="date"
              value={form.published_at}
              onChange={(e) => setForm((f) => ({ ...f, published_at: e.target.value }))}
              className="mt-1.5 w-full sm:w-56"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Extrait *</label>
            <Textarea
              value={form.excerpt}
              onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
              placeholder="Court résumé affiché dans la liste."
              rows={2}
              className="mt-1.5"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Contenu *</label>
            <p className="text-xs text-slate-500">Utilisez « ## » en début de ligne pour les sous-titres.</p>
            <Textarea
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              placeholder="Corps de l'article…"
              rows={10}
              className="mt-1.5"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Image de couverture</label>
            <div className="mt-1.5 flex flex-wrap items-center gap-4">
              {form.image_url ? (
                <div className="relative">
                  <img
                    src={form.image_url}
                    alt="Aperçu"
                    className="h-24 w-40 rounded-lg border border-slate-200 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, image_url: '' }))}
                    className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-white shadow"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex h-24 w-40 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 text-slate-400">
                  <ImageIcon className="h-6 w-6" />
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleUpload}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                {uploading ? 'Téléversement…' : 'Téléverser une image'}
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setEditing(false);
              setForm(emptyForm);
            }}
          >
            Annuler
          </Button>
          <Button type="submit" className="gradient-brand" disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {form.id ? 'Enregistrer' : 'Publier'}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Articles de blog</h2>
          <p className="mt-1 text-sm text-slate-600">{posts.length} article(s)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Actualiser
          </Button>
          <Button size="sm" className="gradient-brand" onClick={startCreate}>
            <Plus className="mr-2 h-4 w-4" /> Nouvel article
          </Button>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {posts.length === 0 && !loading && (
          <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
            Aucun article. Cliquez sur « Nouvel article » pour commencer.
          </p>
        )}
        {posts.map((p) => (
          <div
            key={p.id}
            className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            {p.image_url ? (
              <img
                src={p.image_url}
                alt={p.title}
                className="h-16 w-24 flex-shrink-0 rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-16 w-24 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                <ImageIcon className="h-5 w-5" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                  {p.category || 'Général'}
                </span>
                <span className="text-xs text-slate-400">{formatDate(p.published_at)}</span>
              </div>
              <h3 className="mt-1 truncate font-semibold text-slate-900">{p.title}</h3>
              <p className="truncate text-sm text-slate-500">Par {p.author}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => startEdit(p)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDelete(p)}
                className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BlogManager;
