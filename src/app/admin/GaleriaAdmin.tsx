import { useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, ArrowDownUp, CalendarDays, Check, ChevronLeft, ChevronRight, Film, FolderInput, GripVertical, Image as ImageIcon, Maximize2, Pencil, Play, Save, SlidersHorizontal, Sparkles, Trash2, X } from "lucide-react";
import { mono, serif, ui } from "./adminUi";
import {
  DEFAULT_PHOTO_CATEGORIES,
  DEFAULT_VIDEO_CATEGORIES,
  deleteGalleryItem,
  type GalleryItem,
  type GalleryKind,
  type GallerySort,
  listGalleryPage,
  retryMediaFromFallback,
  updateGalleryItemCategory,
  updateGalleryItemDescription,
} from "../../lib/gallery";

const DRAG_TYPE = "application/x-galeria-item";
const ADMIN_FETCH_LIMIT = 1000;

type GaleriaAdminProps = {
  kind: GalleryKind;
  refreshKey: number;
};

function groupId(category: string) {
  return `grupo-${category.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function formatDuration(seconds?: number) {
  if (!seconds || !Number.isFinite(seconds)) return "";
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function formatDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function groupItems(items: GalleryItem[], orderedCategories: string[], keepEmpty: boolean) {
  const categories = orderedCategories.filter((category) => category !== "Todos");
  const grouped = new Map<string, GalleryItem[]>();

  for (const category of categories) {
    grouped.set(category, []);
  }

  for (const item of items) {
    const category = item.category || "Sem categoria";
    grouped.set(category, [...(grouped.get(category) ?? []), item]);
  }

  return Array.from(grouped.entries())
    .map(([category, categoryItems]) => ({
      category,
      items: categoryItems,
    }))
    .filter((group) => keepEmpty || group.items.length > 0);
}

export default function GaleriaAdmin({ kind, refreshKey }: GaleriaAdminProps) {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [category, setCategory] = useState("Todos");
  const [sort, setSort] = useState<GallerySort>("newest");
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [deleting, setDeleting] = useState("");
  const [saving, setSaving] = useState("");
  const [pendingDelete, setPendingDelete] = useState<GalleryItem | null>(null);
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [draggingPath, setDraggingPath] = useState("");
  const [dropTarget, setDropTarget] = useState("");
  const [moving, setMoving] = useState("");
  const [editingPath, setEditingPath] = useState("");
  const requestId = useRef(0);
  const morePending = useRef(false);

  const title = kind === "photos" ? "Fotos cadastradas" : "Vídeos cadastrados";
  const orderedCategories = kind === "photos" ? DEFAULT_PHOTO_CATEGORIES : DEFAULT_VIDEO_CATEGORIES;
  const moveTargets = orderedCategories.filter((item) => item !== "Todos");
  const showAllGroups = category === "Todos" && !loading;
  const groupedItems = useMemo(() => groupItems(items, orderedCategories, showAllGroups), [items, orderedCategories, showAllGroups]);

  const moveItem = async (path: string, targetCategory: string) => {
    const item = items.find((current) => current.path === path);
    if (!item || item.category === targetCategory || moving) return;
    const previousCategory = item.category;
    setMoving(path);
    setError("");
    setNotice("");
    setItems((current) => current.map((entry) => entry.path === path ? { ...entry, category: targetCategory } : entry));

    try {
      const saved = await updateGalleryItemCategory(kind, path, targetCategory);
      if (category !== "Todos" && saved !== category) {
        setItems((current) => current.filter((entry) => entry.path !== path));
        setTotal((current) => Math.max(0, current - 1));
      }
      setNotice(`Movido de "${previousCategory}" para "${saved}".`);
    } catch (moveError) {
      setItems((current) => current.map((entry) => entry.path === path ? { ...entry, category: previousCategory } : entry));
      setError(moveError instanceof Error ? moveError.message : "Não foi possível mover o item.");
    } finally {
      setMoving("");
    }
  };

  // Enquanto um item é arrastado, aproximar o cursor do topo ou da base da tela
  // rola a página sozinho, para alcançar categorias que estão fora da vista.
  useEffect(() => {
    if (!draggingPath) return;
    const EDGE = 120;
    const MAX_SPEED = 1500; // pixels por segundo, independente da taxa de quadros
    const top = Math.max(0, document.querySelector("header, nav")?.getBoundingClientRect().bottom ?? 0);
    let last = 0;
    let carry = 0;

    // O navegador dispara dragover continuamente (~a cada 50 ms) enquanto o item
    // está sendo segurado, mesmo com o mouse parado; a rolagem acompanha o tempo real.
    const track = (event: globalThis.DragEvent) => {
      const now = performance.now();
      const elapsed = last ? Math.min(0.15, (now - last) / 1000) : 0;
      last = now;
      const pointerY = event.clientY;
      if (!pointerY) return;
      const bottom = window.innerHeight;
      let speed = 0;
      if (pointerY < top + EDGE) speed = -MAX_SPEED * Math.min(1, (top + EDGE - pointerY) / EDGE);
      else if (pointerY > bottom - EDGE) speed = MAX_SPEED * Math.min(1, (pointerY - (bottom - EDGE)) / EDGE);
      if (!speed) { carry = 0; return; }
      carry += speed * elapsed;
      const step = Math.trunc(carry);
      if (step) { window.scrollBy(0, step); carry -= step; }
    };
    const stop = () => { last = 0; carry = 0; };
    document.addEventListener("dragover", track);
    document.addEventListener("drop", stop);
    document.addEventListener("dragend", stop);
    return () => {
      document.removeEventListener("dragover", track);
      document.removeEventListener("drop", stop);
      document.removeEventListener("dragend", stop);
    };
  }, [draggingPath]);

  const onCardDragStart = (event: DragEvent<HTMLElement>, item: GalleryItem) => {
    event.dataTransfer.setData(DRAG_TYPE, item.path);
    event.dataTransfer.setData("text/plain", item.path);
    event.dataTransfer.effectAllowed = "move";
    const card = event.currentTarget.closest("article");
    if (card) event.dataTransfer.setDragImage(card, 40, 40);
    setDraggingPath(item.path);
  };

  const onCardDragEnd = () => {
    setDraggingPath("");
    setDropTarget("");
  };

  const onGroupDragOver = (event: DragEvent<HTMLDivElement>, groupCategory: string) => {
    if (!draggingPath) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (dropTarget !== groupCategory) setDropTarget(groupCategory);
  };

  const onGroupDragLeave = (event: DragEvent<HTMLDivElement>, groupCategory: string) => {
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    if (dropTarget === groupCategory) setDropTarget("");
  };

  const onGroupDrop = (event: DragEvent<HTMLDivElement>, groupCategory: string) => {
    event.preventDefault();
    const path = event.dataTransfer.getData(DRAG_TYPE) || draggingPath;
    setDraggingPath("");
    setDropTarget("");
    if (path) void moveItem(path, groupCategory);
  };

  // O painel mostra o acervo inteiro de uma vez; o "Carregar mais" fica só nas páginas públicas.
  const loadItems = async (limit = ADMIN_FETCH_LIMIT) => {
    const currentRequest = ++requestId.current;
    morePending.current = false;
    setLoading(true);
    setLoadingMore(false);
    setError("");

    try {
      const page = await listGalleryPage(kind, { category, sort, limit });
      if (currentRequest !== requestId.current) return;
      setItems(page.items);
      setTotal(page.total);
      setDescriptions(
        Object.fromEntries(page.items.map((item) => [item.path, item.description ?? ""]))
      );
    } catch {
      if (currentRequest === requestId.current) setError("Não foi possível carregar a galeria.");
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  };

  useEffect(() => {
    setItems([]);
    setTotal(0);
    setDescriptions({});
    void loadItems();
    return () => { requestId.current++; };
  }, [kind, refreshKey, category, sort]);

  const loadMore = async () => {
    if (loading || morePending.current || items.length >= total) return;
    morePending.current = true;
    setLoadingMore(true);
    setError("");
    const currentRequest = requestId.current;
    try {
      const page = await listGalleryPage(kind, { category, sort, offset: items.length, limit: ADMIN_FETCH_LIMIT });
      if (currentRequest !== requestId.current) return;
      const added = page.items.filter((item) => !items.some((loaded) => loaded.id === item.id));
      setItems((current) => [...current, ...added]);
      setDescriptions((current) => ({ ...current, ...Object.fromEntries(added.map((item) => [item.path, item.description ?? ""])) }));
      setTotal(page.total);
    } catch {
      if (currentRequest === requestId.current) setError("Não foi possível carregar mais arquivos.");
    } finally {
      if (currentRequest === requestId.current) {
        morePending.current = false;
        setLoadingMore(false);
      }
    }
  };

  const remove = async (path: string) => {
    setDeleting(path);
    setError("");

    try {
      await deleteGalleryItem(path);
      await loadItems();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Não foi possível excluir este arquivo.");
    } finally {
      setDeleting("");
    }
  };

  const saveDescription = async (item: GalleryItem) => {
    const description = descriptions[item.path] ?? "";
    setSaving(item.path);
    setError("");

    try {
      await updateGalleryItemDescription(item.path, description);
      setItems((current) =>
        current.map((currentItem) =>
          currentItem.path === item.path ? { ...currentItem, description } : currentItem
        )
      );
      setNotice("Descrição salva.");
    } catch {
      setError("Não foi possível salvar a descrição.");
    } finally {
      setSaving("");
    }
  };

  const isDirty = (item: GalleryItem) => (descriptions[item.path] ?? "") !== (item.description ?? "");
  const jumpTo = (groupCategory: string) => document.getElementById(groupId(groupCategory))?.scrollIntoView({ behavior: "smooth", block: "start" });
  const KindIcon = kind === "photos" ? ImageIcon : Film;
  const kindLabel = kind === "photos" ? "Foto" : "Vídeo";
  const flatItems = groupedItems.flatMap((group) => group.items);
  const editingIndex = flatItems.findIndex((item) => item.path === editingPath);
  const editing = editingIndex >= 0 ? flatItems[editingIndex] : null;
  const goTo = (offset: number) => {
    if (editingIndex < 0 || !flatItems.length) return;
    setEditingPath(flatItems[(editingIndex + offset + flatItems.length) % flatItems.length].path);
  };

  // Editor lateral: trava a rolagem do fundo, fecha com Esc e navega com as setas.
  useEffect(() => {
    if (!editing) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (pendingDelete) return;
      const target = event.target;
      const typing = target instanceof Element && Boolean(target.closest("textarea, input, select, video"));
      if (event.key === "Escape") setEditingPath("");
      else if (!typing && event.key === "ArrowRight") goTo(1);
      else if (!typing && event.key === "ArrowLeft") goTo(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  });

  const tileAspect = kind === "photos" ? "aspect-[4/5]" : "aspect-video";

  return (
    <section className="min-w-0 w-full overflow-hidden rounded-3xl border border-border bg-card/80 shadow-[0_18px_50px_rgba(18,9,26,0.08)] backdrop-blur">
      {/* Cabeçalho com faixa de destaque */}
      <div className="relative overflow-hidden border-b border-border px-5 pb-5 pt-6 md:px-7">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(170,125,206,0.35),transparent_65%)] blur-2xl" />
        <div className="relative flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className={`${ui.eyebrow} flex items-center gap-2`} style={mono}><Sparkles size={12} aria-hidden="true" /> Organização por categoria</p>
            <h2 className="mt-1.5 text-3xl md:text-4xl" style={serif}>{title}</h2>
          </div>
          <div className="inline-flex items-center gap-2 self-start rounded-full border border-border bg-background/60 px-3.5 py-1.5 text-xs text-muted-foreground backdrop-blur md:self-auto">
            <KindIcon size={13} className="text-accent" aria-hidden="true" />
            {loading && items.length === 0 ? "Carregando..." : `${total} arquivo${total === 1 ? "" : "s"} ${category === "Todos" ? "no total" : "na categoria"} · ${items.length} exibido${items.length === 1 ? "" : "s"}`}
          </div>
        </div>

        {/* Filtros */}
        <div className="relative mt-5 grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-3 rounded-2xl border border-border bg-background/60 py-1.5 pl-4 pr-1.5 text-xs text-muted-foreground backdrop-blur">
            <SlidersHorizontal size={15} className="shrink-0 text-accent" aria-hidden="true" />
            <span className="shrink-0">Categoria</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)} className="min-h-10 min-w-0 flex-1 rounded-xl border-0 bg-transparent px-2 text-sm text-foreground focus:outline-none">
              {["Todos", ...orderedCategories.filter((item) => item !== "Todos")].map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-border bg-background/60 py-1.5 pl-4 pr-1.5 text-xs text-muted-foreground backdrop-blur">
            <ArrowDownUp size={15} className="shrink-0 text-accent" aria-hidden="true" />
            <span className="shrink-0">Ordenar por</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as GallerySort)} className="min-h-10 min-w-0 flex-1 rounded-xl border-0 bg-transparent px-2 text-sm text-foreground focus:outline-none">
              <option value="newest">Mais recentes</option>
              <option value="oldest">Mais antigas</option>
            </select>
          </label>
        </div>

        {/* Atalhos para as categorias */}
        {category === "Todos" && groupedItems.length > 1 && (
          <nav aria-label="Ir para categoria" className="relative -mx-1 mt-4 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {groupedItems.map((group) => (
              <button
                key={group.category}
                type="button"
                onClick={() => jumpTo(group.category)}
                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-border bg-background/60 px-3.5 py-1.5 text-xs transition-all hover:-translate-y-0.5 hover:border-accent hover:text-accent"
              >
                {group.category}
                <span className="rounded-full bg-primary/15 px-1.5 text-[10px] font-semibold text-accent">{group.items.length}</span>
              </button>
            ))}
          </nav>
        )}
      </div>

      <div className="p-5 md:p-7">
        {category === "Todos" && items.length > 0 && (
          <p className="mb-5 flex items-start gap-2 text-xs text-muted-foreground">
            <GripVertical size={14} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
            <span>Clique em um item para editar. Para trocar a categoria, arraste-o até outra seção — a página rola sozinha perto das bordas.</span>
          </p>
        )}
        {error && <p className="mb-4 flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert"><AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />{error}</p>}
        {!error && notice && !editing && <p className="mb-4 flex items-start gap-2 rounded-2xl border border-border bg-muted/60 px-4 py-3 text-sm text-muted-foreground" aria-live="polite"><Check size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />{notice}</p>}

        {loading && items.length === 0 && (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3" aria-hidden="true">
            {Array.from({ length: 6 }, (_, index) => <div key={index} className={`${tileAspect} animate-pulse rounded-2xl bg-muted`} />)}
          </div>
        )}

        {!loading && items.length === 0 && !error && (
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border px-6 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-accent"><KindIcon size={26} aria-hidden="true" /></span>
            <p className="text-sm text-muted-foreground">Nenhum arquivo cadastrado.</p>
          </div>
        )}

        <div className="space-y-10">
          {groupedItems.map((group) => (
            <div
              key={group.category}
              id={groupId(group.category)}
              onDragOver={(event) => onGroupDragOver(event, group.category)}
              onDragLeave={(event) => onGroupDragLeave(event, group.category)}
              onDrop={(event) => onGroupDrop(event, group.category)}
              className={[
                "min-w-0 scroll-mt-28 rounded-3xl transition-all",
                dropTarget === group.category
                  ? "bg-accent/10 p-3 shadow-[0_0_0_2px_var(--accent),0_0_0_8px_var(--ring)] md:p-4"
                  : draggingPath
                    ? "bg-background/40 p-3 outline-2 outline-dashed outline-border md:p-4"
                    : "",
              ].join(" ")}
            >
              <div className="mb-4 flex items-center gap-4">
                <h3 className="shrink-0 text-2xl" style={serif}>{group.category}</h3>
                <span className="h-px flex-1 bg-gradient-to-r from-border to-transparent" aria-hidden="true" />
                <span className={ui.chip}>
                  {group.items.length} {group.items.length === 1 ? "item" : "itens"}
                </span>
              </div>

              {group.items.length === 0 && (
                <div className={`flex min-h-28 items-center justify-center gap-2 rounded-2xl border border-dashed px-4 text-center text-xs transition-colors ${dropTarget === group.category ? "border-accent text-accent" : "border-border text-muted-foreground"}`}>
                  <FolderInput size={15} className="shrink-0" aria-hidden="true" />
                  {dropTarget === group.category ? "Solte aqui para mover" : items.length < total ? "Nenhum item carregado aqui. Arraste um item para cá ou use \"Carregar mais\"." : "Nenhum item. Arraste um item para cá."}
                </div>
              )}

              <div className="grid min-w-0 grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-3">
                {group.items.map((item) => (
                  <article
                    key={item.path}
                    className={[
                      "group/card relative min-w-0 overflow-hidden rounded-2xl bg-muted shadow-[0_10px_30px_rgba(18,9,26,0.12)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_22px_48px_rgba(170,125,206,0.28)]",
                      editingPath === item.path ? "ring-2 ring-accent ring-offset-2 ring-offset-card" : "",
                      draggingPath === item.path || moving === item.path ? "opacity-40" : "",
                    ].join(" ")}
                  >
                    <div
                      className={`relative ${tileAspect} cursor-grab overflow-hidden active:cursor-grabbing`}
                      draggable={!moving}
                      onDragStart={(event) => onCardDragStart(event, item)}
                      onDragEnd={onCardDragEnd}
                      onClick={() => setEditingPath(item.path)}
                      title="Clique para editar · arraste para outra categoria"
                    >
                      {kind === "photos" ? (
                        <img src={item.thumbnailUrl || item.url} onError={(event) => retryMediaFromFallback(event.currentTarget)} loading="lazy" alt={item.description || item.category} className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover/card:scale-[1.06]" draggable={false} />
                      ) : item.posterUrl ? (
                        <img src={item.posterUrl} onError={(event) => retryMediaFromFallback(event.currentTarget)} loading="lazy" alt={`Capa: ${item.description || item.category}`} className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover/card:scale-[1.06]" draggable={false} />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-secondary to-muted"><Film size={30} className="text-muted-foreground" aria-hidden="true" /></div>
                      )}

                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/30 opacity-90 transition-opacity duration-300 group-hover/card:opacity-100" aria-hidden="true" />

                      {kind === "videos" && (
                        <span className="pointer-events-none absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/40 bg-white/15 text-white backdrop-blur-md transition-transform duration-300 group-hover/card:scale-110" aria-hidden="true">
                          <Play size={20} className="ml-0.5" fill="currentColor" />
                        </span>
                      )}

                      <span className="pointer-events-none absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/45 px-2.5 py-1 text-[11px] text-white backdrop-blur-md transition-opacity sm:opacity-0 sm:group-hover/card:opacity-100">
                        <GripVertical size={13} aria-hidden="true" /> Arrastar
                      </span>

                      <div className="absolute right-3 top-3 flex gap-1.5 transition-all sm:translate-y-[-4px] sm:opacity-0 sm:group-hover/card:translate-y-0 sm:group-hover/card:opacity-100 sm:group-focus-within/card:translate-y-0 sm:group-focus-within/card:opacity-100">
                        <button
                          type="button"
                          onClick={(event) => { event.stopPropagation(); setEditingPath(item.path); }}
                          className="rounded-full bg-white/90 p-2 text-[#12091a] shadow-lg transition-colors hover:bg-white"
                          aria-label="Editar item"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={(event) => { event.stopPropagation(); setPendingDelete(item); }}
                          className="rounded-full bg-black/55 p-2 text-white shadow-lg backdrop-blur-md transition-colors hover:bg-destructive disabled:opacity-50"
                          disabled={deleting === item.path}
                          aria-label="Excluir arquivo"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 text-white">
                        <div className="mb-1.5 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-white/70" style={mono}>
                          <span>{kindLabel}{formatDuration(item.duration) ? ` · ${formatDuration(item.duration)}` : ""}</span>
                          {formatDate(item.createdAt) && <><span aria-hidden="true">•</span><span>{formatDate(item.createdAt)}</span></>}
                        </div>
                        {item.description
                          ? <p className="line-clamp-2 text-sm font-medium leading-snug">{item.description}</p>
                          : <p className="text-sm italic text-white/55">Sem descrição</p>}
                        {isDirty(item) && <p className="mt-1 text-[11px] text-[#e3c8f5]">Alterações não salvas</p>}
                      </div>

                      {(moving === item.path || deleting === item.path) && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/55 text-xs text-white backdrop-blur-sm">
                          {moving === item.path ? "Movendo..." : "Excluindo..."}
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>

        {!loading && items.length < total && (
          <div className="mt-10 flex flex-col items-center gap-2">
            <button type="button" onClick={loadMore} disabled={loadingMore} className="btn-modern min-h-11 border border-border bg-background/60 px-8 py-2 text-sm font-semibold hover:border-accent hover:bg-accent hover:text-accent-foreground disabled:opacity-50">
              {loadingMore ? "Carregando..." : "Carregar mais"}
            </button>
            <span className="text-[11px] text-muted-foreground" style={mono}>{items.length} de {total}</span>
          </div>
        )}
      </div>

      {/* Editor lateral */}
      {editing && createPortal(
        <div className="fixed inset-0 z-[9000] flex justify-end" role="dialog" aria-modal="true" aria-labelledby="editor-title">
          <button type="button" className="absolute inset-0 cursor-default bg-[#12091a]/70 backdrop-blur-sm" aria-label="Fechar editor" onClick={() => setEditingPath("")} />
          <div className="page-enter relative flex h-full w-full max-w-xl flex-col overflow-hidden border-l border-border bg-card shadow-[-30px_0_80px_rgba(18,9,26,0.35)]">
            <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div className="min-w-0">
                <p className={ui.eyebrow} style={mono}>Editar {kindLabel.toLowerCase()}</p>
                <h2 id="editor-title" className="truncate text-2xl" style={serif}>{editing.category}</h2>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="mr-1 text-[11px] text-muted-foreground" style={mono}>{editingIndex + 1} / {flatItems.length}</span>
                <button type="button" onClick={() => goTo(-1)} className="rounded-full border border-border p-2 transition-colors hover:border-accent hover:text-accent" aria-label="Item anterior"><ChevronLeft size={16} /></button>
                <button type="button" onClick={() => goTo(1)} className="rounded-full border border-border p-2 transition-colors hover:border-accent hover:text-accent" aria-label="Próximo item"><ChevronRight size={16} /></button>
                <button type="button" autoFocus onClick={() => setEditingPath("")} className="ml-1 rounded-full bg-muted p-2 transition-colors hover:bg-accent hover:text-accent-foreground" aria-label="Fechar editor"><X size={16} /></button>
              </div>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto p-5">
              <div className="relative overflow-hidden rounded-2xl bg-black">
                {kind === "photos" ? (
                  <img key={editing.path} src={editing.optimizedUrl || editing.url} onError={(event) => retryMediaFromFallback(event.currentTarget)} alt={editing.description || editing.category} className="mx-auto max-h-[46vh] w-full object-contain" />
                ) : (
                  <video key={editing.path} src={editing.originalUrl || editing.url} poster={editing.posterUrl} controls playsInline preload="metadata" onError={(event) => { if (retryMediaFromFallback(event.currentTarget)) event.currentTarget.load(); }} className="mx-auto max-h-[46vh] w-full bg-black object-contain" />
                )}
                {kind === "photos" && (editing.originalUrl || editing.url) && (
                  <a href={editing.originalUrl || editing.url} target="_blank" rel="noreferrer" className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-3 py-1.5 text-[11px] text-white backdrop-blur-md transition-colors hover:bg-black/80">
                    <Maximize2 size={12} aria-hidden="true" /> Abrir original
                  </a>
                )}
              </div>

              <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground" style={mono}>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1"><KindIcon size={12} className="text-accent" aria-hidden="true" />{kindLabel}</span>
                {formatDate(editing.createdAt) && <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1"><CalendarDays size={12} className="text-accent" aria-hidden="true" />{formatDate(editing.createdAt)}</span>}
                {editing.width && editing.height && <span className="rounded-full border border-border px-3 py-1">{editing.width} × {editing.height}</span>}
                {formatDuration(editing.duration) && <span className="rounded-full border border-border px-3 py-1">{formatDuration(editing.duration)}</span>}
              </div>

              <div className="space-y-3">
                <p className={ui.label} style={mono}>Categoria</p>
                <div className="flex flex-wrap gap-2" role="group" aria-label="Mover para">
                  {[...(!moveTargets.includes(editing.category) ? [editing.category] : []), ...moveTargets].map((target) => {
                    const active = editing.category === target;
                    return (
                      <button
                        key={target}
                        type="button"
                        disabled={Boolean(moving) || active}
                        aria-pressed={active}
                        onClick={() => void moveItem(editing.path, target)}
                        className={[
                          "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium transition-all",
                          active
                            ? "bg-primary text-primary-foreground shadow-[0_8px_20px_rgba(170,125,206,0.35)]"
                            : "border border-border hover:-translate-y-0.5 hover:border-accent hover:text-accent disabled:opacity-50",
                        ].join(" ")}
                      >
                        {active && <Check size={13} aria-hidden="true" />}{target}
                      </button>
                    );
                  })}
                </div>
                {moving === editing.path && <p className="text-xs text-muted-foreground">Movendo...</p>}
              </div>

              <label className="block space-y-3">
                <span className="flex items-center justify-between">
                  <span className={ui.label} style={mono}>Descrição</span>
                  <span className="text-[11px] text-muted-foreground" style={mono}>{(descriptions[editing.path] ?? "").length}/240</span>
                </span>
                <textarea
                  value={descriptions[editing.path] ?? ""}
                  onChange={(event) => setDescriptions((current) => ({ ...current, [editing.path]: event.target.value }))}
                  rows={4}
                  maxLength={240}
                  placeholder="Adicione uma descrição para esta mídia."
                  className={`${ui.field} resize-y`}
                />
              </label>

              {error && <p className="flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"><AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />{error}</p>}
              {!error && notice && <p className="flex items-start gap-2 rounded-2xl border border-border bg-muted/60 px-4 py-3 text-sm text-muted-foreground" aria-live="polite"><Check size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />{notice}</p>}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-border bg-card/95 px-5 py-4">
              <button
                type="button"
                onClick={() => setPendingDelete(editing)}
                disabled={deleting === editing.path}
                className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
              >
                <Trash2 size={15} aria-hidden="true" /> Excluir
              </button>
              <div className="flex items-center gap-3">
                {isDirty(editing) && <span className="hidden text-[11px] text-muted-foreground sm:inline">Alterações não salvas</span>}
                <button
                  type="button"
                  onClick={() => saveDescription(editing)}
                  disabled={saving === editing.path || !isDirty(editing)}
                  className="btn-modern inline-flex min-h-11 items-center gap-2 bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-40"
                >
                  <Save size={15} aria-hidden="true" />
                  {saving === editing.path ? "Salvando..." : "Salvar descrição"}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {pendingDelete && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-5 backdrop-blur-sm" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-description">
          <div className="w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
            {(pendingDelete.thumbnailUrl || pendingDelete.posterUrl) && (
              <img src={pendingDelete.thumbnailUrl || pendingDelete.posterUrl} alt="" className="h-40 w-full object-cover" />
            )}
            <div className="p-6">
              <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-destructive/15 text-destructive"><Trash2 size={18} aria-hidden="true" /></span>
              <h2 id="delete-title" className="text-2xl">Excluir este arquivo?</h2>
              <p id="delete-description" className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Serão removidos somente o original, o metadado e as versões derivadas deste item: {pendingDelete.description || pendingDelete.name || pendingDelete.category}.
              </p>
              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <button type="button" onClick={() => setPendingDelete(null)} className="min-h-11 rounded-full border border-border px-5 py-2 text-sm transition-colors hover:border-accent">Cancelar</button>
                <button
                  type="button"
                  autoFocus
                  onClick={() => {
                    const path = pendingDelete.path;
                    setPendingDelete(null);
                    void remove(path);
                  }}
                  className="min-h-11 rounded-full bg-destructive px-5 py-2 text-sm text-destructive-foreground transition-opacity hover:opacity-90"
                >
                  Excluir este arquivo
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </section>
  );
}
