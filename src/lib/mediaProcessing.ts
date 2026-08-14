export type ProcessedPhoto = {
  original: File;
  optimized: File;
  thumbnail: File;
  width: number;
  height: number;
};

export type ProcessedVideo = {
  original: File;
  poster: File;
  width: number;
  height: number;
  duration: number;
};

function replaceExtension(name: string, extension: string) {
  return name.replace(/\.[^.]+$/, "") + extension;
}

function canvasToFile(canvas: HTMLCanvasElement, name: string, type: string, quality: number) {
  return new Promise<File>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error("O navegador não conseguiu gerar a versão otimizada."));
      resolve(new File([blob], name, { type, lastModified: Date.now() }));
    }, type, quality);
  });
}

async function drawResized(source: CanvasImageSource, width: number, height: number, maxWidth: number) {
  const scale = Math.min(1, maxWidth / width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("O navegador não oferece processamento de imagem.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function processPhoto(file: File): Promise<ProcessedPhoto> {
  if (!file.type.startsWith("image/")) throw new Error("Selecione um arquivo de imagem válido.");
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const optimizedCanvas = await drawResized(bitmap, bitmap.width, bitmap.height, 2560);
    const thumbnailCanvas = await drawResized(bitmap, bitmap.width, bitmap.height, 800);
    const optimized = await canvasToFile(optimizedCanvas, replaceExtension(file.name, ".webp"), "image/webp", 0.88);
    const thumbnail = await canvasToFile(thumbnailCanvas, replaceExtension(file.name, ".webp"), "image/webp", 0.82);
    return { original: file, optimized, thumbnail, width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
}

export function validateVideo(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension !== "mp4" || !["video/mp4", "application/mp4", ""].includes(file.type)) {
    throw new Error("Formato incompatível. Envie um vídeo MP4 (H.264). Arquivos MOV devem ser convertidos antes do envio.");
  }
}

export async function processVideo(file: File): Promise<ProcessedVideo> {
  validateVideo(file);
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "metadata";
  video.src = url;

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Não foi possível ler o MP4. Confirme que ele usa vídeo H.264."));
    });
    video.currentTime = Math.min(Math.max(video.duration * 0.1, 0.1), 2);
    await new Promise<void>((resolve, reject) => {
      video.onseeked = () => resolve();
      video.onerror = () => reject(new Error("Não foi possível gerar a capa deste vídeo."));
    });
    const canvas = await drawResized(video, video.videoWidth, video.videoHeight, 960);
    const poster = await canvasToFile(canvas, replaceExtension(file.name, ".webp"), "image/webp", 0.84);
    return { original: file, poster, width: video.videoWidth, height: video.videoHeight, duration: video.duration };
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}
