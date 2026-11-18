import { useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import { GripVertical, Save, X } from "lucide-react";
import {
  DEFAULT_PHOTO_CATEGORIES,
  DEFAULT_VIDEO_CATEGORIES,
  GALLERY_PAGE_SIZE,
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

type GaleriaAdminProps = {
  kind: GalleryKind;
  refreshKey: number;
};

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

  const loadItems = async (limit = GALLERY_PAGE_SIZE) => {
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
      const page = await listGalleryPage(kind, { category, sort, offset: items.length });
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
      await loadItems(Math.min(1000, Math.max(GALLERY_PAGE_SIZE, items.length)));
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
    } catch {
      setError("Não foi possível salvar a descrição.");
    } finally {
      setSaving("");
    }
  };

  return (
    <section className="min-w-0 w-full bg-card border border-border p-5 md:p-6 rounded-2xl">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 mb-6">
        <div>
          <p className="text-xs tracking-widest uppercase text-accent mb-2" style={{ fontFamily: "DM Mono, monospace" }}>
            Organização por categoria
          </p>
          <h2 className="text-2xl" style={{ fontFamily: "DM Serif Display, serif" }}>{title}</h2>
        </div>
        <div className="text-sm text-muted-foreground">
          {loading && items.length === 0 ? "Carregando..." : `${total} arquivo${total === 1 ? "" : "s"} ${category === "Todos" ? "no total" : "na categoria"} · ${items.length} exibido${items.length === 1 ? "" : "s"}`}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Categoria
          <select value={category} onChange={(event) => setCategory(event.target.value)} className="min-h-11 rounded-xl border border-border bg-background px-3 text-foreground">
            {["Todos", ...orderedCategories.filter((item) => item !== "Todos")].map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Ordenar por
          <select value={sort} onChange={(event) => setSort(event.target.value as GallerySort)} className="min-h-11 rounded-xl border border-border bg-background px-3 text-foreground">
            <option value="newest">Mais recentes</option>
            <option value="oldest">Mais antigas</option>
          </select>
        </label>
      </div>

      {category === "Todos" && items.length > 0 && (
        <p className="text-xs text-muted-foreground mb-4">
          Para trocar a categoria, arraste o item pela alça <GripVertical size={12} className="inline align-[-2px]" aria-hidden="true" /> até outra categoria, ou use "Mover para" no card.
        </p>
      )}
      {error && <p className="text-sm text-destructive mb-4" role="alert">{error}</p>}
      {!error && notice && <p className="text-sm text-muted-foreground mb-4" aria-live="polite">{notice}</p>}

      {!loading && items.length === 0 && !error && (
        <p className="text-sm text-muted-foreground">Nenhum arquivo cadastrado.</p>
      )}

      <div className="space-y-8">
        {groupedItems.map((group) => (
          <div
            key={group.category}
            onDragOver={(event) => onGroupDragOver(event, group.category)}
            onDragLeave={(event) => onGroupDragLeave(event, group.category)}
            onDrop={(event) => onGroupDrop(event, group.category)}
            className={[
              "min-w-0 rounded-2xl border p-4 md:p-5 transition-colors",
              dropTarget === group.category
                ? "border-accent border-dashed border-2 bg-accent/10"
                : draggingPath
                  ? "border-dashed border-border bg-background/55"
                  : "border-border bg-background/55",
            ].join(" ")}
          >
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="text-lg font-semibold">{group.category}</h3>
              <span className="rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-semibold">
                {group.items.length} {group.items.length === 1 ? "item" : "itens"}
              </span>
            </div>

            {group.items.length === 0 && (
              <div className="flex min-h-24 items-center justify-center rounded-xl border border-dashed border-border text-xs text-muted-foreground">
                {dropTarget === group.category ? "Solte aqui para mover" : "Nenhum item. Arraste um item para cá."}
              </div>
            )}

            <div className="grid min-w-0 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {group.items.map((item) => (
                <article
                  key={item.path}
                  className={[
                    "min-w-0 border border-border bg-card overflow-hidden rounded-2xl transition-opacity",
                    draggingPath === item.path || moving === item.path ? "opacity-40" : "",
                  ].join(" ")}
                >
                  <div
                    className="relative aspect-video bg-muted cursor-grab active:cursor-grabbing"
                    draggable={!moving}
                    onDragStart={(event) => onCardDragStart(event, item)}
                    onDragEnd={onCardDragEnd}
                    title="Arraste para outra categoria"
                  >
                    <span className="pointer-events-none absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-[11px] text-white">
                      <GripVertical size={13} aria-hidden="true" /> Arrastar
                    </span>
                    {kind === "photos" ? (
                      <img src={item.thumbnailUrl || item.url} onError={(event) => retryMediaFromFallback(event.currentTarget)} loading="lazy" alt={item.description || item.category} className="w-full h-full object-cover" />
                    ) : (
                      item.posterUrl ? <img src={item.posterUrl} onError={(event) => retryMediaFromFallback(event.currentTarget)} loading="lazy" alt={`Capa: ${item.description || item.category}`} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-muted" />
                    )}
                    <button
                      type="button"
                      onClick={() => setPendingDelete(item)}
                      className="absolute top-3 right-3 p-2 rounded-full bg-black/70 text-white hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50"
                      disabled={deleting === item.path}
                      aria-label="Excluir arquivo"
                    >
                      <X size={15} />
                    </button>
                  </div>
                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs tracking-widest uppercase text-accent" style={{ fontFamily: "DM Mono, monospace" }}>
                        {kind === "photos" ? "Foto" : "Vídeo"}
                      </p>
                      {formatDate(item.createdAt) && (
                        <p className="text-xs text-muted-foreground">{formatDate(item.createdAt)}</p>
                      )}
                    </div>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      Mover para
                      <select
                        value={item.category}
                        disabled={Boolean(moving)}
                        onChange={(event) => void moveItem(item.path, event.target.value)}
                        className="min-h-9 min-w-0 flex-1 rounded-xl border border-border bg-background px-2 text-foreground disabled:opacity-50"
                      >
                        {!moveTargets.includes(item.category) && <option value={item.category}>{item.category}</option>}
                        {moveTargets.map((target) => <option key={target} value={target}>{target}</option>)}
                      </select>
                    </label>
                    {moving === item.path && <p className="text-xs text-muted-foreground">Movendo...</p>}
                    <label className="block space-y-2">
                      <span className="text-xs text-muted-foreground">Descrição</span>
                      <textarea
                        value={descriptions[item.path] ?? ""}
                        onChange={(event) =>
                          setDescriptions((current) => ({
                            ...current,
                            [item.path]: event.target.value,
                          }))
                        }
                        rows={3}
                        maxLength={240}
                        placeholder="Adicione uma descrição para esta mídia."
                        className="w-full min-w-0 max-w-full rounded-xl border border-border bg-background px-3 py-2 text-sm resize-y"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => saveDescription(item)}
                      disabled={saving === item.path}
                      className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-all hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
                    >
                      <Save size={14} />
                      {saving === item.path ? "Salvando..." : "Salvar descrição"}
                    </button>
                    {deleting === item.path && <p className="text-xs text-muted-foreground">Excluindo...</p>}
                  </div>
                </article>
              ))}
            </div>
          </div>
        ))}
      </div>
      {!loading && items.length < total && (
        <div className="mt-8 text-center">
          <button type="button" onClick={loadMore} disabled={loadingMore} className="min-h-11 rounded-full border border-border px-6 py-2 text-sm font-semibold hover:bg-accent hover:text-accent-foreground disabled:opacity-50">
            {loadingMore ? "Carregando..." : "Carregar mais"}
          </button>
        </div>
      )}
      {pendingDelete && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-5" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-description">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <h2 id="delete-title" className="text-2xl">Excluir este arquivo?</h2>
            <p id="delete-description" className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Serão removidos somente o original, o metadado e as versões derivadas deste item: {pendingDelete.description || pendingDelete.name || pendingDelete.category}.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={() => setPendingDelete(null)} className="min-h-11 rounded-full border border-border px-5 py-2 text-sm">Cancelar</button>
              <button
                type="button"
                autoFocus
                onClick={() => {
                  const path = pendingDelete.path;
                  setPendingDelete(null);
                  void remove(path);
                }}
                className="min-h-11 rounded-full bg-destructive px-5 py-2 text-sm text-destructive-foreground"
              >
                Excluir este arquivo
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
