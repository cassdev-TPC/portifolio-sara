import { isSupabaseConfigured, supabase } from "./supabase";

export const GALLERY_BUCKET = "galeria";
export type GalleryKind = "photos" | "videos";
export type GallerySort = "newest" | "oldest";
export type GalleryPage = { items: GalleryItem[]; total: number };
export const GALLERY_PAGE_SIZE = 12;

const R2_PUBLIC_URL = import.meta.env.VITE_R2_PUBLIC_URL?.replace(/\/$/, "") ?? "";
// Keep the previous public endpoint available while DNS caches learn the media domain.
const R2_FALLBACK_URL = "https://pub-a324c717811d497b9c1237129c84ffbd.r2.dev";
const isR2Configured = Boolean(R2_PUBLIC_URL);

export function retryMediaFromFallback(element: HTMLImageElement | HTMLVideoElement, publicUrl = R2_PUBLIC_URL): boolean {
  const currentUrl = element.currentSrc || element.src;
  const prefix = `${publicUrl}/`;
  if (!publicUrl || !currentUrl.startsWith(prefix) || element.dataset.r2FallbackAttempted) return false;
  element.dataset.r2FallbackAttempted = "true";
  element.src = `${R2_FALLBACK_URL}/${currentUrl.slice(prefix.length)}`;
  return true;
}

export type GalleryItem = {
  id: string;
  name: string;
  path: string;
  url: string;
  category: string;
  description?: string;
  createdAt?: string;
  originalUrl?: string;
  optimizedUrl?: string;
  thumbnailUrl?: string;
  posterUrl?: string;
  width?: number;
  height?: number;
  duration?: number;
  status?: string;
};

export type UploadProgress = { stage: string; percent: number };
export type UploadOptions = { description?: string; onProgress?: (progress: UploadProgress) => void };

export const DEFAULT_PHOTO_CATEGORIES = ["Todos", "Retrato", "Ensaios", "Pré Wedding", "Eventos", "Produtos"];
export const DEFAULT_VIDEO_CATEGORIES = [
  "Serviços e Produtos",
  "Imobiliário",
  "Eventos Musicais e Shows",
  "Moda e Varejo",
  "Eventos Sociais",
  "Gastronomia",
  "Vídeos",
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
    .replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i, "")
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

export function normalizeGalleryCategory(kind: GalleryKind, category: string) {
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
      "pre wedding": "Pré Wedding",
      "pre-wedding": "Pré Wedding",
      evento: "Eventos",
      eventos: "Eventos",
    };

    const normalized = aliases[key];
    if (!normalized) throw new Error(`Categoria de foto inválida: ${category || "vazia"}.`);
    return normalized;
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
    videos: "Vídeos",
  };

  const normalized = aliases[key];
  if (!normalized) throw new Error(`Categoria de vídeo inválida: ${category || "vazia"}.`);
  return normalized;
}

export function validateGalleryCategory(kind: GalleryKind, category: string) {
  return normalizeGalleryCategory(kind, category);
}

export function getCategories(_items: { category: string }[], defaults: string[]) {
  return defaults;
}

async function getAdminToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? "";
}

async function requestR2Json<T>(url: string, options: RequestInit = {}) {
  const response = await fetch(url, options);
  const raw = await response.text();
  let data: { error?: string } = {};

  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { error: raw.slice(0, 180) };
  }

  if (!response.ok) {
    throw new Error(data.error || `Não foi possível concluir a ação. Status ${response.status}.`);
  }

  return data as T;
}

export async function listGalleryPage(
  kind: GalleryKind,
  { category, sort = "newest", offset = 0, limit = GALLERY_PAGE_SIZE }: {
    category?: string;
    sort?: GallerySort;
    offset?: number;
    limit?: number;
  } = {}
): Promise<GalleryPage> {
  if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 1000) {
    throw new Error("Intervalo de galeria inválido.");
  }
  if (sort !== "newest" && sort !== "oldest") throw new Error("Ordenação inválida.");

  if (!isR2Configured) {
    const items = await listGalleryItems(kind);
    const matching = category && category !== "Todos" ? items.filter((item) => item.category === category) : items;
    matching.sort((a, b) => (sort === "newest" ? -1 : 1) * String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? "")) || a.id.localeCompare(b.id));
    return { items: matching.slice(offset, offset + limit), total: matching.length };
  }

  if (!isSupabaseConfigured) throw new Error("Catálogo Supabase não configurado.");
  let query = supabase
    .from("gallery_media")
    .select("id,name,original_path,optimized_path,thumbnail_path,poster_path,category,description,created_at,width,height,duration,status", { count: "exact" })
    .eq("kind", kind);
  if (category && category !== "Todos") query = query.eq("category", category);
  const { data, count, error } = await query
    .order("created_at", { ascending: sort === "oldest" })
    .order("id", { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) throw error;

  const mediaUrl = (path: string | null) => path ? `${R2_PUBLIC_URL}/${path}` : undefined;
  const items = (data ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    path: item.original_path,
    url: mediaUrl(item.optimized_path || item.original_path)!,
    originalUrl: mediaUrl(item.original_path),
    optimizedUrl: mediaUrl(item.optimized_path || item.original_path),
    thumbnailUrl: mediaUrl(item.thumbnail_path || item.poster_path || item.original_path),
    posterUrl: mediaUrl(item.poster_path),
    category: item.category,
    description: item.description,
    createdAt: item.created_at ?? undefined,
    width: item.width ?? undefined,
    height: item.height ?? undefined,
    duration: item.duration ?? undefined,
    status: item.status,
  }));
  return { items, total: count ?? 0 };
}

async function signR2Upload(kind: GalleryKind, file: File, category: string, variant: string, token: string) {
  return requestR2Json<{ key: string; uploadUrl: string; publicUrl: string }>("/api/r2/sign-upload", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ kind, category, variant, fileName: file.name, contentType: file.type }),
  });
}

function putWithProgress(url: string, file: File, onProgress?: (percent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    if (file.type) xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (event) => event.lengthComputable && onProgress?.(Math.round(event.loaded / event.total * 100));
    xhr.onerror = () => reject(new Error("A conexão foi interrompida durante o upload."));
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Falha no upload. Status ${xhr.status}.`));
    xhr.send(file);
  });
}

async function putViaHostinger(key: string, file: File, token: string, onProgress?: (percent: number) => void) {
  const response = await new Promise<XMLHttpRequest>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", `/api/r2/upload?key=${encodeURIComponent(key)}`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (event) => event.lengthComputable && onProgress?.(Math.round(event.loaded / event.total * 100));
    xhr.onerror = () => reject(new Error("A conexão com a Hostinger foi interrompida durante o upload."));
    xhr.onload = () => resolve(xhr);
    xhr.send(file);
  });
  if (response.status < 200 || response.status >= 300) {
    let message = `Falha no envio alternativo. Status ${response.status}.`;
    try { message = JSON.parse(response.responseText)?.error || message; } catch { /* Keep HTTP status. */ }
    throw new Error(message);
  }
}

export async function uploadProcessedGalleryItem(
  kind: GalleryKind,
  category: string,
  files: { variant: string; file: File }[],
  metadata: Record<string, unknown>,
  options: UploadOptions = {}
) {
  if (!isSupabaseConfigured) throw new Error("Supabase não configurado.");
  const normalizedCategory = validateGalleryCategory(kind, category);

  const token = await getAdminToken();
  if (!token) throw new Error("Faça login novamente para enviar arquivos.");

  const uploaded: Record<string, { key: string; url: string }> = {};
  for (const [index, entry] of files.entries()) {
    const signed = await signR2Upload(kind, entry.file, normalizedCategory, entry.variant, token);
    const reportProgress = (stage: string, part: number) => options.onProgress?.({
      stage,
      percent: Math.round(((index + part / 100) / files.length) * 100),
    });
    try {
      await putWithProgress(signed.uploadUrl, entry.file, (part) => reportProgress(`Enviando ${entry.variant}`, part));
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "A conexão foi interrompida durante o upload." || entry.file.size > 32 * 1024 * 1024) throw error;
      reportProgress(`Reenviando ${entry.variant} pela Hostinger`, 0);
      await putViaHostinger(signed.key, entry.file, token, (part) => reportProgress(`Reenviando ${entry.variant} pela Hostinger`, part));
    }
    uploaded[entry.variant] = { key: signed.key, url: signed.publicUrl };
  }
  const original = uploaded.original ?? uploaded.legacy;
  if (!original) throw new Error("O original não foi enviado.");
  await updateR2GalleryItemMetadata(original.key, options.description ?? "", {
    ...metadata,
    variants: Object.fromEntries(Object.entries(uploaded).map(([variant, value]) => [variant, value.key])),
    status: "ready",
  });
  const { error: catalogError } = await supabase.from("gallery_media").upsert({
    id: original.key,
    kind,
    name: titleFromFileName(original.key.split("/").at(-1) || original.key),
    original_path: original.key,
    optimized_path: uploaded.optimized?.key ?? original.key,
    thumbnail_path: uploaded.thumbnail?.key ?? uploaded.poster?.key ?? original.key,
    poster_path: uploaded.poster?.key ?? null,
    category: normalizedCategory,
    description: options.description ?? "",
    width: typeof metadata.width === "number" ? metadata.width : null,
    height: typeof metadata.height === "number" ? metadata.height : null,
    duration: typeof metadata.duration === "number" ? metadata.duration : null,
    status: "ready",
    created_at: new Date().toISOString(),
  });
  if (catalogError) throw new Error(`Arquivos enviados, mas falha ao registrar no catálogo: ${catalogError.message}`);
  options.onProgress?.({ stage: "Concluído", percent: 100 });
  return original.key;
}

async function deleteR2GalleryItem(path: string) {
  if (!isSupabaseConfigured) throw new Error("Supabase não configurado.");

  const token = await getAdminToken();
  if (!token) throw new Error("Faça login novamente para excluir arquivos.");

  await requestR2Json("/api/r2/delete", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ path }),
  });
  const { error } = await supabase.from("gallery_media").delete().eq("id", path);
  if (error) throw new Error(`Arquivo excluído, mas falha ao atualizar o catálogo: ${error.message}`);
}

async function updateR2GalleryItemDescription(path: string, description: string) {
  const { data: item, error: readError } = await supabase.from("gallery_media")
    .select("original_path,optimized_path,thumbnail_path,poster_path,width,height,duration,status")
    .eq("id", path)
    .single();
  if (readError || !item) throw new Error(`Item não encontrado no catálogo: ${readError?.message || path}`);
  const variants = {
    original: item.original_path,
    ...(item.optimized_path && item.optimized_path !== item.original_path ? { optimized: item.optimized_path } : {}),
    ...(item.thumbnail_path && item.thumbnail_path !== item.original_path ? { thumbnail: item.thumbnail_path } : {}),
    ...(item.poster_path ? { poster: item.poster_path } : {}),
  };
  await updateR2GalleryItemMetadata(path, description, {
    variants,
    width: item.width,
    height: item.height,
    duration: item.duration,
    status: item.status,
  });
  const { error } = await supabase.from("gallery_media").update({ description, updated_at: new Date().toISOString() }).eq("id", path);
  if (error) throw new Error(`Descrição salva no R2, mas falha ao atualizar o catálogo: ${error.message}`);
}

async function updateR2GalleryItemMetadata(path: string, description: string, metadata: Record<string, unknown>) {
  if (!isSupabaseConfigured) throw new Error("Supabase não configurado.");

  const token = await getAdminToken();
  if (!token) throw new Error("Faça login novamente para alterar a descrição.");

  await requestR2Json("/api/r2/metadata", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ path, description, metadata }),
  });
}

export async function listGalleryItems(kind: GalleryKind): Promise<GalleryItem[]> {
  if (isR2Configured) return (await listGalleryPage(kind, { limit: 1000 })).items;

  if (!isSupabaseConfigured) throw new Error("Supabase não configurado.");

  const { data: folders, error: folderError } = await supabase.storage.from(GALLERY_BUCKET).list(kind, {
    limit: 1000,
    sortBy: { column: "name", order: "asc" },
  });

  if (folderError) throw folderError;

  const visibleFolders = (folders ?? []).filter((folder) => !folder.name.includes("."));
  const items = await Promise.all(
    visibleFolders.map(async (folder) => {
      const category = normalizeGalleryCategory(kind, categoryFromSlug(folder.name));
      const prefix = `${kind}/${folder.name}`;
      const { data: files, error } = await supabase.storage.from(GALLERY_BUCKET).list(prefix, {
        limit: 1000,
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
            description: "",
            createdAt: file.created_at ?? undefined,
          };
        });
    })
  );

  return items.flat().sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
}

export async function uploadGalleryItem(kind: GalleryKind, file: File, category: string, description = "") {
  if (isR2Configured) return uploadProcessedGalleryItem(kind, category, [{ variant: "legacy", file }], {}, { description });

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
  if (isR2Configured) return deleteR2GalleryItem(path);

  if (!isSupabaseConfigured) throw new Error("Supabase não configurado.");

  const { error } = await supabase.storage.from(GALLERY_BUCKET).remove([path]);
  if (error) throw error;
}

export async function updateGalleryItemDescription(path: string, description: string) {
  if (isR2Configured) return updateR2GalleryItemDescription(path, description);
  throw new Error("Descrição editável está disponível apenas na galeria R2.");
}
