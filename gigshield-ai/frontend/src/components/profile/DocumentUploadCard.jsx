import React, { useRef } from "react";
import { FileText, Upload } from "lucide-react";
import StatusBadge from "../ui/StatusBadge";
import SurfaceButton from "../ui/SurfaceButton";

export default function DocumentUploadCard({
  title,
  description,
  required = false,
  accept,
  icon: Icon = FileText,
  status,
  fileName,
  previewUrl,
  onUpload,
}) {
  const inputRef = useRef(null);

  function handleChange(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    onUpload(file);
    event.target.value = "";
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
            <Icon size={18} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-slate-900">{title}</h3>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                {required ? "Required" : "Optional"}
              </span>
            </div>
            <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
          </div>
        </div>

        <StatusBadge status={status} />
      </div>

      <div className="mt-5 rounded-2xl bg-slate-50 p-4">
        {previewUrl ? (
          <div className="flex items-center gap-4">
            <img
              src={previewUrl}
              alt={title}
              className="h-14 w-14 rounded-xl object-cover"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{fileName}</p>
              <p className="text-sm text-slate-500">Preview available</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm">
              <FileText size={18} />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">
                {fileName || "No file uploaded"}
              </p>
              <p className="text-sm text-slate-500">
                {fileName ? "Document received" : "Upload a clear file"}
              </p>
            </div>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleChange}
      />

      <SurfaceButton
        onClick={() => inputRef.current?.click()}
        variant="secondary"
        leftIcon={Upload}
        className="mt-5 w-full sm:w-auto"
      >
        {fileName ? "Replace document" : "Upload document"}
      </SurfaceButton>
    </div>
  );
}
