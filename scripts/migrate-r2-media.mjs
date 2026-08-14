import { GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";
import ffmpegPath from "ffmpeg-static";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const apply = process.argv.includes("--apply");
const required = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"];
for (const name of required) if (!process.env[name]) throw new Error(`Variável obrigatória ausente: ${name}`);
const client = new S3Client({ region: "auto", endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY } });
const Bucket = process.env.R2_BUCKET;
const report = { mode: apply ? "apply" : "dry-run", generatedAt: new Date().toISOString(), inventory: [], summary: { photos: 0, videos: 0, mov: 0, bytes: 0, estimatedOutputBytes: 0 }, results: [] };

async function listAll() {
  let token;
  do {
    const page = await client.send(new ListObjectsV2Command({ Bucket, ContinuationToken: token, MaxKeys: 1000 }));
    for (const item of page.Contents ?? []) report.inventory.push({ id: item.ETag, path: item.Key, size: item.Size, type: item.Key?.split(".").pop()?.toLowerCase(), date: item.LastModified?.toISOString() });
    token = page.NextContinuationToken;
  } while (token);
}

async function exists(Key) { try { await client.send(new HeadObjectCommand({ Bucket, Key })); return true; } catch (error) { if (error?.$metadata?.httpStatusCode === 404) return false; throw error; } }
async function bytes(Key) { const value = await client.send(new GetObjectCommand({ Bucket, Key })); return Buffer.from(await value.Body.transformToByteArray()); }
async function put(Key, Body, ContentType) { if (!apply || await exists(Key)) return false; await client.send(new PutObjectCommand({ Bucket, Key, Body, ContentType, CacheControl: "public, max-age=31536000, immutable" })); return true; }
function derivative(prefix, key, ext) { return `${prefix}/${key.replace(/^(photos|videos)\//, "").replace(/\.[^.]+$/, ext)}`; }
function runFfmpeg(args) { return new Promise((resolve, reject) => { const child = spawn(ffmpegPath, ["-hide_banner", "-loglevel", "error", ...args]); let error = ""; child.stderr.on("data", chunk => error += chunk); child.on("close", code => code === 0 ? resolve() : reject(new Error(error || `ffmpeg saiu com código ${code}`))); }); }

await listAll();
const originals = report.inventory.filter(item => /^(photos|videos)\//.test(item.path) && !item.path.endsWith(".metadata.json"));
for (const item of originals) {
  report.summary.bytes += item.size || 0;
  const isPhoto = item.path.startsWith("photos/");
  const result = { path: item.path, status: apply ? "pending" : "planned", outputs: [], error: null };
  try {
    if (isPhoto) {
      report.summary.photos++;
      const optimizedKey = derivative("optimized/photos", item.path, ".webp");
      const thumbnailKey = derivative("thumbnails/photos", item.path, ".webp");
      result.outputs.push(optimizedKey, thumbnailKey);
      if (apply && (!await exists(optimizedKey) || !await exists(thumbnailKey))) {
        const input = await bytes(item.path);
        const image = sharp(input, { failOn: "none" }).rotate();
        const info = await image.metadata();
        const optimized = await image.clone().resize({ width: 2560, withoutEnlargement: true }).webp({ quality: 88 }).toBuffer();
        const thumbnail = await image.clone().resize({ width: 800, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
        await put(optimizedKey, optimized, "image/webp"); await put(thumbnailKey, thumbnail, "image/webp");
        await put(`${item.path}.metadata.json`, JSON.stringify({ variants: { original: item.path, optimized: optimizedKey, thumbnail: thumbnailKey }, width: info.width, height: info.height, mediaType: "photo", status: "ready" }), "application/json");
        report.summary.estimatedOutputBytes += optimized.length + thumbnail.length;
      }
    } else {
      report.summary.videos++;
      if (item.type === "mov") report.summary.mov++;
      const posterKey = derivative("posters/videos", item.path, ".webp"); result.outputs.push(posterKey);
      if (apply && !await exists(posterKey)) {
        const dir = await mkdtemp(join(tmpdir(), "sara-media-"));
        try {
          const inputPath = join(dir, `input.${item.type}`); const outputPath = join(dir, "poster.webp");
          await writeFile(inputPath, await bytes(item.path)); await runFfmpeg(["-ss", "1", "-i", inputPath, "-frames:v", "1", "-vf", "scale='min(960,iw)':-2", "-quality", "84", outputPath]);
          const poster = await readFile(outputPath); await put(posterKey, poster, "image/webp");
          await put(`${item.path}.metadata.json`, JSON.stringify({ variants: { original: item.path, poster: posterKey }, mediaType: "video", needsConversion: item.type === "mov", status: "ready" }), "application/json");
          report.summary.estimatedOutputBytes += poster.length;
        } finally { await rm(dir, { recursive: true, force: true }); }
      }
    }
    result.status = apply ? "success" : "planned";
  } catch (error) { result.status = "failed"; result.error = error instanceof Error ? error.message : String(error); }
  report.results.push(result);
}
await writeFile(`r2-migration-${report.mode}.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ report: `r2-migration-${report.mode}.json`, objects: report.inventory.length, ...report.summary, failed: report.results.filter(x => x.status === "failed").length }, null, 2));
