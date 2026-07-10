import { ListObjectsV2Command } from "@aws-sdk/client-s3";
import {
  getR2Client,
  getR2Config,
  getR2PublicUrl,
  getWorkerUploadConfig,
  handleApiError,
  parseKind,
  sendMethodNotAllowed,
} from "./_shared.js";

function titleFromFileName(fileName) {
  return String(fileName || "")
    .replace(/^\d+-/, "")
    .replace(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i, "")
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ");
}

function categoryFromSlug(slug) {
  return (
    String(slug || "")
      .split("-")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ") || "Sem categoria"
  );
}

function categoryKey(category) {
  return String(category || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizeGalleryCategory(kind, category) {
  const key = categoryKey(category);

  if (kind === "photos") {
    const aliases = {
      produto: "Produtos",
      produtos: "Produtos",
      retrato: "Retrato",
      retratos: "Retrato",
      ensaio: "Ensaios",
      ensaios: "Ensaios",
      evento: "Eventos",
      eventos: "Eventos",
    };

    return aliases[key] ?? "Ensaios";
  }

  const aliases = {
    storytelling: "Serviços e Produtos",
    "trafego pago": "Serviços e Produtos",
    produto: "Serviços e Produtos",
    produtos: "Serviços e Produtos",
    servico: "Serviços e Produtos",
    servicos: "Serviços e Produtos",
    "servicos e produtos": "Serviços e Produtos",
    imobiliario: "Imobiliário",
    evento: "Eventos Sociais",
    eventos: "Eventos Sociais",
    "eventos musicais e shows": "Eventos Musicais e Shows",
    show: "Eventos Musicais e Shows",
    shows: "Eventos Musicais e Shows",
    moda: "Moda e Varejo",
    varejo: "Moda e Varejo",
    "moda e varejo": "Moda e Varejo",
    "eventos sociais": "Eventos Sociais",
    gastronomia: "Gastronomia",
  };

  return aliases[key] ?? "Serviços e Produtos";
}

function mapObjectToItem(kind, object, publicUrl) {
  const key = object.key || object.Key;
  const uploaded = object.uploaded || object.LastModified?.toISOString?.();
  const parts = key.split("/");
  const categorySlug = parts[1] || "sem-categoria";
  const fileName = parts.at(-1) || key;

  return {
    id: key,
    name: titleFromFileName(fileName),
    path: key,
    url: `${publicUrl}/${key}`,
    category: normalizeGalleryCategory(kind, categoryFromSlug(categorySlug)),
    createdAt: uploaded,
  };
}

export default async function handler(request, response) {
  if (request.method !== "GET") {
    sendMethodNotAllowed(response);
    return;
  }

  try {
    const kind = parseKind(request.query.kind);
    const publicUrl = getR2PublicUrl();
    const workerConfig = getWorkerUploadConfig();

    if (workerConfig) {
      const listUrl = new URL("/list", workerConfig.workerUrl);
      listUrl.searchParams.set("kind", kind);

      const workerResponse = await fetch(listUrl);
      const workerData = await workerResponse.json().catch(() => ({}));

      if (!workerResponse.ok) {
        throw new Error(workerData.error || `Worker list falhou com status ${workerResponse.status}.`);
      }

      const items = (workerData.objects ?? [])
        .filter((object) => object.key && !object.key.endsWith("/"))
        .map((object) => mapObjectToItem(kind, object, publicUrl))
        .sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));

      response.status(200).json({ items });
      return;
    }

    const config = getR2Config();
    const client = getR2Client();
    const items = [];
    let continuationToken;

    do {
      const result = await client.send(
        new ListObjectsV2Command({
          Bucket: config.bucket,
          Prefix: `${kind}/`,
          MaxKeys: 1000,
          ContinuationToken: continuationToken,
        })
      );

      for (const object of result.Contents ?? []) {
        if (!object.Key || object.Key.endsWith("/")) continue;
        items.push(mapObjectToItem(kind, object, config.publicUrl));
      }

      continuationToken = result.NextContinuationToken;
    } while (continuationToken);

    items.sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
    response.status(200).json({ items });
  } catch (error) {
    handleApiError(response, error);
  }
}
