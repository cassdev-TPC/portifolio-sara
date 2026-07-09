import { S3Client } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

export function sendMethodNotAllowed(response) {
  response.setHeader("Allow", "GET, POST");
  response.status(405).json({ error: "Metodo nao permitido." });
}

export function getEnv(name, fallbackName) {
  return process.env[name] || (fallbackName ? process.env[fallbackName] : "") || "";
}

export function getR2Config() {
  const accountId = getEnv("R2_ACCOUNT_ID");
  const accessKeyId = getEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = getEnv("R2_SECRET_ACCESS_KEY");
  const bucket = getEnv("R2_BUCKET") || "galeria-sara";
  const publicUrl = getEnv("R2_PUBLIC_URL", "VITE_R2_PUBLIC_URL").replace(/\/$/, "");
  const endpoint = getEnv("R2_ENDPOINT") || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "");

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicUrl || !endpoint) {
    throw new Error("Cloudflare R2 nao configurado. Confira R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET e R2_PUBLIC_URL na Vercel.");
  }

  return { accessKeyId, secretAccessKey, bucket, publicUrl, endpoint };
}

export function getR2Client() {
  const config = getR2Config();

  return new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

export function cleanCategory(category) {
  return String(category || "").trim() || "Sem categoria";
}

export function slugify(value) {
  return (
    cleanCategory(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "sem-categoria"
  );
}

export function normalizeObjectKey(path) {
  const key = String(path || "").replace(/^\/+/, "");

  if (!key.startsWith("photos/") && !key.startsWith("videos/")) {
    throw new Error("Caminho invalido.");
  }

  if (key.includes("..")) {
    throw new Error("Caminho invalido.");
  }

  return key;
}

export function safeFileName(fileName) {
  const originalName = String(fileName || "arquivo");
  const extension = originalName.includes(".") ? originalName.split(".").pop() : "";
  const withoutExtension = originalName.replace(/\.[^.]+$/, "");
  const safeName = slugify(withoutExtension);
  const uniqueId = randomUUID();

  return `${Date.now()}-${uniqueId}-${safeName}${extension ? `.${extension.toLowerCase()}` : ""}`;
}

export async function requireAdmin(request) {
  const authHeader = request.headers.authorization;
  const authorization = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  const token = authorization?.replace(/^Bearer\s+/i, "");

  if (!token) {
    throw new Error("Login obrigatorio.");
  }

  const supabaseUrl = getEnv("SUPABASE_URL", "VITE_SUPABASE_URL");
  const supabaseAnonKey = getEnv("SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY");
  const adminEmail = getEnv("ADMIN_EMAIL", "VITE_ADMIN_EMAIL").toLowerCase();

  if (!supabaseUrl || !supabaseAnonKey || !adminEmail) {
    throw new Error("Supabase nao configurado no servidor. Confira VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY e VITE_ADMIN_EMAIL na Vercel.");
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getUser(token);
  const email = data.user?.email?.toLowerCase() ?? "";

  if (error || !data.user || email !== adminEmail) {
    throw new Error("Usuario sem permissao.");
  }

  return data.user;
}

export function parseKind(value) {
  if (value === "photos" || value === "videos") return value;
  throw new Error("Tipo de galeria invalido.");
}

export function readJsonBody(request) {
  if (!request.body) return {};
  if (typeof request.body === "string") return JSON.parse(request.body);
  return request.body;
}

export function handleApiError(response, error) {
  const message = error instanceof Error ? error.message : "Erro inesperado.";
  const status = message.includes("permissao") || message.includes("Login") ? 401 : 400;

  response.status(status).json({ error: message });
}
