import { DeleteObjectCommand } from "@aws-sdk/client-s3";
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
    const workerConfig = getWorkerUploadConfig();

    if (workerConfig) {
      const expiresAt = Math.floor(Date.now() / 1000) + 60 * 5;
      const signature = createUploadSignature(key, expiresAt, workerConfig.uploadSecret);
      const deleteUrl = new URL("/delete", workerConfig.workerUrl);

      deleteUrl.searchParams.set("key", key);
      deleteUrl.searchParams.set("exp", String(expiresAt));
      deleteUrl.searchParams.set("sig", signature);

      const workerResponse = await fetch(deleteUrl, { method: "DELETE" });
      const workerData = await workerResponse.json().catch(() => ({}));

      if (!workerResponse.ok) {
        throw new Error(workerData.error || `Worker delete falhou com status ${workerResponse.status}.`);
      }

      response.status(200).json({ ok: true });
      return;
    }

    const config = getR2Config();
    const client = getR2Client();

    await client.send(
      new DeleteObjectCommand({
        Bucket: config.bucket,
        Key: key,
      })
    );

    response.status(200).json({ ok: true });
  } catch (error) {
    handleApiError(response, error);
  }
}
