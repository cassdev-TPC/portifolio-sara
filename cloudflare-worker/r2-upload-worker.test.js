import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import worker from "./r2-upload-worker.js";

function signedDeleteRequest(key, secret) {
  const expiresAt = Math.floor(Date.now() / 1000) + 300;
  const signature = createHmac("sha256", secret).update(`${key}.${expiresAt}`).digest("hex");
  const url = new URL("https://worker.example/delete");
  url.searchParams.set("key", key);
  url.searchParams.set("exp", String(expiresAt));
  url.searchParams.set("sig", signature);
  return new Request(url, { method: "DELETE" });
}

describe("worker R2 delete", () => {
  it("remove original, metadado e todas as variantes e confirma que não restaram objetos", async () => {
    const secret = "segredo-de-teste";
    const original = "originals/photos/retrato/foto.jpg";
    const metadata = `${original}.metadata.json`;
    const optimized = "optimized/photos/retrato/foto.webp";
    const thumbnail = "thumbnails/photos/retrato/foto.webp";
    const bucket = {
      get: vi.fn().mockResolvedValue({
        json: vi.fn().mockResolvedValue({ variants: { original, optimized, thumbnail } }),
      }),
      delete: vi.fn().mockResolvedValue(undefined),
      head: vi.fn().mockResolvedValue(null),
    };

    const response = await worker.fetch(signedDeleteRequest(original, secret), {
      GALERIA: bucket,
      UPLOAD_SECRET: secret,
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(bucket.delete).toHaveBeenCalledWith([original, metadata, optimized, thumbnail]);
    expect(bucket.head).toHaveBeenCalledTimes(4);
    expect(body.deleted).toEqual([original, metadata, optimized, thumbnail]);
  });

  it("recusa a exclusão quando o segredo do Worker não está configurado", async () => {
    const response = await worker.fetch(
      new Request("https://worker.example/delete", { method: "DELETE" }),
      { GALERIA: {}, UPLOAD_SECRET: "" }
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({ error: "UPLOAD_SECRET nao configurado." });
  });
});
