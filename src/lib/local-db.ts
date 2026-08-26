const genId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return (crypto as any).randomUUID();
  }
  return 'doc_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
};

const STORE_PREFIX = 'intervenia:db:';

const readTable = (table: string): any[] => {
  try {
    const raw = localStorage.getItem(STORE_PREFIX + table);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const writeTable = (table: string, items: any[]) => {
  localStorage.setItem(STORE_PREFIX + table, JSON.stringify(items));
};

function makeTable(table: string) {
  return {
    select: () => Promise.resolve({ data: readTable(table), error: null }),
    insert: (record: any) => {
      const items = readTable(table);
      const newItem: any = {
        ...record,
        id: record.id || genId(),
        created_at: record.created_at || new Date().toISOString(),
      };
      items.push(newItem);
      writeTable(table, items);
      return Promise.resolve({ data: [newItem], error: null });
    },
    update: (updates: any) => ({
      eq: (field: string, value: string) => {
        const items = readTable(table);
        const idx = items.findIndex((i: any) => i[field] === value);
        if (idx >= 0) {
          items[idx] = { ...items[idx], ...updates };
          writeTable(table, items);
        }
        return Promise.resolve({ data: items[idx] || null, error: null });
      },
    }),
    delete: () => ({
      eq: (field: string, value: string) => {
        const items = readTable(table).filter((i: any) => i[field] !== value);
        writeTable(table, items);
        return Promise.resolve({ error: null });
      },
    }),
    eq: (field: string, value: string) => ({
      order: (col: string, opts?: any) => {
        const items = readTable(table).filter((i: any) => i[field] === value);
        items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return Promise.resolve({ data: items, error: null });
      },
      select: (cols?: string) => {
        const items = readTable(table).filter((i: any) => i[field] === value);
        return Promise.resolve({ data: items, error: null });
      },
      maybeSingle: () => {
        const items = readTable(table).filter((i: any) => i[field] === value);
        return Promise.resolve({ data: items[0] || null, error: null });
      },
    }),
    not: (field: string, op: string, val: any) => ({
      select: (cols?: string) => {
        const items = readTable(table).filter((i: any) => i[field] !== val);
        return Promise.resolve({ data: items, error: null });
      },
    }),
    or: (filters: string) => ({
      order: (col: string, opts?: any) => {
        const items = readTable(table);
        items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return Promise.resolve({ data: items, error: null });
      },
      limit: (n: number) => Promise.resolve({ data: readTable(table).slice(0, n), error: null }),
    }),
  };
}

export const supabase = {
  from: (table: string) => makeTable(table),
  functions: {
    invoke: async () => ({ data: null, error: { message: 'No backend' } }),
  },
  auth: {
    signUp: async () => ({ data: null, error: { message: 'No backend' } }),
    signIn: async () => ({ data: null, error: { message: 'No backend' } }),
    signOut: async () => {},
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
  },
};