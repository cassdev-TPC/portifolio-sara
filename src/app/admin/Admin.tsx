import { useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { ExternalLink, Film, Image as ImageIcon, LogOut } from "lucide-react";
import { supabase } from "../../lib/supabase";
import GaleriaAdmin from "./GaleriaAdmin";
import UploadFoto from "./UploadFoto";
import UploadVideo from "./UploadVideo";
import { mono, serif } from "./adminUi";

type AdminProps = {
  session: Session;
};

function goHome() {
  window.history.pushState({}, "", "/");
  window.dispatchEvent(new PopStateEvent("popstate"));
}

const TABS = [
  { id: "photos", label: "Fotos", icon: ImageIcon },
  { id: "videos", label: "Vídeos", icon: Film },
] as const;

export default function Admin({ session }: AdminProps) {
  const [tab, setTab] = useState<"photos" | "videos">("photos");
  const [refreshKey, setRefreshKey] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);

  const refresh = () => setRefreshKey((current) => current + 1);
  const email = session.user.email ?? "";
  const initial = (email.trim()[0] ?? "A").toUpperCase();

  const logout = async () => {
    setLoggingOut(true);
    await supabase.auth.signOut();
    goHome();
  };

  return (
    <main className="page-enter relative pt-28 md:pt-16 min-h-screen">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[radial-gradient(50%_80%_at_15%_0%,rgba(170,125,206,0.22),transparent_70%),radial-gradient(40%_70%_at_95%_10%,rgba(143,95,184,0.16),transparent_70%)]" />

      <div className="mx-auto max-w-7xl px-5 py-10 md:px-8 md:py-14">
        {/* Cabeçalho */}
        <header className="mb-8 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-3 text-xs uppercase tracking-[0.3em] text-accent" style={mono}>
              Painel administrativo
            </p>
            <h1 className="text-5xl md:text-6xl" style={serif}>
              Galeria
            </h1>
            <p className="mt-3 max-w-md text-sm text-muted-foreground">
              Envie novos trabalhos, organize por categoria e edite as descrições.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex min-w-0 items-center gap-3 rounded-full border border-border bg-card/80 py-1.5 pl-1.5 pr-4 backdrop-blur">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-sm font-semibold text-white" aria-hidden="true">
                {initial}
              </span>
              <span className="min-w-0">
                <span className="block text-[10px] uppercase tracking-widest text-muted-foreground" style={mono}>Logada como</span>
                <span className="block max-w-[14rem] truncate text-sm">{email}</span>
              </span>
            </div>
            <button
              type="button"
              onClick={goHome}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-4 text-sm transition-colors hover:border-accent hover:text-accent"
            >
              <ExternalLink size={15} aria-hidden="true" /> Ver site
            </button>
            <button
              onClick={logout}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border px-4 text-sm transition-colors hover:border-destructive hover:text-destructive disabled:opacity-50"
              disabled={loggingOut}
            >
              <LogOut size={15} aria-hidden="true" /> {loggingOut ? "Saindo..." : "Sair"}
            </button>
          </div>
        </header>

        {/* Abas */}
        <div className="mb-8 inline-flex rounded-full border border-border bg-card/80 p-1.5 backdrop-blur" role="group" aria-label="Tipo de mídia">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              type="button"
              key={id}
              onClick={() => setTab(id)}
              aria-pressed={tab === id}
              className={[
                "inline-flex min-h-10 items-center gap-2 rounded-full px-5 text-sm font-medium transition-all",
                tab === id
                  ? "bg-primary text-primary-foreground shadow-[0_8px_24px_rgba(170,125,206,0.35)]"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              <Icon size={16} aria-hidden="true" /> {label}
            </button>
          ))}
        </div>

        <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[380px_minmax(0,1fr)] [&>*]:min-w-0">
          <div className="lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:rounded-3xl">
            {tab === "photos" ? <UploadFoto onUploaded={refresh} /> : <UploadVideo onUploaded={refresh} />}
          </div>
          <GaleriaAdmin key={tab} kind={tab} refreshKey={refreshKey} />
        </div>
      </div>
    </main>
  );
}
