import { isSupabaseConfigured, supabase } from "./supabase";

export const GALLERY_BUCKET = "galeria";
export type GalleryKind = "photos" | "videos";

export type GalleryItem = {
  id: string;
  name: string;
  path: string;
  url: string;
  category: string;
  createdAt?: string;
};

export const DEFAULT_PHOTO_CATEGORIES = ["Todos", "Retrato", "Ensaios", "Eventos", "Produtos"];
export const DEFAULT_VIDEO_CATEGORIES = [
  "Serviços e Produtos",
  "Imobiliário",
  "Eventos Musicais e Shows",
  "Moda e Varejo",
  "Eventos Sociais",
  "Gastronomia",
];

function cleanCategory(category: string) {
  return category.trim() || "Sem categoria";
}

function slugify(value: string) {
  return cleanCategory(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "sem-categoria";
}

function titleFromFileName(fileName: string) {
  return fileName
    .replace(/^\d+-/, "")
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ");
}

function categoryFromSlug(slug: string) {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "Sem categoria";
}

function categoryKey(category: string) {
  return category
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizeGalleryCategory(kind: GalleryKind, category: string) {
  const key = categoryKey(category);

  if (kind === "photos") {
    const aliases: Record<string, string> = {
      produto: "Produtos",
      produtos: "Produtos",
      retrato: "Retrato",
      retratos: "Retrato",
      ensaio: "Ensaios",
      ensaios: "Ensaios",
      bastidor: "Ensaios",
      bastidores: "Ensaios",
      evento: "Eventos",
      eventos: "Eventos",
    };

    return aliases[key] ?? "Ensaios";
  }

  const aliases: Record<string, string> = {
    storytelling: "Serviços e Produtos",
    "trafego pago": "Serviços e Produtos",
    produto: "Serviços e Produtos",
    produtos: "Serviços e Produtos",
    servico: "Serviços e Produtos",
    servicos: "Serviços e Produtos",
    "servicos e produtos": "Serviços e Produtos",
    imobiliario: "Imobiliário",
    evento: "Eventos Sociais",
    eventos: "Eventos Sociais",
    "eventos musicais e shows": "Eventos Musicais e Shows",
    show: "Eventos Musicais e Shows",
    shows: "Eventos Musicais e Shows",
    moda: "Moda e Varejo",
    varejo: "Moda e Varejo",
    "moda e varejo": "Moda e Varejo",
    "eventos sociais": "Eventos Sociais",
    gastronomia: "Gastronomia",
  };

  return aliases[key] ?? "Serviços e Produtos";
}

export function getCategories(_items: { category: string }[], defaults: string[]) {
  return defaults;
}

export async function listGalleryItems(kind: GalleryKind): Promise<GalleryItem[]> {
  if (!isSupabaseConfigured) throw new Error("Supabase não configurado.");

  const { data: folders, error: folderError } = await supabase.storage.from(GALLERY_BUCKET).list(kind, {
    limit: 100,
    sortBy: { column: "name", order: "asc" },
  });

  if (folderError) throw folderError;

  const visibleFolders = (folders ?? []).filter((folder) => !folder.name.includes("."));
  const items = await Promise.all(
    visibleFolders.map(async (folder) => {
      const category = normalizeGalleryCategory(kind, categoryFromSlug(folder.name));
      const prefix = `${kind}/${folder.name}`;
      const { data: files, error } = await supabase.storage.from(GALLERY_BUCKET).list(prefix, {
        limit: 100,
        sortBy: { column: "created_at", order: "desc" },
      });

      if (error) throw error;

      return (files ?? [])
        .filter((file) => file.name && !file.name.startsWith("."))
        .map((file) => {
          const path = `${prefix}/${file.name}`;
          const { data } = supabase.storage.from(GALLERY_BUCKET).getPublicUrl(path);

          return {
            id: path,
            name: titleFromFileName(file.name),
            path,
            url: data.publicUrl,
            category,
            createdAt: file.created_at,
          };
        });
    })
  );

  return items.flat().sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
}

export async function uploadGalleryItem(kind: GalleryKind, file: File, category: string) {
  if (!isSupabaseConfigured) throw new Error("Supabase não configurado.");

  const extension = file.name.includes(".") ? file.name.split(".").pop() : "";
  const safeName = slugify(file.name.replace(/\.[^.]+$/, ""));
  const uniqueId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const filename = `${Date.now()}-${uniqueId}-${safeName}${extension ? `.${extension}` : ""}`;
  const path = `${kind}/${slugify(category)}/${filename}`;

  const { error } = await supabase.storage.from(GALLERY_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) throw error;
  return path;
}

export async function deleteGalleryItem(path: string) {
  if (!isSupabaseConfigured) throw new Error("Supabase não configurado.");

  const { error } = await supabase.storage.from(GALLERY_BUCKET).remove([path]);
  if (error) throw error;
}
