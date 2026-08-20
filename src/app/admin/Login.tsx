import { useState } from "react";
import type { FormEvent } from "react";
import { ArrowUpRight } from "lucide-react";
import { ADMIN_EMAIL, isSupabaseConfigured, supabase } from "../../lib/supabase";
import { isAdminEmail } from "./ProtectedRoute";
import { getLoginErrorMessage, withTimeout } from "../../lib/authErrors";

function goToAdmin() {
  window.history.pushState({}, "", "/admin");
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export default function Login() {
  const [email, setEmail] = useState(ADMIN_EMAIL);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [message, setMessage] = useState(() => new URLSearchParams(window.location.search).get("reason") === "session-expired" ? "Sua sessão expirou. Entre novamente." : "");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setMessage("");

    if (!isSupabaseConfigured) {
      setError("Supabase ainda não foi configurado neste projeto.");
      return;
    }

    setLoading(true);
    try {
      const { data, error: loginError } = await withTimeout(supabase.auth.signInWithPassword({ email, password }));
      if (loginError) throw loginError;
      if (!isAdminEmail(data.user.email)) {
        await supabase.auth.signOut();
        setError("Esta conta não tem autorização para administrar o portfólio.");
        return;
      }
      goToAdmin();
    } catch (loginError) {
      setError(getLoginErrorMessage(loginError));
    } finally {
      setLoading(false);
    }
  };

  const recoverPassword = async () => {
    setError("");
    setMessage("");
    if (!email) { setError("Informe seu e-mail para recuperar a senha."); return; }
    if (!isSupabaseConfigured) { setError("O acesso administrativo ainda não está configurado."); return; }
    setRecoveryLoading(true);
    try {
      const { error: recoveryError } = await withTimeout(supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/login` }));
      if (recoveryError) throw recoveryError;
      setMessage("Se o e-mail estiver cadastrado, você receberá as instruções de recuperação.");
    } catch (recoveryError) {
      setError(getLoginErrorMessage(recoveryError));
    } finally {
      setRecoveryLoading(false);
    }
  };

  return (
    <main className="pt-28 md:pt-16 min-h-screen flex items-center justify-center px-5 py-12">
      <form onSubmit={submit} className="w-full max-w-md bg-card border border-border p-6 md:p-8">
        <p className="text-xs tracking-[0.3em] uppercase text-accent mb-3" style={{ fontFamily: "DM Mono, monospace" }}>
          Área administrativa
        </p>
        <h1 className="text-4xl md:text-5xl mb-6" style={{ fontFamily: "DM Serif Display, serif" }}>
          Login
        </h1>

        <div className="space-y-4">
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-xs tracking-widest uppercase text-muted-foreground" style={{ fontFamily: "DM Mono, monospace" }}>E-mail</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="border border-border bg-background px-3 py-3 text-sm"
              required
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-xs tracking-widest uppercase text-muted-foreground" style={{ fontFamily: "DM Mono, monospace" }}>Senha</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="border border-border bg-background px-3 py-3 text-sm"
              required
            />
          </label>
        </div>

        <div className="mt-4 min-h-5" aria-live="polite" aria-atomic="true">
          {error ? <p className="text-sm text-destructive">{error}</p> : message && <p className="text-sm text-muted-foreground">{message}</p>}
        </div>

        <button
          className="mt-6 w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-primary text-primary-foreground text-sm tracking-wide hover:bg-accent hover:text-accent-foreground transition-all disabled:opacity-50"
          disabled={loading || recoveryLoading}
        >
          {loading ? "Entrando..." : "Entrar"} <ArrowUpRight size={15} />
        </button>
        <button type="button" onClick={recoverPassword} disabled={loading || recoveryLoading} className="mt-3 w-full min-h-11 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:opacity-50">
          {recoveryLoading ? "Enviando instruções..." : "Esqueci minha senha"}
        </button>
      </form>
    </main>
  );
}
