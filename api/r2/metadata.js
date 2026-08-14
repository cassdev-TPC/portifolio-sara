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
    const metadata = { ...(body.metadata && typeof body.metadata === "object" ? body.metadata : {}), description };
    const workerConfig = getWorkerUploadConfig();

    if (workerConfig) {
      const expiresAt = Math.floor(Date.now() / 1000) + 60 * 5;
      const signature = createUploadSignature(key, expiresAt, workerConfig.uploadSecret);
      const metadataUrl = new URL("/metadata", workerConfig.workerUrl);

      metadataUrl.searchParams.set("key", key);
      metadataUrl.searchParams.set("exp", String(expiresAt));
      metadataUrl.searchParams.set("sig", signature);

      const workerResponse = await fetch(metadataUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(metadata),
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
        Body: JSON.stringify(metadata),
        ContentType: "application/json",
        CacheControl: "no-cache",
      })
    );

    response.status(200).json({ ok: true });
  } catch (error) {
    handleApiError(response, error);
  }
}
