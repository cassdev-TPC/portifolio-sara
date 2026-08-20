import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { ArrowUpRight } from "lucide-react";
import { DEFAULT_VIDEO_CATEGORIES, uploadProcessedGalleryItem } from "../../lib/gallery";
import { processVideo, validateVideo } from "../../lib/mediaProcessing";

type UploadVideoProps = {
  onUploaded: () => void;
};

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : "Erro inesperado.";
}

export default function UploadVideo({ onUploaded }: UploadVideoProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [category, setCategory] = useState(DEFAULT_VIDEO_CATEGORIES[0] ?? "Serviços e Produtos");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState<File[]>([]);

  const totalSize = useMemo(() => files.reduce((sum, file) => sum + file.size, 0), [files]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    setMessage("");
    setError("");

    if (files.length === 0) {
      setError("Selecione pelo menos um vídeo.");
      return;
    }

    let uploadedCount = 0;
    const failures: File[] = [];

    try {
      setLoading(true);

      for (const [index, selectedFile] of files.entries()) {
        try {
          setMessage(`Gerando capa ${index + 1} de ${files.length}: ${selectedFile.name}`);
          const processed = await processVideo(selectedFile);
          await uploadProcessedGalleryItem("videos", category, [
            { variant: "original", file: processed.original },
            { variant: "poster", file: processed.poster },
          ], { width: processed.width, height: processed.height, duration: processed.duration, mediaType: "video", codec: "H.264" }, {
            description,
            onProgress: ({ stage, percent }) => { setMessage(`${stage}: ${selectedFile.name}`); setProgress(percent); },
          });
          uploadedCount += 1;
        } catch { failures.push(selectedFile); }
      }
      setFailed(failures);
      setError(failures.length ? `${failures.length} vídeo${failures.length > 1 ? "s falharam" : " falhou"}. Tente novamente somente esses arquivos.` : "");
      setMessage(`${uploadedCount} vídeo${uploadedCount === 1 ? " enviado" : "s enviados"} com sucesso.`);
      setFiles(failures);
      setCategory(DEFAULT_VIDEO_CATEGORIES[0] ?? "Serviços e Produtos");
      setDescription("");
      form.reset();
      onUploaded();
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      setMessage("");
      setError(
        uploadedCount > 0
          ? `${uploadedCount} vídeo${uploadedCount > 1 ? "s foram enviados" : " foi enviado"}, mas um falhou: ${errorMessage}`
          : `Não foi possível enviar os vídeos: ${errorMessage}`
      );
      if (uploadedCount > 0) onUploaded();
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="min-w-0 w-full bg-card border border-border p-5 md:p-6 space-y-4 rounded-2xl">
      <h2 className="text-2xl" style={{ fontFamily: "DM Serif Display, serif" }}>Adicionar vídeos</h2>
      <label className="flex flex-col gap-2 text-sm">
        <span className="text-xs tracking-widest uppercase text-muted-foreground" style={{ fontFamily: "DM Mono, monospace" }}>Arquivos</span>
        <input
          type="file"
          accept="video/*"
          multiple
          onChange={(event) => {
            const selected = Array.from(event.target.files ?? []);
            const incompatible = selected.filter((file) => { try { validateVideo(file); return false; } catch { return true; } });
            setFiles(selected.filter((file) => !incompatible.includes(file)));
            setFailed([]);
            setMessage("");
            setError("");
            if (incompatible.length) setError(`${incompatible.length} arquivo(s) incompatível(is). Envie MP4 com vídeo H.264; MOV não é aceito neste momento.`);
          }}
          className="w-full min-w-0 max-w-full border border-border bg-background px-3 py-2 text-sm rounded-xl"
        />
        {files.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {files.length} vídeo{files.length > 1 ? "s selecionados" : " selecionado"} · total aproximado: {formatFileSize(totalSize)}.
          </span>
        )}
        <span className="text-xs text-muted-foreground">
          Vídeos grandes podem levar alguns minutos. Mantenha a página aberta até a mensagem de sucesso.
        </span>
      </label>
      <label className="flex flex-col gap-2 text-sm">
        <span className="text-xs tracking-widest uppercase text-muted-foreground" style={{ fontFamily: "DM Mono, monospace" }}>Categoria</span>
        <select
          value={category}
          onChange={(event) => {
            setCategory(event.target.value);
            setMessage("");
            setError("");
          }}
          className="w-full min-w-0 max-w-full border border-border bg-background px-3 py-2 text-sm rounded-xl"
        >
          {DEFAULT_VIDEO_CATEGORIES.filter((cat) => cat !== "Todos").map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-2 text-sm">
        <span className="text-xs tracking-widest uppercase text-muted-foreground" style={{ fontFamily: "DM Mono, monospace" }}>Descrição</span>
        <textarea
          value={description}
          onChange={(event) => {
            setDescription(event.target.value);
            setMessage("");
            setError("");
          }}
          rows={4}
          maxLength={240}
          placeholder="Escreva uma descrição curta para aparecer na galeria."
          className="w-full min-w-0 max-w-full border border-border bg-background px-3 py-2 text-sm resize-y rounded-xl"
        />
        <span className="text-xs text-muted-foreground">
          Essa descrição será aplicada em todos os vídeos selecionados neste envio.
        </span>
      </label>
      <div aria-live="polite">{error ? <p className="text-sm text-destructive">{error}</p> : message && <p className="text-sm text-muted-foreground">{message}</p>}</div>
      {loading && <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Progresso do envio" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><div className="h-full bg-accent transition-all" style={{ width: `${progress}%` }} /></div>}
      <button
        type="submit"
        className="inline-flex items-center gap-2 px-5 py-3 bg-primary text-primary-foreground text-sm tracking-wide hover:bg-accent hover:text-accent-foreground transition-all disabled:opacity-50 rounded-full"
        disabled={loading}
      >
        {loading ? "Gerando capa e enviando..." : failed.length ? "Tentar novamente os que falharam" : `Enviar ${files.length > 1 ? "vídeos" : "vídeo"}`} <ArrowUpRight size={15} />
      </button>
    </form>
  );
}
