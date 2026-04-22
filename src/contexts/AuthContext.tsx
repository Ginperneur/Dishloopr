import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

const REMEMBER_ME_KEY = 'auth-remember-me';

// Find the Supabase auth storage key in localStorage (sb-<ref>-auth-token)
function findSupabaseAuthKey(): string | null {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        return key;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

function clearSupabaseAuthFromLocalStorage() {
  const key = findSupabaseAuthKey();
  if (key) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  }
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string, rememberMe?: boolean) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, name: string, accountType?: 'user' | 'restaurant') => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (password: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Set up auth state listener FIRST so we catch SIGNED_IN, TOKEN_REFRESHED, SIGNED_OUT, etc.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        if (!mounted) return;
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session. If the access token is expired,
    // try to refresh it so the user stays logged in across visits.
    (async () => {
      try {
        const { data: { session: existing } } = await supabase.auth.getSession();

        if (existing) {
          // If token expires within the next 60s, proactively refresh.
          const expiresAt = (existing.expires_at ?? 0) * 1000;
          if (expiresAt && expiresAt - Date.now() < 60_000) {
            const { data: refreshed } = await supabase.auth.refreshSession();
            if (mounted) {
              const s = refreshed.session ?? existing;
              setSession(s);
              setUser(s?.user ?? null);
            }
          } else if (mounted) {
            setSession(existing);
            setUser(existing.user);
          }
        }
      } catch (err) {
        console.warn('[Auth] Failed to restore session:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, name: string, accountType: 'user' | 'restaurant' = 'user') => {
    const redirectUrl = `${window.location.origin}/email-confirm`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          name,
          account_type: accountType,
        },
      },
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    const redirectUrl = `${window.location.origin}/reset-password`;
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });
    return { error: error as Error | null };
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error as Error | null };
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut, resetPassword, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
