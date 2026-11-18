import { describe, expect, it, vi } from "vitest";

vi.mock("./supabase", () => ({ isSupabaseConfigured: false, supabase: {} }));

import { spreadGalleryItems, type GalleryItem } from "./gallery";

function item(id: string, category: string, minutes: number): GalleryItem {
  return { id, path: id, name: id, url: `/${id}`, category, createdAt: new Date(Date.UTC(2026, 0, 1, 0, minutes)).toISOString() };
}

const items = [
  ...Array.from({ length: 6 }, (_, index) => item(`r${index}`, "Retrato", index)),
  ...Array.from({ length: 6 }, (_, index) => item(`e${index}`, "Eventos", 600 + index)),
  ...Array.from({ length: 6 }, (_, index) => item(`p${index}`, "Produtos", 1200 + index)),
];

describe("spreadGalleryItems", () => {
  it("mantém todos os itens, sem repetir", () => {
    const spread = spreadGalleryItems(items, 42);
    expect(spread).toHaveLength(items.length);
    expect(new Set(spread.map((entry) => entry.id)).size).toBe(items.length);
  });

  it("é estável para a mesma semente e muda com outra", () => {
    const ids = (seed: number) => spreadGalleryItems(items, seed).map((entry) => entry.id).join();
    expect(ids(7)).toBe(ids(7));
    expect(ids(7)).not.toBe(ids(8));
  });

  it("alterna categorias quando há mais de uma disponível", () => {
    const spread = spreadGalleryItems(items, 123);
    const repeats = spread.filter((entry, index) => index > 0 && spread[index - 1].category === entry.category);
    expect(repeats).toHaveLength(0);
  });
});
