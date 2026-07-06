import { useState } from "react";
import type { FormEvent } from "react";
import { ArrowUpRight } from "lucide-react";
import { ADMIN_EMAIL, isSupabaseConfigured, supabase } from "../../lib/supabase";
import { isAdminEmail } from "./ProtectedRoute";

function goToAdmin() {
  window.history.pushState({}, "", "/admin");
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export default function Login() {
  const [email, setEmail] = useState(ADMIN_EMAIL);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!isSupabaseConfigured) {
      setError("Supabase ainda não foi configurado neste projeto.");
      return;
    }

    setLoading(true);
    const { data, error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (loginError) {
      setError("E-mail ou senha inválidos.");
      return;
    }

    if (!isAdminEmail(data.user.email)) {
      await supabase.auth.signOut();
      setError("Esta conta não tem permissão para administrar o portfólio.");
      return;
    }

    goToAdmin();
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
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="border border-border bg-background px-3 py-3 text-sm"
              required
            />
          </label>
        </div>

        {error && <p className="text-sm text-accent mt-4">{error}</p>}

        <button
          className="mt-6 w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-primary text-primary-foreground text-sm tracking-wide hover:bg-accent hover:text-accent-foreground transition-all disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "Entrando..." : "Entrar"} <ArrowUpRight size={15} />
        </button>
      </form>
    </main>
  );
}
