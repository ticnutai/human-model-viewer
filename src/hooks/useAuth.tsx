import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  isAdmin: false,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const debugLogsEnabled = import.meta.env.DEV && import.meta.env.VITE_DEBUG_LOGS === "true";

  const checkAdmin = async (userId: string) => {
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    setIsAdmin(!!data);
  };

  useEffect(() => {
    let settled = false;
    let safetyTimer: ReturnType<typeof setTimeout> | null = null;

    const resolveLoading = () => {
      settled = true;
      if (safetyTimer) {
        clearTimeout(safetyTimer);
        safetyTimer = null;
      }
      setLoading(false);
    };

    // Safety timeout: ensure loading completes even if auth check hangs
    safetyTimer = setTimeout(() => {
      setLoading((prev) => {
        return false;
      });
    }, 3000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (debugLogsEnabled) {
          console.info("[AUTH_DEBUG] onAuthStateChange", {
            event: _event,
            hasSession: !!session,
            userId: session?.user?.id ?? null,
          });
        }
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await checkAdmin(session.user.id);
        } else {
          setIsAdmin(false);
        }
        resolveLoading();
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (debugLogsEnabled) {
        console.info("[AUTH_DEBUG] getSession", {
          hasSession: !!session,
          userId: session?.user?.id ?? null,
        });
      }
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        checkAdmin(session.user.id);
      }
      resolveLoading();
    });

    return () => {
      if (safetyTimer) clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isAdmin, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
