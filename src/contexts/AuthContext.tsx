import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { auth, setToken, getToken } from '@/lib/api';

export interface AuthUser {
  id: string;
  email: string;
  full_name?: string;
  user_metadata?: { full_name?: string };
  created_at?: string;
  role?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  session: { user: AuthUser } | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: any }>;
  signInWithGoogle: (email: string, fullName?: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  consentGiven: boolean;
  giveConsent: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [consentGiven, setConsentGiven] = useState(false);
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Vérifier la session au montage
  useEffect(() => {
    const init = async () => {
      const token = getToken();
      if (token) {
        try {
          const res = await auth.me();
          setUser(res.user);
          setConsentGiven(!!res.user.consent_given);
        } catch {
          setToken(null);
        }
      }
      setLoading(false);
    };
    init();
  }, []);

  // Déconnexion automatique après inactivité
  const resetInactivityTimer = () => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    if (user) {
      inactivityTimer.current = setTimeout(() => {
        signOut();
        window.location.reload();
      }, INACTIVITY_TIMEOUT_MS);
    }
  };

  useEffect(() => {
    if (!user) return;
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'mousemove'];
    events.forEach((e) => window.addEventListener(e, resetInactivityTimer));
    resetInactivityTimer();
    return () => {
      events.forEach((e) => window.removeEventListener(e, resetInactivityTimer));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [user]);

  const signIn = async (email: string, password: string) => {
    try {
      const res = await auth.login(email, password);
      setToken(res.token);
      setUser(res.user);
      return { error: null };
    } catch (err: any) {
      return { error: { message: err.message || 'Identifiants invalides' } };
    }
  };

  const signUp = async (email: string, password: string, fullName?: string) => {
    try {
      const res = await auth.signup(email, password, fullName);
      setToken(res.token);
      setUser(res.user);
      return { error: null };
    } catch (err: any) {
      return { error: { message: err.message || 'Erreur à l\'inscription' } };
    }
  };

  const signInWithGoogle = async (email: string, fullName?: string) => {
    try {
      const res = await auth.signup(email, 'google_oauth_' + Date.now(), fullName);
      setToken(res.token);
      setUser(res.user);
      return { error: null };
    } catch (err: any) {
      return { error: { message: err.message || 'Erreur connexion Google' } };
    }
  };

  const signOut = async () => {
    setToken(null);
    setUser(null);
    setConsentGiven(false);
  };

  const giveConsent = async () => {
    if (!user) return;
    try {
      await auth.consent(user.id, true);
      setConsentGiven(true);
    } catch { /* ignore */ }
  };

  const session = user ? { user } : null;

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signInWithGoogle, signOut, consentGiven, giveConsent }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};