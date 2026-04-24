import type { Session, User } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { getSupabase, upsertProfile } from '../lib/supabase';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  error: string | null;
  signOut: () => Promise<void>;
  clearError: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function firstNameFromEmail(email?: string | null): string | null {
  if (!email) return null;
  const local = email.split('@')[0]?.trim();
  if (!local) return null;
  const cleaned = local.replace(/[._-]+/g, ' ');
  const firstWord = cleaned.split(/\s+/)[0];
  if (!firstWord) return null;
  return firstWord[0].toUpperCase() + firstWord.slice(1);
}

async function ensureProfile(user: User) {
  await upsertProfile({
    id: user.id,
    first_name: firstNameFromEmail(user.email),
    city: null,
  });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const supabase = getSupabase();

    void (async () => {
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (!mounted) return;
        if (sessionError) {
          setError(sessionError.message);
        }
        setSession(data.session ?? null);
        if (data.session?.user) {
          await ensureProfile(data.session.user);
        }
      } catch (e) {
        if (!mounted) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null);
      if (nextSession?.user) {
        void ensureProfile(nextSession.user).catch((e) => {
          setError(e instanceof Error ? e.message : String(e));
        });
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    const { error: signOutError } = await getSupabase().auth.signOut();
    if (signOutError) {
      setError(signOutError.message);
      throw signOutError;
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      error,
      signOut,
      clearError,
    }),
    [clearError, error, loading, session, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return value;
}
