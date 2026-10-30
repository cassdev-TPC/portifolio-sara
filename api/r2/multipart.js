import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import {
  getR2Client, getR2Config, handleApiError, normalizeObjectKey,
  requireAdmin, safeFileName, slugify, validateCategory,
} from "./_shared.js";

const MAX_PART_BYTES = 16 * 1024 * 1024;
export const config = { api: { bodyParser: false } };

async function readBody(request, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new Error("Parte do vídeo excede o limite de 16 MB.");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readJson(request) {
  if (request.body && typeof request.body === "object") return request.body;
  const raw = await readBody(request, 64 * 1024);
  return JSON.parse(raw.toString("utf8") || "{}");
}

export default async function handler(request, response) {
  if (request.method !== "POST" && request.method !== "PUT") {
    response.setHeader("Allow", "POST, PUT");
    response.status(405).json({ error: "Metodo nao permitido." });
    return;
  }

  try {
    await requireAdmin(request);
    const config = getR2Config();
    const client = getR2Client();

    if (request.method === "PUT") {
      const key = normalizeObjectKey(request.query?.key);
      if (!key.startsWith("originals/videos/")) throw new Error("Caminho de vídeo inválido.");
      const uploadId = String(request.query?.uploadId || "");
      const partNumber = Number(request.query?.partNumber);
      if (!uploadId || !Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10000) throw new Error("Parte inválida.");
      const declaredSize = Number(request.headers["content-length"]);
      if (!Number.isSafeInteger(declaredSize) || declaredSize < 1 || declaredSize > MAX_PART_BYTES) throw new Error("Tamanho da parte inválido.");
      const body = await readBody(request, MAX_PART_BYTES);
      if (body.length !== declaredSize) throw new Error("Parte incompleta. Tente novamente.");
      const result = await client.send(new UploadPartCommand({ Bucket: config.bucket, Key: key, UploadId: uploadId, PartNumber: partNumber, Body: body }));
      if (!result.ETag) throw new Error("R2 não confirmou a parte enviada.");
      response.status(200).json({ partNumber, etag: result.ETag });
      return;
    }

    const body = await readJson(request);
    const action = String(body.action || "");
    if (action === "start") {
      const category = validateCategory("videos", body.category);
      const key = `originals/videos/${slugify(category)}/${safeFileName(body.fileName)}`;
      const result = await client.send(new CreateMultipartUploadCommand({
        Bucket: config.bucket, Key: key,
        ContentType: "video/mp4",
        CacheControl: "public, max-age=86400",
      }));
      if (!result.UploadId) throw new Error("R2 não iniciou o envio.");
      response.status(200).json({ key, uploadId: result.UploadId, publicUrl: `${config.publicUrl}/${key}` });
      return;
    }

    const key = normalizeObjectKey(body.key);
    if (!key.startsWith("originals/videos/")) throw new Error("Caminho de vídeo inválido.");
    const uploadId = String(body.uploadId || "");
    if (!uploadId) throw new Error("Envio inválido.");
    if (action === "abort") {
      await client.send(new AbortMultipartUploadCommand({ Bucket: config.bucket, Key: key, UploadId: uploadId }));
      response.status(200).json({ ok: true });
      return;
    }
    if (action === "complete") {
      const parts = body.parts;
      if (!Array.isArray(parts) || parts.length < 1 || parts.length > 10000 || parts.some((part, index) =>
        part?.partNumber !== index + 1 || typeof part.etag !== "string" || !part.etag
      )) throw new Error("Lista de partes inválida.");
      await client.send(new CompleteMultipartUploadCommand({
        Bucket: config.bucket, Key: key, UploadId: uploadId,
        MultipartUpload: { Parts: parts.map((part) => ({ PartNumber: part.partNumber, ETag: part.etag })) },
      }));
      response.status(200).json({ ok: true });
      return;
    }
    throw new Error("Ação inválida.");
  } catch (error) {
    handleApiError(response, error);
  }
}
