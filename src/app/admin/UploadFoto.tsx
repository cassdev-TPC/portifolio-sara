import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { ArrowUpRight, ImagePlus, X } from "lucide-react";
import { DEFAULT_PHOTO_CATEGORIES, uploadProcessedGalleryItem } from "../../lib/gallery";
import { processPhoto } from "../../lib/mediaProcessing";
import { FieldLabel, FilePicker, ProgressBar, StatusMessage, mono, serif, ui } from "./adminUi";

type UploadFotoProps = {
  onUploaded: () => void;
};

function getErrorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : "Erro inesperado.";
}

function PhotoPreviews({ files, onRemove, disabled }: { files: File[]; onRemove: (file: File) => void; disabled: boolean }) {
  const previews = useMemo(() => files.map((file) => ({ file, url: URL.createObjectURL(file) })), [files]);
  useEffect(() => () => previews.forEach(({ url }) => URL.revokeObjectURL(url)), [previews]);
  return (
    <div className="grid grid-cols-4 gap-2">
      {previews.map(({ file, url }) => (
        <div key={`${file.name}-${file.lastModified}`} className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-muted">
          <img src={url} alt={`Prévia de ${file.name}`} className="h-full w-full object-cover" />
          {!disabled && (
            <button
              type="button"
              onClick={() => onRemove(file)}
              className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white opacity-100 transition-opacity hover:bg-destructive sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
              aria-label={`Remover ${file.name} da seleção`}
            >
              <X size={12} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export default function UploadFoto({ onUploaded }: UploadFotoProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [category, setCategory] = useState(DEFAULT_PHOTO_CATEGORIES[1] ?? "Retrato");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState<File[]>([]);

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
    const failures: File[] = [];
    const failureMessages: string[] = [];

    try {
      setLoading(true);

      for (const [index, selectedFile] of files.entries()) {
        try {
          setMessage(`Processando ${index + 1} de ${files.length}: ${selectedFile.name}`);
          setProgress(0);
          const processed = await processPhoto(selectedFile);
          await uploadProcessedGalleryItem("photos", category, [
            { variant: "original", file: processed.original },
            { variant: "optimized", file: processed.optimized },
            { variant: "thumbnail", file: processed.thumbnail },
          ], { width: processed.width, height: processed.height, mediaType: "photo" }, {
            description,
            onProgress: ({ stage, percent }) => { setMessage(`${stage}: ${selectedFile.name}`); setProgress(percent); },
          });
          uploadedCount += 1;
        } catch (uploadError) {
          failures.push(selectedFile);
          failureMessages.push(`${selectedFile.name}: ${getErrorMessage(uploadError)}`);
        }
      }
      setFailed(failures);
      setError(
        failures.length
          ? `${failures.length} foto${failures.length > 1 ? "s falharam" : " falhou"}. ${failureMessages.join(" ")} Você pode tentar novamente somente essas.`
          : ""
      );
      setMessage(`${uploadedCount} foto${uploadedCount === 1 ? " enviada" : "s enviadas"} com sucesso.`);
      setFiles(failures);
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
    <form onSubmit={submit} className={`${ui.panel} space-y-5`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={ui.eyebrow} style={mono}>Novo envio</p>
          <h2 className="mt-1 text-2xl" style={serif}>Adicionar fotos</h2>
        </div>
        {files.length > 0 && <span className={ui.chip}>{files.length} selecionada{files.length > 1 ? "s" : ""}</span>}
      </div>

      <div className="flex flex-col gap-2 text-sm">
        <FieldLabel>Arquivos</FieldLabel>
        <FilePicker
          accept="image/*"
          title="Clique ou arraste fotos aqui"
          hint="JPG, PNG ou WEBP · várias de uma vez"
          icon={<ImagePlus size={22} aria-hidden="true" />}
          disabled={loading}
          onFiles={(selected) => {
            setFiles(selected);
            setMessage("");
            setError("");
          }}
        />
        {files.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {files.length} foto{files.length > 1 ? "s selecionadas" : " selecionada"}.
          </span>
        )}
        {files.length > 0 && <PhotoPreviews files={files} disabled={loading} onRemove={(file) => setFiles((current) => current.filter((item) => item !== file))} />}
      </div>

      <label className="flex flex-col gap-2 text-sm">
        <FieldLabel>Categoria</FieldLabel>
        <select
          value={category}
          onChange={(event) => {
            setCategory(event.target.value);
            setMessage("");
            setError("");
          }}
          className={ui.field}
        >
          {DEFAULT_PHOTO_CATEGORIES.filter((cat) => cat !== "Todos").map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-2 text-sm">
        <span className="flex items-center justify-between">
          <FieldLabel>Descrição</FieldLabel>
          <span className="text-[11px] text-muted-foreground" style={mono}>{description.length}/240</span>
        </span>
        <textarea
          value={description}
          onChange={(event) => {
            setDescription(event.target.value);
            setMessage("");
            setError("");
          }}
          rows={3}
          maxLength={240}
          placeholder="Escreva uma descrição curta para aparecer na galeria."
          className={`${ui.field} resize-y`}
        />
        <span className="text-xs text-muted-foreground">
          Essa descrição será aplicada em todas as fotos selecionadas neste envio.
        </span>
      </label>

      <StatusMessage error={error} message={message} />
      {loading && <ProgressBar value={progress} />}

      <button type="submit" className={ui.primaryButton} disabled={loading}>
        {loading ? "Processando e enviando..." : failed.length ? "Tentar novamente as que falharam" : `Enviar ${files.length > 1 ? "fotos" : "foto"}`} <ArrowUpRight size={16} />
      </button>
    </form>
  );
}
