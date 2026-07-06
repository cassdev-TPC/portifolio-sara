import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { ADMIN_EMAIL, isSupabaseConfigured, supabase } from "../../lib/supabase";

type ProtectedRouteProps = {
  children: (session: Session) => ReactNode;
};

export function isAdminEmail(email?: string | null) {
  return Boolean(ADMIN_EMAIL && email && email.toLowerCase() === ADMIN_EMAIL.toLowerCase());
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!loading && (!session || !isAdminEmail(session.user.email))) {
      window.history.replaceState({}, "", "/login");
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  }, [loading, session]);

  if (loading) {
    return (
      <main className="pt-28 md:pt-16 min-h-screen flex items-center justify-center px-5">
        <p className="text-muted-foreground">Carregando acesso...</p>
      </main>
    );
  }

  if (!isSupabaseConfigured) {
    return (
      <main className="pt-28 md:pt-16 min-h-screen flex items-center justify-center px-5">
        <p className="text-muted-foreground max-w-md text-center">
          Configure as variáveis VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY e VITE_ADMIN_EMAIL para ativar o painel.
        </p>
      </main>
    );
  }

  if (!session || !isAdminEmail(session.user.email)) return null;

  return <>{children(session)}</>;
}
