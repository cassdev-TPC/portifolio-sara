import sharp from "sharp";

const source = process.argv[2];
if (!source) throw new Error("Informe a URL da API de listagem.");
const base = new URL(source);
const rows = [];

for (const kind of ["photos", "videos"]) {
  const listUrl = new URL("/api/r2/list", base);
  listUrl.searchParams.set("kind", kind);
  const listResponse = await fetch(listUrl);
  if (!listResponse.ok) throw new Error(`Listagem ${kind}: HTTP ${listResponse.status}`);
  const { items } = await listResponse.json();

  for (const item of items) {
    if (item.width && item.height) continue;
    const imageUrl = new URL(kind === "videos" ? item.posterUrl : item.originalUrl);
    if (imageUrl.hostname !== "pub-a324c717811d497b9c1237129c84ffbd.r2.dev") {
      throw new Error(`Origem de imagem inesperada: ${imageUrl.hostname}`);
    }
    const response = await fetch(imageUrl, { headers: { Range: "bytes=0-1048575" } });
    if (!response.ok) throw new Error(`${item.path}: HTTP ${response.status}`);
    const metadata = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
    rows.push({ path: item.path, width: metadata.width, height: metadata.height });
  }
}

console.log(JSON.stringify(rows));
