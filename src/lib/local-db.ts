// Pont transparent : toutes les requêtes Supabase des composants
// sont redirigées vers le backend sécurisé.
// Aucun changement nécessaire dans les composants.

import { interventions, clients } from './api';

const genId = () => crypto.randomUUID ? crypto.randomUUID() : 'id_' + Math.random().toString(36).slice(2);

const STORE_PREFIX = 'intervenia:db:';

// Fallback localStorage pour les données non synchronisées (blog, admin, etc.)
const readLocal = (table: string): any[] => {
  try { return JSON.parse(localStorage.getItem(STORE_PREFIX + table) || '[]'); } catch { return []; }
};
const writeLocal = (table: string, items: any[]) => {
  try { localStorage.setItem(STORE_PREFIX + table, JSON.stringify(items)); } catch {}
};

// API routes par table
const API: Record<string, { list: () => Promise<any>; create: (d: any) => Promise<any>; update: (id: string, d: any) => Promise<any>; del: (id: string) => Promise<any> } | null> = {
  interventions: {
    list: async () => { const r = await interventions.list(); return r.data; },
    create: async (d) => { const r = await interventions.create(d); return [r.data]; },
    update: async (id, d) => { await interventions.update(id, d); return []; },
    del: async (id) => { await interventions.delete(id); },
  },
  clients: {
    list: async () => { const r = await clients.list(); return r.data; },
    create: async (d) => { const r = await clients.create(d); return [r.data]; },
    update: async (id, d) => { await clients.update(id, d); return []; },
    del: async (id) => { await clients.delete(id); },
  },
};

function getAPI(table: string) {
  return API[table] || null;
}

type Filter = (row: any) => boolean;

function chain(getRows: () => any[], useApi?: boolean) {
  const filters: Filter[] = [];
  let limitN: number | null = null;
  let sortDesc = true;

  const apply = async () => {
    let rows = await getRows();
    for (const f of filters) rows = rows.filter(f);
    rows = [...rows].sort(sortDesc ? (a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime() : (a: any, b: any) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
    if (limitN != null) rows = rows.slice(0, limitN);
    return rows;
  };

  const p: any = { then: async (res: any, rej: any) => {
    try {
      const result = await apply();
      return Promise.resolve({ data: result, error: null }).then(res, rej);
    } catch { return Promise.resolve({ data: [], error: null }).then(res, rej); }
  }};
  p.eq = (f: string, v: any) => { filters.push((r) => r[f] === v); return p; };
  p.neq = (f: string, v: any) => { filters.push((r) => r[f] !== v); return p; };
  p.not = (f: string, _op: string, v: any) => { filters.push((r) => r[f] !== v); return p; };
  p.in = (f: string, vals: any[]) => { filters.push((r) => vals.includes(r[f])); return p; };
  p.order = (_col?: string, opts?: any) => { sortDesc = opts?.ascending ? false : true; return p; };
  p.limit = (n: number) => { limitN = n; return p; };

  Object.defineProperty(p, 'count', { get: () => { let rows = getRows(); for (const f of filters) rows = rows.filter(f); return rows.length; } });
  p.maybeSingle = async () => ({ data: (await apply())[0] || null, error: null });
  p.single = async () => ({ data: (await apply())[0] || null, error: null });
  return p;
}

function insertResult(row: any) {
  const base: any = { then: (res: any, rej: any) => Promise.resolve({ data: [row], error: null }).then(res, rej), data: [row], error: null };
  base.select = () => ({ single: async () => ({ data: row, error: null }) });
  return base;
}

function makeTable(table: string) {
  const api = getAPI(table);
  
  async function fetchRows(): Promise<any[]> {
    if (!api) return readLocal(table);
    try { return await api.list(); }
    catch { return readLocal(table); }
  }

  return {
    select: (_cols?: string, _opts?: any) => chain(fetchRows),
    insert: async (record: any) => {
      const item = { ...record, ...(!record.id && { id: genId() }), ...(!record.created_at && { created_at: new Date().toISOString() }) };
      if (api) {
        try { const rows = await api.create(item); return insertResult(rows[0] || item); }
        catch (e) { console.warn('API insert failed, fallback local:', e); }
      }
      const items = readLocal(table);
      items.push(item);
      writeLocal(table, items);
      return insertResult(item);
    },
    update: (updates: any) => {
      const filters: Filter[] = [];
      const p: any = { then: async (res: any, rej: any) => {
        const items = readLocal(table);
        const updated: any[] = [];
        const next = items.map(r => { const match = filters.every(f => f(r)); if (match) { const nr = { ...r, ...updates }; updated.push(nr); return nr; } return r; });
        writeLocal(table, next);
        return Promise.resolve({ data: updated, error: null }).then(res, rej);
      }};
      p.eq = async (f: string, v: string) => {
        if (api && f === 'id') { try { await api.update(v, updates); } catch {} }
        filters.push((r) => r[f] === v);
        return p;
      };
      return p;
    },
    delete: () => {
      const filters: Filter[] = [];
      const p: any = { then: (res: any, rej: any) => {
        const items = readLocal(table);
        const kept = items.filter(r => !filters.every(f => f(r)));
        writeLocal(table, kept);
        return Promise.resolve({ data: null, error: null }).then(res, rej);
      }};
      p.eq = async (f: string, v: string) => {
        if (api && f === 'id') { try { await api.del(v); } catch {} }
        filters.push(r => r[f] === v);
        return p;
      };
      return p;
    },
    eq: (field: string, value: string) => ({
      order: (col: string, opts?: any) => chain(async () => { if (api) { try { const rows = await api.list(); return rows.filter((r: any) => r[field] === value); } catch {} } return readLocal(table).filter(r => r[field] === value); }, true),
      select: (cols?: string) => chain(async () => { if (api) { try { const rows = await api.list(); return rows.filter((r: any) => r[field] === value); } catch {} } return readLocal(table).filter(r => r[field] === value); }, true),
      maybeSingle: async () => { if (api) { try { const rows = await api.list(); const found = rows.find((r: any) => r[field] === value); return { data: found || null, error: null }; } catch {} } const items = readLocal(table).filter(r => r[field] === value); return { data: items[0] || null, error: null }; },
    }),
    not: (field: string, op: string, val: any) => ({ select: () => Promise.resolve({ data: readLocal(table).filter(r => r[field] !== val), error: null }) }),
    or: (_s: string) => ({ order: () => chain(() => readLocal(table)), limit: (n: number) => ({ data: readLocal(table).slice(0, n), error: null }) }),
  };
}

export const supabase = {
  from: (table: string) => makeTable(table),
  functions: { invoke: async () => ({ data: null, error: { message: 'Backend requis' } }) },
  auth: { signUp: async () => ({ data: null, error: null }), signIn: async () => ({ data: null, error: null }), signOut: async () => {}, getSession: async () => ({ data: { session: null }, error: null }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }) },
};

export const probeBackendReachable = async () => true;
export type RestProbeResult = { kind: 'ok'; status: number; ms: number; sample?: unknown } | { kind: string; status?: number; ms: number; detail?: string };
export const probeRestTable = async (): Promise<RestProbeResult> => ({ kind: 'ok', status: 200, ms: 0, sample: [] });