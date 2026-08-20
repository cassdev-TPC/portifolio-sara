import { useState, useEffect, useCallback, useMemo } from "react";
import { X, Sun, Moon, Play, ChevronLeft, ChevronRight, ArrowUpRight } from "lucide-react";
import { createPortal } from "react-dom";
import { useRef } from "react";
import type { AnchorHTMLAttributes } from "react";
import Admin from "./admin/Admin";
import Login from "./admin/Login";
import ProtectedRoute from "./admin/ProtectedRoute";
import { mediaDescription } from "../lib/accessibility";
import { PAGE_META, PAGE_PATHS, pageFromPath, type Page } from "../lib/routes";
import {
  DEFAULT_PHOTO_CATEGORIES,
  DEFAULT_VIDEO_CATEGORIES,
  getCategories,
  type GalleryItem,
  listGalleryItems,
} from "../lib/gallery";

const SERVICES = [
  {
    title: "Gestão de Tráfego Pago",
    desc: "Criação, gerenciamento e otimização de campanhas no Meta Ads, utilizando estratégias para ampliar o alcance, atrair o público certo e potencializar os resultados da sua presença digital.",
  },
  {
    title: "Storymaker Realtime",
    desc: "Cobertura em tempo real através de stories, registrando cada momento de forma espontânea e estratégica. Ideal para eventos e festas. Registro pessoas, momentos, eventos e marcas com um olhar criativo e atento aos detalhes, criando imagens que transmitem emoção, autenticidade e contam histórias.",
  },
  {
    title: "Videomaker",
    desc: "Produzo vídeos com uma linguagem criativa e estratégica, adaptando cada projeto ao seu objetivo. Seja para anúncios, redes sociais, eventos ou conteúdos institucionais, desenvolvo vídeos que comunicam com clareza, geram conexão e valorizam a sua marca ou o seu momento.",
  },
  {
    title: "Fotografia",
    desc: "Registro pessoas, momentos, eventos e marcas com um olhar criativo e atento aos detalhes, criando imagens que transmitem emoção, autenticidade e contam histórias.",
  },
];

const PROCESS_STEPS = [
  {
    title: "Conte sua ideia",
    text: "Explique o que você precisa e qual resultado deseja alcançar.",
  },
  {
    title: "Receba um orçamento personalizado",
    text: "Cada projeto é planejado de acordo com o objetivo, local, tempo de produção e formato de entrega.",
  },
  {
    title: "Planejamento e produção",
    text: "Após alinharmos o briefing, iniciaremos a criação do conteúdo para gerar resultados para sua marca.",
  },
];

// Utility
function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(" ");
}

function AppLink({ page, onNav, className, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { page: Exclude<Page, "not-found">; onNav: (page: Page) => void }) {
  return (
    <a
      href={PAGE_PATHS[page]}
      className={className}
      onClick={(event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        onNav(page);
      }}
      {...props}
    >
      {children}
    </a>
  );
}

function useScrollReveal(deps: unknown[] = []) {
  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const elements = Array.from(document.querySelectorAll<HTMLElement>(".reveal-on-scroll"));

    if (reducedMotion) {
      elements.forEach((element) => element.classList.add("is-visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.16, rootMargin: "0px 0px -8% 0px" }
    );

    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, deps);
}

// Lightbox
export function Lightbox({
  photos,
  initialIndex,
  onClose,
  sourceElement,
}: {
  photos: GalleryItem[];
  initialIndex: number;
  onClose: () => void;
  sourceElement: HTMLElement | null;
}) {
  const [current, setCurrent] = useState(initialIndex);
  const [imageError, setImageError] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const touchStart = useRef<number | null>(null);

  const prev = useCallback(() => setCurrent((i) => (i - 1 + photos.length) % photos.length), [photos.length]);
  const next = useCallback(() => setCurrent((i) => (i + 1) % photos.length), [photos.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'));
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handler);
    closeRef.current?.focus();

    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = previousOverflow;
      sourceElement?.focus();
    };
  }, [onClose, prev, next, sourceElement]);

  useEffect(() => setImageError(false), [current]);

  const photo = photos[current];

  if (!photo) return null;

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="lightbox-title"
      className="fixed inset-0 z-[9999] overflow-hidden bg-black/95"
      onClick={onClose}
      onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null; }}
      onTouchEnd={(event) => {
        const start = touchStart.current;
        const end = event.changedTouches[0]?.clientX;
        touchStart.current = null;
        if (start == null || end == null || Math.abs(end - start) < 60) return;
        end < start ? next() : prev();
      }}
    >
      <button
        ref={closeRef}
        className="absolute top-3 right-3 sm:top-5 sm:right-5 text-white/70 hover:text-white transition-colors z-10 p-2"
        onClick={onClose}
        aria-label="Fechar visualização da foto"
      >
        <X size={28} />
      </button>

      <button
        className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors z-10 p-2"
        onClick={(e) => { e.stopPropagation(); prev(); }}
        aria-label="Foto anterior"
      >
        <ChevronLeft size={36} />
      </button>

      <button
        className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 text-white/60 hover:text-white transition-colors z-10 p-2"
        onClick={(e) => { e.stopPropagation(); next(); }}
        aria-label="Próxima foto"
      >
        <ChevronRight size={36} />
      </button>

      <div
        className="grid h-[100dvh] w-full max-w-[100vw] grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)_auto_auto] gap-2 overflow-hidden px-11 py-12 sm:px-16 sm:py-8 md:px-20"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex min-h-0 min-w-0 w-full items-center justify-center overflow-hidden">
          {imageError ? (
            <div className="rounded-xl border border-white/30 bg-white/10 p-6 text-center text-white" role="status">Não foi possível exibir esta foto.</div>
          ) : (
            <img
              src={photo.optimizedUrl || photo.url}
              alt={mediaDescription(photo, "photos")}
              onError={() => setImageError(true)}
              className="block h-auto w-auto max-h-full max-w-full object-contain"
            />
          )}
        </div>
        <div className="min-w-0 shrink-0 text-center">
          <p id="lightbox-title" className="text-white/90 font-medium text-sm tracking-widest uppercase" style={{ fontFamily: "DM Mono, monospace" }}>
            {mediaDescription(photo, "photos")}
          </p>
          <p className="mt-1 text-xs text-white/70" aria-live="polite">Foto {current + 1} de {photos.length} · {photo.category}</p>
        </div>
        <div className="mx-auto flex max-w-[calc(100vw-2rem)] shrink-0 justify-center gap-1 overflow-hidden px-1 sm:gap-1.5">
          {photos.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              aria-label={`Ir para foto ${i + 1} de ${photos.length}`}
              aria-current={i === current ? "true" : undefined}
              className={cn(
                "h-1 w-1 rounded-full transition-all sm:h-1.5 sm:w-1.5",
                i === current ? "bg-white w-3 sm:w-4" : "bg-white/30"
              )}
            />
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

function VideoPreview({ video }: { video: GalleryItem }) {
  return video.posterUrl ? <img src={video.posterUrl} alt={mediaDescription(video, "videos")} loading="lazy" width={video.width} height={video.height} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-gradient-to-br from-muted to-background flex items-center justify-center p-4 text-center text-sm text-muted-foreground">Capa indisponível</div>;
}

function PhotoThumbnail({ photo, eager }: { photo: GalleryItem; eager: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <div className="flex min-h-48 w-full items-center justify-center bg-muted p-5 text-center text-sm text-muted-foreground" role="status">Foto indisponível</div>;
  return <img src={photo.thumbnailUrl || photo.url} alt={mediaDescription(photo, "photos")} onError={() => setFailed(true)} width={photo.width} height={photo.height} className="w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" loading={eager ? "eager" : "lazy"} />;
}

// Navbar
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
    { label: "Contato", page: "contact" },
  ];

  return (
    <nav className="fixed top-0 inset-x-0 z-40 bg-header/95 backdrop-blur-md border-b border-primary/25 shadow-[0_10px_34px_rgba(170,125,206,0.12)]">
      <div className="max-w-6xl mx-auto px-4 md:px-8 min-h-16 py-3 md:py-0 grid grid-cols-[2.25rem_1fr_2.25rem] md:flex md:items-center md:justify-between gap-y-3">
        <span className="md:hidden" />
        <AppLink
          page="home"
          onNav={onNav}
          className="flex min-h-11 items-center justify-self-center text-center font-serif text-xl tracking-tight leading-none md:justify-self-auto"
          style={{ fontFamily: "DM Serif Display, serif" }}
        >
          SARA MARQUES
          <span className="text-accent ml-1.5 text-sm" style={{ fontFamily: "DM Mono, monospace" }}>
            *
          </span>
        </AppLink>

        <ul className="col-span-3 row-start-2 w-full grid grid-cols-4 gap-1 border-t border-border pt-3 md:row-auto md:col-auto md:w-auto md:flex md:items-center md:justify-center md:border-0 md:pt-0 md:gap-8">
          {links.map((l) => (
            <li key={l.page}>
              <AppLink
                page={l.page as Exclude<Page, "not-found">}
                onNav={onNav}
                aria-current={current === l.page ? "page" : undefined}
                className={cn(
                  "relative flex min-h-11 w-full items-center justify-center pb-1 text-center text-[0.78rem] tracking-wide transition-colors sm:text-sm md:w-auto md:pb-0.5",
                  current === l.page
                    ? "text-primary font-semibold"
                    : "text-foreground/75 hover:text-primary"
                )}
              >
                {l.label}
                {current === l.page && (
                  <span className="absolute -bottom-0.5 left-0 right-0 h-px bg-primary" />
                )}
              </AppLink>
            </li>
          ))}
        </ul>

        <div className="justify-self-end flex items-center gap-3">
          <button
            onClick={onToggleDark}
            className="flex min-h-11 min-w-11 items-center justify-center p-2 text-primary hover:text-accent hover:bg-primary/10 transition-all"
            aria-label="Alternar tema"
          >
            {dark ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          <AppLink
            page="contact"
            onNav={onNav}
            className="btn-modern hidden md:inline-flex items-center gap-2 px-4 py-2 text-xs tracking-widest uppercase bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground"
          >
            Contato
          </AppLink>
        </div>
      </div>
    </nav>
  );
}

// Home page
function HomePage({ onNav }: { onNav: (p: Page) => void }) {
  useScrollReveal([]);

  return (
    <main className="page-enter pt-28 md:pt-16">
      {/* Hero */}
      <section className="relative flex min-h-[calc(100svh-7rem)] md:min-h-[calc(100svh-4rem)] items-center overflow-hidden bg-black text-white">
        <img
          src="/assets/home-cover-sara-banner.png"
          alt="Sara Marques trabalhando em frente ao computador"
          className="absolute inset-0 h-full w-full object-cover object-[58%_35%]"
        />
        <div className="absolute inset-0 bg-black/65" aria-hidden="true" />
        <div className="absolute inset-y-0 left-0 w-2/3 bg-gradient-to-r from-black/80 via-black/45 to-transparent" aria-hidden="true" />

        <div className="reveal-on-scroll relative w-full max-w-6xl mx-auto px-5 sm:px-8 md:px-16 lg:px-20 py-20 md:py-28">
          <div className="max-w-3xl">
            <p
              className="text-xs font-semibold tracking-[0.24em] sm:tracking-[0.3em] uppercase text-accent mb-6 md:mb-8"
              style={{ fontFamily: "DM Mono, monospace" }}
            >
              Audiovisual ·
            </p>
            <h1
              className="text-5xl sm:text-6xl lg:text-7xl leading-[1.02] mb-7 md:mb-8"
              style={{ fontFamily: "DM Serif Display, serif" }}
            >
              A imagem{" "}
              <br />
              como{" "}
              <span className="text-primary drop-shadow-[0_10px_28px_rgba(170,125,206,0.35)]">
                ferramenta{" "}
                <br />
                de venda.
              </span>
            </h1>
            <div className="flex flex-wrap gap-3">
              <AppLink
                page="photos"
                onNav={onNav}
                className="btn-modern inline-flex items-center justify-center gap-2 px-5 py-3 border border-[#c77dff] bg-[#8f3dff] text-sm font-semibold tracking-wide text-white shadow-[0_18px_45px_rgba(143,61,255,0.42)] hover:bg-[#c77dff] hover:border-[#c77dff] hover:text-white"
              >
                Ver portfólio <ArrowUpRight size={15} />
              </AppLink>
              <AppLink
                page="contact"
                onNav={onNav}
                className="btn-modern inline-flex items-center justify-center gap-2 px-5 py-3 border border-[#c77dff] bg-[#8f3dff] text-sm font-semibold tracking-wide text-white shadow-[0_18px_45px_rgba(143,61,255,0.42)] hover:bg-[#c77dff] hover:border-[#c77dff] hover:text-white"
              >
                Contato
              </AppLink>
            </div>
          </div>
        </div>
      </section>

      {/* About */}
      <section className="reveal-on-scroll relative bg-card border-t border-border py-20 md:py-28 px-8 md:px-16 lg:px-20 overflow-hidden">
        <div className="relative max-w-5xl mx-auto grid md:grid-cols-5 gap-12 md:gap-16 items-start md:items-center">
          <div className="md:col-span-2">
            <p className="text-xs font-semibold tracking-[0.3em] uppercase text-accent mb-4" style={{ fontFamily: "DM Mono, monospace" }}>
              Sobre mim
            </p>
            <img
              src="/assets/sara-marques.png"
              alt="Sara Marques"
              className="w-full object-cover bg-muted rounded-2xl"
              style={{ aspectRatio: "4/5" }}
            />
          </div>
          <div className="md:col-span-3 flex flex-col justify-center">
            <p className="text-muted-foreground leading-relaxed mb-4">
              Olá! Eu sou a Sara Marques, tenho 19 anos e sou apaixonada por comunicação, criatividade e pelo poder de contar histórias através do audiovisual.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Sou estudante de Publicidade e Propaganda e atuo como Gestora de Tráfego Pago, Videomaker e Fotógrafa, unindo estratégia e criatividade para desenvolver conteúdos que conectam pessoas, fortalecem marcas e registram momentos de forma autêntica.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Acredito que cada projeto é único e, por isso, busco sempre entregar um trabalho com qualidade, dedicação e atenção aos detalhes.
            </p>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="reveal-on-scroll relative py-20 md:py-28 px-8 md:px-16 lg:px-20 border-t border-border overflow-hidden">
        <div className="relative max-w-5xl mx-auto">
          <div className="mb-12">
            <p className="text-xs font-semibold tracking-[0.3em] uppercase text-accent mb-3" style={{ fontFamily: "DM Mono, monospace" }}>
              Serviços
            </p>
            <h2 className="text-4xl md:text-5xl" style={{ fontFamily: "DM Serif Display, serif" }}>
              O que eu faço
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-px bg-border rounded-2xl overflow-hidden">
            {SERVICES.map((s, index) => (
              <div key={s.title} className="reveal-on-scroll bg-background p-8 hover:bg-card transition-all duration-300 group hover:-translate-y-1 hover:shadow-[0_18px_36px_rgba(170,125,206,0.16)]" style={{ "--reveal-delay": `${index * 90}ms` } as Record<string, string>}>
                <h3 className="text-lg font-medium mb-3 group-hover:text-accent transition-colors" style={{ fontFamily: "Inter, sans-serif" }}>
                  {s.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Process */}
      <section className="reveal-on-scroll relative py-20 md:py-24 px-8 md:px-16 lg:px-20 border-t border-border bg-card/60 overflow-hidden">
        <div className="relative max-w-5xl mx-auto">
          <div className="mb-10">
            <p className="text-xs font-semibold tracking-[0.3em] uppercase text-accent mb-3" style={{ fontFamily: "DM Mono, monospace" }}>
              Processo
            </p>
            <h2 className="text-4xl md:text-5xl" style={{ fontFamily: "DM Serif Display, serif" }}>
              Meu processo de trabalho
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {PROCESS_STEPS.map((item, index) => (
              <div key={item.title} className="reveal-on-scroll relative border border-border bg-background rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:border-primary/60 hover:shadow-[0_18px_36px_rgba(170,125,206,0.14)]" style={{ "--reveal-delay": `${index * 90}ms` } as Record<string, string>}>
                <span className="mb-5 inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/12 text-sm font-semibold text-primary">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="font-semibold mb-2 text-base tracking-wide">{item.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA strip */}
      <section className="reveal-on-scroll relative bg-primary text-primary-foreground py-16 px-8 md:px-16 text-center overflow-hidden">
        <p className="relative text-xs font-semibold tracking-[0.3em] uppercase opacity-85 mb-4" style={{ fontFamily: "DM Mono, monospace" }}>
          Vamos trabalhar juntos
        </p>
        <h2
          className="relative text-3xl md:text-5xl mb-8"
          style={{ fontFamily: "DM Serif Display, serif" }}
        >
          Seu próximo projeto começa aqui.
        </h2>
        <AppLink
          page="contact"
          onNav={onNav}
          className="btn-modern relative inline-flex items-center gap-2 px-8 py-4 bg-[#12091a] text-white text-sm tracking-widest uppercase shadow-[0_18px_44px_rgba(18,9,26,0.35)] hover:bg-[#2a0f3d] hover:text-white"
        >
          Página de Contato <ArrowUpRight size={16} />
        </AppLink>
      </section>
    </main>
  );
}

// Photos page
function PhotosPage() {
  const [photos, setPhotos] = useState<GalleryItem[]>([]);
  const [filter, setFilter] = useState("Todos");
  const [lightbox, setLightbox] = useState<number | null>(null);
  const [lightboxSource, setLightboxSource] = useState<HTMLElement | null>(null);
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

  useScrollReveal([loading, filter, filtered.length]);

  useEffect(() => {
    setLightbox(null);
  }, [filter]);

  return (
    <main className="page-enter relative pt-28 md:pt-16 min-h-screen overflow-hidden">
      <div className="relative max-w-6xl mx-auto px-5 md:px-8 py-14 md:py-20">
        <div className="reveal-on-scroll mb-10">
          <p
            className="text-xs font-semibold tracking-[0.3em] uppercase text-accent mb-3"
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
        <div className="reveal-on-scroll flex flex-wrap gap-2 mb-10 border-b border-border pb-6">
          {categories.map((cat) => (
            <button
              type="button"
              key={cat}
              onClick={() => setFilter(cat)}
              aria-pressed={filter === cat}
              className={cn(
                "btn-modern min-h-11 px-4 py-2 text-xs tracking-wide uppercase",
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
            <button
              type="button"
              key={photo.id}
              className="reveal-on-scroll mb-3 w-full break-inside-avoid cursor-pointer group overflow-hidden bg-card border border-border rounded-2xl text-left transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(170,125,206,0.16)]"
              style={{ "--reveal-delay": `${Math.min(i, 8) * 45}ms` } as Record<string, string>}
              onClick={(event) => { setLightboxSource(event.currentTarget); setLightbox(i); }}
              aria-label={`Abrir ${mediaDescription(photo, "photos")}`}
            >
              <div className="relative overflow-hidden bg-muted">
                <PhotoThumbnail photo={photo} eager={i < 4} />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all duration-300" />
              </div>
              <div className="p-4">
                <p
                  className="text-xs tracking-widest uppercase text-accent mb-2"
                  style={{ fontFamily: "DM Mono, monospace" }}
                >
                  {photo.category}
                </p>
                {photo.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {photo.description}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>

        {!loading && filtered.length === 0 && (
          <p className="text-muted-foreground text-center py-20">Nenhuma foto publicada nesta categoria.</p>
        )}
      </div>

      {lightbox !== null && (
        <Lightbox
          photos={filtered}
          initialIndex={lightbox}
          onClose={() => setLightbox(null)}
          sourceElement={lightboxSource}
        />
      )}
    </main>
  );
}

// Videos page
function VideosPage() {
  const [videos, setVideos] = useState<GalleryItem[]>([]);
  const [filter, setFilter] = useState(DEFAULT_VIDEO_CATEGORIES[0]);
  const [active, setActive] = useState<string | null>(null);
  const [playbackErrors, setPlaybackErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    listGalleryItems("videos")
      .then(setVideos)
      .catch(() => setError("Não foi possível carregar os vídeos."))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => getCategories(videos, DEFAULT_VIDEO_CATEGORIES), [videos]);

  const filtered = videos.filter((v) => v.category === filter);

  useEffect(() => {
    setActive(null);
  }, [filter]);

  useScrollReveal([loading, filter, filtered.length]);

  return (
    <main className="page-enter relative pt-28 md:pt-16 min-h-screen overflow-hidden">
      <div className="relative max-w-6xl mx-auto px-5 md:px-8 py-14 md:py-20">
        <div className="reveal-on-scroll mb-10">
          <p
            className="text-xs font-semibold tracking-[0.3em] uppercase text-accent mb-3"
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
        <div className="reveal-on-scroll flex flex-wrap gap-2 mb-10 border-b border-border pb-6">
          {categories.map((cat) => (
            <button
              type="button"
              key={cat}
              onClick={() => setFilter(cat)}
              aria-pressed={filter === cat}
              className={cn(
                "btn-modern min-h-11 px-4 py-2 text-xs tracking-wide uppercase",
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
          {filtered.map((v, index) => (
            <div
              key={v.id}
              className="reveal-on-scroll group bg-card border border-border rounded-2xl overflow-hidden hover:border-accent/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(170,125,206,0.16)]"
              style={{ "--reveal-delay": `${Math.min(index, 8) * 55}ms` } as Record<string, string>}
            >
              <div className="relative aspect-video bg-muted overflow-hidden">
                {active === v.id ? (
                  <video
                    key={v.id}
                    src={v.originalUrl || v.url}
                    controls
                    playsInline
                    preload="none"
                    autoPlay
                    aria-label={mediaDescription(v, "videos")}
                    onError={() => {
                      setActive(null);
                      setPlaybackErrors((current) => ({ ...current, [v.id]: "Este formato não é compatível com o seu navegador. O arquivo original permanece preservado." }));
                    }}
                    className="w-full h-full bg-black object-contain"
                  >Seu navegador não consegue reproduzir este vídeo.</video>
                ) : (
                  <>
                    <VideoPreview video={v} />
                    <button
                      type="button"
                      onClick={() => setActive(v.id)}
                      className="absolute inset-0 bg-black/30 group-hover:bg-black/50 transition-all flex items-center justify-center"
                      aria-label={`Reproduzir vídeo da categoria ${v.category}`}
                    >
                      <span className="w-14 h-14 rounded-full border-2 border-white/80 bg-black/30 flex items-center justify-center transition-all group-hover:scale-110">
                        <Play size={18} className="text-white ml-1" fill="white" />
                      </span>
                    </button>
                    <div className="absolute bottom-3 right-3 bg-black/70 text-white text-xs px-2 py-0.5" style={{ fontFamily: "DM Mono, monospace" }}>
                      Vídeo
                    </div>
                    <div className="absolute top-3 left-3 bg-accent text-accent-foreground text-xs px-2 py-0.5 uppercase tracking-wider">
                      {v.category}
                    </div>
                  </>
                )}
              </div>

              <div className="p-5">
                <p className="text-xs text-muted-foreground mb-1.5 tracking-widest uppercase" style={{ fontFamily: "DM Mono, monospace" }}>
                  {v.category}
                </p>
                {v.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {v.description}
                  </p>
                )}
                {playbackErrors[v.id] && <p className="mt-2 text-sm text-destructive" role="alert">{playbackErrors[v.id]}</p>}
              </div>
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

// Contact page
function ContactPage() {
  const whatsappUrl = "https://wa.me/5518996188589?text=Ol%C3%A1%2C%20Sara%21%20Vim%20pelo%20seu%20portf%C3%B3lio%20e%20quero%20falar%20sobre%20um%20projeto.";
  useScrollReveal([]);

  return (
    <main className="page-enter relative pt-28 md:pt-16 min-h-screen overflow-hidden">
      <div className="relative max-w-6xl mx-auto px-5 md:px-8 py-14 md:py-20 min-h-[calc(100svh-7rem)] md:min-h-[calc(100svh-4rem)] flex items-center">
        <div className="reveal-on-scroll grid w-full lg:grid-cols-[1.1fr_0.9fr] gap-10 lg:gap-16 items-center">
          <div className="text-center lg:text-left">
            <p
              className="text-xs font-semibold tracking-[0.3em] uppercase text-accent mb-3"
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
            <p className="text-muted-foreground leading-relaxed max-w-xl mx-auto lg:mx-0 mb-8">
              Para orçamentos, parcerias ou dúvidas sobre os serviços, fale diretamente comigo pelo WhatsApp.
            </p>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-modern inline-flex items-center gap-2 px-8 py-4 bg-primary text-primary-foreground text-sm tracking-widest uppercase hover:bg-accent hover:text-accent-foreground"
            >
              Chamar no WhatsApp <ArrowUpRight size={16} />
            </a>
          </div>

          <div className="reveal-on-scroll bg-card border border-border rounded-2xl p-6 md:p-8 shadow-[0_18px_50px_rgba(170,125,206,0.12)]" style={{ "--reveal-delay": "110ms" } as Record<string, string>}>
            <p className="text-xs font-semibold tracking-[0.3em] uppercase text-accent mb-6" style={{ fontFamily: "DM Mono, monospace" }}>
              Informações
            </p>
            <div className="space-y-6">
              {[
                { label: "WhatsApp", value: "+55 18 99618-8589", href: whatsappUrl },
                { label: "E-mail", value: "smarquesmedia@gmail.com", href: "mailto:smarquesmedia@gmail.com" },
                { label: "Instagram", value: "@smarques.midia", href: "https://instagram.com/smarques.midia" },
                { label: "Instagram pessoal", value: "@eusahmarques", href: "https://instagram.com/eusahmarques" },
                { label: "Nome", value: "Sara Marques" },
              ].map((item) => (
                <div key={item.label} className="border-b border-border pb-4 last:border-0 last:pb-0">
                  <p className="text-xs tracking-widest uppercase text-muted-foreground mb-1" style={{ fontFamily: "DM Mono, monospace" }}>
                    {item.label}
                  </p>
                  {item.href ? (
                    <a href={item.href} target={item.href.startsWith("http") ? "_blank" : undefined} rel={item.href.startsWith("http") ? "noopener noreferrer" : undefined} className="inline-flex min-h-11 items-center text-foreground hover:text-accent transition-colors">
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
      </div>
    </main>
  );
}
// Footer
function Footer({ onNav }: { onNav: (p: Page) => void }) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-card">
      <div className="max-w-6xl mx-auto px-5 md:px-8 py-10 grid sm:grid-cols-2 gap-8">
        <div>
          <p className="text-xs tracking-widest uppercase text-muted-foreground mb-4" style={{ fontFamily: "DM Mono, monospace" }}>
            Navegação
          </p>
          <ul className="space-y-2">
            {(["home", "photos", "videos", "contact"] as Page[]).map((p) => (
              <li key={p}>
                <AppLink
                  page={p as Exclude<Page, "not-found">}
                  onNav={onNav}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors capitalize"
                >
                  {p === "home" ? "Início" : p === "photos" ? "Fotos" : p === "videos" ? "Vídeos" : "Contato"}
                </AppLink>
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
            <li>@smarques.midia</li>
            <li>@eusahmarques</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border px-5 md:px-8 py-4 flex items-center justify-between">
        <p className="text-xs text-muted-foreground" style={{ fontFamily: "DM Mono, monospace" }}>
          © {currentYear} Sara Marques. Todos os direitos reservados.
          <AppLink
            page="login"
            onNav={onNav}
            className="ml-2 text-muted-foreground/30 hover:text-accent transition-colors align-baseline"
            aria-label="Acesso administrativo"
            title="Acesso"
          >
            *
          </AppLink>
        </p>
        <p className="text-xs text-muted-foreground hidden sm:block" style={{ fontFamily: "DM Mono, monospace" }}>
          @smarques.midia
        </p>
      </div>
    </footer>
  );
}

function NotFoundPage({ onNav }: { onNav: (page: Page) => void }) {
  return (
    <main className="page-enter flex min-h-screen items-center justify-center px-5 pb-16 pt-32 text-center">
      <div className="max-w-xl">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-accent">Erro 404</p>
        <h1 className="mb-5 text-5xl sm:text-6xl">Página não encontrada</h1>
        <p className="mb-8 text-muted-foreground">O endereço pode estar incorreto ou a página pode ter mudado.</p>
        <AppLink page="home" onNav={onNav} className="btn-modern inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-6 py-3 text-primary-foreground">Voltar ao início</AppLink>
      </div>
    </main>
  );
}

// App
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

  useEffect(() => {
    const meta = PAGE_META[page];
    document.title = meta.title;
    document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute("content", meta.description);
    document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.setAttribute("content", meta.title);
    document.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.setAttribute("content", meta.description);
    document.querySelector<HTMLMetaElement>('meta[name="twitter:title"]')?.setAttribute("content", meta.title);
    document.querySelector<HTMLMetaElement>('meta[name="twitter:description"]')?.setAttribute("content", meta.description);
    document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.setAttribute("href", `https://portfoliosaramarques.vercel.app${page === "not-found" ? window.location.pathname : PAGE_PATHS[page]}`);
  }, [page]);

  const navigate = (p: Page) => {
    setPage(p);
    const path = p === "not-found" ? window.location.pathname : PAGE_PATHS[p];
    if (window.location.pathname !== path) window.history.pushState({}, "", path);
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-300">
      <Navbar current={page} onNav={navigate} dark={dark} onToggleDark={() => setDark(!dark)} />

      <div className="flex-1">
        {page === "home" && <HomePage onNav={navigate} />}
        {page === "photos" && <PhotosPage />}
        {page === "videos" && <VideosPage />}
        {page === "contact" && <ContactPage />}
        {page === "login" && <Login />}
        {page === "admin" && (
          <ProtectedRoute>
            {(session) => <Admin session={session} />}
          </ProtectedRoute>
        )}
        {page === "not-found" && <NotFoundPage onNav={navigate} />}
      </div>

      {page !== "login" && page !== "admin" && <Footer onNav={navigate} />}
    </div>
  );
}
