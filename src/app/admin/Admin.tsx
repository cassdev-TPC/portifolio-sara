import { useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { ArrowUpRight } from "lucide-react";
import { supabase } from "../../lib/supabase";
import GaleriaAdmin from "./GaleriaAdmin";
import UploadFoto from "./UploadFoto";
import UploadVideo from "./UploadVideo";

type AdminProps = {
  session: Session;
};

function goHome() {
  window.history.pushState({}, "", "/");
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export default function Admin({ session }: AdminProps) {
  const [tab, setTab] = useState<"photos" | "videos">("photos");
  const [refreshKey, setRefreshKey] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);

  const refresh = () => setRefreshKey((current) => current + 1);

  const logout = async () => {
    setLoggingOut(true);
    await supabase.auth.signOut();
    goHome();
  };

  return (
    <main className="pt-28 md:pt-16 min-h-screen">
      <div className="max-w-6xl mx-auto px-5 md:px-8 py-14 md:py-20">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <p className="text-xs tracking-[0.3em] uppercase text-accent mb-3" style={{ fontFamily: "DM Mono, monospace" }}>
              Painel administrativo
            </p>
            <h1 className="text-5xl md:text-6xl mb-4" style={{ fontFamily: "DM Serif Display, serif" }}>
              Galeria
            </h1>
            <p className="text-muted-foreground">
              Logada como {session.user.email}
            </p>
          </div>
          <button
            onClick={logout}
            className="inline-flex items-center gap-2 px-5 py-3 border border-border text-sm tracking-wide hover:border-foreground transition-all disabled:opacity-50"
            disabled={loggingOut}
          >
            {loggingOut ? "Saindo..." : "Sair"} <ArrowUpRight size={15} />
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-8 border-b border-border pb-6">
          {[
            { id: "photos", label: "Fotos" },
            { id: "videos", label: "Vídeos" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id as "photos" | "videos")}
              className={[
                "px-4 py-1.5 text-xs tracking-wide uppercase transition-all",
                tab === item.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground border border-transparent hover:border-border",
              ].join(" ")}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="grid lg:grid-cols-[360px_1fr] gap-6 items-start">
          {tab === "photos" ? <UploadFoto onUploaded={refresh} /> : <UploadVideo onUploaded={refresh} />}
          <GaleriaAdmin kind={tab} refreshKey={refreshKey} />
        </div>
      </div>
    </main>
  );
}
