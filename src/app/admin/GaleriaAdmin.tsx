import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { deleteGalleryItem, type GalleryItem, type GalleryKind, listGalleryItems } from "../../lib/gallery";

type GaleriaAdminProps = {
  kind: GalleryKind;
  refreshKey: number;
};

export default function GaleriaAdmin({ kind, refreshKey }: GaleriaAdminProps) {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState("");
  const [error, setError] = useState("");

  const title = kind === "photos" ? "Fotos cadastradas" : "Vídeos cadastrados";

  const loadItems = async () => {
    setLoading(true);
    setError("");

    try {
      setItems(await listGalleryItems(kind));
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

  return (
    <section className="bg-card border border-border p-5 md:p-6">
      <div className="flex items-center justify-between gap-4 mb-5">
        <h2 className="text-2xl" style={{ fontFamily: "DM Serif Display, serif" }}>{title}</h2>
        {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
      </div>

      {error && <p className="text-sm text-accent mb-4">{error}</p>}

      {!loading && items.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum arquivo cadastrado.</p>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => (
          <div key={item.path} className="border border-border bg-background overflow-hidden">
            <div className="relative aspect-video bg-muted">
              {kind === "photos" ? (
                <img src={item.url} alt={item.name} className="w-full h-full object-cover" />
              ) : (
                <video src={item.url} className="w-full h-full object-cover" controls />
              )}
              <button
                onClick={() => remove(item.path)}
                className="absolute top-3 right-3 p-2 bg-black/70 text-white hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50"
                disabled={deleting === item.path}
                aria-label="Excluir arquivo"
              >
                <X size={15} />
              </button>
            </div>
            <div className="p-4">
              <p className="text-xs tracking-widest uppercase text-accent mb-1" style={{ fontFamily: "DM Mono, monospace" }}>{item.category}</p>
              <p className="text-sm text-muted-foreground truncate">{item.name}</p>
              {deleting === item.path && <p className="text-xs text-muted-foreground mt-2">Excluindo...</p>}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
