import { describe, expect, it } from "vitest";
import { mediaDescription } from "./accessibility";
import { getLoginErrorMessage } from "./authErrors";

describe("fallbacks públicos", () => {
  it("evita nomes técnicos e UUIDs", () => {
    expect(mediaDescription({ name: "IMG_2724", category: "Eventos", description: "" }, "photos")).toBe("Fotografia da categoria Eventos");
    expect(mediaDescription({ name: "Normal", category: "Retrato", description: "Retrato profissional" }, "photos")).toBe("Retrato profissional");
  });
  it.each([
    [{ message: "Invalid login credentials", status: 400 }, "E-mail ou senha inválidos."],
    [{ message: "Email not confirmed" }, "Confirme seu e-mail antes de entrar."],
    [{ message: "Failed to fetch" }, "Não foi possível conectar"],
    [{ message: "timeout" }, "demorou mais"],
    [{ message: "Too many requests", status: 429 }, "Muitas tentativas"],
    [{ message: "Service unavailable", status: 503 }, "temporariamente indisponível"],
  ])("diferencia falhas de login", (error, expected) => expect(getLoginErrorMessage(error)).toContain(expected));
});
