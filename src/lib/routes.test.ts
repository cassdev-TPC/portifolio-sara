import { describe, expect, it } from "vitest";
import { PAGE_META, PAGE_PATHS, pageFromPath } from "./routes";

describe("rotas públicas", () => {
  it.each([["/", "home"], ["/fotos", "photos"], ["/videos", "videos"], ["/contato", "contact"], ["/login", "login"], ["/admin/login", "login"], ["/admin", "admin"], ["/fotos/", "photos"]])("mapeia %s", (path, page) => expect(pageFromPath(path)).toBe(page));
  it("não transforma rota desconhecida em home", () => expect(pageFromPath("/nao-existe")).toBe("not-found"));
  it("mantém caminhos e metadados", () => {
    expect(PAGE_PATHS.photos).toBe("/fotos");
    expect(PAGE_META.photos.title).toContain("Sara Marques");
    expect(PAGE_META.videos.description.length).toBeGreaterThan(20);
  });
});
