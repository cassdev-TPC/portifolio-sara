import { useState } from "react";
import type { FormEvent } from "react";
import { ArrowUpRight } from "lucide-react";
import { uploadGalleryItem } from "../../lib/gallery";

type UploadFotoProps = {
  onUploaded: () => void;
};

export default function UploadFoto({ onUploaded }: UploadFotoProps) {
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!file) {
      setError("Selecione uma foto.");
      return;
    }

    try {
      setLoading(true);
      await uploadGalleryItem("photos", file, category);
      setMessage("Foto adicionada com sucesso.");
      setFile(null);
      setCategory("");
      event.currentTarget.reset();
      onUploaded();
    } catch {
      setError("Não foi possível enviar a foto.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="bg-card border border-border p-5 md:p-6 space-y-4">
      <h2 className="text-2xl" style={{ fontFamily: "DM Serif Display, serif" }}>Adicionar foto</h2>
      <label className="flex flex-col gap-2 text-sm">
        <span className="text-xs tracking-widest uppercase text-muted-foreground" style={{ fontFamily: "DM Mono, monospace" }}>Arquivo</span>
        <input
          type="file"
          accept="image/*"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="border border-border bg-background px-3 py-2 text-sm"
        />
      </label>
      <label className="flex flex-col gap-2 text-sm">
        <span className="text-xs tracking-widest uppercase text-muted-foreground" style={{ fontFamily: "DM Mono, monospace" }}>Categoria</span>
        <input
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          placeholder="Produtos, Eventos, Retratos..."
          className="border border-border bg-background px-3 py-2 text-sm"
        />
      </label>
      {message && <p className="text-sm text-muted-foreground">{message}</p>}
      {error && <p className="text-sm text-accent">{error}</p>}
      <button
        className="inline-flex items-center gap-2 px-5 py-3 bg-primary text-primary-foreground text-sm tracking-wide hover:bg-accent hover:text-accent-foreground transition-all disabled:opacity-50"
        disabled={loading}
      >
        {loading ? "Enviando..." : "Enviar foto"} <ArrowUpRight size={15} />
      </button>
    </form>
  );
}
