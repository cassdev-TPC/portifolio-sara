import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { ArrowUpRight, Film, Info, X } from "lucide-react";
import { DEFAULT_VIDEO_CATEGORIES, uploadProcessedGalleryItem } from "../../lib/gallery";
import { processVideo, validateVideo } from "../../lib/mediaProcessing";
import { FieldLabel, FilePicker, ProgressBar, StatusMessage, mono, serif, ui } from "./adminUi";

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

  const selectFiles = (selected: File[]) => {
    const incompatible = selected.filter((file) => { try { validateVideo(file); return false; } catch { return true; } });
    setFiles(selected.filter((file) => !incompatible.includes(file)));
    setFailed([]);
    setMessage("");
    setError("");
    if (incompatible.length) setError(`${incompatible.length} arquivo(s) incompatível(is). Envie MP4 com vídeo H.264; MOV não é aceito neste momento.`);
  };

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
    const failureMessages: string[] = [];

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
        } catch (uploadError) {
          failures.push(selectedFile);
          failureMessages.push(`${selectedFile.name}: ${getErrorMessage(uploadError)}`);
        }
      }
      setFailed(failures);
      setError(failures.length ? `${failures.length} vídeo${failures.length > 1 ? "s falharam" : " falhou"}. ${failureMessages.join(" ")} Tente novamente somente esses arquivos.` : "");
      setMessage(`${uploadedCount} vídeo${uploadedCount === 1 ? " enviado" : "s enviados"} com sucesso.`);
      setFiles(failures);
      if (!failures.length) {
        setCategory(DEFAULT_VIDEO_CATEGORIES[0] ?? "Serviços e Produtos");
        setDescription("");
        form.reset();
      }
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
    <form onSubmit={submit} className={`${ui.panel} space-y-5`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={ui.eyebrow} style={mono}>Novo envio</p>
          <h2 className="mt-1 text-2xl" style={serif}>Adicionar vídeos</h2>
        </div>
        {files.length > 0 && <span className={ui.chip}>{files.length} selecionado{files.length > 1 ? "s" : ""}</span>}
      </div>

      <div className="flex flex-col gap-2 text-sm">
        <FieldLabel>Arquivos</FieldLabel>
        <FilePicker
          accept="video/*"
          title="Clique ou arraste vídeos aqui"
          hint="MP4 com vídeo H.264"
          icon={<Film size={22} aria-hidden="true" />}
          disabled={loading}
          onFiles={selectFiles}
        />
        {files.length > 0 && (
          <>
            <span className="text-xs text-muted-foreground">
              {files.length} vídeo{files.length > 1 ? "s selecionados" : " selecionado"} · total aproximado: {formatFileSize(totalSize)}.
            </span>
            <ul className="space-y-1.5">
              {files.map((file) => (
                <li key={`${file.name}-${file.lastModified}`} className="flex items-center gap-3 rounded-xl border border-border bg-background/60 px-3 py-2 text-xs">
                  <Film size={14} className="shrink-0 text-accent" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{file.name}</span>
                  <span className="shrink-0 text-muted-foreground" style={mono}>{formatFileSize(file.size)}</span>
                  {!loading && (
                    <button type="button" onClick={() => setFiles((current) => current.filter((item) => item !== file))} className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-destructive" aria-label={`Remover ${file.name} da seleção`}>
                      <X size={12} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
        <span className="flex items-start gap-2 text-xs text-muted-foreground">
          <Info size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
          Vídeos grandes podem levar alguns minutos. Mantenha a página aberta até a mensagem de sucesso.
        </span>
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
          {DEFAULT_VIDEO_CATEGORIES.filter((cat) => cat !== "Todos").map((cat) => (
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
          Essa descrição será aplicada em todos os vídeos selecionados neste envio.
        </span>
      </label>

      <StatusMessage error={error} message={message} />
      {loading && <ProgressBar value={progress} />}

      <button type="submit" className={ui.primaryButton} disabled={loading}>
        {loading ? "Gerando capa e enviando..." : failed.length ? "Tentar novamente os que falharam" : `Enviar ${files.length > 1 ? "vídeos" : "vídeo"}`} <ArrowUpRight size={16} />
      </button>
    </form>
  );
}
