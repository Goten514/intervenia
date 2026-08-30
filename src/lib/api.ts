const API_BASE = import.meta.env.VITE_API_URL || 'https://intervenia-production.up.railway.app/api';

let _token: string | null = localStorage.getItem('intervenia:token');

export function setToken(token: string | null) {
  _token = token;
  if (token) localStorage.setItem('intervenia:token', token);
  else localStorage.removeItem('intervenia:token');
}

export function getToken(): string | null {
  return _token;
}

async function request(path: string, options: RequestInit = {}): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (_token) headers['Authorization'] = `Bearer ${_token}`;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Erreur ${res.status}`);
  return body;
}

// Auth
export const auth = {
  signup: (email: string, password: string, fullName?: string) =>
    request('/auth/signup', { method: 'POST', body: JSON.stringify({ email, password, fullName }) }),
  login: (email: string, password: string) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => request('/auth/me'),
  consent: (userId: string, consent: boolean) =>
    request('/auth/consent', { method: 'POST', body: JSON.stringify({ userId, consent }) }),
};

// Interventions
export const interventions = {
  list: () => request('/interventions'),
  get: (id: string) => request(`/interventions/${id}`),
  create: (data: any) => request('/interventions', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => request(`/interventions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request(`/interventions/${id}`, { method: 'DELETE' }),
};

// Clients
export const clients = {
  list: () => request('/clients'),
  create: (data: any) => request('/clients', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => request(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request(`/clients/${id}`, { method: 'DELETE' }),
};

// IA
export const ai = {
  generate: (params: { age: string; problematique: string; contexte?: string; objectif?: string; type?: string }) =>
    request('/ai/generate', { method: 'POST', body: JSON.stringify(params) }),
};