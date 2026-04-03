import React, { useRef, useState } from "react";
import { FileImage, FileText, UploadCloud } from "lucide-react";
import SurfaceButton from "../ui/SurfaceButton";

function isImageFile(file) {
  return Boolean(file?.type?.startsWith("image/"));
}

export default function FileUploadCard({
  label,
  helperText,
  file,
  previewUrl,
  onFileSelect,
  disabled = false,
}) {
  const inputRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleFiles(nextFile) {
    if (!nextFile) {
      return;
    }

    onFileSelect(nextFile);
  }

  function handleDrop(event) {
    event.preventDefault();
    setIsDragging(false);
    handleFiles(event.dataTransfer.files?.[0]);
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-slate-700">{label}</p>
        <p className="mt-1 text-sm text-slate-500">{helperText}</p>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) {
            setIsDragging(true);
          }
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`rounded-2xl border border-dashed bg-slate-50 p-5 transition-colors duration-200 ${
          isDragging ? "border-blue-300 bg-blue-50" : "border-slate-200"
        } ${disabled ? "cursor-not-allowed opacity-70" : ""}`}
      >
        {file ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            {previewUrl && isImageFile(file) ? (
              <img
                src={previewUrl}
                alt={file.name}
                className="h-20 w-20 rounded-xl border border-slate-200 object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500">
                <FileText size={26} />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">{file.name}</p>
              <p className="mt-1 text-sm text-slate-500">
                {isImageFile(file) ? "Preview available" : "File ready for verification"}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-slate-500 shadow-sm">
              <UploadCloud size={22} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Drag and drop your proof here
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Upload a screenshot of your app profile or your worker ID card
              </p>
            </div>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        disabled={disabled}
        onChange={(event) => handleFiles(event.target.files?.[0])}
      />

      <SurfaceButton
        type="button"
        variant="secondary"
        leftIcon={file ? FileImage : UploadCloud}
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        className="w-full sm:w-auto"
      >
        {file ? "Replace file" : "Upload Proof"}
      </SurfaceButton>
    </div>
  );
}
