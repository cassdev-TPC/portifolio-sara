function corsHeaders(origin, env) {
  const allowedOrigin = env.ALLOWED_ORIGIN || "https://portifolio-sara.vercel.app";
  const responseOrigin = origin === allowedOrigin ? origin : allowedOrigin;

  return {
    "Access-Control-Allow-Origin": responseOrigin,
    "Access-Control-Allow-Methods": "PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "3600",
  };
}

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
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

  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }

  return result === 0;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const headers = corsHeaders(origin, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    try {
      if (request.method !== "PUT") {
        return json({ error: "Metodo nao permitido." }, 405, headers);
      }

      if (!env.GALERIA) {
        return json({ error: "Binding R2 GALERIA nao configurado." }, 500, headers);
      }

      if (!env.UPLOAD_SECRET) {
        return json({ error: "UPLOAD_SECRET nao configurado." }, 500, headers);
      }

      const url = new URL(request.url);
      const key = normalizeKey(url.searchParams.get("key"));
      const expiresAt = Number(url.searchParams.get("exp"));
      const signature = url.searchParams.get("sig") || "";
      const now = Math.floor(Date.now() / 1000);

      if (!expiresAt || expiresAt < now) {
        return json({ error: "URL de upload expirada." }, 401, headers);
      }

      const expectedSignature = await hmacHex(`${key}.${expiresAt}`, env.UPLOAD_SECRET);

      if (!timingSafeEqual(signature, expectedSignature)) {
        return json({ error: "Assinatura invalida." }, 401, headers);
      }

      await env.GALERIA.put(key, request.body, {
        httpMetadata: {
          contentType: request.headers.get("Content-Type") || "application/octet-stream",
        },
      });

      return json({ ok: true, key }, 200, {
        ...headers,
        ETag: `"${key}"`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro inesperado.";
      return json({ error: message }, 400, headers);
    }
  },
};
