import sharp from "sharp";
import ffmpegPath from "ffmpeg-static";
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const apply = process.argv.includes("--apply");
const bucket = "galeria-sara";
const api = "https://portfoliosaramarques.vercel.app/api/r2/list";
const report = { mode: apply ? "apply" : "dry-run", generatedAt: new Date().toISOString(), inventory: [], results: [] };
const lists = await Promise.all(["photos", "videos"].map(kind => fetch(`${api}?kind=${kind}`).then(r => r.json())));
const items = lists.flatMap(x => x.items);

async function head(url) { const response = await fetch(url, { method: "HEAD" }); return { exists: response.ok, size: Number(response.headers.get("content-length") || 0), type: response.headers.get("content-type"), date: response.headers.get("last-modified"), id: response.headers.get("etag") }; }
function outputKey(prefix, key) { return `${prefix}/${key.replace(/^(photos|videos)\//, "").replace(/\.[^.]+$/, ".webp")}`; }
function publicUrl(item, key) { const original = item.originalUrl || item.url; return `${original.slice(0, -item.path.length)}${key}`; }
function put(key, file, type) { const result = spawnSync("npx.cmd", ["wrangler@latest", "r2", "object", "put", `${bucket}/${key}`, "--remote", "--file", file, "--content-type", type, "--cache-control", "public,max-age=31536000,immutable", "--force"], { stdio: "pipe", encoding: "utf8", shell: true }); if (result.status !== 0) throw new Error(result.stderr || result.stdout); }
function ffmpeg(args) { return new Promise((resolve, reject) => { const child = spawn(ffmpegPath, ["-hide_banner", "-loglevel", "error", ...args]); let error=""; child.stderr.on("data", x => error += x); child.on("close", code => code === 0 ? resolve() : reject(new Error(error))); }); }

for (const item of items) {
  const source = await head(item.url);
  report.inventory.push({ id: source.id, path: item.path, size: source.size, type: source.type, date: source.date });
  const photo = item.path.startsWith("photos/");
  const outputs = photo ? [outputKey("optimized/photos", item.path), outputKey("thumbnails/photos", item.path)] : [outputKey("posters/videos", item.path)];
  const existing = await Promise.all(outputs.map(key => head(publicUrl(item, key)).then(x => x.exists)));
  const result = { path: item.path, outputs, status: existing.every(Boolean) ? "skipped" : apply ? "pending" : "planned", originalBytes: source.size, outputBytes: 0, error: null };
  if (apply && !existing.every(Boolean)) {
    const dir = await mkdtemp(join(tmpdir(), "sara-r2-"));
    try {
      if (photo) {
        const input = Buffer.from(await (await fetch(item.url)).arrayBuffer());
        const meta = await sharp(input).rotate().metadata();
        const optimized = await sharp(input).rotate().resize({ width: 2560, withoutEnlargement: true }).webp({ quality: 88 }).toBuffer();
        const thumb = await sharp(input).rotate().resize({ width: 800, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
        const optimizedFile=join(dir,"optimized.webp"), thumbFile=join(dir,"thumbnail.webp"); await writeFile(optimizedFile,optimized); await writeFile(thumbFile,thumb);
        if (!existing[0]) put(outputs[0], optimizedFile, "image/webp"); if (!existing[1]) put(outputs[1], thumbFile, "image/webp");
        const metadataFile=join(dir,"metadata.json"); await writeFile(metadataFile, JSON.stringify({ variants:{ original:item.path,optimized:outputs[0],thumbnail:outputs[1]},width:meta.width,height:meta.height,mediaType:"photo",status:"ready",description:item.description||"" })); put(`${item.path}.metadata.json`,metadataFile,"application/json"); result.outputBytes=optimized.length+thumb.length;
      } else {
        const posterFile=join(dir,"poster.webp"); await ffmpeg(["-ss","1","-i",item.url,"-frames:v","1","-vf","scale='min(960,iw)':-2","-quality","84",posterFile]);
        const poster=await readFile(posterFile); if(!existing[0]) put(outputs[0],posterFile,"image/webp");
        const metadataFile=join(dir,"metadata.json"); await writeFile(metadataFile,JSON.stringify({variants:{original:item.path,poster:outputs[0]},mediaType:"video",needsConversion:/\.mov$/i.test(item.path),status:"ready",description:item.description||""})); put(`${item.path}.metadata.json`,metadataFile,"application/json"); result.outputBytes=poster.length;
      }
      result.status="success";
    } catch(error) { result.status="failed"; result.error=error instanceof Error?error.message:String(error); console.error(result.error.slice(0, 1200)); }
    finally { await rm(dir,{recursive:true,force:true}); }
  }
  report.results.push(result); console.log(`${report.results.length}/${items.length} ${result.status} ${item.path}`);
}
report.summary={photos:items.filter(x=>x.path.startsWith("photos/")).length,videos:items.filter(x=>x.path.startsWith("videos/")).length,mov:items.filter(x=>/\.mov$/i.test(x.path)).length,originalBytes:report.inventory.reduce((n,x)=>n+x.size,0),outputBytes:report.results.reduce((n,x)=>n+x.outputBytes,0),success:report.results.filter(x=>x.status==="success").length,failed:report.results.filter(x=>x.status==="failed").length,skipped:report.results.filter(x=>x.status==="skipped").length};
await writeFile(`r2-migration-${report.mode}.json`,JSON.stringify(report,null,2)); console.log(JSON.stringify(report.summary,null,2));
