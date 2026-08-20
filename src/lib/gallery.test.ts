import { describe, expect, it } from "vitest";
import { DEFAULT_PHOTO_CATEGORIES, DEFAULT_VIDEO_CATEGORIES, getCategories, normalizeGalleryCategory, validateGalleryCategory } from "./gallery";

describe("categorias", () => {
  it("preserva a ordem dos filtros", () => {
    expect(getCategories([], DEFAULT_PHOTO_CATEGORIES)).toEqual(["Todos", "Retrato", "Ensaios", "Pré Wedding", "Eventos", "Produtos"]);
    expect(getCategories([], DEFAULT_VIDEO_CATEGORIES)).toHaveLength(6);
  });
  it("normaliza aliases conhecidos", () => {
    expect(normalizeGalleryCategory("photos", "retratos")).toBe("Retrato");
    expect(normalizeGalleryCategory("photos", "pre wedding")).toBe("Pré Wedding");
    expect(normalizeGalleryCategory("videos", "servicos e produtos")).toBe("Serviços e Produtos");
  });
  it("rejeita categoria desconhecida sem fallback silencioso", () => {
    expect(() => validateGalleryCategory("photos", "qualquer coisa")).toThrow("inválida");
    expect(() => validateGalleryCategory("videos", "qualquer coisa")).toThrow("inválida");
  });
});
