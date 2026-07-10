import { PutObjectCommand } from "@aws-sdk/client-s3";
import {
  createUploadSignature,
  getR2Client,
  getR2Config,
  getWorkerUploadConfig,
  handleApiError,
  normalizeObjectKey,
  readJsonBody,
  requireAdmin,
  sendMethodNotAllowed,
} from "./_shared.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    sendMethodNotAllowed(response);
    return;
  }

  try {
    await requireAdmin(request);

    const body = readJsonBody(request);
    const key = normalizeObjectKey(body.path);
    const description = String(body.description || "").trim().slice(0, 240);
    const workerConfig = getWorkerUploadConfig();

    if (workerConfig) {
      const workerInfoResponse = await fetch(workerConfig.workerUrl);
      const workerInfo = await workerInfoResponse.json().catch(() => ({}));

      if (workerInfo.worker !== "sara-r2-upload-v5") {
        throw new Error("Atualize o codigo do Worker no Cloudflare antes de salvar descricoes.");
      }

      const expiresAt = Math.floor(Date.now() / 1000) + 60 * 5;
      const signature = createUploadSignature(key, expiresAt, workerConfig.uploadSecret);
      const metadataUrl = new URL("/metadata", workerConfig.workerUrl);

      metadataUrl.searchParams.set("key", key);
      metadataUrl.searchParams.set("exp", String(expiresAt));
      metadataUrl.searchParams.set("sig", signature);

      const workerResponse = await fetch(metadataUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      const workerData = await workerResponse.json().catch(() => ({}));

      if (!workerResponse.ok) {
        throw new Error(workerData.error || `Worker metadata falhou com status ${workerResponse.status}.`);
      }

      response.status(200).json({ ok: true });
      return;
    }

    const config = getR2Config();
    const client = getR2Client();

    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: `${key}.metadata.json`,
        Body: JSON.stringify({ description }),
        ContentType: "application/json",
      })
    );

    response.status(200).json({ ok: true });
  } catch (error) {
    handleApiError(response, error);
  }
}
