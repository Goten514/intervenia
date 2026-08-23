import React, { createContext, useContext, useEffect, useState } from 'react';

// Lightweight client-side auth that persists to localStorage.
// This replaces the previous Supabase-based auth which was failing because
// the configured database URL does not provide a hosted auth (GoTrue) service.

export interface AuthUser {
  id: string;
  email: string;
  user_metadata: { full_name?: string };
  created_at: string;
}

interface StoredUser extends AuthUser {
  password: string;
}

interface AuthContextType {
  user: AuthUser | null;
  session: { user: AuthUser } | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: any }>;
  signInWithGoogle: (email: string, fullName?: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}


const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USERS_KEY = 'intervenia.users';
const SESSION_KEY = 'intervenia.session';

const readUsers = (): StoredUser[] => {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const writeUsers = (users: StoredUser[]) => {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

const readSession = (): AuthUser | null => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeSession = (user: AuthUser | null) => {
  if (user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
};

const genId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return (crypto as any).randomUUID();
  }
  return 'usr_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const existing = readSession();
    setUser(existing);
    setLoading(false);
  }, []);

  const signIn = async (email: string, password: string) => {
    await new Promise((r) => setTimeout(r, 300));
    const users = readUsers();
    const normalized = email.trim().toLowerCase();
    const found = users.find((u) => u.email.toLowerCase() === normalized);
    if (!found) {
      return { error: { message: 'Invalid login credentials' } };
    }
    if (found.password !== password) {
      return { error: { message: 'Invalid login credentials' } };
    }
    const { password: _pw, ...publicUser } = found;
    writeSession(publicUser);
    setUser(publicUser);
    return { error: null };
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    await new Promise((r) => setTimeout(r, 300));
    const users = readUsers();
    const normalized = email.trim().toLowerCase();
    if (users.some((u) => u.email.toLowerCase() === normalized)) {
      return { error: { message: 'User already registered' } };
    }
    const newUser: StoredUser = {
      id: genId(),
      email: normalized,
      password,
      user_metadata: { full_name: fullName || '' },
      created_at: new Date().toISOString(),
    };
    users.push(newUser);
    writeUsers(users);
    const { password: _pw, ...publicUser } = newUser;
    writeSession(publicUser);
    setUser(publicUser);
    return { error: null };
  };

  const signInWithGoogle = async (email: string, fullName?: string) => {
    await new Promise((r) => setTimeout(r, 400));
    const normalized = (email || '').trim().toLowerCase();
    if (!normalized || !normalized.includes('@')) {
      return { error: { message: 'Courriel Google invalide' } };
    }
    const users = readUsers();
    let existing = users.find((u) => u.email.toLowerCase() === normalized);
    if (!existing) {
      existing = {
        id: genId(),
        email: normalized,
        password: '__google_oauth__',
        user_metadata: { full_name: fullName || normalized.split('@')[0] },
        created_at: new Date().toISOString(),
      };
      users.push(existing);
      writeUsers(users);
    } else if (fullName && !existing.user_metadata.full_name) {
      existing.user_metadata.full_name = fullName;
      writeUsers(users);
    }
    const { password: _pw, ...publicUser } = existing;
    writeSession(publicUser);
    setUser(publicUser);
    return { error: null };
  };


  const signOut = async () => {
    writeSession(null);
    setUser(null);
  };

  const session = user ? { user } : null;

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
