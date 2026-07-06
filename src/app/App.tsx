import { useState, useEffect, useCallback, useMemo } from "react";
import { X, Sun, Moon, Play, ChevronLeft, ChevronRight, ArrowUpRight } from "lucide-react";
import Admin from "./admin/Admin";
import Login from "./admin/Login";
import ProtectedRoute from "./admin/ProtectedRoute";
import {
  DEFAULT_PHOTO_CATEGORIES,
  DEFAULT_VIDEO_CATEGORIES,
  getCategories,
  type GalleryItem,
  listGalleryItems,
} from "../lib/gallery";

// ── Types ──────────────────────────────────────────────────────────────────
type Page = "home" | "photos" | "videos" | "pricing" | "login" | "admin";

const SERVICES = [
  {
    title: "Videografia & Storytelling",
    desc: "Criação de vídeos dinâmicos e autênticos focados em identidade, desde o roteiro à edição final, com estratégias de storytelling feitas para reter a atenção e despertar o desejo de compra.",
  },
  {
    title: "Tráfego Pago",
    desc: "Planeamento e gestão de campanhas de anúncios estratégicas no Meta e Google, focadas na escala do seu negócio através da análise de dados, geração de leads e aumento real de vendas.",
  },
  {
    title: "Fotografia Publicitária",
    desc: "Captura de imagens de alta qualidade com um olhar direcionado para o posicionamento da sua marca, cobrindo produtos, festas e eventos com edição profissional e foco na sua identidade visual.",
  },
];

// ── Utility ────────────────────────────────────────────────────────────────
function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(" ");
}

function pageFromPath(pathname: string): Page {
  if (pathname === "/login" || pathname === "/admin/login") return "login";
  if (pathname === "/admin") return "admin";
  if (pathname === "/fotos") return "photos";
  if (pathname === "/videos") return "videos";
  if (pathname === "/contato" || pathname === "/planos") return "pricing";
  return "home";
}

function pathFromPage(page: Page) {
  const paths: Record<Page, string> = {
    home: "/",
    photos: "/fotos",
    videos: "/videos",
    pricing: "/contato",
    login: "/login",
    admin: "/admin",
  };

  return paths[page];
}

// ── Lightbox ───────────────────────────────────────────────────────────────
function Lightbox({
  photos,
  initialIndex,
  onClose,
}: {
  photos: GalleryItem[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState(initialIndex);

  const prev = useCallback(() => setCurrent((i) => (i - 1 + photos.length) % photos.length), [photos.length]);
  const next = useCallback(() => setCurrent((i) => (i + 1) % photos.length), [photos.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, prev, next]);

  const photo = photos[current];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
      onClick={onClose}
    >
      <button
        className="absolute top-5 right-5 text-white/70 hover:text-white transition-colors z-10"
        onClick={onClose}
        aria-label="Fechar"
      >
        <X size={28} />
      </button>

      <button
        className="absolute left-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors z-10 p-2"
        onClick={(e) => { e.stopPropagation(); prev(); }}
        aria-label="Anterior"
      >
        <ChevronLeft size={36} />
      </button>

      <button
        className="absolute right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors z-10 p-2"
        onClick={(e) => { e.stopPropagation(); next(); }}
        aria-label="Próxima"
      >
        <ChevronRight size={36} />
      </button>

      <div className="flex flex-col items-center max-w-5xl w-full px-16" onClick={(e) => e.stopPropagation()}>
        <img
          src={photo.url}
          alt={photo.name}
          className="max-h-[80vh] w-auto object-contain"
          style={{ maxWidth: "100%" }}
        />
        <div className="mt-4 text-center">
          <p className="text-white/90 font-medium text-sm tracking-widest uppercase" style={{ fontFamily: "DM Mono, monospace" }}>
            {photo.category}
          </p>
          <p className="text-white/50 text-xs mt-1">{photo.name}</p>
        </div>
        <div className="flex gap-1.5 mt-4">
          {photos.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={cn(
                "w-1.5 h-1.5 rounded-full transition-all",
                i === current ? "bg-white w-4" : "bg-white/30"
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Navbar ─────────────────────────────────────────────────────────────────
function Navbar({
  current,
  onNav,
  dark,
  onToggleDark,
}: {
  current: Page;
  onNav: (p: Page) => void;
  dark: boolean;
  onToggleDark: () => void;
}) {
  const links: { label: string; page: Page }[] = [
    { label: "Início", page: "home" },
    { label: "Fotos", page: "photos" },
    { label: "Vídeos", page: "videos" },
    { label: "Contato", page: "pricing" },
  ];

  return (
    <nav className="fixed top-0 inset-x-0 z-40 bg-background/90 backdrop-blur-md border-b border-border">
      <div className="max-w-6xl mx-auto px-5 md:px-8 min-h-16 py-3 md:py-0 flex items-center justify-between flex-wrap gap-y-3">
        <button
          onClick={() => onNav("home")}
          className="font-serif text-xl tracking-tight leading-none"
          style={{ fontFamily: "DM Serif Display, serif" }}
        >
          Sara Marques
          <span className="text-accent ml-1.5 text-sm" style={{ fontFamily: "DM Mono, monospace" }}>
            ✦
          </span>
        </button>

        {/* Desktop links */}
        <ul className="order-3 w-full flex items-center justify-center gap-5 overflow-x-auto border-t border-border pt-3 md:order-none md:w-auto md:border-0 md:pt-0 md:gap-8">
          {links.map((l) => (
            <li key={l.page}>
              <button
                onClick={() => onNav(l.page)}
                className={cn(
                  "text-sm tracking-wide transition-colors relative pb-0.5",
                  current === l.page
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {l.label}
                {current === l.page && (
                  <span className="absolute -bottom-0.5 left-0 right-0 h-px bg-accent" />
                )}
              </button>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-3">
          <button
            onClick={onToggleDark}
            className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
            aria-label="Alternar tema"
          >
            {dark ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          <button
            className="hidden md:inline-flex items-center gap-2 px-4 py-2 text-xs tracking-widest uppercase bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            onClick={() => onNav("pricing")}
          >
            Contato
          </button>
        </div>
      </div>
    </nav>
  );
}

// ── HOME PAGE ──────────────────────────────────────────────────────────────
function HomePage({ onNav }: { onNav: (p: Page) => void }) {
  return (
    <main className="pt-28 md:pt-16">
      {/* Hero */}
      <section className="min-h-[calc(100vh-4rem)] flex items-center bg-background">
        {/* Left — text */}
        <div className="w-full max-w-6xl mx-auto flex flex-col justify-center px-8 md:px-16 lg:px-20 py-20 md:py-28">
          <p
            className="text-xs tracking-[0.3em] uppercase text-accent mb-8"
            style={{ fontFamily: "DM Mono, monospace" }}
          >
            Audiovisual · Birigui, SP
          </p>
          <h1
            className="text-5xl md:text-6xl lg:text-7xl leading-[1.05] mb-8"
            style={{ fontFamily: "DM Serif Display, serif" }}
          >
            A imagem
            <br />
            como
            <br />
            <em className="not-italic text-accent">linguagem.</em>
          </h1>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => onNav("photos")}
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground text-sm tracking-wide hover:bg-accent hover:text-accent-foreground transition-all"
            >
              Ver portfólio <ArrowUpRight size={15} />
            </button>
            <button
              onClick={() => onNav("pricing")}
              className="inline-flex items-center gap-2 px-6 py-3 border border-border text-sm tracking-wide hover:border-foreground transition-all"
            >
              Contato
            </button>
          </div>
        </div>
      </section>

      {/* Cover */}
      <section className="border-t border-border bg-card px-5 md:px-8 py-8 md:py-12">
        <div className="max-w-6xl mx-auto overflow-hidden bg-muted">
          <img
            src="/assets/home-cover.png"
            alt="Equipamentos de fotografia e edição sobre mesa"
            className="w-full h-[320px] md:h-[520px] object-cover"
          />
        </div>
      </section>

      {/* About */}
      <section className="bg-card border-t border-border py-20 md:py-28 px-8 md:px-16 lg:px-20">
        <div className="max-w-5xl mx-auto grid md:grid-cols-5 gap-12 md:gap-16 items-start">
          <div className="md:col-span-2">
            <p className="text-xs tracking-[0.3em] uppercase text-accent mb-4" style={{ fontFamily: "DM Mono, monospace" }}>
              Sobre mim
            </p>
            <img
              src="/assets/sara-marques.png"
              alt="Sara Marques"
              className="w-full object-cover bg-muted"
              style={{ aspectRatio: "4/5" }}
            />
          </div>
          <div className="md:col-span-3 flex flex-col justify-center">
            <p className="text-muted-foreground leading-relaxed mb-4">
              Olá! Eu sou a Sara Marques, tenho 19 anos e sou apaixonada por transformar ideias em resultados reais. Sou cristã, e é o que guia minha ética e dedicação em tudo o que faço.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Atualmente, curso Publicidade e Propaganda no Unisalesiano de Araçatuba, mergulhando diariamente no universo da comunicação estratégica.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Minha rotina é dividida entre a precisão dos dados e a sensibilidade da lente: atuo como Gestora de Tráfego Pago em uma agência de publicidade em Birigui e, simultaneamente, dou vida a marcas através do audiovisual como Videomaker e Fotógrafa Mobile.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Unir a faculdade com a prática de agência me permite entregar um trabalho que não é apenas "bonito", mas focado em conversão.
            </p>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="py-20 md:py-28 px-8 md:px-16 lg:px-20 border-t border-border">
        <div className="max-w-5xl mx-auto">
          <div className="mb-12">
            <p className="text-xs tracking-[0.3em] uppercase text-accent mb-3" style={{ fontFamily: "DM Mono, monospace" }}>
              Serviços
            </p>
            <h2 className="text-4xl md:text-5xl" style={{ fontFamily: "DM Serif Display, serif" }}>
              O que eu faço
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border">
            {SERVICES.map((s) => (
              <div key={s.title} className="bg-background p-8 hover:bg-card transition-colors group">
                <h3 className="text-lg font-medium mb-3 group-hover:text-accent transition-colors" style={{ fontFamily: "Inter, sans-serif" }}>
                  {s.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA strip */}
      <section className="bg-primary text-primary-foreground py-16 px-8 md:px-16 text-center">
        <p className="text-xs tracking-[0.3em] uppercase opacity-50 mb-4" style={{ fontFamily: "DM Mono, monospace" }}>
          Vamos trabalhar juntos
        </p>
        <h2
          className="text-3xl md:text-5xl mb-8"
          style={{ fontFamily: "DM Serif Display, serif" }}
        >
          Seu próximo projeto começa aqui.
        </h2>
        <button
          onClick={() => onNav("pricing")}
          className="inline-flex items-center gap-2 px-8 py-4 bg-accent text-accent-foreground text-sm tracking-widest uppercase hover:opacity-90 transition-opacity"
        >
          Falar no WhatsApp <ArrowUpRight size={16} />
        </button>
      </section>
    </main>
  );
}

// ── PHOTOS PAGE ────────────────────────────────────────────────────────────
function PhotosPage() {
  const [photos, setPhotos] = useState<GalleryItem[]>([]);
  const [filter, setFilter] = useState("Todos");
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    listGalleryItems("photos")
      .then(setPhotos)
      .catch(() => setError("Não foi possível carregar as fotos."))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => getCategories(photos, DEFAULT_PHOTO_CATEGORIES), [photos]);

  const filtered =
    filter === "Todos"
      ? photos
      : photos.filter((p) => p.category === filter);

  return (
    <main className="pt-28 md:pt-16 min-h-screen">
      <div className="max-w-6xl mx-auto px-5 md:px-8 py-14 md:py-20">
        <div className="mb-10">
          <p
            className="text-xs tracking-[0.3em] uppercase text-accent mb-3"
            style={{ fontFamily: "DM Mono, monospace" }}
          >
            Galeria
          </p>
          <h1
            className="text-5xl md:text-6xl mb-6"
            style={{ fontFamily: "DM Serif Display, serif" }}
          >
            Fotografias
          </h1>
          <p className="text-muted-foreground max-w-md leading-relaxed">
            Trabalhos fotográficos organizados por categoria.
          </p>
        </div>

        {loading && <p className="text-muted-foreground mb-8">Carregando fotos...</p>}
        {error && <p className="text-accent mb-8">{error}</p>}

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-10 border-b border-border pb-6">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={cn(
                "px-4 py-1.5 text-xs tracking-wide uppercase transition-all",
                filter === cat
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground border border-transparent hover:border-border"
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Masonry-style grid */}
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-3 space-y-3">
          {filtered.map((photo, i) => (
            <div
              key={photo.id}
              className="break-inside-avoid cursor-pointer group relative overflow-hidden bg-muted"
              onClick={() => setLightbox(photos.indexOf(photo))}
            >
              <img
                src={photo.url}
                alt={photo.name}
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
                className="w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                loading={i > 3 ? "lazy" : undefined}
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-end p-4">
                <div className="translate-y-3 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                  <p
                    className="text-white text-xs tracking-widest uppercase"
                    style={{ fontFamily: "DM Mono, monospace" }}
                  >
                    {photo.category}
                  </p>
                  <p className="text-white/70 text-xs mt-0.5">{photo.name}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {!loading && filtered.length === 0 && (
          <p className="text-muted-foreground text-center py-20">Nenhuma foto publicada nesta categoria.</p>
        )}
      </div>

      {lightbox !== null && (
        <Lightbox
          photos={photos}
          initialIndex={lightbox}
          onClose={() => setLightbox(null)}
        />
      )}
    </main>
  );
}

// ── VIDEOS PAGE ────────────────────────────────────────────────────────────
function VideosPage() {
  const [videos, setVideos] = useState<GalleryItem[]>([]);
  const [filter, setFilter] = useState("Todos");
  const [active, setActive] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    listGalleryItems("videos")
      .then(setVideos)
      .catch(() => setError("Não foi possível carregar os vídeos."))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => getCategories(videos, DEFAULT_VIDEO_CATEGORIES), [videos]);

  const filtered =
    filter === "Todos"
      ? videos
      : videos.filter((v) => v.category === filter);

  return (
    <main className="pt-28 md:pt-16 min-h-screen">
      <div className="max-w-6xl mx-auto px-5 md:px-8 py-14 md:py-20">
        <div className="mb-10">
          <p
            className="text-xs tracking-[0.3em] uppercase text-accent mb-3"
            style={{ fontFamily: "DM Mono, monospace" }}
          >
            Produções
          </p>
          <h1
            className="text-5xl md:text-6xl mb-6"
            style={{ fontFamily: "DM Serif Display, serif" }}
          >
            Vídeos
          </h1>
          <p className="text-muted-foreground max-w-md leading-relaxed">
            Produções audiovisuais publicadas por categoria.
          </p>
        </div>

        {loading && <p className="text-muted-foreground mb-8">Carregando vídeos...</p>}
        {error && <p className="text-accent mb-8">{error}</p>}

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-10 border-b border-border pb-6">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={cn(
                "px-4 py-1.5 text-xs tracking-wide uppercase transition-all",
                filter === cat
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground border border-transparent hover:border-border"
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Video grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {filtered.map((v) => (
            <div
              key={v.id}
              className="group cursor-pointer bg-card border border-border hover:border-accent/40 transition-all"
              onClick={() => setActive(v.id === active ? null : v.id)}
            >
              <div className="relative aspect-video bg-muted overflow-hidden">
                <video src={v.url} className="w-full h-full object-cover" muted />
                <div className="absolute inset-0 bg-black/30 group-hover:bg-black/50 transition-all flex items-center justify-center">
                  <div className={cn(
                    "w-14 h-14 rounded-full border-2 border-white/80 flex items-center justify-center transition-all",
                    active === v.id ? "bg-accent border-accent scale-110" : "bg-black/30 group-hover:scale-110"
                  )}>
                    <Play size={18} className="text-white ml-1" fill="white" />
                  </div>
                </div>
                <div className="absolute bottom-3 right-3 bg-black/70 text-white text-xs px-2 py-0.5" style={{ fontFamily: "DM Mono, monospace" }}>
                  Vídeo
                </div>
                <div className="absolute top-3 left-3 bg-accent text-accent-foreground text-xs px-2 py-0.5 uppercase tracking-wider">
                  {v.category}
                </div>
              </div>

              <div className="p-5">
                <p className="text-xs text-muted-foreground mb-1.5 tracking-widest uppercase" style={{ fontFamily: "DM Mono, monospace" }}>
                  {v.category}
                </p>
                <h3 className="font-medium text-base leading-snug mb-2 group-hover:text-accent transition-colors" style={{ fontFamily: "Inter, sans-serif" }}>
                  {v.name}
                </h3>
              </div>

              {active === v.id && (
                <div className="px-5 pb-5 pt-0">
                  <div className="bg-secondary border border-border p-4 text-sm text-muted-foreground leading-relaxed space-y-3">
                    <video src={v.url} controls className="w-full bg-black" />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {!loading && filtered.length === 0 && (
          <p className="text-muted-foreground text-center py-20">Nenhum vídeo publicado nesta categoria.</p>
        )}
      </div>
    </main>
  );
}

// ── PRICING PAGE ───────────────────────────────────────────────────────────
function PricingPage() {
  const whatsappUrl = "https://wa.me/5518996188589?text=Ol%C3%A1%2C%20Sara%21%20Vim%20pelo%20seu%20portf%C3%B3lio%20e%20quero%20falar%20sobre%20um%20projeto.";

  return (
    <main className="pt-28 md:pt-16 min-h-screen">
      <div className="max-w-6xl mx-auto px-5 md:px-8 py-14 md:py-20">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-10 lg:gap-16 items-start">
          <div>
            <p
              className="text-xs tracking-[0.3em] uppercase text-accent mb-3"
              style={{ fontFamily: "DM Mono, monospace" }}
            >
              Contato
            </p>
            <h1
              className="text-5xl md:text-6xl mb-6"
              style={{ fontFamily: "DM Serif Display, serif" }}
            >
              Vamos conversar sobre o seu projeto?
            </h1>
            <p className="text-muted-foreground leading-relaxed max-w-xl mb-8">
              Para orçamentos, parcerias ou dúvidas sobre audiovisual, fotografia mobile e tráfego pago, fale diretamente com a Sara pelo WhatsApp.
            </p>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-8 py-4 bg-primary text-primary-foreground text-sm tracking-widest uppercase hover:bg-accent hover:text-accent-foreground transition-all"
            >
              Chamar no WhatsApp <ArrowUpRight size={16} />
            </a>
          </div>

          <div className="bg-card border border-border p-6 md:p-8">
            <p className="text-xs tracking-[0.3em] uppercase text-accent mb-6" style={{ fontFamily: "DM Mono, monospace" }}>
              Informações
            </p>
            <div className="space-y-6">
              {[
                { label: "WhatsApp", value: "+55 18 99618-8589", href: whatsappUrl },
                { label: "E-mail", value: "smarquesmedia@gmail.com", href: "mailto:smarquesmedia@gmail.com" },
                { label: "Cidade", value: "Birigui, SP" },
                { label: "Nome", value: "Sara Marques" },
              ].map((item) => (
                <div key={item.label} className="border-b border-border pb-4 last:border-0 last:pb-0">
                  <p className="text-xs tracking-widest uppercase text-muted-foreground mb-1" style={{ fontFamily: "DM Mono, monospace" }}>
                    {item.label}
                  </p>
                  {item.href ? (
                    <a href={item.href} target={item.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className="text-foreground hover:text-accent transition-colors">
                      {item.value}
                    </a>
                  ) : (
                    <p>{item.value}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-16 border-t border-border pt-12 grid md:grid-cols-3 gap-8">
          {[
            {
              title: "Audiovisual",
              text: "Vídeos dinâmicos para marcas, eventos e conteúdos digitais com foco em narrativa e conversão.",
            },
            {
              title: "Fotografia",
              text: "Imagens para produtos, festas, eventos e posicionamento visual de marcas.",
            },
            {
              title: "Tráfego pago",
              text: "Campanhas estratégicas no Meta e Google com análise de dados, leads e vendas.",
            },
          ].map((item) => (
            <div key={item.title}>
              <h4 className="font-medium mb-2 text-sm tracking-wide">{item.title}</h4>
              <p className="text-muted-foreground text-sm leading-relaxed">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
// ── Footer ─────────────────────────────────────────────────────────────────
function Footer({ onNav }: { onNav: (p: Page) => void }) {
  return (
    <footer className="border-t border-border bg-card">
      <div className="max-w-6xl mx-auto px-5 md:px-8 py-10 grid sm:grid-cols-3 gap-8">
        <div>
          <p className="text-lg mb-2" style={{ fontFamily: "DM Serif Display, serif" }}>
            Sara Marques
          </p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Videomaker, fotógrafa mobile e gestora de tráfego pago baseada em Birigui, SP.
          </p>
        </div>
        <div>
          <p className="text-xs tracking-widest uppercase text-muted-foreground mb-4" style={{ fontFamily: "DM Mono, monospace" }}>
            Navegação
          </p>
          <ul className="space-y-2">
            {(["home", "photos", "videos", "pricing"] as Page[]).map((p) => (
              <li key={p}>
                <button
                  onClick={() => onNav(p)}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors capitalize"
                >
                  {p === "home" ? "Início" : p === "photos" ? "Fotos" : p === "videos" ? "Vídeos" : "Contato"}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs tracking-widest uppercase text-muted-foreground mb-4" style={{ fontFamily: "DM Mono, monospace" }}>
            Contato
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>smarquesmedia@gmail.com</li>
            <li>+55 18 99618-8589</li>
            <li>Birigui, SP</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border px-5 md:px-8 py-4 flex items-center justify-between">
        <p className="text-xs text-muted-foreground" style={{ fontFamily: "DM Mono, monospace" }}>
          © 2024 Sara Marques. Todos os direitos reservados.
          <button
            onClick={() => onNav("login")}
            className="ml-2 text-muted-foreground/30 hover:text-accent transition-colors align-baseline"
            aria-label="Acesso administrativo"
            title="Acesso"
          >
            ✦
          </button>
        </p>
        <p className="text-xs text-muted-foreground hidden sm:block" style={{ fontFamily: "DM Mono, monospace" }}>
          Birigui · SP
        </p>
      </div>
    </footer>
  );
}

// ── APP ────────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState<Page>(() => pageFromPath(window.location.pathname));
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDark(prefersDark);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    const syncPage = () => setPage(pageFromPath(window.location.pathname));
    window.addEventListener("popstate", syncPage);
    return () => window.removeEventListener("popstate", syncPage);
  }, []);

  const navigate = (p: Page) => {
    setPage(p);
    window.history.pushState({}, "", pathFromPage(p));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-300">
      <Navbar current={page} onNav={navigate} dark={dark} onToggleDark={() => setDark(!dark)} />

      <div className="flex-1">
        {page === "home" && <HomePage onNav={navigate} />}
        {page === "photos" && <PhotosPage />}
        {page === "videos" && <VideosPage />}
        {page === "pricing" && <PricingPage />}
        {page === "login" && <Login />}
        {page === "admin" && (
          <ProtectedRoute>
            {(session) => <Admin session={session} />}
          </ProtectedRoute>
        )}
      </div>

      {page !== "login" && page !== "admin" && <Footer onNav={navigate} />}
    </div>
  );
}
