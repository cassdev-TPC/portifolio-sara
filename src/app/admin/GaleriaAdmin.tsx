import { useEffect, useMemo, useState } from "react";
import { Save, X } from "lucide-react";
import {
  DEFAULT_PHOTO_CATEGORIES,
  DEFAULT_VIDEO_CATEGORIES,
  deleteGalleryItem,
  type GalleryItem,
  type GalleryKind,
  listGalleryItems,
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
      items: categoryItems.sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""))),
    }))
    .filter((group) => group.items.length > 0);
}

export default function GaleriaAdmin({ kind, refreshKey }: GaleriaAdminProps) {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState("");
  const [saving, setSaving] = useState("");
  const [descriptions, setDescriptions] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  const title = kind === "photos" ? "Fotos cadastradas" : "Vídeos cadastrados";
  const orderedCategories = kind === "photos" ? DEFAULT_PHOTO_CATEGORIES : DEFAULT_VIDEO_CATEGORIES;
  const groupedItems = useMemo(() => groupItems(items, orderedCategories), [items, orderedCategories]);

  const loadItems = async () => {
    setLoading(true);
    setError("");

    try {
      const nextItems = await listGalleryItems(kind);
      setItems(nextItems);
      setDescriptions(
        Object.fromEntries(nextItems.map((item) => [item.path, item.description ?? ""]))
      );
    } catch {
      setError("Não foi possível carregar a galeria.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, [kind, refreshKey]);

  const remove = async (path: string) => {
    setDeleting(path);
    setError("");

    try {
      await deleteGalleryItem(path);
      setItems((current) => current.filter((item) => item.path !== path));
    } catch {
      setError("Não foi possível excluir este arquivo.");
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
    <section className="bg-card border border-border p-5 md:p-6 rounded-2xl">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 mb-6">
        <div>
          <p className="text-xs tracking-widest uppercase text-accent mb-2" style={{ fontFamily: "DM Mono, monospace" }}>
            Organização por categoria
          </p>
          <h2 className="text-2xl" style={{ fontFamily: "DM Serif Display, serif" }}>{title}</h2>
        </div>
        <div className="text-sm text-muted-foreground">
          {loading ? "Carregando..." : `${items.length} arquivo${items.length === 1 ? "" : "s"} no total`}
        </div>
      </div>

      {error && <p className="text-sm text-accent mb-4">{error}</p>}

      {!loading && items.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum arquivo cadastrado.</p>
      )}

      <div className="space-y-8">
        {groupedItems.map((group) => (
          <div key={group.category} className="rounded-2xl border border-border bg-background/55 p-4 md:p-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="text-lg font-semibold">{group.category}</h3>
              <span className="rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-semibold">
                {group.items.length} {group.items.length === 1 ? "item" : "itens"}
              </span>
            </div>

            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {group.items.map((item) => (
                <article key={item.path} className="border border-border bg-card overflow-hidden rounded-2xl">
                  <div className="relative aspect-video bg-muted">
                    {kind === "photos" ? (
                      <img src={item.url} alt={item.description || item.category} className="w-full h-full object-cover" />
                    ) : (
                      <video src={item.url} className="w-full h-full object-cover" controls preload="metadata" />
                    )}
                    <button
                      type="button"
                      onClick={() => remove(item.path)}
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
                        className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm resize-y"
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
    </section>
  );
}
