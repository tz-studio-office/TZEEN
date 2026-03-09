import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { Profile, UserRole } from '../types';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signUp: (email: string, password: string, fullName: string, role: 'coach' | 'student') => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getRoleFromSession(session: Session | null): UserRole {
  const appMeta = session?.user?.app_metadata;
  if (appMeta?.role === 'admin' || appMeta?.role === 'coach') return appMeta.role;
  const userMeta = session?.user?.user_metadata;
  if (userMeta?.role === 'admin' || userMeta?.role === 'coach') return userMeta.role;
  return 'student';
}

function buildFallbackProfile(session: Session): Profile {
  const user = session.user;
  return {
    id: user.id,
    organization_id: null,
    role: getRoleFromSession(session),
    full_name: user.user_metadata?.full_name || user.email || '',
    avatar_url: null,
    created_at: user.created_at,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchProfile(currentSession: Session): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', currentSession.user.id)
      .maybeSingle();

    if (data) return data;

    if (error) {
      console.warn('Profile fetch error, using JWT fallback:', error.message);
    }

    return buildFallbackProfile(currentSession);
  }

  async function initSession(s: Session) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    const freshSession = refreshed.session || s;

    setSession(freshSession);
    setUser(freshSession.user);

    const p = await fetchProfile(freshSession);
    setProfile(p);
  }

  async function refreshProfile() {
    const { data } = await supabase.auth.refreshSession();
    if (data.session) {
      setSession(data.session);
      setUser(data.session.user);
      const p = await fetchProfile(data.session);
      setProfile(p);
    }
  }

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      if (!mounted) return;
      if (s) {
        await initSession(s);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return;
      if (!s) {
        setSession(null);
        setUser(null);
        setProfile(null);
        return;
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function signUp(email: string, password: string, fullName: string, role: 'coach' | 'student') {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role },
      },
    });
    return { error: error as Error | null };
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error as Error | null };

    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session) {
      await initSession(sessionData.session);
    }

    return { error: null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
  }

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, refreshProfile, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
