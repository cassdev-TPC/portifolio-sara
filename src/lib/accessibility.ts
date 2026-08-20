import type { GalleryItem, GalleryKind } from "./gallery";

const technicalName = /(^|\s)(img|dsc|vid|mov|mp4)[-_ ]?\d+|[0-9a-f]{8}-[0-9a-f-]{27,}/i;

export function mediaDescription(item: Pick<GalleryItem, "description" | "name" | "category">, kind: GalleryKind) {
  const description = item.description?.trim();
  if (description && !technicalName.test(description)) return description;
  const name = item.name?.trim();
  if (name && !technicalName.test(name) && name.length > 2) return name;
  return kind === "photos" ? `Fotografia da categoria ${item.category}` : `Vídeo da categoria ${item.category}`;
}
