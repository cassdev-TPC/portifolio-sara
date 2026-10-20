import { useEffect, useMemo, useRef, useState } from "react";
import { Save, X } from "lucide-react";
import {
  DEFAULT_PHOTO_CATEGORIES,
  DEFAULT_VIDEO_CATEGORIES,
  GALLERY_PAGE_SIZE,
  deleteGalleryItem,
  type GalleryItem,
  type GalleryKind,
  type GallerySort,
  listGalleryPage,
  updateGalleryItemDescription,
} from "../../lib/gallery";

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

function groupItems(items: GalleryItem[], orderedCategories: string[]) {
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
    .filter((group) => group.items.length > 0);
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
  const requestId = useRef(0);
  const morePending = useRef(false);

  const title = kind === "photos" ? "Fotos cadastradas" : "Vídeos cadastrados";
  const orderedCategories = kind === "photos" ? DEFAULT_PHOTO_CATEGORIES : DEFAULT_VIDEO_CATEGORIES;
  const groupedItems = useMemo(() => groupItems(items, orderedCategories), [items, orderedCategories]);

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

      {error && <p className="text-sm text-destructive mb-4" role="alert">{error}</p>}

      {!loading && items.length === 0 && !error && (
        <p className="text-sm text-muted-foreground">Nenhum arquivo cadastrado.</p>
      )}

      <div className="space-y-8">
        {groupedItems.map((group) => (
          <div key={group.category} className="min-w-0 rounded-2xl border border-border bg-background/55 p-4 md:p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="text-lg font-semibold">{group.category}</h3>
              <span className="rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-semibold">
                {group.items.length} {group.items.length === 1 ? "item" : "itens"}
              </span>
            </div>

            <div className="grid min-w-0 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {group.items.map((item) => (
                <article key={item.path} className="min-w-0 border border-border bg-card overflow-hidden rounded-2xl">
                  <div className="relative aspect-video bg-muted">
                    {kind === "photos" ? (
                      <img src={item.thumbnailUrl || item.url} loading="lazy" alt={item.description || item.category} className="w-full h-full object-cover" />
                    ) : (
                      item.posterUrl ? <img src={item.posterUrl} loading="lazy" alt={`Capa: ${item.description || item.category}`} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-muted" />
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
