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

export const DEFAULT_PHOTO_CATEGORIES = ["Todos", "Produtos", "Eventos", "Retratos", "Bastidores"];
export const DEFAULT_VIDEO_CATEGORIES = ["Todos", "Storytelling", "Tráfego Pago", "Eventos", "Produtos"];

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

export function getCategories(items: { category: string }[], defaults: string[]) {
  const unique = new Set(defaults);
  items.forEach((item) => {
    if (item.category.trim()) unique.add(item.category.trim());
  });
  return Array.from(unique);
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
      const category = categoryFromSlug(folder.name);
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
  const filename = `${Date.now()}-${safeName}${extension ? `.${extension}` : ""}`;
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
