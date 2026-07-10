function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, PUT, DELETE, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, content-type, Authorization, authorization, Accept, accept, Origin, origin, *",
    "Access-Control-Expose-Headers": "ETag",
    "Access-Control-Max-Age": "86400",
  };
}

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(),
      ...headers,
    },
  });
}

function normalizeKey(key) {
  const value = String(key || "").replace(/^\/+/, "");

  if (!value.startsWith("photos/") && !value.startsWith("videos/")) {
    throw new Error("Caminho invalido.");
  }

  if (value.includes("..")) {
    throw new Error("Caminho invalido.");
  }

  return value;
}

function parseKind(value) {
  if (value === "photos" || value === "videos") return value;
  throw new Error("Tipo de galeria invalido.");
}

function metadataKey(key) {
  return `${normalizeKey(key)}.metadata.json`;
}

async function readDescription(env, key) {
  const metadataObject = await env.GALERIA.get(metadataKey(key));

  if (!metadataObject) return "";

  const metadata = await metadataObject.json().catch(() => ({}));
  return typeof metadata.description === "string" ? metadata.description : "";
}

async function hmacHex(message, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));

  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }

  return result === 0;
}

async function verifySignature(url, secret) {
  const key = normalizeKey(url.searchParams.get("key"));
  const expiresAt = Number(url.searchParams.get("exp"));
  const signature = url.searchParams.get("sig") || "";
  const now = Math.floor(Date.now() / 1000);

  if (!expiresAt || expiresAt < now) {
    throw new Error("URL expirada.");
  }

  const expectedSignature = await hmacHex(`${key}.${expiresAt}`, secret);

  if (!timingSafeEqual(signature, expectedSignature)) {
    throw new Error("Assinatura invalida.");
  }

  return key;
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    try {
      if (!env.GALERIA) {
        return json({ error: "Binding R2 GALERIA nao configurado." }, 500);
      }

      const url = new URL(request.url);

      if (request.method === "GET" && url.pathname === "/list") {
        const kind = parseKind(url.searchParams.get("kind"));
        const objects = [];
        let cursor;

        do {
          const result = await env.GALERIA.list({
            prefix: `${kind}/`,
            limit: 1000,
            cursor,
          });

          for (const object of result.objects) {
            if (object.key.endsWith(".metadata.json")) continue;

            objects.push({
              key: object.key,
              description: await readDescription(env, object.key),
              uploaded: object.uploaded?.toISOString?.() || null,
            });
          }

          cursor = result.truncated ? result.cursor : undefined;
        } while (cursor);

        objects.sort((a, b) => String(b.uploaded ?? "").localeCompare(String(a.uploaded ?? "")));
        return json({ objects });
      }

      if (request.method === "GET") {
        return json({
          ok: true,
          worker: "sara-r2-upload-v5",
          hasBucket: Boolean(env.GALERIA),
          hasSecret: Boolean(env.UPLOAD_SECRET),
        });
      }

      if (!env.UPLOAD_SECRET) {
        return json({ error: "UPLOAD_SECRET nao configurado." }, 500);
      }

      if (request.method === "DELETE") {
        const key = await verifySignature(url, env.UPLOAD_SECRET);
        await env.GALERIA.delete(key);
        await env.GALERIA.delete(metadataKey(key));
        return json({ ok: true, key });
      }

      if (request.method === "PUT" && url.pathname === "/metadata") {
        const key = await verifySignature(url, env.UPLOAD_SECRET);
        const body = await request.json().catch(() => ({}));
        const description = String(body.description || "").trim().slice(0, 240);

        await env.GALERIA.put(metadataKey(key), JSON.stringify({ description }), {
          httpMetadata: {
            contentType: "application/json",
          },
        });

        return json({ ok: true, key });
      }

      if (request.method !== "PUT") {
        return json({ error: "Metodo nao permitido." }, 405);
      }

      const key = await verifySignature(url, env.UPLOAD_SECRET);

      await env.GALERIA.put(key, request.body, {
        httpMetadata: {
          contentType: request.headers.get("Content-Type") || "application/octet-stream",
        },
      });

      return json({ ok: true, key }, 200, {
        ETag: `"${key}"`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro inesperado.";
      return json({ error: message }, 400);
    }
  },
};
