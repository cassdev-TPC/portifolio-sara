import { useState } from "react";
import type { FormEvent } from "react";
import { ArrowUpRight } from "lucide-react";
import { DEFAULT_PHOTO_CATEGORIES, uploadGalleryItem } from "../../lib/gallery";

type UploadFotoProps = {
  onUploaded: () => void;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : "Erro inesperado.";
}

export default function UploadFoto({ onUploaded }: UploadFotoProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [category, setCategory] = useState(DEFAULT_PHOTO_CATEGORIES[1] ?? "Retrato");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    setMessage("");
    setError("");

    if (files.length === 0) {
      setError("Selecione pelo menos uma foto.");
      return;
    }

    let uploadedCount = 0;

    try {
      setLoading(true);

      for (const [index, selectedFile] of files.entries()) {
        setMessage(`Enviando ${index + 1} de ${files.length}: ${selectedFile.name}`);
        await uploadGalleryItem("photos", selectedFile, category, description);
        uploadedCount += 1;
      }

      setError("");
      setMessage(`${files.length} foto${files.length > 1 ? "s" : ""} adicionada${files.length > 1 ? "s" : ""} com sucesso.`);
      setFiles([]);
      setCategory(DEFAULT_PHOTO_CATEGORIES[1] ?? "Retrato");
      setDescription("");
      form.reset();
      onUploaded();
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      setMessage("");
      setError(
        uploadedCount > 0
          ? `${uploadedCount} foto${uploadedCount > 1 ? "s foram enviadas" : " foi enviada"}, mas uma falhou: ${errorMessage}`
          : `Não foi possível enviar as fotos: ${errorMessage}`
      );
      if (uploadedCount > 0) onUploaded();
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="bg-card border border-border p-5 md:p-6 space-y-4 rounded-2xl">
      <h2 className="text-2xl" style={{ fontFamily: "DM Serif Display, serif" }}>Adicionar fotos</h2>
      <label className="flex flex-col gap-2 text-sm">
        <span className="text-xs tracking-widest uppercase text-muted-foreground" style={{ fontFamily: "DM Mono, monospace" }}>Arquivos</span>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(event) => {
            setFiles(Array.from(event.target.files ?? []));
            setMessage("");
            setError("");
          }}
          className="border border-border bg-background px-3 py-2 text-sm rounded-xl"
        />
        {files.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {files.length} foto{files.length > 1 ? "s selecionadas" : " selecionada"}.
          </span>
        )}
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
          className="border border-border bg-background px-3 py-2 text-sm rounded-xl"
        >
          {DEFAULT_PHOTO_CATEGORIES.filter((cat) => cat !== "Todos").map((cat) => (
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
          className="border border-border bg-background px-3 py-2 text-sm resize-y rounded-xl"
        />
        <span className="text-xs text-muted-foreground">
          Essa descrição será aplicada em todas as fotos selecionadas neste envio.
        </span>
      </label>
      {error ? <p className="text-sm text-accent">{error}</p> : message && <p className="text-sm text-muted-foreground">{message}</p>}
      <button
        className="inline-flex items-center gap-2 px-5 py-3 bg-primary text-primary-foreground text-sm tracking-wide hover:bg-accent hover:text-accent-foreground transition-all disabled:opacity-50 rounded-full"
        disabled={loading}
      >
        {loading ? "Enviando..." : `Enviar ${files.length > 1 ? "fotos" : "foto"}`} <ArrowUpRight size={15} />
      </button>
    </form>
  );
}
