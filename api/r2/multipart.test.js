import { Readable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.hoisted(() => vi.fn());
vi.mock("./_shared.js", async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    requireAdmin: vi.fn().mockResolvedValue({ id: "admin" }),
    getR2Config: () => ({ bucket: "test", publicUrl: "https://midia.example" }),
    getR2Client: () => ({ send }),
  };
});

import handler from "./multipart.js";

function response() {
  return {
    statusCode: 200,
    setHeader: vi.fn(),
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function request(method, body, query = {}) {
  const data = Buffer.isBuffer(body) ? body : Buffer.from(JSON.stringify(body));
  const stream = Readable.from([data]);
  stream.method = method;
  stream.query = query;
  stream.headers = { "content-length": String(data.length) };
  return stream;
}

describe("envio de vídeo em partes", () => {
  beforeEach(() => send.mockReset());

  it("inicia, envia uma parte e conclui o vídeo no R2", async () => {
    send.mockResolvedValueOnce({ UploadId: "upload-1" })
      .mockResolvedValueOnce({ ETag: '"parte-1"' })
      .mockResolvedValueOnce({});
    const start = response();
    await handler(request("POST", { action: "start", category: "Casamento", fileName: "video.mp4" }), start);
    expect(start.statusCode).toBe(200);
    expect(start.body.key).toMatch(/^originals\/videos\/casamento\/.+\.mp4$/);

    const part = response();
    const content = Buffer.alloc(8 * 1024 * 1024);
    await handler(request("PUT", content, { key: start.body.key, uploadId: "upload-1", partNumber: "1" }), part);
    expect(part.body).toEqual({ partNumber: 1, etag: '"parte-1"' });

    const complete = response();
    await handler(request("POST", { action: "complete", key: start.body.key, uploadId: "upload-1", parts: [part.body] }), complete);
    expect(complete.statusCode).toBe(200);
    expect(send.mock.calls.map(([command]) => command.constructor.name)).toEqual([
      "CreateMultipartUploadCommand", "UploadPartCommand", "CompleteMultipartUploadCommand",
    ]);
  });

  it("recusa parte acima do limite sem enviá-la ao R2", async () => {
    const res = response();
    const req = request("PUT", Buffer.alloc(1), { key: "originals/videos/casamento/video.mp4", uploadId: "upload-1", partNumber: "1" });
    req.headers["content-length"] = String(17 * 1024 * 1024);
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(send).not.toHaveBeenCalled();
  });
});
