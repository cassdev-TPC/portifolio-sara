import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { ArrowUpRight } from "lucide-react";
import { DEFAULT_VIDEO_CATEGORIES, uploadGalleryItem } from "../../lib/gallery";

type UploadVideoProps = {
  onUploaded: () => void;
};

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export default function UploadVideo({ onUploaded }: UploadVideoProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [category, setCategory] = useState(DEFAULT_VIDEO_CATEGORIES[0] ?? "Serviços e Produtos");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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

    try {
      setLoading(true);

      for (const [index, selectedFile] of files.entries()) {
        setMessage(`Enviando ${index + 1} de ${files.length}: ${selectedFile.name} (${formatFileSize(selectedFile.size)})`);
        await uploadGalleryItem("videos", selectedFile, category);
        uploadedCount += 1;
      }

      setError("");
      setMessage(`${files.length} vídeo${files.length > 1 ? "s" : ""} adicionado${files.length > 1 ? "s" : ""} com sucesso.`);
      setFiles([]);
      setCategory(DEFAULT_VIDEO_CATEGORIES[0] ?? "Serviços e Produtos");
      form.reset();
      onUploaded();
    } catch {
      setMessage("");
      setError(
        uploadedCount > 0
          ? `${uploadedCount} vídeo${uploadedCount > 1 ? "s foram enviados" : " foi enviado"}, mas um falhou. Tente enviar novamente o arquivo que faltou.`
          : "Não foi possível enviar os vídeos. Confirme as variáveis do Cloudflare R2 e a política CORS do bucket."
      );
      if (uploadedCount > 0) onUploaded();
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="bg-card border border-border p-5 md:p-6 space-y-4">
      <h2 className="text-2xl" style={{ fontFamily: "DM Serif Display, serif" }}>Adicionar vídeos</h2>
      <label className="flex flex-col gap-2 text-sm">
        <span className="text-xs tracking-widest uppercase text-muted-foreground" style={{ fontFamily: "DM Mono, monospace" }}>Arquivos</span>
        <input
          type="file"
          accept="video/*"
          multiple
          onChange={(event) => {
            setFiles(Array.from(event.target.files ?? []));
            setMessage("");
            setError("");
          }}
          className="border border-border bg-background px-3 py-2 text-sm"
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
          className="border border-border bg-background px-3 py-2 text-sm"
        >
          {DEFAULT_VIDEO_CATEGORIES.filter((cat) => cat !== "Todos").map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </label>
      {error ? <p className="text-sm text-accent">{error}</p> : message && <p className="text-sm text-muted-foreground">{message}</p>}
      <button
        className="inline-flex items-center gap-2 px-5 py-3 bg-primary text-primary-foreground text-sm tracking-wide hover:bg-accent hover:text-accent-foreground transition-all disabled:opacity-50"
        disabled={loading}
      >
        {loading ? "Enviando..." : `Enviar ${files.length > 1 ? "vídeos" : "vídeo"}`} <ArrowUpRight size={15} />
      </button>
    </form>
  );
}
