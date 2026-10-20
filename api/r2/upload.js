import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client, getR2Config, handleApiError, normalizeObjectKey, requireAdmin, sendMethodNotAllowed } from "./_shared.js";

const MAX_UPLOAD_BYTES = 32 * 1024 * 1024;
export const config = { api: { bodyParser: false } };

export default async function handler(request, response) {
  if (request.method !== "PUT") {
    sendMethodNotAllowed(response);
    return;
  }

  try {
    await requireAdmin(request);
    const key = normalizeObjectKey(request.query?.key);
    const declaredSize = Number(request.headers["content-length"]);
    if (!Number.isSafeInteger(declaredSize) || declaredSize < 1 || declaredSize > MAX_UPLOAD_BYTES) {
      response.status(413).json({ error: "Arquivo muito grande para o envio alternativo (limite de 32 MB)." });
      return;
    }

    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
      size += chunk.length;
      if (size > MAX_UPLOAD_BYTES) {
        response.status(413).json({ error: "Arquivo muito grande para o envio alternativo (limite de 32 MB)." });
        return;
      }
      chunks.push(chunk);
    }
    if (size !== declaredSize) throw new Error("O arquivo chegou incompleto. Tente novamente.");

    const config = getR2Config();
    await getR2Client().send(new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: Buffer.concat(chunks),
      ContentType: String(request.headers["content-type"] || "application/octet-stream"),
      CacheControl: key.startsWith("originals/") ? "public, max-age=86400" : "public, max-age=31536000, immutable",
    }));
    response.status(200).json({ ok: true, key });
  } catch (error) {
    handleApiError(response, error);
  }
}
