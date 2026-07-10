import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  getR2Client,
  getR2Config,
  getWorkerUploadConfig,
  handleApiError,
  parseKind,
  readJsonBody,
  requireAdmin,
  safeFileName,
  sendMethodNotAllowed,
  createUploadSignature,
  slugify,
} from "./_shared.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    sendMethodNotAllowed(response);
    return;
  }

  try {
    await requireAdmin(request);

    const body = readJsonBody(request);
    const kind = parseKind(body.kind);
    const category = String(body.category || "Sem categoria");
    const fileName = String(body.fileName || "arquivo");
    const key = `${kind}/${slugify(category)}/${safeFileName(fileName)}`;
    const config = getR2Config();
    const workerConfig = getWorkerUploadConfig();

    if (workerConfig) {
      const expiresAt = Math.floor(Date.now() / 1000) + 60 * 20;
      const signature = createUploadSignature(key, expiresAt, workerConfig.uploadSecret);
      const uploadUrl = new URL("/upload", workerConfig.workerUrl);

      uploadUrl.searchParams.set("key", key);
      uploadUrl.searchParams.set("exp", String(expiresAt));
      uploadUrl.searchParams.set("sig", signature);

      response.status(200).json({
        key,
        uploadUrl: uploadUrl.toString(),
        publicUrl: `${config.publicUrl}/${key}`,
      });
      return;
    }

    const client = getR2Client();

    const command = new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
    });

    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 60 * 20 });

    response.status(200).json({
      key,
      uploadUrl,
      publicUrl: `${config.publicUrl}/${key}`,
    });
  } catch (error) {
    handleApiError(response, error);
  }
}
