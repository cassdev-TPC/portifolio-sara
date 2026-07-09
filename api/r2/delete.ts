import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import {
  getR2Client,
  getR2Config,
  handleApiError,
  normalizeObjectKey,
  readJsonBody,
  requireAdmin,
  sendMethodNotAllowed,
} from "./_shared";

export default async function handler(request: any, response: any) {
  if (request.method !== "POST") {
    sendMethodNotAllowed(response);
    return;
  }

  try {
    await requireAdmin(request);

    const body = await readJsonBody(request);
    const key = normalizeObjectKey(String(body.path || ""));
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
