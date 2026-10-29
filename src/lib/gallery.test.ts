import { describe, expect, it } from "vitest";
import { DEFAULT_PHOTO_CATEGORIES, DEFAULT_VIDEO_CATEGORIES, getCategories, normalizeGalleryCategory, retryMediaFromFallback, validateGalleryCategory } from "./gallery";
import { validateCategory } from "../../api/r2/_shared.js";

describe("categorias", () => {
  it("preserva a ordem dos filtros", () => {
    expect(getCategories([], DEFAULT_PHOTO_CATEGORIES)).toEqual(["Todos", "Retrato", "Ensaios", "Pré Wedding", "Eventos", "Produtos"]);
    expect(getCategories([], DEFAULT_VIDEO_CATEGORIES)).toEqual(["Serviços e Produtos", "Imobiliário", "Eventos Musicais e Shows", "Moda e Varejo", "Eventos Sociais", "Gastronomia", "Casamento"]);
  });
  it("normaliza aliases conhecidos", () => {
    expect(normalizeGalleryCategory("photos", "retratos")).toBe("Retrato");
    expect(normalizeGalleryCategory("photos", "pre wedding")).toBe("Pré Wedding");
    expect(normalizeGalleryCategory("videos", "servicos e produtos")).toBe("Serviços e Produtos");
    expect(normalizeGalleryCategory("videos", "casamento")).toBe("Casamento");
    expect(validateCategory("videos", "Casamento")).toBe("Casamento");
  });
  it("rejeita categoria desconhecida sem fallback silencioso", () => {
    expect(() => validateGalleryCategory("photos", "qualquer coisa")).toThrow("inválida");
    expect(() => validateGalleryCategory("videos", "qualquer coisa")).toThrow("inválida");
  });
});

describe("fallback de mídia durante propagação DNS", () => {
  it("tenta o mesmo objeto no endereço anterior apenas uma vez", () => {
    const image = document.createElement("img");
    image.src = "https://midia.base4systems.com.br/thumbnails/photos/retrato/foto.webp";

    expect(retryMediaFromFallback(image, "https://midia.base4systems.com.br")).toBe(true);
    expect(image.src).toBe("https://pub-a324c717811d497b9c1237129c84ffbd.r2.dev/thumbnails/photos/retrato/foto.webp");
    expect(retryMediaFromFallback(image, "https://midia.base4systems.com.br")).toBe(false);
  });
});
