import { useRef, useState } from "react";
import type { DragEvent, ReactNode } from "react";
import { UploadCloud } from "lucide-react";

export const mono = { fontFamily: "DM Mono, monospace" };
export const serif = { fontFamily: "DM Serif Display, serif" };

export const ui = {
  panel: "min-w-0 w-full rounded-3xl border border-border bg-card/80 p-5 shadow-[0_18px_50px_rgba(18,9,26,0.08)] backdrop-blur md:p-6",
  eyebrow: "text-[11px] uppercase tracking-[0.25em] text-accent",
  label: "text-[11px] uppercase tracking-widest text-muted-foreground",
  field: "w-full min-w-0 max-w-full rounded-2xl border border-border bg-background/70 px-4 py-3 text-sm text-foreground transition-all focus:border-accent focus:bg-background focus:outline-none focus:shadow-[0_0_0_4px_var(--ring)]",
  primaryButton: "btn-modern inline-flex w-full items-center justify-center gap-2 bg-primary px-5 py-3.5 text-sm font-semibold tracking-wide text-primary-foreground hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50",
  ghostButton: "inline-flex min-h-10 items-center gap-2 rounded-full border border-border px-4 py-2 text-sm transition-colors hover:border-accent hover:text-accent disabled:opacity-50",
  chip: "inline-flex items-center rounded-full bg-primary/12 px-3 py-1 text-xs font-semibold text-accent",
};

export function FieldLabel({ children }: { children: ReactNode }) {
  return <span className={ui.label} style={mono}>{children}</span>;
}

export function StatusMessage({ error, message }: { error: string; message: string }) {
  return (
    <div aria-live="polite">
      {error ? (
        <p className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>
      ) : message ? (
        <p className="rounded-2xl border border-border bg-muted/60 px-4 py-3 text-sm text-muted-foreground">{message}</p>
      ) : null}
    </div>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="space-y-1.5">
      <div className="h-2.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Progresso do envio" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-300" style={{ width: `${value}%` }} />
      </div>
      <p className="text-right text-[11px] text-muted-foreground" style={mono}>{value}%</p>
    </div>
  );
}

type FilePickerProps = {
  accept: string;
  title: string;
  hint: string;
  icon?: ReactNode;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
};

/** Área de seleção de arquivos: clique para escolher ou arraste os arquivos para cá. */
export function FilePicker({ accept, title, hint, icon, disabled = false, onFiles }: FilePickerProps) {
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);

  const accepts = (file: File) => accept.split(",").some((rule) => {
    const value = rule.trim();
    return value.endsWith("/*") ? file.type.startsWith(value.slice(0, -1)) : file.type === value;
  });

  const isFileDrag = (event: DragEvent) => Array.from(event.dataTransfer.types).includes("Files");

  return (
    <label
      onDragEnter={(event) => { if (!isFileDrag(event) || disabled) return; event.preventDefault(); depth.current += 1; setDragging(true); }}
      onDragOver={(event) => { if (!isFileDrag(event) || disabled) return; event.preventDefault(); event.dataTransfer.dropEffect = "copy"; }}
      onDragLeave={() => { depth.current = Math.max(0, depth.current - 1); if (!depth.current) setDragging(false); }}
      onDrop={(event) => {
        if (!isFileDrag(event) || disabled) return;
        event.preventDefault();
        depth.current = 0;
        setDragging(false);
        const files = Array.from(event.dataTransfer.files).filter(accepts);
        if (files.length) onFiles(files);
      }}
      className={[
        "group relative flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-5 py-8 text-center transition-all",
        "focus-within:border-accent focus-within:shadow-[0_0_0_4px_var(--ring)]",
        dragging ? "border-accent bg-accent/10 scale-[1.01]" : "border-border bg-background/50 hover:border-accent/70 hover:bg-accent/5",
        disabled ? "pointer-events-none opacity-50" : "",
      ].join(" ")}
    >
      <span className={`flex h-12 w-12 items-center justify-center rounded-2xl transition-colors ${dragging ? "bg-accent text-accent-foreground" : "bg-primary/15 text-accent group-hover:bg-primary/25"}`}>
        {icon ?? <UploadCloud size={22} aria-hidden="true" />}
      </span>
      <span className="space-y-1">
        <span className="block text-sm font-semibold text-foreground">{dragging ? "Solte os arquivos aqui" : title}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
      <input
        type="file"
        accept={accept}
        multiple
        disabled={disabled}
        onChange={(event) => {
          onFiles(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
        className="sr-only"
      />
    </label>
  );
}
