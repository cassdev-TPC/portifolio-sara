import { useState } from "react";
import type { FormEvent } from "react";
import { ArrowUpRight, Eye, EyeOff, Lock, Mail, ShieldCheck } from "lucide-react";
import { ADMIN_EMAIL, isSupabaseConfigured, supabase } from "../../lib/supabase";
import { isAdminEmail } from "./ProtectedRoute";
import { getLoginErrorMessage, withTimeout } from "../../lib/authErrors";

function goToAdmin() {
  window.history.pushState({}, "", "/admin");
  window.dispatchEvent(new PopStateEvent("popstate"));
}

const mono = { fontFamily: "DM Mono, monospace" };
const serif = { fontFamily: "DM Serif Display, serif" };

export default function Login() {
  const [email, setEmail] = useState(ADMIN_EMAIL);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

  const busy = loading || recoveryLoading;
  const fieldShell = "group flex items-center gap-3 rounded-2xl border border-border bg-background/70 px-4 transition-all focus-within:border-accent focus-within:bg-background focus-within:shadow-[0_0_0_4px_var(--ring)]";

  return (
    <main className="page-enter pt-28 md:pt-16 min-h-screen flex items-center justify-center px-5 py-12">
      <div className="relative w-full max-w-5xl">
        <div aria-hidden="true" className="pointer-events-none absolute -inset-10 -z-10 rounded-[3rem] bg-[radial-gradient(60%_60%_at_20%_20%,rgba(170,125,206,0.28),transparent_70%),radial-gradient(50%_50%_at_90%_80%,rgba(143,95,184,0.22),transparent_70%)] blur-2xl" />

        <div className="grid overflow-hidden rounded-[2rem] border border-border bg-card shadow-[0_30px_80px_rgba(18,9,26,0.18)] md:grid-cols-[1.05fr_1fr]">
          {/* Painel visual */}
          <aside className="relative hidden min-h-[560px] md:block">
            <img src="/assets/home-cover-sara-camera.png" alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#12091a] via-[#12091a]/55 to-[#12091a]/10" />
            <div className="absolute inset-x-0 bottom-0 p-10 text-white">
              <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.25em] backdrop-blur" style={mono}>
                <ShieldCheck size={13} aria-hidden="true" /> Acesso restrito
              </p>
              <h2 className="text-4xl leading-tight" style={serif}>
                Seu portfólio,<br />
                <span className="text-[#caa3e6]">do seu jeito.</span>
              </h2>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/75">
                Envie fotos e vídeos, organize categorias e mantenha a galeria sempre atualizada.
              </p>
            </div>
          </aside>

          {/* Formulário */}
          <form onSubmit={submit} className="flex flex-col justify-center p-7 sm:p-10 md:p-12">
            <p className="mb-3 text-xs uppercase tracking-[0.3em] text-accent" style={mono}>
              Área administrativa
            </p>
            <h1 className="mb-2 text-4xl md:text-5xl" style={serif}>
              Bem-vinda de volta
            </h1>
            <p className="mb-8 text-sm text-muted-foreground">
              Entre com sua conta para gerenciar a galeria.
            </p>

            <div className="space-y-5">
              <label className="flex flex-col gap-2 text-sm">
                <span className="text-xs uppercase tracking-widest text-muted-foreground" style={mono}>E-mail</span>
                <span className={fieldShell}>
                  <Mail size={17} className="shrink-0 text-muted-foreground transition-colors group-focus-within:text-accent" aria-hidden="true" />
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="min-w-0 flex-1 bg-transparent py-3.5 text-sm outline-none"
                    required
                  />
                </span>
              </label>
              <label className="flex flex-col gap-2 text-sm">
                <span className="text-xs uppercase tracking-widest text-muted-foreground" style={mono}>Senha</span>
                <span className={fieldShell}>
                  <Lock size={17} className="shrink-0 text-muted-foreground transition-colors group-focus-within:text-accent" aria-hidden="true" />
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="min-w-0 flex-1 bg-transparent py-3.5 text-sm outline-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="-mr-2 rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </span>
              </label>
            </div>

            <div className="mt-4 min-h-5" aria-live="polite" aria-atomic="true">
              {error ? (
                <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
              ) : message && (
                <p className="rounded-xl border border-border bg-muted/60 px-3 py-2 text-sm text-muted-foreground">{message}</p>
              )}
            </div>

            <button
              className="btn-modern mt-6 inline-flex w-full items-center justify-center gap-2 bg-primary px-5 py-3.5 text-sm font-semibold tracking-wide text-primary-foreground hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
              disabled={busy}
            >
              {loading ? "Entrando..." : "Entrar"} <ArrowUpRight size={16} />
            </button>
            <button
              type="button"
              onClick={recoverPassword}
              disabled={busy}
              className="mt-3 min-h-11 w-full text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline disabled:opacity-50"
            >
              {recoveryLoading ? "Enviando instruções..." : "Esqueci minha senha"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
