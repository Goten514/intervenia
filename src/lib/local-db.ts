const INTERVENTIONS_KEY = 'intervenia:interventions';

export interface StoredIntervention {
  id: string;
  titre: string;
  problematique: string | null;
  type: string | null;
  age: number | null;
  contenu: any;
  created_at: string;
  is_draft?: boolean;
  shared_with?: string[];
  user_id?: string;
}

const genId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return (crypto as any).randomUUID();
  }
  return 'int_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
};

const readAll = (): StoredIntervention[] => {
  try {
    const raw = localStorage.getItem(INTERVENTIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const writeAll = (items: StoredIntervention[]) => {
  localStorage.setItem(INTERVENTIONS_KEY, JSON.stringify(items));
};

export const db = {
  from: () => ({
    select: () => Promise.resolve({ data: readAll(), error: null }),
    insert: (record: any) => {
      const items = readAll();
      const newItem: StoredIntervention = {
        ...record,
        id: record.id || genId(),
        created_at: record.created_at || new Date().toISOString(),
        user_id: record.user_id || 'local',
      };
      items.push(newItem);
      writeAll(items);
      return Promise.resolve({ data: [newItem], error: null });
    },
    update: (updates: any) => ({
      eq: (field: string, value: string) => {
        const items = readAll();
        const idx = items.findIndex((i: any) => i[field] === value);
        if (idx >= 0) {
          items[idx] = { ...items[idx], ...updates };
          writeAll(items);
        }
        return Promise.resolve({ data: items[idx] || null, error: null });
      },
    }),
    delete: () => ({
      eq: (field: string, value: string) => {
        const items = readAll().filter((i: any) => i[field] !== value);
        writeAll(items);
        return Promise.resolve({ error: null });
      },
    }),
    eq: (field: string, value: string) => ({
      order: (col: string, opts?: any) => {
        const items = readAll().filter((i: any) => i[field] === value);
        items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return Promise.resolve({ data: items, error: null });
      },
      select: () => {
        const items = readAll().filter((i: any) => i[field] === value);
        return Promise.resolve({ data: items, error: null });
      },
      maybeSingle: () => {
        const items = readAll().filter((i: any) => i[field] === value);
        return Promise.resolve({ data: items[0] || null, error: null });
      },
    }),
    or: (filters: string) => ({
      order: (col: string, opts?: any) => {
        const items = readAll();
        items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return Promise.resolve({ data: items, error: null });
      },
      limit: (n: number) => Promise.resolve({ data: readAll().slice(0, n), error: null }),
    }),
  }),
};