// Mini base de données locale (localStorage) — remplace Supabase.
// Compatible avec les chaînages utilisés dans l'app :
// .select() .insert() .update() .delete() .eq() .in() .not() .or()
// .order() .limit() .maybeSingle() .single() et insert().select('id').single()

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
  try {
    localStorage.setItem(STORE_PREFIX + table, JSON.stringify(items));
  } catch {
    /* quota dépassé — ignorer */
  }
};

const byCreatedDesc = (a: any, b: any) =>
  new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();

type Filter = (row: any) => boolean;

/**
 * Un "thenable" chaînable : on peut faire await dessus ET appeler
 * d'autres méthodes de filtre avant le await.
 */
function chain(getRows: () => any[]) {
  const filters: Filter[] = [];
  let limitN: number | null = null;
  let sortDesc = true;

  const apply = (): any[] => {
    let rows = getRows();
    for (const f of filters) rows = rows.filter(f);
    rows = [...rows].sort(sortDesc ? byCreatedDesc : (a, b) => -byCreatedDesc(a, b));
    if (limitN != null) rows = rows.slice(0, limitN);
    return rows;
  };

  const p: any = { then: (res: any, rej: any) => Promise.resolve({ data: apply(), error: null }).then(res, rej) };

  p.eq = (f: string, v: any) => { filters.push((r) => r[f] === v); return p; };
  p.neq = (f: string, v: any) => { filters.push((r) => r[f] !== v); return p; };
  p.not = (f: string, _op: string, v: any) => { filters.push((r) => r[f] !== v); return p; };
  p.in = (f: string, vals: any[]) => { filters.push((r) => vals.includes(r[f])); return p; };
  p.ilike = (f: string, pattern: string) => {
    const rx = new RegExp('^' + pattern.replace(/%/g, '.*').replace(/_/g, '.') + '$', 'i');
    filters.push((r) => rx.test(String(r[f] ?? '')));
    return p;
  };
  p.or = (_spec: string) => p; // simplification : renvoie tout
  p.order = (_col?: string, opts?: any) => { sortDesc = opts?.ascending ? false : true; return p; };
  p.limit = (n: number) => { limitN = n; return p; };

  // Compatibilité : select('*', { count: 'exact', head: true })
  Object.defineProperty(p, 'count', {
    get: () => {
      let rows = getRows();
      for (const f of filters) rows = rows.filter(f);
      return rows.length;
    },
  });

  p.maybeSingle = async () => ({ data: apply()[0] || null, error: null });
  p.single = async () => ({ data: apply()[0] || null, error: null });

  return p;
}

/** Résultat d'insertion : await direct OU .select(...).single() */
function insertResult(row: any) {
  const base: any = {
    then: (res: any, rej: any) => Promise.resolve({ data: [row], error: null }).then(res, rej),
    data: [row],
    error: null,
  };
  base.select = (_cols?: string) => ({
    single: async () => ({ data: row, error: null }),
    maybeSingle: async () => ({ data: row, error: null }),
  });
  return base;
}

function makeTable(table: string) {
  return {
    select: (_cols?: string, _opts?: any) => chain(() => readTable(table)),

    insert: (record: any) => {
      const items = readTable(table);
      const newRow: any = Array.isArray(record)
        ? record.map((r: any) => ({
            ...r,
            id: r.id || genId(),
            created_at: r.created_at || new Date().toISOString(),
          }))
        : [{
            ...record,
            id: record.id || genId(),
            created_at: record.created_at || new Date().toISOString(),
          }];
      items.push(...newRow);
      writeTable(table, items);
      return insertResult(newRow[0]);
    },

    update: (updates: any) => {
      const filters: Filter[] = [];
      const p: any = {
        then: (res: any, rej: any) => {
          const rows = readTable(table);
          const updated: any[] = [];
          const next = rows.map((r) => {
            const match = filters.every((f) => f(r));
            if (match) {
              const nr = { ...r, ...updates };
              updated.push(nr);
              return nr;
            }
            return r;
          });
          writeTable(table, next);
          return Promise.resolve({ data: updated, error: null }).then(res, rej);
        },
        data: [],
        error: null,
      };
      p.eq = (f: string, v: any) => { filters.push((r) => r[f] === v); return p; };
      p.in = (f: string, vals: any[]) => { filters.push((r) => vals.includes(r[f])); return p; };
      return p;
    },

    delete: () => {
      const filters: Filter[] = [];
      const p: any = {
        then: (res: any, rej: any) => {
          const rows = readTable(table);
          const kept = rows.filter((r) => !filters.every((f) => f(r)));
          writeTable(table, kept);
          return Promise.resolve({ data: null, error: null }).then(res, rej);
        },
        data: null,
        error: null,
      };
      p.eq = (f: string, v: any) => { filters.push((r) => r[f] === v); return p; };
      p.in = (f: string, vals: any[]) => { filters.push((r) => vals.includes(r[f])); return p; };
      return p;
    },
  };
}

export const supabase = {
  from: (table: string) => makeTable(table),
  functions: {
    invoke: async (name: string) => {
      if (name === 'health-check') {
        return { data: { ready: true, status: 'ready', gateway: 'ok' }, error: null };
      }
      return { data: null, error: { message: 'Fonction indisponible en mode local' } };
    },
  },
  auth: {
    signUp: async () => ({ data: null, error: { message: 'Auth locale gérée par AuthContext' } }),
    signIn: async () => ({ data: null, error: { message: 'Auth locale gérée par AuthContext' } }),
    signOut: async () => {},
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
  },
};

/** Sondes réseau conservées pour compatibilité avec RestGatewayCheck / Banner. */
export const probeBackendReachable = async (): Promise<boolean> => true;

export type RestProbeResult =
  | { kind: 'ok'; status: number; ms: number; sample?: unknown }
  | { kind: 'not_found'; status: number; ms: number; body?: string }
  | { kind: 'forbidden'; status: number; ms: number; body?: string }
  | { kind: 'http'; status: number; ms: number; body?: string }
  | { kind: 'cors'; ms: number; detail: string };

export const probeRestTable = async (): Promise<RestProbeResult> => ({
  kind: 'ok',
  status: 200,
  ms: 0,
  sample: [],
});
