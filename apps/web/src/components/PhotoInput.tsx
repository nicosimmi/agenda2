import { secondaryButtonClass } from "../ui.tsx";

/** Botón para elegir una o varias fotos del dispositivo (o hacerla con la cámara en el móvil). */
export function PhotoInput({
  label,
  multiple = false,
  disabled = false,
  onFiles,
}: {
  label: string;
  multiple?: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
}) {
  return (
    <label
      className={`${secondaryButtonClass} focus-within:ring-gold inline-block focus-within:ring-2 ${
        disabled ? "pointer-events-none opacity-50" : ""
      }`}
    >
      {label}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple={multiple}
        disabled={disabled}
        className="sr-only"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = ""; // permite volver a elegir el mismo archivo
          if (files.length) onFiles(files);
        }}
      />
    </label>
  );
}
